// src/pages/panel/payments.tsx
import React from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";

const PaymentsPage: React.FC = () => {
  const { dbUser } = useAuth();

  const empresaId = dbUser?.empresa_id ?? null;

  return (
    <AdminLayout>
      <div className="px-8 py-6 max-w-5xl">
        {/* Encabezado */}
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Panel administrativo
          </p>

          <h1 className="text-2xl font-semibold text-slate-900 mt-1">
            Pagos
          </h1>

          <p className="text-sm text-slate-500 mt-2 max-w-lg">
            Desde acá vas a configurar y administrar los métodos de cobro de tu
            tienda, empezando por la integración con MercadoPago.
          </p>
        </header>

        {/* Empresa actual */}
        <section className="mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Empresa actual
          </p>
          {empresaId ? (
            <p className="mt-1 text-xs text-slate-400">
              ID:{" "}
              <span className="font-mono text-[11px]">
                {empresaId}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">
              No se encontró información de empresa asociada.
            </p>
          )}
        </section>

        {/* Card principal */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Integraciones de pago
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Acá más adelante vas a manejar integraciones de cobro y estados de
            pago. El primer paso va a ser conectar tu cuenta de MercadoPago en
            modo test y, luego, en producción.
          </p>

          {/* Lugar reservado para el primer botón de MP */}
          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
              disabled
            >
              Conectar MercadoPago (próximamente)
            </button>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default PaymentsPage;
