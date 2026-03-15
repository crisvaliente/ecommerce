import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
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

type IntentoPagoEstado =
  | "iniciado"
  | "aprobado"
  | "rechazado"
  | "cancelado"
  | "expirado";

type PedidoItem = {
  producto_id: string | null;
  variante_id: string | null;
  nombre_producto: string;
  talle: string | null;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
};

type IntentoPago = {
  id: string;
  estado: IntentoPagoEstado;
  canal_pago: string;
  external_id: string | null;
  preference_id?: string | null;
  creado_en: string;
  actualizado_en: string;
};

type PedidoDetail = {
  pedido_id: string;
  estado: PedidoEstado;
  total: number;
  expira_en: string;
  bloqueado_por_stock: boolean;
  direccion_envio_snapshot: unknown;
  creado_en: string;
  actualizado_en: string;
  items: PedidoItem[];
  intento_pago: IntentoPago | null;
};

type ApiOk = {
  pedido: PedidoDetail;
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

const intentoEstadoLabel: Record<IntentoPagoEstado, string> = {
  iniciado: "Iniciado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  expirado: "Expirado",
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

function renderSnapshot(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") {
    return "Sin snapshot disponible";
  }

  const data = snapshot as Record<string, unknown>;
  const parts = [
    data.direccion,
    data.ciudad,
    data.pais,
    data.codigo_postal,
  ].filter((value) => typeof value === "string" && value.trim().length > 0);

  return parts.length > 0 ? parts.join(", ") : "Sin snapshot disponible";
}

function getPedidoBanner(pedido: PedidoDetail): {
  title: string;
  message: string;
  className: string;
} {
  if (pedido.bloqueado_por_stock || pedido.estado === "bloqueado") {
    return {
      title: "Pedido bloqueado",
      message: "Este pedido necesita revision antes de seguir avanzando.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (pedido.estado === "pendiente_pago") {
    return {
      title: "Esperando pago",
      message: "El pedido ya fue creado y esta a la espera de que el comprador complete el pago.",
      className: "border-blue-200 bg-blue-50 text-blue-900",
    };
  }

  if (pedido.estado === "pagado") {
    return {
      title: "Pago confirmado",
      message: "El pedido ya figura como pagado y puede seguir su curso operativo.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  return {
    title: "Pedido actualizado",
    message: "Este pedido ya tiene actividad registrada y puede seguir gestionandose desde el panel.",
    className: "border-stone-200 bg-stone-50 text-stone-900",
  };
}

function getIntentoStatusTone(intento: IntentoPago | null): string {
  if (!intento) return "text-stone-500";

  switch (intento.estado) {
    case "aprobado":
      return "text-emerald-300";
    case "rechazado":
    case "cancelado":
    case "expirado":
      return "text-rose-300";
    default:
      return "text-amber-300";
  }
}

const PanelPedidoDetailPage: React.FC = () => {
  const router = useRouter();
  const pedidoId =
    typeof router.query.id === "string" ? router.query.id.trim() : "";

  const [pedido, setPedido] = useState<PedidoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pedidoBanner = pedido ? getPedidoBanner(pedido) : null;

  const fetchPedido = useCallback(async () => {
    if (!pedidoId) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) console.error("[panel-pedido-detail] getSession error:", sessErr);

      const accessToken = session?.access_token;
      if (!accessToken) {
        setPedido(null);
        setErrorMsg("Sesión no válida. Volvé a iniciar sesión.");
        return;
      }

      const r = await fetch(`/api/panel/pedidos/${pedidoId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.error("[panel-pedido-detail] endpoint error:", r.status, txt);
        setPedido(null);
        setErrorMsg(
          r.status === 404
            ? "Pedido no encontrado."
            : "No se pudo cargar el detalle del pedido."
        );
        return;
      }

      const data = (await r.json()) as ApiOk;
      setPedido(data.pedido);
    } catch (err) {
      console.error(err);
      setPedido(null);
      setErrorMsg("Ocurrió un error al cargar el detalle del pedido.");
    } finally {
      setLoading(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!pedidoId) {
      setLoading(false);
      setErrorMsg("Pedido inválido.");
      return;
    }

    fetchPedido();
  }, [fetchPedido, pedidoId, router.isReady]);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link
            href="/panel/pedidos"
            className="text-sm font-medium text-emerald-400 hover:underline"
          >
            Volver a pedidos
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Pedido</h1>
          {pedidoId && (
            <p className="mt-1 text-sm text-slate-400">
              Seguimiento completo del pedido y su estado de cobro.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={fetchPedido}
          disabled={loading || !pedidoId}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
        >
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-300">Cargando detalle…</p>}

      {errorMsg && !loading && (
        <p className="mb-4 text-sm text-rose-400">{errorMsg}</p>
      )}

      {!loading && pedido && (
        <div className="space-y-6">
          {pedidoBanner && (
            <section className={`rounded-xl border p-4 ${pedidoBanner.className}`}>
              <p className="text-sm font-semibold">{pedidoBanner.title}</p>
              <p className="mt-1 text-sm opacity-90">{pedidoBanner.message}</p>
            </section>
          )}

          <section className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
              <p className="mt-1 text-sm text-slate-100">
                {estadoLabel[pedido.estado] ?? pedido.estado}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 text-sm text-slate-100">
                {pedido.total.toLocaleString("es-UY", {
                  style: "currency",
                  currency: "UYU",
                })}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Revision de stock</p>
              <p className="mt-1 text-sm text-slate-100">
                {pedido.bloqueado_por_stock ? "Requiere atencion" : "Sin observaciones"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Creado</p>
              <p className="mt-1 text-sm text-slate-100">{formatDate(pedido.creado_en)}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Expira</p>
              <p className="mt-1 text-sm text-slate-100">{formatDate(pedido.expira_en)}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Actualizado</p>
              <p className="mt-1 text-sm text-slate-100">{formatDate(pedido.actualizado_en)}</p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h2 className="text-lg font-medium text-slate-100">Entrega</h2>
            <p className="mt-3 text-sm text-slate-300">
              {renderSnapshot(pedido.direccion_envio_snapshot)}
            </p>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-slate-100">Cobro</h2>
            </div>

            {!pedido.intento_pago ? (
              <p className="text-sm text-slate-400">
                Todavia no hay un intento de pago asociado a este pedido.
              </p>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Estado del cobro
                    </p>
                    <p className={`mt-1 text-sm font-medium ${getIntentoStatusTone(pedido.intento_pago)}`}>
                      {intentoEstadoLabel[pedido.intento_pago.estado] ?? pedido.intento_pago.estado}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Canal</p>
                    <p className="mt-1 text-sm text-slate-100">{pedido.intento_pago.canal_pago}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Creado</p>
                    <p className="mt-1 text-sm text-slate-100">
                      {formatDate(pedido.intento_pago.creado_en)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Actualizado</p>
                    <p className="mt-1 text-sm text-slate-100">
                      {formatDate(pedido.intento_pago.actualizado_en)}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <h3 className="text-sm font-medium text-slate-100">Datos tecnicos</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Intento ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-100">
                        {pedido.intento_pago.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">Preference ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-100">
                        {pedido.intento_pago.preference_id ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">External ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-100">
                        {pedido.intento_pago.external_id ?? "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h2 className="mb-3 text-lg font-medium text-slate-100">Items</h2>

            {pedido.items.length === 0 ? (
              <p className="text-sm text-slate-400">Este pedido no tiene items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/60">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-slate-300">Producto</th>
                      <th className="px-4 py-2 text-left font-medium text-slate-300">Talle</th>
                      <th className="px-4 py-2 text-left font-medium text-slate-300">Cantidad</th>
                      <th className="px-4 py-2 text-left font-medium text-slate-300">Precio</th>
                      <th className="px-4 py-2 text-left font-medium text-slate-300">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.items.map((item, index) => (
                      <tr
                        key={`${item.producto_id ?? "item"}-${index}`}
                        className="border-t border-slate-800"
                      >
                        <td className="px-4 py-2 text-slate-200">{item.nombre_producto}</td>
                        <td className="px-4 py-2 text-slate-300">{item.talle ?? "-"}</td>
                        <td className="px-4 py-2 text-slate-300">{item.cantidad}</td>
                        <td className="px-4 py-2 text-slate-300">
                          {item.precio_unitario.toLocaleString("es-UY", {
                            style: "currency",
                            currency: "UYU",
                          })}
                        </td>
                        <td className="px-4 py-2 text-slate-100">
                          {item.subtotal.toLocaleString("es-UY", {
                            style: "currency",
                            currency: "UYU",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
};

export default PanelPedidoDetailPage;
