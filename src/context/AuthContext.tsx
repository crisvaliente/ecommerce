import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

/** Ajustá campos si tu tabla cambia */
export interface CustomUser {
  id: string;               // PK de public.usuario
  supabase_uid: string;     // auth.users.id
  nombre: string | null;
  correo: string | null;
  rol: "admin" | "desarrollador" | "usuario" | "invitado" | string;
  empresa_id: string | null;
}

interface AuthContextType {
  sessionUser: User | null;
  dbUser: CustomUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<CustomUser | null>(null);

  // Anti-race en Strict Mode
  const didInit = useRef(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  // ✅ safeSet estable
  const safeSet = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
      if (mountedRef.current) setter(value);
    },
    [mountedRef]
  );

  /** ✅ ensureProfile estable (usada dentro de load) */
  const ensureProfile = useCallback(
    async (u: User): Promise<CustomUser | null> => {
      const emailLower = u.email ? u.email.toLowerCase() : null;

      // Nombre desde metadata (Google u otros providers)
      const fullName =
        (u.user_metadata &&
          (u.user_metadata.full_name ||
            u.user_metadata.name ||
            u.user_metadata.user_name)) ||
        null;

      // ¿existe?
      const { data: existing, error: exErr } = await supabase
        .from("usuario")
        .select("id, supabase_uid, nombre, correo, rol, empresa_id")
        .eq("supabase_uid", u.id)
        .maybeSingle();

      if (exErr) {
        console.debug("[auth] ensureProfile select error:", exErr);
        return null;
      }
      if (existing) return existing as CustomUser;

      // crear
      const { data: inserted, error: insErr } = await supabase
        .from("usuario")
        .insert({
          supabase_uid: u.id,
          correo: emailLower,
          nombre: fullName, // ⬅️ ahora guardamos el nombre real
          rol: "invitado",
          empresa_id: null,
        })
        .select("id, supabase_uid, nombre, correo, rol, empresa_id")
        .single();

      if (insErr) {
        console.debug("[auth] ensureProfile insert error:", insErr);
        return null;
      }
      return inserted as CustomUser;
    },
    []
  );

  /** ✅ load estable (usada en effect y expuesta como refresh) */
  const load = useCallback(async () => {
    safeSet(setLoading, true);

    // 1) Sesión actual
    const {
      data: { session },
      error: sErr,
    } = await supabase.auth.getSession();
    if (sErr) console.debug("[auth] getSession error:", sErr);

    const u = session?.user ?? null;
    safeSet(setSessionUser, u);

    // 2) Invitado
    if (!u) {
      safeSet(setDbUser, null);
      safeSet(setLoading, false);
      return;
    }

    // 3) Buscar perfil por supabase_uid
    const { data, error } = await supabase
      .from("usuario")
      .select("id, supabase_uid, nombre, correo, rol, empresa_id")
      .eq("supabase_uid", u.id)
      .maybeSingle();

    if (error) console.debug("[auth] fetch usuario error:", error);

    let profile: CustomUser | null = (data as CustomUser) ?? null;

    // 4) Autocrear si falta
    if (!profile) profile = await ensureProfile(u);

    // 5) Setear estado
    safeSet(setDbUser, profile);
    safeSet(setLoading, false);
  }, [ensureProfile, safeSet]);

  // ✅ Effect depende de load (función estable)
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    load();

    // Cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_evt, newSession) => {
        safeSet(setSessionUser, newSession?.user ?? null);
        load();
      }
    );

    return () => {
      sub?.subscription.unsubscribe();
    };
  }, [load, safeSet]);

  // ✅ signOut estable
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    safeSet(setSessionUser, null);
    safeSet(setDbUser, null);
  }, [safeSet]);

  // ✅ Memo incluye load y signOut
  const value = useMemo<AuthContextType>(
    () => ({ sessionUser, dbUser, loading, refresh: load, signOut }),
    [sessionUser, dbUser, loading, load, signOut]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
