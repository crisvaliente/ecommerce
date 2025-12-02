// src/pages/panel/payments.tsx
import React from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";

const PaymentsPage: React.FC = () => {
  const { dbUser } = useAuth();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Empresa actual */}
        <section>
          <p className="text-xs uppercase tracking-[0.18em] text-gray-600">
            Empresa actual
          </p>
          <p className="text-sm font-medium text-gray-900">
            {dbUser?.empresa_id ?? "—"}
          </p>
        </section>

        {/* Card principal */}
        <section className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Pagos</h1>
          <p className="mt-2 text-sm text-gray-600">
            Acá más adelante vas a manejar integraciones de cobro y estados de pago.
          </p>
        </section>
      </div>
    </AdminLayout>
  );
};

export default PaymentsPage;
