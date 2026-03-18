import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
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
      return "text-emerald-700";
    case "rechazado":
    case "cancelado":
    case "expirado":
      return "text-rose-700";
    default:
      return "text-amber-700";
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
            className="text-sm font-medium text-primary hover:underline"
          >
            Volver a pedidos
          </Link>
          <h1 className="mt-2 font-raleway text-2xl font-semibold text-text">Pedido</h1>
          {pedidoId && (
            <p className="mt-1 text-sm text-muted">
              Seguimiento completo del pedido y su estado de cobro.
            </p>
          )}
        </div>

        <Button
          variant="secondary"
          onClick={fetchPedido}
          disabled={loading || !pedidoId}
        >
          {loading ? "Cargando..." : "Refrescar"}
        </Button>
      </div>

      {loading && <p className="text-sm text-muted">Cargando detalle...</p>}

      {errorMsg && !loading && (
        <p className="mb-4 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{errorMsg}</p>
      )}

      {!loading && pedido && (
        <div className="space-y-6">
          {pedidoBanner && (
            <section className={`rounded-xl border p-4 ${pedidoBanner.className}`}>
              <p className="text-sm font-semibold">{pedidoBanner.title}</p>
              <p className="mt-1 text-sm opacity-90">{pedidoBanner.message}</p>
            </section>
          )}

          <Card className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Estado</p>
              <p className="mt-1 text-sm text-text">
                {estadoLabel[pedido.estado] ?? pedido.estado}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Total</p>
              <p className="mt-1 text-sm text-text">
                {pedido.total.toLocaleString("es-UY", {
                  style: "currency",
                  currency: "UYU",
                })}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Revision de stock</p>
              <p className="mt-1 text-sm text-text">
                {pedido.bloqueado_por_stock ? "Requiere atencion" : "Sin observaciones"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Creado</p>
              <p className="mt-1 text-sm text-text">{formatDate(pedido.creado_en)}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Expira</p>
              <p className="mt-1 text-sm text-text">{formatDate(pedido.expira_en)}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Actualizado</p>
              <p className="mt-1 text-sm text-text">{formatDate(pedido.actualizado_en)}</p>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-medium text-text">Entrega</h2>
            <p className="mt-3 text-sm text-muted">
              {renderSnapshot(pedido.direccion_envio_snapshot)}
            </p>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-text">Cobro</h2>
            </div>

            {!pedido.intento_pago ? (
              <p className="text-sm text-muted">
                Todavia no hay un intento de pago asociado a este pedido.
              </p>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">
                      Estado del cobro
                    </p>
                    <p className={`mt-1 text-sm font-medium ${getIntentoStatusTone(pedido.intento_pago)}`}>
                      {intentoEstadoLabel[pedido.intento_pago.estado] ?? pedido.intento_pago.estado}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Canal</p>
                    <p className="mt-1 text-sm text-text">{pedido.intento_pago.canal_pago}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Creado</p>
                    <p className="mt-1 text-sm text-text">
                      {formatDate(pedido.intento_pago.creado_en)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">Actualizado</p>
                    <p className="mt-1 text-sm text-text">
                      {formatDate(pedido.intento_pago.actualizado_en)}
                    </p>
                  </div>
                </div>

                <Card className="p-4" muted>
                  <h3 className="text-sm font-medium text-text">Datos tecnicos</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Intento ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-text">
                        {pedido.intento_pago.id}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">Preference ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-text">
                        {pedido.intento_pago.preference_id ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">External ID</p>
                      <p className="mt-1 break-all font-mono text-xs text-text">
                        {pedido.intento_pago.external_id ?? "-"}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-lg font-medium text-text">Items</h2>

            {pedido.items.length === 0 ? (
              <p className="text-sm text-muted">Este pedido no tiene items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-black/[0.03]">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-muted">Producto</th>
                      <th className="px-4 py-2 text-left font-medium text-muted">Talle</th>
                      <th className="px-4 py-2 text-left font-medium text-muted">Cantidad</th>
                      <th className="px-4 py-2 text-left font-medium text-muted">Precio</th>
                      <th className="px-4 py-2 text-left font-medium text-muted">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.items.map((item, index) => (
                      <tr
                        key={`${item.producto_id ?? "item"}-${index}`}
                        className="border-t border-border"
                      >
                        <td className="px-4 py-2 text-text">{item.nombre_producto}</td>
                        <td className="px-4 py-2 text-muted">{item.talle ?? "-"}</td>
                        <td className="px-4 py-2 text-muted">{item.cantidad}</td>
                        <td className="px-4 py-2 text-muted">
                          {item.precio_unitario.toLocaleString("es-UY", {
                            style: "currency",
                            currency: "UYU",
                          })}
                        </td>
                        <td className="px-4 py-2 text-text">
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
          </Card>
        </div>
      )}
    </AdminLayout>
  );
};

export default PanelPedidoDetailPage;
