import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Error desconocido";
  }
};

export default function LoginPage() {
  const router = useRouter();
  const { sessionUser, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  const go = (path: string) => router.push(path);

  // --- Helper: asegura org personal y guarda activeOrgId ---
  const ensureAndSetActiveOrg = async (): Promise<string> => {
    const existing =
      typeof window !== "undefined"
        ? localStorage.getItem("activeOrgId")
        : null;
    if (existing) return existing;

    const { data, error } = await supabase.rpc("ensure_personal_org");
    if (error) throw error;

    const orgId = data?.[0]?.empresa_id as string | undefined;
    if (!orgId) throw new Error("No se pudo determinar empresa activa");
    localStorage.setItem("activeOrgId", orgId);
    return orgId;
  };

  // --- Si ya hay sesión, bootstrap multitenant y redirige ---
  useEffect(() => {
    if (!authLoading && sessionUser && !bootstrapping) {
      setBootstrapping(true);
      (async () => {
        try {
          await ensureAndSetActiveOrg();
        } catch (e: unknown) {
          console.error(e);
          setErrorMsg(getErrorMessage(e) ?? "Error inicializando empresa");
        } finally {
          router.replace("/debug/auth"); // o "/dashboard"
          setBootstrapping(false);
        }
      })();
    }
  }, [authLoading, sessionUser, router, bootstrapping]);

  // --- Login con email/clave ---
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(getErrorMessage(error));
      return;
    }
    // Redirige el effect al detectar sesión
  };

  // --- Login con Google ---
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback", // ajustá en Supabase y prod
      },
    });

    if (error) {
      setLoading(false);
      setErrorMsg(getErrorMessage(error));
    }
  };

  if (authLoading || bootstrapping) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Cargando autenticación…</p>
      </div>
    );
  }

  // Handlers tipados para inputs (evita any implícito si cambiás config)
  const onChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) =>
    setEmail(e.target.value);
  const onChangePassword = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPassword(e.target.value);

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h1 className="text-2xl mb-4 font-semibold">Iniciar sesión</h1>

      {errorMsg && <p className="text-red-600 mb-4 text-sm">{errorMsg}</p>}

      <form onSubmit={handleLogin} className="flex flex-col space-y-4">
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={onChangeEmail}
          required
          className="border p-2 rounded"
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={onChangePassword}
          required
          className="border p-2 rounded"
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>

      <hr className="my-6" />

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="bg-red-600 text-white p-2 rounded hover:bg-red-700 w-full disabled:opacity-60"
      >
        {loading ? "Redirigiendo..." : "Iniciar sesión con Google"}
      </button>

      <div className="mt-4 text-sm opacity-80">
        <p>
          ¿Querés probar la sesión actual?{" "}
          <button onClick={() => go("/debug/auth")} className="text-blue-600 underline">
            Ir a /debug/auth
          </button>
        </p>
      </div>
    </div>
  );
}
