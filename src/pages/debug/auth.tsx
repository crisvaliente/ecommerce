// /pages/debug/auth.tsx
// /src/pages/debug/auth.tsx
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";


export default function DebugAuth() {
  const { sessionUser, dbUser, loading, refresh, signOut } = useAuth();
  const [log, setLog] = useState<string>("");

  const runReadOwn = async () => {
    const u = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from("usuario")
      .select("id,supabase_uid,nombre,rol,correo,empresa_id")
      .eq("supabase_uid", u?.id)
      .maybeSingle();
    setLog(JSON.stringify({ step: "readOwn", data, error }, null, 2));
  };

  const runUpdateOwn = async () => {
    const u = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase
      .from("usuario")
      .update({ nombre: "Cris OK" })
      .eq("supabase_uid", u?.id)
      .select()
      .single();
    setLog(JSON.stringify({ step: "updateOwn", data, error }, null, 2));
  };

  // Cambiá este valor por el UID *de otro usuario real* para probar el bloqueo por RLS
  const runUpdateOther = async () => {
    const otherUid = prompt("Pegá aquí el supabase_uid de OTRO usuario:");
    if (!otherUid) return;
    const { data, error } = await supabase
      .from("usuario")
      .update({ nombre: "Hacker!" })
      .eq("supabase_uid", otherUid)
      .select()
      .maybeSingle();
    setLog(JSON.stringify({ step: "updateOther (debería fallar)", data, error }, null, 2));
  };

  return (
    <main style={{ padding: 24, fontFamily: "ui-sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Debug Auth / RLS</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Estado: {loading ? "cargando..." : "listo"} |
        &nbsp;sessionUser: {sessionUser?.id ?? "null"} |
        &nbsp;dbUser: {dbUser ? dbUser.supabase_uid : "null"}
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={refresh} style={btn}>Refresh</button>
        <button onClick={runReadOwn} style={btn}>SELECT propio</button>
        <button onClick={runUpdateOwn} style={btn}>UPDATE propio</button>
        <button onClick={runUpdateOther} style={btnDanger}>UPDATE OTRO (debe fallar)</button>
        <button onClick={signOut} style={btnSecondary}>Sign out</button>
      </div>

      <pre style={{
        whiteSpace: "pre-wrap",
        background: "#0b1020",
        color: "#e6f0ff",
        padding: 12,
        borderRadius: 8,
        minHeight: 160
      }}>{log || "Logs aquí..."}</pre>

      <p style={{ marginTop: 16, opacity: 0.8 }}>
        Tip: para conseguir el UID de otro usuario: Supabase Studio → Authentication → Users → copia el <code>id</code>.
      </p>
    </main>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #1f6feb",
  background: "#1f6feb",
  color: "white",
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  ...btn,
  background: "transparent",
  color: "#1f6feb",
};

const btnDanger: React.CSSProperties = {
  ...btn,
  background: "#b91c1c",
  borderColor: "#b91c1c",
};
