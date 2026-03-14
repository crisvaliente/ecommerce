import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import { supabase } from "../../../lib/supabaseClient";

type PedidoEstado =
  | "pendiente_pago"
  | "pagado"
  | "bloqueado"
  | "en_preparacion"
  | "enviado"
  | "entregado"
  | "cancelado";

type PedidoPanelDTO = {
  pedido_id: string;
  estado: PedidoEstado;
  total: number;
  creado_en: string;
  expira_en: string;
  bloqueado_por_stock: boolean;
};

type ApiOk = {
  pedidos: PedidoPanelDTO[];
  meta: {
    count: number;
  };
};

const estadoLabel: Record<PedidoEstado, string> = {
  pendiente_pago: "Pendiente pago",
  pagado: "Pagado",
  bloqueado: "Bloqueado",
  en_preparacion: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("es-UY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PanelPedidosPage: React.FC = () => {
  const [pedidos, setPedidos] = useState<PedidoPanelDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPedidos = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) console.error("[pedidos] getSession error:", sessErr);

      const accessToken = session?.access_token;
      if (!accessToken) {
        setPedidos([]);
        setErrorMsg("Sesión no válida. Volvé a iniciar sesión.");
        return;
      }

      const r = await fetch("/api/panel/pedidos", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.error("[pedidos] endpoint error:", r.status, txt);
        setPedidos([]);
        setErrorMsg("No se pudieron cargar los pedidos.");
        return;
      }

      const data = (await r.json()) as ApiOk;
      setPedidos(data.pedidos ?? []);
    } catch (err) {
      console.error(err);
      setPedidos([]);
      setErrorMsg("Ocurrió un error al cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  return (
    <AdminLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-sm text-slate-300">
            Revisá los pedidos más recientes de tu empresa.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPedidos}
          disabled={loading}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
        >
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-300">Cargando pedidos…</p>}

      {errorMsg && !loading && (
        <p className="mb-3 text-sm text-rose-400">{errorMsg}</p>
      )}

      {!loading && !errorMsg && pedidos.length === 0 && (
        <p className="text-sm text-slate-400">Todavía no hay pedidos.</p>
      )}

      {!loading && pedidos.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Pedido
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Estado
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Total
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Creado
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Expira
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-300">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.pedido_id} className="border-t border-slate-800">
                  <td className="px-4 py-2 font-mono text-xs text-slate-200">
                    {pedido.pedido_id}
                  </td>

                  <td className="px-4 py-2">
                    <span
                      className={
                        pedido.bloqueado_por_stock
                          ? "text-amber-300"
                          : "text-slate-200"
                      }
                    >
                      {estadoLabel[pedido.estado] ?? pedido.estado}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-slate-200">
                    {Number(pedido.total).toLocaleString("es-UY", {
                      style: "currency",
                      currency: "UYU",
                    })}
                  </td>

                  <td className="px-4 py-2 text-slate-300">
                    {formatDate(pedido.creado_en)}
                  </td>

                  <td className="px-4 py-2 text-slate-300">
                    {formatDate(pedido.expira_en)}
                  </td>

                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/panel/pedidos/${pedido.pedido_id}`}
                      className="text-xs font-medium text-emerald-400 hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};

export default PanelPedidosPage;
