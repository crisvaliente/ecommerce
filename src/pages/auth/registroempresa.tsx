import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";

export default function RegistroEmpresa() {
  const router = useRouter();
  const { sessionUser, dbUser, loading } = useAuth();

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
      <h1 className="text-xl font-bold mb-4">Registro temporalmente deshabilitado</h1>

      <p className="text-sm text-slate-600">
        Estamos realizando mantenimiento preventivo. La creación de empresas volverá a estar disponible cuando
        terminemos la actualización de seguridad.
      </p>
    </div>
  );
}
