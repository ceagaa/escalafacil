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
      .select("*, department:departments(id, name)")
      .eq("user_id", userId);
    if (error) {
      console.warn("Falha ao buscar departamentos:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
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
      if (depts.length > 0 && !activeDepartment) {
        setActiveDepartment(depts[0]);
      }
    } else {
      setProfile(null);
      setDepartments([]);
      setActiveDepartment(null);
    }
  }, [fetchProfile, fetchDepartments, activeDepartment]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

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
    }

    init();

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
    logout,
    selectDepartment,
    refreshSession,
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
