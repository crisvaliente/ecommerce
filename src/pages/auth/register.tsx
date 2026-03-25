// src/pages/auth/register.tsx
import React, { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

type Feedback = {
  kind: "success" | "info" | "error";
  text: string;
};

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
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const normalize = (m: string) => {
    if (/already registered|duplicate/i.test(m)) return "Ya existe una cuenta con ese correo.";
    if (/Email not confirmed/i.test(m)) return "Confirmá tu correo para continuar.";
    if (/password/i.test(m)) return "La contraseña no cumple los requisitos.";
    return "No pudimos crear tu cuenta. Intenta de nuevo.";
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // evita refresh
    setFeedback(null);
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

      if (data.session) {
        setFeedback({
          kind: "success",
          text: "Cuenta creada correctamente. Redirigiendo...",
        });
        setTimeout(() => router.push("/auth/login"), 900);
      } else if (data.user) {
        setFeedback({
          kind: "info",
          text: "Te enviamos un correo de verificación. Revisá tu bandeja (y Spam).",
        });
      } else {
        throw new Error("No pudimos confirmar la creación de tu cuenta.");
      }
    } catch (e: unknown) {
      setFeedback({ kind: "error", text: normalize(getErrorMessage(e)) });
      console.error("signup error:", e);
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setFeedback(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    if (error) setFeedback({ kind: "error", text: "No pudimos reenviar el correo." });
    else setFeedback({ kind: "info", text: "Correo de verificación reenviado." });
  };

  const handleGoogleRegister = async () => {
    setFeedback(null);
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: origin ? `${origin}/auth/callback` : undefined },
    });
    if (error) setFeedback({ kind: "error", text: error.message });
  };

  // Handlers tipados de inputs (evitan any implícito)
  const onChangeName = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const onChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value);
  const onChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value);

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow bg-white/80">
      <h1 className="text-2xl mb-4">Registrarse</h1>

      {feedback && (
        <p
          className={`mb-4 p-3 rounded ${
            feedback.kind === "success"
              ? "bg-green-100 text-green-800"
              : feedback.kind === "info"
                ? "bg-blue-100 text-blue-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {feedback.text}
        </p>
      )}

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
