import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import { useAuth } from "../../../context/AuthContext";

type PanelLink = {
  href: string;
  label: string;
  allowedRoles?: string[];
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
    allowedRoles: ["admin"],
  },
];

const PanelSidebar: React.FC = () => {
  const router = useRouter();
  const { dbUser, sessionUser } = useAuth();

  const role = dbUser?.rol ?? "invitado";

  const visibleLinks = links.filter(
    (link) => !link.allowedRoles || link.allowedRoles.includes(role)
  );

  return (
    <aside className="rz-sidebar">
      <div className="rz-sidebar-header">
        <span className="rz-sidebar-brand">RAEYZ</span>
        <span className="rz-sidebar-subtitle">Panel administrativo</span>
      </div>

      <nav className="rz-sidebar-nav">
        {visibleLinks.map((link) => {
          const active = router.pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                "rz-sidebar-link " +
                (active ? "rz-sidebar-link--active" : "")
              }
            >
              {link.label}
            </Link>
          );
        })}

        {visibleLinks.length === 0 && (
          <p className="rz-sidebar-link text-xs opacity-60">
            No tenés secciones disponibles con tu rol actual.
          </p>
        )}
      </nav>

<div className="rz-sidebar-footer">
  {dbUser && (
    <>
      <div>
        Usuario: {dbUser?.nombre || sessionUser?.email}
      </div>
      <div>Rol: {dbUser?.rol}</div>
    </>
  )}
</div>
    </aside>
  );
};

export default PanelSidebar;
