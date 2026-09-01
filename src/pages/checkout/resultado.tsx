import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "../../components/ui/CartContext";
import { useAuth } from "../../context/AuthContext";
import {
  getCheckoutMarkerForCart,
  removeCheckoutMarkerIfMatches,
  shouldPollPedido,
} from "../../lib/buyerCheckout";
import { formatCurrency } from "../../lib/formatters";
import { supabase } from "../../lib/supabaseClient";

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

const MAX_POLL_ATTEMPTS = 5;
const POLL_DELAYS_MS = [2_000, 4_000, 6_000, 8_000] as const;

export default function CheckoutResultadoPage() {
  const router = useRouter();
  const pedidoId = typeof router.query.pedido_id === "string" ? router.query.pedido_id : null;
  const { sessionUser, loading: authLoading } = useAuth();
  const {
    empresaId,
    items,
    isHydrated,
    clearCartIfMatches,
  } = useCart();
  const [pedidoEstado, setPedidoEstado] = useState<PedidoEstado | null>(null);
  const [pedidoTotal, setPedidoTotal] = useState<number | null>(null);
  const [loadingPedido, setLoadingPedido] = useState(false);
  const [pedidoError, setPedidoError] = useState<string | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const loadPedido = async (): Promise<void> => {
      if (!pedidoId || !router.isReady) return;

      try {
        setLoadingPedido(true);
        setPedidoError(null);

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token ?? null;

        if (sessionError || !accessToken) {
          if (!cancelled) setPedidoError("Iniciá sesión para consultar el estado real del pedido.");
          return;
        }

        const response = await fetch(`/api/ecommerce/pedido/${pedidoId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = (await response.json().catch(() => null)) as
          | PedidoResponse
          | { error?: string }
          | null;

        if (!response.ok || !body || !("pedido" in body) || !body.pedido) {
          if (!cancelled) setPedidoError("No pudimos confirmar el estado real del pedido.");
          return;
        }

        attempts += 1;
        const estado = body.pedido.estado;
        if (!cancelled) {
          setPedidoEstado(estado);
          setPedidoTotal(typeof body.pedido.total === "number" ? body.pedido.total : null);
        }

        if (shouldPollPedido(estado, attempts, MAX_POLL_ATTEMPTS)) {
          const delay = POLL_DELAYS_MS[Math.min(attempts - 1, POLL_DELAYS_MS.length - 1)];
          timer = setTimeout(() => void loadPedido(), delay);
        } else if (!cancelled && estado === "pendiente_pago") {
          setPollExhausted(true);
        }
      } catch {
        if (!cancelled) setPedidoError("No pudimos confirmar el estado real del pedido.");
      } finally {
        if (!cancelled) setLoadingPedido(false);
      }
    };

    setPollExhausted(false);
    void loadPedido();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pedidoId, refreshNonce, router.isReady]);

  useEffect(() => {
    if (
      pedidoEstado !== "pagado" ||
      !pedidoId ||
      !sessionUser ||
      !isHydrated ||
      !empresaId ||
      items.length === 0
    ) {
      return;
    }

    let marker;
    try {
      marker = getCheckoutMarkerForCart(
        window.localStorage,
        sessionUser.id,
        { empresaId, items },
      );
    } catch {
      return;
    }

    if (!marker || marker.pedidoId !== pedidoId) return;
    if (!clearCartIfMatches(marker.cartMarker)) return;
    removeCheckoutMarkerIfMatches(
      window.localStorage,
      marker,
      pedidoId,
      sessionUser.id,
    );
  }, [
    clearCartIfMatches,
    empresaId,
    isHydrated,
    items,
    pedidoEstado,
    pedidoId,
    sessionUser,
  ]);

  const resolvedCopy = useMemo(() => {
    if (!pedidoId) {
      return {
        title: "Pedido no informado",
        message: "El retorno no incluye un pedido que podamos consultar.",
        tone: "border-stone-200 bg-stone-50 text-stone-900",
      };
    }
    if (pedidoEstado === "pagado") {
      return {
        title: "Pago confirmado",
        message: "El estado real del pedido figura como pagado.",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      };
    }
    if (pedidoEstado === "bloqueado") {
      return {
        title: "Pedido en revisión",
        message: "El pedido está bloqueado y requiere revisión antes de confirmarse.",
        tone: "border-amber-200 bg-amber-50 text-amber-900",
      };
    }
    if (pedidoEstado === "pendiente_pago") {
      return {
        title: pollExhausted ? "El pago sigue pendiente" : "Pago en verificación",
        message: pollExhausted
          ? "Terminamos las consultas automáticas. Podés volver a consultar manualmente."
          : "Estamos consultando el estado real del pedido mientras se procesa el pago.",
        tone: "border-blue-200 bg-blue-50 text-blue-900",
      };
    }
    if (pedidoError) {
      return {
        title: "No pudimos verificar el pedido",
        message: pedidoError,
        tone: "border-rose-200 bg-rose-50 text-rose-900",
      };
    }
    return {
      title: "Consultando tu pedido",
      message: "Estamos consultando el estado real en nuestro sistema.",
      tone: "border-blue-200 bg-blue-50 text-blue-900",
    };
  }, [pedidoError, pedidoEstado, pedidoId, pollExhausted]);

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Checkout Mercado Pago</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Estado de tu pedido</h1>
          <p className="mt-2 text-sm text-stone-600">
            La confirmación depende exclusivamente del estado real del pedido, no del estado informado en la URL.
          </p>
        </section>

        <section className={`rounded-2xl border p-5 ${resolvedCopy.tone}`} aria-live="polite">
          <p className="text-sm font-semibold">{resolvedCopy.title}</p>
          <p className="mt-2 text-sm opacity-90">{resolvedCopy.message}</p>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Pedido</p>
              <p className="mt-1 break-all text-sm text-stone-900">{pedidoId ?? "No informado"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Estado real</p>
              <p className="mt-1 text-sm font-medium text-stone-900">
                {loadingPedido && !pedidoEstado
                  ? "Consultando..."
                  : pedidoEstado ?? (pedidoError ? "No disponible" : "Sin confirmar")}
              </p>
            </div>
          </div>

          {pedidoTotal !== null && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-stone-500">Total del pedido</p>
              <p className="mt-1 text-sm text-stone-900">{formatCurrency(pedidoTotal)}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {(pollExhausted || pedidoError) && pedidoId && sessionUser && (
              <button
                type="button"
                onClick={() => setRefreshNonce((value) => value + 1)}
                disabled={loadingPedido}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
              >
                {loadingPedido ? "Consultando..." : "Consultar nuevamente"}
              </button>
            )}
            {!authLoading && !sessionUser && (
              <Link
                href="/auth/login?next=/coleccion"
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
              >
                Iniciar sesión
              </Link>
            )}
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
