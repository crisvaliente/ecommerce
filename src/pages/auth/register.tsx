// src/pages/auth/register.tsx
import React, { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "No pudimos crear tu cuenta. Intenta de nuevo.";
  }
};

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");           // opcional, mételo en metadata
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const normalize = (m: string) => {
    if (/already registered|duplicate/i.test(m)) return "Ya existe una cuenta con ese correo.";
    if (/Email not confirmed/i.test(m)) return "Confirmá tu correo para continuar.";
    if (/password/i.test(m)) return "La contraseña no cumple los requisitos.";
    return "No pudimos crear tu cuenta. Intenta de nuevo.";
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // evita refresh
    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
          data: { name },
        },
      });

      if (error) throw error;

      const needsVerify = !data.user?.email_confirmed_at;
      if (needsVerify) {
        setMsg("Te enviamos un correo de verificación. Revisá tu bandeja (y Spam).");
      } else {
        setMsg("Cuenta creada correctamente. Redirigiendo…");
        setTimeout(() => router.push("/auth/login"), 900);
      }
    } catch (e: unknown) {
      setErr(normalize(getErrorMessage(e)));
      console.error("signup error:", e);
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setErr(null);
    setMsg(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    if (error) setErr("No pudimos reenviar el correo.");
    else setMsg("Correo de verificación reenviado.");
  };

  const handleGoogleRegister = async () => {
    setErr(null);
    setMsg(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: origin ? `${origin}/auth/callback` : undefined },
    });
    if (error) setErr(error.message);
  };

  // Handlers tipados de inputs (evitan any implícito)
  const onChangeName = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const onChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
  const onChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow bg-white/80">
      <h1 className="text-2xl mb-4">Registrarse</h1>

      {msg && <p className="mb-4 p-3 rounded bg-green-100 text-green-800">{msg}</p>}
      {err && <p className="mb-4 p-3 rounded bg-red-100 text-red-800">{err}</p>}

      <form onSubmit={handleRegister} className="flex flex-col space-y-4">
        <input
          type="text"
          placeholder="Nombre (opcional)"
          value={name}
          onChange={onChangeName}
          className="border p-2 rounded"
        />
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={onChangeEmail}
          required
          className="border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={onChangePassword}
          required
          className="border p-2 rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:opacity-60"
        >
          {loading ? "Creando…" : "Registrarse"}
        </button>
      </form>

      <button onClick={resendVerification} className="mt-3 text-sm underline">
        Reenviar correo de verificación
      </button>

      <hr className="my-6" />
      <button
        type="button"
        onClick={handleGoogleRegister}
        className="bg-red-600 text-white p-2 rounded hover:bg-red-700 w-full"
      >
        Registrarse con Google
      </button>
    </div>
  );
}
