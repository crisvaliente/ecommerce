import React from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";

const PanelHomePage: React.FC = () => {
  const { dbUser } = useAuth();
  const empresaId = typeof dbUser?.empresa_id === "string" && dbUser.empresa_id.trim()
    ? dbUser.empresa_id
    : "—";
  const empresaLabel = "Empresa actual";

  return (
    <AdminLayout>
      <div className="px-8 py-6 max-w-5xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Panel administrativo
          </p>

          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            {empresaLabel}
          </h1>

          <p className="mt-1 text-xs text-slate-400">
            ID empresa: <span className="font-mono text-[11px]">{empresaId}</span>
          </p>

          <p className="text-sm text-slate-500 mt-3 max-w-lg">
            Desde acá vas a gestionar los productos, categorías, métodos de pago,
            integraciones y la configuración general de tu tienda.
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-medium text-slate-800">Productos</h2>
            <p className="text-sm text-slate-500 mt-1">
              Administrá el catálogo de tu tienda.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-medium text-slate-800">Categorías</h2>
            <p className="text-sm text-slate-500 mt-1">
              Organizá tus productos según rubros.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-medium text-slate-800">Métodos de pago</h2>
            <p className="text-sm text-slate-500 mt-1">
              Próximamente: integración con MercadoPago.
            </p>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default PanelHomePage;
