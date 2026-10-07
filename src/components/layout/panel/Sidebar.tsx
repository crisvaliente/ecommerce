import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import { useAuth } from "../../../context/AuthContext";
import { instanceConfig } from "../../../config/instance";
import { decidePanelAdmission } from "../../../lib/panelRouteCapabilities";

type PanelLink = {
  href: string;
  label: string;
};

const links: PanelLink[] = [
  { href: "/panel", label: "Inicio" },
  { href: "/panel/productos", label: "Productos" },
  { href: "/panel/categorias", label: "Categorías" },
  { href: "/panel/pedidos", label: "Pedidos" },
  { href: "/panel/payments", label: "Pagos" },
];

const PanelSidebar: React.FC = () => {
  const router = useRouter();
  const { dbUser, sessionUser, loading } = useAuth();

  const visibleLinks = links.filter((link) =>
    decidePanelAdmission({
      loading,
      pathname: link.href,
      sessionUser,
      dbUser,
    }).kind === "allow"
  );

  const isActiveLink = (href: string) => {
    if (href === "/panel") {
      return router.pathname === "/panel";
    }

    return router.pathname === href || router.pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="rz-sidebar">
      <div className="rz-sidebar-header">
        <span className="rz-sidebar-brand">{instanceConfig.store.name}</span>
        <span className="rz-sidebar-subtitle">Panel administrativo</span>
      </div>

      <nav className="rz-sidebar-nav">
        {visibleLinks.map((link) => {
          const active = isActiveLink(link.href);

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
            <div>{dbUser?.nombre || sessionUser?.email}</div>
            <div className="uppercase tracking-wide">{dbUser?.rol}</div>
          </>
        )}
      </div>
    </aside>
  );
};

export default PanelSidebar;
