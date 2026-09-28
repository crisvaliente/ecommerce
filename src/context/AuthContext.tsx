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
  rol: "admin" | "staff" | "cliente";
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

function fetchOwnProfile(uid: string) {
  return supabase
    .from("usuario")
    .select("id, supabase_uid, nombre, correo, rol, empresa_id")
    .eq("supabase_uid", uid)
    .maybeSingle();
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<CustomUser | null>(null);

  // Each effect setup owns a distinct active lifetime.
  const mountedRef = useRef(false);
  const loadVersionRef = useRef(0);
  const invalidateLoad = useCallback(() => {
    ++loadVersionRef.current;
  }, []);

  // ✅ safeSet estable
  const safeSet = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
      if (mountedRef.current) setter(value);
    },
    [mountedRef]
  );

  /** ✅ load estable (usada en effect y expuesta como refresh) */
  const load = useCallback(async () => {
    const loadVersion = ++loadVersionRef.current;
    const isCurrentLoad = () =>
      mountedRef.current && loadVersionRef.current === loadVersion;

    safeSet(setLoading, true);

    // 1) Sesión actual
    const {
      data: { session },
      error: sErr,
    } = await supabase.auth.getSession();
    if (!isCurrentLoad()) return;
    if (sErr) console.debug("[auth] getSession error:", sErr);

    const u = session?.user ?? null;
    safeSet(setSessionUser, u);

    // 2) Invitado
    if (!u) {
      safeSet(setDbUser, null);
      safeSet(setLoading, false);
      return;
    }

    // 3) Buscar perfil por supabase_uid. Lo crea el trigger on_auth_user_created
    // (migración 20260914165851); el navegador no provisiona ni repara perfiles.
    let { data, error } = await fetchOwnProfile(u.id);
    if (!isCurrentLoad()) return;

    // 4) Un error de lectura (no un perfil inexistente) se reintenta una sola vez.
    if (error) {
      console.error("[auth] fetch usuario error:", error);
      ({ data, error } = await fetchOwnProfile(u.id));
      if (!isCurrentLoad()) return;
      if (error) console.error("[auth] fetch usuario retry error:", error);
    }
    if (!error && !data) {
      console.warn("[auth] usuario sin perfil para la sesión actual");
    }

    const profile: CustomUser | null = error ? null : (data as CustomUser) ?? null;

    // 5) Setear estado
    safeSet(setDbUser, profile);
    safeSet(setLoading, false);
  }, [safeSet]);

  // ✅ Effect depende de load (función estable)
  useEffect(() => {
    mountedRef.current = true;
    load();

    // Cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_evt, newSession) => {
        safeSet(setSessionUser, newSession?.user ?? null);
        load();
      }
    );

    return () => {
      invalidateLoad();
      mountedRef.current = false;
      sub?.subscription.unsubscribe();
    };
  }, [invalidateLoad, load, safeSet]);

  // ✅ signOut estable
  const signOut = useCallback(async () => {
    ++loadVersionRef.current;
    safeSet(setSessionUser, null);
    safeSet(setDbUser, null);
    safeSet(setLoading, false);
    await supabase.auth.signOut();
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
