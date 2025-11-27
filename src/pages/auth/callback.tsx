// /src/pages/auth/callback.tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

export default function Callback() {
  const router = useRouter();
  const [msg, setMsg] = useState("Procesando login...");

  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const err = url.searchParams.get("error_description");

        if (err) {
          setMsg(`Error: ${err}`);
          await router.replace(
            "/auth/login?error=" + encodeURIComponent(err)
          );
          return;
        }

        // Intercambia el code por la sesión (PASO CLAVE)
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        // 🔥 DEBUG: ver qué devuelve en producción
        console.log("[CALLBACK] exchange result", { data, error });

        if (error) {
          setMsg(`No se pudo finalizar el login: ${error.message}`);
          await router.replace(
            "/auth/login?error=" + encodeURIComponent(error.message)
          );
          return;
        }

        // ✅ Sesión OK → redirigir a tu página de pruebas / dashboard
        await router.replace("/debug/auth");
      } catch (e) {
        const err =
          e instanceof Error
            ? e.message
            : typeof e === "string"
            ? e
            : "Error inesperado";
        setMsg(err);
        await router.replace(
          "/auth/login?error=" + encodeURIComponent(err)
        );
      }
    };

    void run();
  }, [router]);

  return <p style={{ textAlign: "center", marginTop: 40 }}>{msg}</p>;
}
