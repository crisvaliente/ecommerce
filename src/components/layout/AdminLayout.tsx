// src/components/layout/AdminLayout.tsx
import React, { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import PanelSidebar from "./panel/Sidebar";
import PanelNavbar from "./panel/Navbar";

interface AdminLayoutProps {
  children: ReactNode;
}

const allowedRoles = ["admin", "desarrollador"];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { sessionUser, dbUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!sessionUser) {
      router.replace("/auth/login");
      return;
    }

    if (!dbUser || !allowedRoles.includes(dbUser.rol)) {
      router.replace("/auth/no-autorizado");
      return;
    }

    if (!dbUser.empresa_id) {
      router.replace("/auth/registroempresa");
      return;
    }
  }, [sessionUser, dbUser, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-gray-700">Cargando panel…</p>
      </div>
    );
  }

  if (!sessionUser || !dbUser?.empresa_id) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <PanelSidebar />

      <div className="flex flex-1 flex-col">
        <PanelNavbar />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

