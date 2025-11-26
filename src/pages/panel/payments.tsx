import React from "react";
import AdminLayout from "../../components/layout/AdminLayout";

const PaymentsPage: React.FC = () => {
  return (
    <AdminLayout>
      <h1 className="mb-2 text-2xl font-semibold">Pagos</h1>
      <p className="text-sm text-slate-300">
        Acá más adelante vas a manejar integraciones de cobro y estados de pago.
      </p>
    </AdminLayout>
  );
};

export default PaymentsPage;
