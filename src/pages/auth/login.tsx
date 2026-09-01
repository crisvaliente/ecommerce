import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { getSafeAuthReturn } from "../../lib/buyerCheckout";

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
  const returnTo = getSafeAuthReturn(router.query.next);

  const go = (path: string) => router.push(path);

  useEffect(() => {
    if (!authLoading && sessionUser && router.isReady) {
      router.replace(returnTo);
    }
  }, [authLoading, returnTo, router, sessionUser]);

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
    // El useEffect se encarga de redirigir cuando detecta la sesión
  };

  // --- Login con Google (funciona tanto en localhost como en Vercel) ---
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        setErrorMsg(getErrorMessage(error));
        setLoading(false);
      }
      // Si no hay error, Supabase redirige fuera de esta página
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Cargando autenticación…</p>
      </div>
    );
  }

  const onChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) =>
    setEmail(e.target.value);
  const onChangePassword = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPassword(e.target.value);

  return (
    <div className="mx-auto mt-10 max-w-md rounded border p-6 shadow">
      <h1 className="mb-4 text-2xl font-semibold">Iniciar sesión</h1>

      {errorMsg && (
        <p className="mb-4 text-sm text-red-600 whitespace-pre-wrap">
          {errorMsg}
        </p>
      )}

      <form onSubmit={handleLogin} className="flex flex-col space-y-4">
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={onChangeEmail}
          required
          className="rounded border p-2"
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={onChangePassword}
          required
          className="rounded border p-2"
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>
      </form>

      <hr className="my-6" />

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full rounded bg-red-600 p-2 text-white hover:bg-red-700 disabled:opacity-60"
      >
        {loading ? "Redirigiendo..." : "Iniciar sesión con Google"}
      </button>

      <div className="mt-4 text-sm opacity-80">
        <p>
          ¿Querés volver a comprar?{" "}
          <button
            onClick={() => go("/coleccion")}
            className="text-blue-600 underline"
          >
            Ir a la colección
          </button>
        </p>
      </div>
    </div>
  );
}
