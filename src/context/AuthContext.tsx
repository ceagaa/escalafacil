import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import { useEvent } from "./EventContext";
import type { DepartmentMembership, Profile } from "../types";

const DEPT_STORAGE_KEY = "escalafacil_active_department_id";

interface AuthContextValue {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<DepartmentMembership[]>([]);
  const [activeDepartment, setActiveDepartment] = useState<DepartmentMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const deptRestoredRef = useRef(false);

  const eventoIdRef = useRef(eventoId);
  useEffect(() => {
    eventoIdRef.current = eventoId;
  }, [eventoId]);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.warn("Falha ao buscar perfil:", error.message);
      return null;
    }
    return data as Profile;
  }, []);

  const fetchDepartments = useCallback(async (userId: string): Promise<DepartmentMembership[]> => {
    const { data, error } = await supabase
      .from("department_members")
      .select("*, department:departments(id, name, features, slug)")
      .eq("user_id", userId);
    if (error) {
      console.warn("Falha ao buscar departamentos:", error.message);
      return [];
    }
    const rows: DepartmentMembership[] = Array.isArray(data) ? (data as DepartmentMembership[]) : [];
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
   * IDs de departamento que o usuário coordena no evento ativo.
   * Lê direto de department_members (fonte de verdade) para que a tela de
   * escolha e a navbar reconheçam o departamento mesmo que o join de
   * departments falhe por RLS ou cache de schema do PostgREST.
   */
  const fetchCoordinatedDepartmentIds = useCallback(async (userId: string, eventoId: string): Promise<string[]> => {
    if (!userId || !eventoId) return [];
    const { data, error } = await supabase
      .from("department_members")
      .select("department_id, evento_id, role, user_id")
      .eq("user_id", userId)
      .eq("role", "coordenador")
      .eq("evento_id", eventoId);
    if (error) {
      console.warn("Falha ao buscar departamentos coordenados:", error.message);
      return [];
    }
    return (Array.isArray(data) ? data : [])
      .map((row: { department_id?: string | null }) => row?.department_id)
      .filter(Boolean) as string[];
  }, []);

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

  const refreshSession = useCallback(async (): Promise<DepartmentMembership[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user ?? null;
    setUser(currentUser);

    if (currentUser) {
      const [profileData, depts] = await Promise.all([
        fetchProfile(currentUser.id),
        fetchDepartments(currentUser.id),
      ]);
      setProfile(profileData);
      setDepartments(depts);
      setActiveDepartment((prev) => {
        if (!prev) return null;
        return reconcileActiveDepartment(depts, prev);
      });
      restoreFromStorage(depts);
      return depts;
    }
    setProfile(null);
    setDepartments([]);
    setActiveDepartment(null);
    return [];
  }, [fetchProfile, fetchDepartments, reconcileActiveDepartment]);

  const refreshDepartments = useCallback(async (): Promise<DepartmentMembership[]> => {
    if (!user) return [];
    const depts = await fetchDepartments(user.id);
    setDepartments(depts);
    setActiveDepartment((prev) => {
      if (!prev) return null;
      return reconcileActiveDepartment(depts, prev);
    });
    return depts;
  }, [user, fetchDepartments, reconcileActiveDepartment]);

  useEffect(() => {
    if (eventLoading) return;

    // Sem evento ativo não há departamento ativo. Isto NÃO apaga `departments`,
    // que precisa sobreviver à troca de evento para o Dashboard conseguir
    // reconhecer (sem piscar) os departamentos já coordenados pelo usuário.
    if (!eventoId) {
      setActiveDepartment(null);
      storeDeptId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      if (!currentUser || cancelled) return;
      const depts = await fetchDepartments(currentUser.id);
      if (cancelled) return;
      setDepartments(depts);
      setActiveDepartment((prev) => (prev ? reconcileActiveDepartment(depts, prev) : prev));
    })();

    return () => { cancelled = true; };
  }, [eventoId, eventLoading, fetchDepartments, reconcileActiveDepartment]);

  useEffect(() => {
    let mounted = true;

    const TIMEOUT_MS = 8000;

    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), TIMEOUT_MS);
    });

    Promise.race([sessionPromise, timeoutPromise])
      .then(async (result) => {
        if (!mounted) return;

        if ("timedOut" in result && result.timedOut) {
          console.warn("Supabase session check timed out — proceeding without auth.");
          return;
        }

        const session = ("data" in result ? result.data?.session : null) ?? null;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          try {
            const [profileData, depts] = await Promise.all([
              fetchProfile(currentUser.id),
              fetchDepartments(currentUser.id),
            ]);
            if (!mounted) return;
            setProfile(profileData);
            setDepartments(depts);
            restoreFromStorage(depts);
          } catch (err) {
            console.warn("Erro ao buscar dados do usuário:", err);
          }
        }
      })
      .catch((err) => {
        console.warn("Erro ao verificar sessão:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          const currentUser = session?.user ?? null;
          setUser(currentUser);

          if (currentUser) {
            const [profileData, depts] = await Promise.all([
              fetchProfile(currentUser.id),
              fetchDepartments(currentUser.id),
            ]);
            setProfile(profileData);
            setDepartments(depts);
          } else {
            setProfile(null);
            setDepartments([]);
            setActiveDepartment(null);
            storeDeptId(null);
          }
        } catch (err) {
          console.warn("Erro no onAuthStateChange:", err);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchDepartments]);

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email: string, password: string, name: string) {
    const redirectTo = typeof window !== "undefined" ? window.location.origin + "/login" : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) throw error;

    if (data?.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: data.user.id, email, name }, { onConflict: "id" });
      if (profileError) {
        console.warn("Falha ao salvar perfil:", profileError.message);
      }
    }

    return data;
  }

  async function resetPassword(email: string): Promise<void> {
    const redirectTo = typeof window !== "undefined" ? window.location.origin + window.location.pathname : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setDepartments([]);
    setActiveDepartment(null);
    storeDeptId(null);
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
