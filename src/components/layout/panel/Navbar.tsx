import React from "react";
import { useAuth } from "../../../context/AuthContext";

const PanelNavbar: React.FC = () => {
  const { sessionUser, dbUser } = useAuth();

  return (
    <header
      className="
        sticky top-0 z-20
        flex h-16 items-center justify-between
        px-6
        bg-[#EEECE1]/90 backdrop-blur-md
        border-b border-slate-300/40
      "
    >
      {/* Izquierda: Empresa */}
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
          Empresa actual
        </span>

        <span className="text-sm font-bold text-slate-900">
          {dbUser?.empresa_id ?? "Sin empresa vinculada"}
        </span>
      </div>

      {/* Derecha: Usuario */}
      <div className="flex flex-col items-end">
        <span className="text-sm font-medium text-slate-800">
          {sessionUser?.email ?? "Invitado"}
        </span>

        {dbUser?.rol && (
          <span className="text-[11px] uppercase font-semibold text-red-600 tracking-wide">
            {dbUser.rol}
          </span>
        )}
      </div>
    </header>
  );
};

export default PanelNavbar;
