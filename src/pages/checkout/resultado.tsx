import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type CheckoutStatus = "success" | "failure" | "pending" | "unknown";

type PedidoEstado = "pendiente_pago" | "pagado" | "bloqueado" | string;

type PedidoResponse = {
  pedido: {
    pedido_id: string;
    estado: PedidoEstado;
    total: number;
    expira_en: string;
    creado_en: string;
    actualizado_en: string;
  };
};

function resolveStatus(value: string | string[] | undefined): CheckoutStatus {
  const status = Array.isArray(value) ? value[0] : value;

  switch (status) {
    case "success":
    case "failure":
    case "pending":
      return status;
    default:
      return "unknown";
  }
}

function getStatusCopy(status: CheckoutStatus): {
  title: string;
  message: string;
  tone: string;
} {
  switch (status) {
    case "success":
      return {
        title: "Estamos verificando tu pago",
        message:
          "Mercado Pago informó un retorno exitoso, pero la confirmación final depende del procesamiento de nuestro sistema.",
        tone: "border-blue-200 bg-blue-50 text-blue-900",
      };
    case "pending":
      return {
        title: "Pago en proceso",
        message:
          "Tu pago quedó pendiente de confirmación. Refrescá más tarde para ver el estado definitivo del pedido.",
        tone: "border-amber-200 bg-amber-50 text-amber-900",
      };
    case "failure":
      return {
        title: "Pago no completado",
        message:
          "El checkout volvió con estado de fallo. Podés revisar tu pedido y volver a intentarlo si sigue vigente.",
        tone: "border-rose-200 bg-rose-50 text-rose-900",
      };
    default:
      return {
        title: "Estado del checkout recibido",
        message:
          "Recibimos el retorno del checkout, pero el estado informado no fue reconocido. Revisá tu pedido para confirmar cómo quedó.",
        tone: "border-stone-200 bg-stone-50 text-stone-900",
      };
  }
}

export default function CheckoutResultadoPage() {
  const router = useRouter();
  const status = resolveStatus(router.query.status);
  const pedidoId = typeof router.query.pedido_id === "string" ? router.query.pedido_id : null;
  const copy = getStatusCopy(status);
  const [pedidoEstado, setPedidoEstado] = useState<PedidoEstado | null>(null);
  const [pedidoTotal, setPedidoTotal] = useState<number | null>(null);
  const [loadingPedido, setLoadingPedido] = useState(false);
  const [pedidoError, setPedidoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPedido = async () => {
      if (!pedidoId) return;

      try {
        setLoadingPedido(true);
        setPedidoError(null);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        const accessToken = session?.access_token ?? null;

        if (sessionError || !accessToken) {
          if (!cancelled) {
            setPedidoError("No pudimos validar tu sesión para consultar el pedido.");
          }
          return;
        }

        const response = await fetch(`/api/ecommerce/pedido/${pedidoId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const body = (await response.json().catch(() => null)) as PedidoResponse | { error?: string } | null;

        if (!response.ok || !body || !("pedido" in body) || !body.pedido) {
          if (!cancelled) {
            setPedidoError("No pudimos confirmar el estado real del pedido todavía.");
          }
          return;
        }

        if (!cancelled) {
          setPedidoEstado(body.pedido.estado);
          setPedidoTotal(typeof body.pedido.total === "number" ? body.pedido.total : null);
        }
      } catch {
        if (!cancelled) {
          setPedidoError("No pudimos confirmar el estado real del pedido todavía.");
        }
      } finally {
        if (!cancelled) {
          setLoadingPedido(false);
        }
      }
    };

    loadPedido();

    return () => {
      cancelled = true;
    };
  }, [pedidoId]);

  const resolvedCopy = useMemo(() => {
    if (loadingPedido) {
      return {
        title: "Estamos consultando tu pedido",
        message:
          "Ya recibimos el retorno del checkout y estamos consultando el estado real del pedido en nuestro sistema.",
        tone: "border-blue-200 bg-blue-50 text-blue-900",
      };
    }

    if (pedidoEstado === "pagado") {
      return {
        title: "Pago confirmado",
        message: "El pedido ya figura como pagado y quedó confirmado correctamente.",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      };
    }

    if (pedidoEstado === "bloqueado") {
      return {
        title: "Pedido en revisión",
        message:
          "Recibimos actividad de pago, pero el pedido quedó bloqueado y requiere revisión antes de confirmarse.",
        tone: "border-amber-200 bg-amber-50 text-amber-900",
      };
    }

    if (pedidoEstado === "pendiente_pago") {
      return {
        title: "Pago en verificación",
        message:
          "Mercado Pago informó un retorno, pero el pedido todavía sigue pendiente de confirmación en nuestro sistema.",
        tone: "border-blue-200 bg-blue-50 text-blue-900",
      };
    }

    if (pedidoError) {
      return {
        title: copy.title,
        message: pedidoError,
        tone: "border-stone-200 bg-stone-50 text-stone-900",
      };
    }

    return copy;
  }, [copy, loadingPedido, pedidoEstado, pedidoError]);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Checkout Mercado Pago</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Resultado del checkout</h1>
          <p className="mt-2 text-sm text-stone-600">
            Esta pantalla informa el retorno del proveedor, pero la verdad final del pago depende del estado real de tu pedido.
          </p>
        </section>

        <section className={`rounded-2xl border p-5 ${resolvedCopy.tone}`}>
          <p className="text-sm font-semibold">{resolvedCopy.title}</p>
          <p className="mt-2 text-sm opacity-90">{resolvedCopy.message}</p>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Status recibido</p>
              <p className="mt-1 text-sm font-medium text-stone-900">{status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Pedido</p>
              <p className="mt-1 break-all text-sm text-stone-900">{pedidoId ?? "No informado"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Estado real</p>
              <p className="mt-1 text-sm font-medium text-stone-900">
                {loadingPedido
                  ? "Consultando..."
                  : pedidoEstado ?? (pedidoError ? "No disponible" : "Sin confirmar")}
              </p>
            </div>
          </div>

          {pedidoTotal !== null && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-stone-500">Total del pedido</p>
              <p className="mt-1 text-sm text-stone-900">
                {pedidoTotal.toLocaleString("es-UY", {
                  style: "currency",
                  currency: "UYU",
                })}
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={pedidoId ? `/panel/pedidos/${pedidoId}` : "/coleccion"}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              {pedidoId ? "Ver pedido en panel" : "Volver a colección"}
            </Link>
            <Link
              href="/coleccion"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-50"
            >
              Volver a colección
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
