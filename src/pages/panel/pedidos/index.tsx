import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
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

function getEstadoBadgeClass(pedido: PedidoPanelDTO): string {
  if (pedido.bloqueado_por_stock || pedido.estado === "bloqueado") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  }

  switch (pedido.estado) {
    case "pagado":
    case "entregado":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
    case "cancelado":
      return "border-rose-500/20 bg-rose-500/10 text-rose-700";
    default:
      return "border-border bg-black/[0.03] text-text";
  }
}

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
          <h1 className="font-raleway text-2xl font-semibold text-text">Pedidos</h1>
          <p className="text-sm text-muted">
            Revisá los pedidos más recientes de tu empresa.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={fetchPedidos}
          disabled={loading}
        >
          {loading ? "Cargando..." : "Refrescar"}
        </Button>
      </div>

      {loading && <p className="text-sm text-muted">Cargando pedidos...</p>}

      {errorMsg && !loading && (
        <p className="mb-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{errorMsg}</p>
      )}

      {!loading && !errorMsg && pedidos.length === 0 && (
        <Card className="p-6 text-center" muted>
          <p className="text-sm text-muted">Todavia no hay pedidos.</p>
        </Card>
      )}

      {!loading && pedidos.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted">
                  Pedido
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted">
                  Estado
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted">
                  Total
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted">
                  Creado
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted">
                  Expira
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {pedidos.map((pedido) => (
                <tr key={pedido.pedido_id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs text-text">
                    {pedido.pedido_id}
                  </td>

                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getEstadoBadgeClass(pedido)}`}>
                      {estadoLabel[pedido.estado] ?? pedido.estado}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-text">
                    {Number(pedido.total).toLocaleString("es-UY", {
                      style: "currency",
                      currency: "UYU",
                    })}
                  </td>

                  <td className="px-4 py-3 text-muted">
                    {formatDate(pedido.creado_en)}
                  </td>

                  <td className="px-4 py-3 text-muted">
                    {formatDate(pedido.expira_en)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/panel/pedidos/${pedido.pedido_id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AdminLayout>
  );
};

export default PanelPedidosPage;
