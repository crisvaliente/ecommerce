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
          await router.replace("/auth/login?error=" + encodeURIComponent(err));
          return;
        }

        // Intercambia el code por la sesión (PASO CLAVE)
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setMsg(`No se pudo finalizar el login: ${error.message}`);
          await router.replace("/auth/login?error=" + encodeURIComponent(error.message));
          return;
        }

        // Sesión OK → a tu página de pruebas / dashboard
        await router.replace("/debug/auth");
      } catch (e: any) {
        setMsg(e?.message ?? "Error inesperado");
        await router.replace("/auth/login?error=" + encodeURIComponent(e?.message ?? "unknown"));
      }
    };
    run();
  }, [router]);

  return <p style={{ textAlign: "center", marginTop: 40 }}>{msg}</p>;
}
