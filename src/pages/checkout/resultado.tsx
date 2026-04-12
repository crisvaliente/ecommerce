import Link from "next/link";
import { useRouter } from "next/router";

type CheckoutStatus = "success" | "failure" | "pending" | "unknown";

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

        <section className={`rounded-2xl border p-5 ${copy.tone}`}>
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="mt-2 text-sm opacity-90">{copy.message}</p>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Status recibido</p>
              <p className="mt-1 text-sm font-medium text-stone-900">{status}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">Pedido</p>
              <p className="mt-1 break-all text-sm text-stone-900">{pedidoId ?? "No informado"}</p>
            </div>
          </div>

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
