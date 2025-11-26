import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import { useAuth } from "../../../context/AuthContext";

type PanelLink = {
  href: string;
  label: string;
  allowedRoles?: string[]; // si se omite → todos los roles que llegan al panel
};

const links: PanelLink[] = [
  {
    href: "/panel",
    label: "Inicio",
    allowedRoles: ["admin", "desarrollador"],
  },
  {
    href: "/panel/productos",
    label: "Productos",
    allowedRoles: ["admin", "desarrollador"],
  },
  {
    href: "/panel/categorias",
    label: "Categorías",
    allowedRoles: ["admin", "desarrollador"],
  },
  {
    href: "/panel/payments",
    label: "Pagos",
    allowedRoles: ["admin"], // ej: solo admin maneja pagos
  },
  // Ejemplo futuro:
  // { href: "/panel/usuarios", label: "Gestión usuarios", allowedRoles: ["admin"] },
];

const PanelSidebar: React.FC = () => {
  const router = useRouter();
  const { dbUser } = useAuth();
  const role = dbUser?.rol ?? "invitado";

  const visibleLinks = links.filter(
    (link) => !link.allowedRoles || link.allowedRoles.includes(role)
  );

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950/80">
      <div className="px-4 py-4 text-lg font-semibold tracking-wide">
        Raeyz Panel
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {visibleLinks.map((link) => {
          const active = router.pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-lg px-3 py-2 text-sm ${
                active
                  ? "bg-slate-800 text-slate-50"
                  : "text-slate-300 hover:bg-slate-900 hover:text-slate-50"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        {visibleLinks.length === 0 && (
          <p className="px-3 py-2 text-xs text-slate-500">
            No tenés secciones disponibles en el panel con tu rol actual.
          </p>
        )}
      </nav>
    </aside>
  );
};

export default PanelSidebar;
