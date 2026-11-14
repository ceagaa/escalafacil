import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { apiGet, apiRequest, ApiError, type AuthUser } from "../services/api";
import { useEvent } from "./EventContext";
import type { DepartmentMembership, Profile } from "../types";

const DEPT_STORAGE_KEY = "escalafacil_active_department_id";

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  departments: DepartmentMembership[];
  activeDepartment: DepartmentMembership | null;
  loading: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<unknown>;
  signUp: (email: string, password: string, name: string) => Promise<unknown>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  selectDepartment: (dept: DepartmentMembership | null) => void;
  refreshSession: () => Promise<DepartmentMembership[]>;
  refreshDepartments: () => Promise<DepartmentMembership[]>;
  fetchCoordinatedDepartmentIds: (userId: string, eventoId: string) => Promise<string[]>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredDeptId(): string | null {
  try {
    return localStorage.getItem(DEPT_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function storeDeptId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(DEPT_STORAGE_KEY, id);
    } else {
      localStorage.removeItem(DEPT_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { eventoId, eventLoading } = useEvent();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<DepartmentMembership[]>([]);
  const [activeDepartment, setActiveDepartment] = useState<DepartmentMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const deptRestoredRef = useRef(false);

  const eventoIdRef = useRef(eventoId);
  useEffect(() => {
    eventoIdRef.current = eventoId;
  }, [eventoId]);

  const userRef = useRef<AuthUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      return await apiGet<Profile>(`/api/profiles?id=${encodeURIComponent(userId)}`);
    } catch (error) {
      console.warn("Falha ao buscar perfil:", (error as Error)?.message);
      return null;
    }
  }, []);

  const fetchDepartments = useCallback(async (userId: string): Promise<DepartmentMembership[]> => {
    let rows: DepartmentMembership[] = [];
    try {
      const data = await apiGet<DepartmentMembership[]>(
        `/api/members?user_id=${encodeURIComponent(userId)}&include=department`
      );
      rows = Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn("Falha ao buscar departamentos:", (error as Error)?.message);
      return [];
    }
    const activeEventoId = eventoIdRef.current;
    if (!activeEventoId) return rows;
    // Vínculo legado (evento_id NULL) vale como fallback; o vínculo do evento
    // ativo tem prioridade e, quando existe, esconde o legado do mesmo dept.
    const eventRows = rows.filter((row) => row?.evento_id === activeEventoId);
    const eventDeptIds = new Set(
      eventRows.map((row) => row?.department?.id || row?.department_id).filter(Boolean) as string[]
    );
    const legacyRows = rows.filter(
      (row) =>
        !row?.evento_id &&
        !eventDeptIds.has(row?.department?.id || row?.department_id || "")
    );
    return [...eventRows, ...legacyRows];
  }, []);

  /**
   * IDs de departamento que o usuário coordena no evento ativo (fonte de
   * verdade: department_members).
   */
  const fetchCoordinatedDepartmentIds = useCallback(
    async (userId: string, eventoId: string): Promise<string[]> => {
      if (!userId || !eventoId) return [];
      try {
        const data = await apiGet<Array<{ department_id?: string | null }>>(
          `/api/members?user_id=${encodeURIComponent(userId)}&role=coordenador&evento_id=${encodeURIComponent(eventoId)}`
        );
        return (Array.isArray(data) ? data : [])
          .map((row) => row?.department_id)
          .filter(Boolean) as string[];
      } catch (error) {
        console.warn("Falha ao buscar departamentos coordenados:", (error as Error)?.message);
        return [];
      }
    },
    []
  );

  const reconcileActiveDepartment = useCallback((
    depts: DepartmentMembership[],
    prev: DepartmentMembership | null
  ): DepartmentMembership | null => {
    if (!prev) return null;
    const prevDeptId = prev?.department?.id || prev?.id;
    return depts.find(
      (member) => member?.department?.id === prevDeptId
    ) || null;
  }, []);

  function restoreFromStorage(depts: DepartmentMembership[]): void {
    if (deptRestoredRef.current) return;
    deptRestoredRef.current = true;
    const storedDeptId = getStoredDeptId();
    if (!storedDeptId) return;
    const match = depts.find((m) => m?.department?.id === storedDeptId);
    if (match) {
      setActiveDepartment(match);
    } else {
      storeDeptId(null);
    }
  }

  /** Carrega profile + departamentos de um usuário autenticado. */
  const loadUserData = useCallback(
    async (currentUser: AuthUser): Promise<DepartmentMembership[]> => {
      const [profileData, depts] = await Promise.all([
        fetchProfile(currentUser.id),
        fetchDepartments(currentUser.id),
      ]);
      setProfile(profileData);
      setDepartments(depts);
      setActiveDepartment((prev) => (prev ? reconcileActiveDepartment(depts, prev) : prev));
      restoreFromStorage(depts);
      return depts;
    },
    [fetchProfile, fetchDepartments, reconcileActiveDepartment]
  );

  /** Estado limpo de "deslogado". */
  const clearUserData = useCallback((): DepartmentMembership[] => {
    setProfile(null);
    setDepartments([]);
    setActiveDepartment(null);
    storeDeptId(null);
    return [];
  }, []);

  /**
   * Sincroniza o estado com a sessão do servidor (GET /auth/session;
   * o cliente renova o access token automaticamente em 401).
   */
  const refreshSession = useCallback(async (): Promise<DepartmentMembership[]> => {
    let currentUser: AuthUser | null = null;
    try {
      const body = await apiRequest<{ user?: AuthUser | null }>("/auth/session");
      currentUser = body?.user ?? null;
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 401 && error.status !== 0)) {
        console.warn("Erro ao verificar sessão:", (error as Error)?.message);
      }
      currentUser = null;
    }

    setUser(currentUser);
    if (currentUser) {
      try {
        return await loadUserData(currentUser);
      } catch (err) {
        console.warn("Erro ao buscar dados do usuário:", err);
        return [];
      }
    }
    return clearUserData();
  }, [loadUserData, clearUserData]);

  const refreshDepartments = useCallback(async (): Promise<DepartmentMembership[]> => {
    const currentUser = userRef.current;
    if (!currentUser) return [];
    const depts = await fetchDepartments(currentUser.id);
    setDepartments(depts);
    setActiveDepartment((prev) => {
      if (!prev) return null;
      return reconcileActiveDepartment(depts, prev);
    });
    return depts;
  }, [fetchDepartments, reconcileActiveDepartment]);

  // Sessão inicial.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshSession();
      } catch (err) {
        console.warn("Erro ao verificar sessão:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshSession]);

  // Recarrega os vínculos quando o evento ativo muda. Isto NÃO apaga
  // `departments` no fallback sem evento — eles precisam sobreviver à troca
  // para o Dashboard reconhecer (sem piscar) os departamentos coordenados.
  useEffect(() => {
    if (eventLoading) return;

    if (!eventoId) {
      setActiveDepartment(null);
      storeDeptId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const currentUser = userRef.current;
      if (!currentUser) return;
      const depts = await fetchDepartments(currentUser.id);
      if (cancelled) return;
      setDepartments(depts);
      setActiveDepartment((prev) => (prev ? reconcileActiveDepartment(depts, prev) : prev));
    })();

    return () => {
      cancelled = true;
    };
  }, [eventoId, eventLoading, fetchDepartments, reconcileActiveDepartment]);

  async function login(email: string, password: string) {
    const body = await apiRequest<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipRefresh: true,
    });
    setUser(body.user);
    await loadUserData(body.user);
    return body;
  }

  /**
   * Cria a conta e já inicia a sessão (o Worker faz signup + login num passo).
   * Devolve `{ session }` — o Login usa isso para navegar direto ao app.
   */
  async function signUp(email: string, password: string, name: string) {
    const body = await apiRequest<{ user: AuthUser }>("/auth/signup", {
      method: "POST",
      body: { email, password, name },
      skipRefresh: true,
    });
    setUser(body.user);
    await loadUserData(body.user);
    return { session: { user: body.user } };
  }

  async function resetPassword(email: string): Promise<void> {
    await apiRequest("/auth/password/forgot", {
      method: "POST",
      body: { email },
      skipRefresh: true,
    });
  }

  async function logout(): Promise<void> {
    try {
      await apiRequest("/auth/logout", { method: "POST", skipRefresh: true });
    } catch (error) {
      // Mesmo com falha de rede, o estado local é limpo.
      console.warn("Falha ao encerrar a sessão no servidor:", (error as Error)?.message);
    }
    setUser(null);
    clearUserData();
    deptRestoredRef.current = false;
  }

  function selectDepartment(dept: DepartmentMembership | null): void {
    setActiveDepartment(dept);
    storeDeptId(dept?.department?.id || dept?.id || null);
  }

  const isSuperAdmin = profile?.is_super_admin === true;

  const value: AuthContextValue = {
    user,
    profile,
    departments,
    activeDepartment,
    loading,
    isSuperAdmin,
    login,
    signUp,
    resetPassword,
    logout,
    selectDepartment,
    refreshSession,
    refreshDepartments,
    fetchCoordinatedDepartmentIds,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
