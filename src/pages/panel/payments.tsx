// src/pages/panel/payments.tsx
import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";

type PagosResponse = {
  configurado: boolean;
  live_mode: boolean | null;
  estado: "activo" | "inactivo" | null;
};

type PagosStatus = "loading" | "error" | PagosResponse;

function usePagosStatus(): PagosStatus {
  const [status, setStatus] = useState<PagosStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        if (!cancelled) setStatus("error");
        return;
      }

      let response: Response;
      try {
        response = await fetch("/api/panel/pagos", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }

      const body = (await response.json().catch(() => null)) as PagosResponse | null;
      if (!response.ok || !body) {
        if (!cancelled) setStatus("error");
        return;
      }

      if (!cancelled) setStatus(body);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

function PagosStatusCard({ status }: { status: PagosStatus }) {
  if (status === "loading") {
    return <p className="mt-2 text-sm text-slate-500">Cargando estado de pagos...</p>;
  }

  if (status === "error") {
    return (
      <p className="mt-2 text-sm text-rose-600">
        No pudimos cargar el estado de pagos. Reintent\u00e1 m\u00e1s tarde.
      </p>
    );
  }

  if (!status.configurado) {
    return (
      <p className="mt-2 text-sm text-slate-600">
        Pagos no configurados: pedile al operador de la plataforma que los cargue.
      </p>
    );
  }

  if (status.estado === "inactivo") {
    return <p className="mt-2 text-sm text-slate-600">Pagos desactivados</p>;
  }

  return (
    <p className="mt-2 text-sm text-slate-600">
      Pagos configurados ({status.live_mode ? "modo real" : "modo prueba"})
    </p>
  );
}

const PaymentsPage: React.FC = () => {
  const { dbUser } = useAuth();
  const status = usePagosStatus();

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
            Desde ac\u00e1 vas a ver el estado de la integraci\u00f3n con MercadoPago de tu
            tienda.
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
              No se encontr\u00f3 informaci\u00f3n de empresa asociada.
            </p>
          )}
        </section>

        {/* Card principal */}
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Integraciones de pago
          </h2>
          <PagosStatusCard status={status} />
        </section>
      </div>
    </AdminLayout>
  );
};

export default PaymentsPage;
