// src/services/authService.ts
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

const REDIRECT_URL = "http://localhost:3000/auth/callback"; // debe estar permitido en Supabase

export function useGoogleLoginHandler() {
  const router = useRouter();

  /** Inicia OAuth con Google */
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: REDIRECT_URL },
    });
    // Si no hay error, el navegador redirige a Google automáticamente.
    if (error) {
      // devolvelo para mostrar en UI si querés
      return { error };
    }
    return { error: null };
  };

  /** Callback: intercambia el 'code' por la sesión y redirige */
  const handleGoogleLoginRedirect = async () => {
    const url = new URL(window.location.href);

    const error = url.searchParams.get("error_description");
    if (error) {
      // Mostralo/guardalo si querés
      console.error("OAuth error:", error);
      await router.replace("/auth/login?error=" + encodeURIComponent(error));
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      // Nada que procesar (alguien entró directo)
      await router.replace("/auth/login");
      return;
    }

    // Paso CLAVE: crear la sesión en el cliente
    const { error: exchErr } = await supabase.auth.exchangeCodeForSession(
      window.location.href
    );
    if (exchErr) {
      console.error("exchangeCodeForSession error:", exchErr);
      await router.replace("/auth/login?error=" + encodeURIComponent(exchErr.message));
      return;
    }

    // Sesión creada: tu AuthContext la detecta solo
    await router.replace("/debug/auth"); // o donde quieras aterrizar
  };

  return { handleGoogleLogin, handleGoogleLoginRedirect };
}
