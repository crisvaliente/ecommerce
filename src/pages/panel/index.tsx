import React from "react";
import AdminLayout from "../../components/layout/AdminLayout";

const PanelHomePage: React.FC = () => {
  return (
    <AdminLayout>
      <h1 className="mb-2 text-2xl font-semibold">Panel de la empresa</h1>
      <p className="text-sm text-slate-300">
        Acá vas a ver el resumen, métricas y accesos rápidos a productos, categorías y más.
      </p>
    </AdminLayout>
  );
};

export default PanelHomePage;

