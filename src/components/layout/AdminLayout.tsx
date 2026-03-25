// src/components/layout/AdminLayout.tsx
import React, { ReactNode, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";
import PanelSidebar from "./panel/Sidebar";
import PanelNavbar from "./panel/Navbar";

interface AdminLayoutProps {
  children: ReactNode;
}

const allowedRoles = ["admin", "staff"];

type InterstitialProps = {
  title: string;
  message: string;
};

const PanelInterstitial: React.FC<InterstitialProps> = ({ title, message }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#EEECE1] px-6">
      <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#E30B13]">
          Raeyz Admin
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-[#0D0D0E]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{message}</p>
      </div>
    </div>
  );
};

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
      <PanelInterstitial
        title="Cargando panel"
        message="Estamos preparando tu espacio de trabajo. Esto tarda solo un momento."
      />
    );
  }

  if (!sessionUser || !dbUser?.empresa_id) {
    return (
      <PanelInterstitial
        title="Redirigiendo"
        message="Estamos verificando tu acceso y llevandote a la pantalla correcta."
      />
    );
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

