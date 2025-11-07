import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { sessionUser, loading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const go = (path: string) => router.push(path);

  // --- Si ya hay sesión, redirige automáticamente ---
  useEffect(() => {
    if (!authLoading && sessionUser) {
      router.replace("/debug/auth");
    }
  }, [authLoading, sessionUser, router]);

  // --- Login con email/clave ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // Sesión creada, AuthContext la detecta automáticamente
    go("/debug/auth");
  };

  // --- Login con Google ---
  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback", // Debe estar permitido en Supabase
      },
    });

    if (error) {
      setLoading(false);
      setErrorMsg(error.message);
    }
  };

  // --- Mostrar mientras AuthContext se inicializa ---
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Cargando autenticación...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h1 className="text-2xl mb-4 font-semibold">Iniciar sesión</h1>

      {errorMsg && (
        <p className="text-red-600 mb-4 text-sm">{errorMsg}</p>
      )}

      <form onSubmit={handleLogin} className="flex flex-col space-y-4">
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border p-2 rounded"
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
          <button
            onClick={() => go("/debug/auth")}
            className="text-blue-600 underline"
          >
            Ir a /debug/auth
          </button>
        </p>
      </div>
    </div>
  );
}
