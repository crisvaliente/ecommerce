import React from "react";
import AdminLayout from "../../components/layout/AdminLayout";

const PanelHomePage: React.FC = () => {
  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold">Panel de la empresa</h1>
      <p className="mt-2 text-sm text-slate-300">
        Bienvenido al panel administrativo. Desde aquí vas a gestionar productos,
        categorías, pagos y más.
      </p>
    </AdminLayout>
  );
};

export default PanelHomePage;
