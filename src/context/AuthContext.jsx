import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [activeDepartment, setActiveDepartment] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.warn("Falha ao buscar perfil:", error.message);
      return null;
    }
    return data;
  }, []);

  const fetchDepartments = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("department_members")
      .select("*, department:departments(id, name, features, slug)")
      .eq("user_id", userId);
    if (error) {
      console.warn("Falha ao buscar departamentos:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  }, []);

  const reconcileActiveDepartment = useCallback((depts, prev) => {
    if (!prev) return depts[0] || null;
    const prevDeptId = prev?.department?.id || prev?.id;
    return depts.find((member) => member?.department?.id === prevDeptId) || depts[0] || null;
  }, []);

  const refreshSession = useCallback(async () => {
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
      setActiveDepartment((prev) => reconcileActiveDepartment(depts, prev));
      return depts;
    }
    setProfile(null);
    setDepartments([]);
    setActiveDepartment(null);
    return [];
  }, [fetchProfile, fetchDepartments, reconcileActiveDepartment]);

  const refreshDepartments = useCallback(async () => {
    if (!user) return [];
    const depts = await fetchDepartments(user.id);
    setDepartments(depts);
    setActiveDepartment((prev) => reconcileActiveDepartment(depts, prev));
    return depts;
  }, [user, fetchDepartments, reconcileActiveDepartment]);

  useEffect(() => {
    let mounted = true;

    const TIMEOUT_MS = 8000;

    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), TIMEOUT_MS);
    });

    Promise.race([sessionPromise, timeoutPromise]).then(async (result) => {
      if (!mounted) return;

      if (result?.timedOut) {
        console.warn("Supabase session check timed out — proceeding without auth.");
        setLoading(false);
        return;
      }

      const { data: { session } } = result;
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const [profileData, depts] = await Promise.all([
          fetchProfile(currentUser.id),
          fetchDepartments(currentUser.id),
        ]);
        if (!mounted) return;
        setProfile(profileData);
        setDepartments(depts);
        if (depts.length > 0) {
          setActiveDepartment(depts[0]);
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const [profileData, depts] = await Promise.all([
            fetchProfile(currentUser.id),
            fetchDepartments(currentUser.id),
          ]);
          setProfile(profileData);
          setDepartments(depts);
          if (depts.length > 0) {
            setActiveDepartment((prev) => prev ?? depts[0]);
          }
        } else {
          setProfile(null);
          setDepartments([]);
          setActiveDepartment(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchDepartments]);

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
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

  async function resetPassword(email) {
    const redirectTo = typeof window !== "undefined" ? window.location.origin + window.location.pathname : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setDepartments([]);
    setActiveDepartment(null);
  }

  function selectDepartment(dept) {
    setActiveDepartment(dept);
  }

  const isSuperAdmin = profile?.is_super_admin === true;

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
