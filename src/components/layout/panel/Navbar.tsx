import React from "react";
import { useAuth } from ".././../../context/AuthContext";

const PanelNavbar: React.FC = () => {
  const { sessionUser, dbUser } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/60 px-4">
      <div>
        <span className="text-xs uppercase text-slate-400">
          Empresa actual
        </span>
        <div className="text-sm font-medium">
          {dbUser?.empresa_id ?? "Sin empresa vinculada"}
        </div>
      </div>

      <div className="flex flex-col items-end text-xs text-slate-300">
        <span>{sessionUser?.email ?? "Invitado"}</span>
        {dbUser?.rol && (
          <span className="text-[10px] uppercase text-slate-500">
            Rol: {dbUser.rol}
          </span>
        )}
      </div>
    </header>
  );
};

export default PanelNavbar;
