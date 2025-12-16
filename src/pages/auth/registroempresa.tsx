import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";

export default function RegistroEmpresa() {
  const router = useRouter();
  const { sessionUser, dbUser, loading } = useAuth();

  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cargando, setCargando] = useState(false);

  // ✅ Guard de acceso
  useEffect(() => {
    if (loading) return;

    if (!sessionUser) {
      router.replace("/auth/login");
      return;
    }

    // Si ya tiene empresa -> panel
    if (dbUser?.empresa_id) {
      router.replace("/panel");
      return;
    }

    // Si no es admin, por ahora no le dejamos crear empresa
    if (dbUser && dbUser.rol !== "admin") {
      router.replace("/");
      return;
    }
  }, [loading, sessionUser, dbUser, router]);

  const handleRegistro = async () => {
    if (!sessionUser) return;
    if (!nombreEmpresa.trim()) {
      alert("Ingresá un nombre para la empresa.");
      return;
    }

    setCargando(true);

    // 1) Crear empresa
    const { data: empresa, error: errorEmpresa } = await supabase
      .from("empresa")
      .insert({ nombre: nombreEmpresa.trim(), descripcion })
      .select("id")
      .single();

    if (errorEmpresa || !empresa) {
      console.error(errorEmpresa);
      alert("Error creando la empresa");
      setCargando(false);
      return;
    }

    // 2) Actualizar usuario actual (NO insertar)
    const { error: errorUpdate } = await supabase
      .from("usuario")
      .update({ empresa_id: empresa.id, rol: "admin" })
      .eq("supabase_uid", sessionUser.id);

    if (errorUpdate) {
      console.error("Error actualizando usuario:", errorUpdate);
      alert("Error asignando la empresa al usuario");
      setCargando(false);
      return;
    }

    // 3) Redirigir al panel
    router.push("/panel");
  };

  if (loading) return null;
  if (!sessionUser) return null;

  // Si dbUser todavía no llegó por algún motivo, no mostramos el form
  if (!dbUser) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6">
        <p className="text-sm text-slate-500">Cargando perfil…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
      <h1 className="text-xl font-bold mb-4">Crear nueva empresa</h1>

      <label className="block mb-2">
        Nombre de la empresa:
        <input
          type="text"
          value={nombreEmpresa}
          onChange={(e) => setNombreEmpresa(e.target.value)}
          className="w-full border px-2 py-1 mt-1"
        />
      </label>

      <label className="block mb-4">
        Descripción:
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="w-full border px-2 py-1 mt-1"
        />
      </label>

      <button
        onClick={handleRegistro}
        disabled={cargando}
        className="bg-black text-white px-4 py-2 rounded mt-4"
      >
        {cargando ? "Creando..." : "Crear empresa y continuar"}
      </button>
    </div>
  );
}
