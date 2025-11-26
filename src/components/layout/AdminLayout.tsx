import React, { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import PanelSidebar from "./panel/Sidebar";
import PanelNavbar from "./panel/Navbar";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { sessionUser, dbUser, loading } = useAuth();
  const router = useRouter();

useEffect(() => {
  if (!loading) {
    // 1) Sin sesión → login
    if (!sessionUser) {
      router.replace("/auth/login");
      return;
    }

    // 2) Roles permitidos en el panel
    const allowed = ["admin", "desarrollador"];
    if (!dbUser || !allowed.includes(dbUser.rol)) {
      router.replace("/auth/no-autorizado");
      return;
    }

    // 3) Si tiene rol válido pero no tiene empresa → registroempresa
    if (!dbUser.empresa_id) {
      router.replace("/auth/registroempresa");
      return;
    }
  }
}, [sessionUser, dbUser, loading, router]);


  // Mientras carga autenticación
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm">Cargando autenticación…</p>
      </div>
    );
  }

  // Mientras redirige
  if (!sessionUser || !dbUser?.empresa_id) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <PanelSidebar />
      <div className="flex flex-1 flex-col">
        <PanelNavbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
