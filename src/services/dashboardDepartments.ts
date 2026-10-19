import { supabase } from "./supabase";
import type { DepartmentOwner, DepartmentRecord } from "../types";

/**
 * Slugs dos departamentos padrão (espelha departmentService.STANDARD_DEPARTMENTS;
 * mantido local para o Dashboard não depender desse módulo).
 */
const STANDARD_SLUGS = [
  "contas",
  "indicadores",
  "audio-e-video",
  "batismo",
  "primeiros-socorros",
  "informacoes-e-servico-voluntario",
  "achados-perdidos-e-guarda-volumes",
  "montagem",
  "estacionamento",
  "hospedagem",
  "seguranca",
  "transporte-e-equipamentos",
];

/** Eventos já reparados nesta sessão (evita repetir escrita a cada load). */
const healedEventos = new Set<string>();

/**
 * Departamentos padrão lidos direto de `departments` (leitura pública).
 * Rede de segurança: a grade NUNCA pode ficar vazia por problemas em
 * evento_departamentos (links vazios/faltantes/ilegíveis).
 */
async function fetchStandardDepartments(): Promise<DepartmentRecord[]> {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, slug, coordenador_id")
      .in("slug", STANDARD_SLUGS);
    if (error) {
      console.warn("Falha ao buscar departamentos padrão:", error.message);
      return [];
    }
    return Array.isArray(data) ? (data as DepartmentRecord[]) : [];
  } catch (error) {
    console.warn("Falha ao buscar departamentos padrão:", (error as Error)?.message);
    return [];
  }
}

/**
 * Repara em background os vínculos padrão que faltarem no evento.
 * A exibição já foi resolvida antes (union) — isto só persiste a correção.
 */
function healEventLinks(eventoId: string): void {
  if (!eventoId || healedEventos.has(eventoId)) return;
  healedEventos.add(eventoId);
  import("./departmentService")
    .then((mod) => mod.linkStandardDepartmentsToEvento?.(eventoId))
    .then((result) => {
      if (result && result.linked > 0) {
        console.info("Vínculos de departamentos reparados no evento:", result.linked);
      }
    })
    .catch((error) => console.warn("Não foi possível reparar os vínculos do evento:", (error as Error)?.message));
}


/**
 * Consulta dos departamentos de um evento, já com o coordenador resolvido.
 *
 * Fica num módulo próprio (e não dentro de Dashboard.jsx) para poder ser
 * mockada nos testes de página — a mesma razão pela qual o Dashboard consome
 * `fetchEventDepartments` como dependência, e não como função local.
 */
export async function fetchOwnersMap(eventoId: string | null | undefined): Promise<Map<string, DepartmentOwner>> {
  if (!eventoId) return new Map();

  // 1. Quem coordena cada departamento do evento — SEM join, porque um join
  //    que falhe (RLS/cache do PostgREST) derrubava o mapa inteiro e fazia
  //    TODOS os cards aparecerem como "Disponível".
  let rows: Array<{ department_id: string; user_id: string | null }> = [];
  try {
    const { data, error } = await supabase
      .from("department_members")
      .select("department_id, user_id")
      .eq("role", "coordenador")
      .eq("evento_id", eventoId);
    if (error) {
      console.warn("Falha ao buscar coordenadores do evento:", error.message);
      return new Map();
    }
    rows = ((Array.isArray(data) ? data : []) as Array<{ department_id?: string | null; user_id?: string | null }>)
      .filter((row): row is { department_id: string; user_id: string | null } => Boolean(row?.department_id))
      .map((row) => ({ department_id: row.department_id as string, user_id: row.user_id ?? null }));
  } catch (error) {
    console.warn("Falha ao buscar coordenadores do evento:", (error as Error)?.message);
    return new Map();
  }

  const map = new Map<string, DepartmentOwner>();
  rows.forEach((row) => {
    map.set(row.department_id, { userId: row.user_id || null, name: null });
  });

  // 2. Nomes dos coordenadores numa segunda consulta tolerante: se falhar,
  //    o card ainda mostra "Ocupado" (sem o nome) em vez de "Disponível".
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))] as string[];
  if (userIds.length === 0) return map;
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", userIds);
    if (error) {
      console.warn("Falha ao buscar nomes dos coordenadores:", error.message);
      return map;
    }
    const namesById = new Map(
      ((Array.isArray(profiles) ? profiles : []) as Array<{ id?: string | null; name?: string | null }>).map((p) => [String(p?.id), p?.name ?? null])
    );
    map.forEach((value) => {
      if (value.userId && namesById.has(value.userId)) {
        value.name = namesById.get(value.userId) || null;
      }
    });
  } catch (error) {
    console.warn("Falha ao buscar nomes dos coordenadores:", (error as Error)?.message);
  }
  return map;
}

/**
 * Resolve o coordenador de um departamento.
 * Prioriza `department_members` do evento (fonte de verdade) e só recorre à
 * coluna legada `departments.coordenador_id` quando não há membership.
 */
export function applyEventOwner(dept: DepartmentRecord, owners: Map<string, DepartmentOwner>): DepartmentRecord {
  const owner = owners.get(dept.id);
  if (owner?.userId) {
    return { ...dept, coordenador_id: owner.userId, ownerName: owner.name, ownerId: owner.userId };
  }
  const fallbackId = dept.coordenador_id ?? null;
  return {
    ...dept,
    coordenador_id: fallbackId,
    ownerName: dept.coordenador?.name ?? null,
    ownerId: fallbackId,
  };
}

/**
 * Departamentos vinculados ao evento, com o coordenador do evento aplicado.
 *
 * A consulta é única e tolerante: o join `department:departments(...)` pode
 * falhar por RLS ou por cache de schema do PostgREST, e nesse caso o erro
 * derrubava a lista inteira, deixando a tela de escolha e a navbar vazias.
 * Se o join falhar, caímos para uma consulta simples de departments.
 */
export async function fetchEventDepartments(eventoId: string | null | undefined): Promise<DepartmentRecord[]> {
  if (!eventoId) return [];

  const ownersPromise = fetchOwnersMap(eventoId);
  const withJoin = await supabase
    .from("evento_departamentos")
    .select("department:departments(id, name, slug, coordenador_id, coordenador:coordenador_id(name))")
    .eq("evento_id", eventoId);

  let list: DepartmentRecord[] = [];
  if (!withJoin.error) {
    list = ((withJoin.data || []) as unknown as Array<{ department: DepartmentRecord | null }>)
      .map((row) => row.department)
      .filter((dept): dept is DepartmentRecord => Boolean(dept));
  } else {
    console.warn("Falha no join de departments do evento, usando consulta simples:", withJoin.error.message);
    const { data: links, error: linkError } = await supabase
      .from("evento_departamentos")
      .select("department_id")
      .eq("evento_id", eventoId);
    if (linkError) {
      // Não damos return aqui: a lista continua vazia e o fallback de
      // departamentos padrão (abaixo) ainda precisa rodar para a grade
      // não ficar em branco para quem não tem vínculo.
      console.warn("Falha ao listar departamentos do evento:", linkError.message);
    }
    const ids = ((links || []) as Array<{ department_id?: string | null }>)
      .map((row) => row.department_id)
      .filter(Boolean) as string[];
    if (ids.length > 0) {
      const { data: depts, error: deptsError } = await supabase
        .from("departments")
        .select("id, name, slug, coordenador_id, coordenador:coordenador_id(name)")
        .in("id", ids);
      if (!deptsError) list = Array.isArray(depts) ? (depts as DepartmentRecord[]) : [];
      else console.warn("Falha ao buscar os departamentos:", deptsError.message);
    }
  }

  // Grade completa: os departamentos padrão precisam aparecer em TODO evento,
  // mesmo que evento_departamentos esteja vazio, incompleto (ex.: só o
  // departamento que alguém assumiu) ou ilegível. Sem isto, quem não tem
  // vínculo nenhum via uma grade vazia.
  const standard = await fetchStandardDepartments();
  if (standard.length > 0) {
    const linkedIds = new Set(list.map((dept) => dept?.id).filter(Boolean) as string[]);
    const missing = standard.filter((dept) => !linkedIds.has(dept.id));
    if (missing.length > 0) {
      list = [...list, ...missing];
      healEventLinks(eventoId);
    }
  }

  const owners = await ownersPromise;
  return list.map((dept) => applyEventOwner(dept, owners));
}

/** Separa os departamentos em três grupos, conforme quem coordena cada um. */
export function groupDepartments(
  deptRecords: DepartmentRecord[],
  userId?: string | null
): { mine: DepartmentRecord[]; takenByOthers: DepartmentRecord[]; available: DepartmentRecord[] } {
  const mine: DepartmentRecord[] = [];
  const takenByOthers: DepartmentRecord[] = [];
  const available: DepartmentRecord[] = [];
  for (const dept of deptRecords) {
    if (!dept) continue;
    if (dept.coordenador_id && dept.coordenador_id === userId) mine.push(dept);
    else if (dept.coordenador_id) takenByOthers.push(dept);
    else available.push(dept);
  }
  return { mine, takenByOthers, available };
}

/** Rótulo do coordenador usado nos cards de departamento ocupado. */
export function ownerLabel(dept?: DepartmentRecord | null): string {
  return dept?.ownerName || dept?.coordenador?.name || "Coordenador";
}
