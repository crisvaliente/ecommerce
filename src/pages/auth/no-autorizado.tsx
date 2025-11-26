import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../../context/AuthContext";

const NoAutorizadoPage: React.FC = () => {
  const router = useRouter();
  const { sessionUser, dbUser, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace("/auth/login");
  };

  const isLogged = !!sessionUser;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <div className="mb-4 text-center">
          <div className="mb-3 text-4xl">🚫</div>
          <h1 className="text-xl font-semibold">Acceso no autorizado</h1>
        </div>

        <p className="mb-3 text-sm text-slate-300">
          Tu cuenta no tiene permisos para acceder al panel administrativo.
        </p>

        {dbUser && (
          <p className="mb-3 text-xs text-slate-400">
            Rol actual: <span className="font-semibold">{dbUser.rol}</span>
          </p>
        )}



        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800"
          >
            Volver al inicio
          </Link>

          {isLogged && (
            <button
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoAutorizadoPage;
