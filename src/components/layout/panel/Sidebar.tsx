import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";

const links = [
  { href: "/panel", label: "Inicio" },
  { href: "/panel/productos", label: "Productos" },
  { href: "/panel/categorias", label: "Categorías" },
  { href: "/panel/payments", label: "Pagos" },
];

const PanelSidebar: React.FC = () => {
  const router = useRouter();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950/80">
      <div className="px-4 py-4 text-lg font-semibold tracking-wide">
        Raeyz Panel
      </div>
      <nav className="flex-1 space-y-1 px-2">
        {links.map((link) => {
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
      </nav>
    </aside>
  );
};

export default PanelSidebar;
