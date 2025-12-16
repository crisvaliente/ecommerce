// /src/pages/auth/callback.tsx
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

export default function Callback() {
  const router = useRouter();
  const [msg, setMsg] = useState("Procesando login...");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      try {
        const url = new URL(window.location.href);

        const err = url.searchParams.get("error_description");
        if (err) {
          setMsg(`Error: ${err}`);
          router.replace("/auth/login?error=" + encodeURIComponent(err));
          return;
        }

        // ✅ Si no viene code, no intentes exchange (evita el 400)
        const code = url.searchParams.get("code");
        if (!code) {
          setMsg("Callback sin code. Volviendo al inicio…");
          router.replace("/");
          return;
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        console.log("[CALLBACK] exchange result", { data, error });

        if (error) {
          setMsg(`No se pudo finalizar el login: ${error.message}`);
          router.replace("/auth/login?error=" + encodeURIComponent(error.message));
          return;
        }

        // ✅ sesión OK -> destino real
        router.replace("/"); // o "/panel" si querés
      } catch (e) {
        const err =
          e instanceof Error ? e.message : typeof e === "string" ? e : "Error inesperado";
        setMsg(err);
        router.replace("/auth/login?error=" + encodeURIComponent(err));
      }
    };

    void run();
  }, [router]);

  return <p style={{ textAlign: "center", marginTop: 40 }}>{msg}</p>;
}
