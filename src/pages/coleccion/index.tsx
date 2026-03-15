import React, { useMemo, useState } from "react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useAuth } from "../../context/AuthContext";
import { supabaseServer } from "../../lib/supabaseServer";
import { supabase } from "../../lib/supabaseClient";

type ProductoEstado = "draft" | "published";

type ProductoRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  estado: ProductoEstado;
  stock: number | null;
};

type StockResumenRow = {
  producto_id: string;
  stock_total: number;
  usa_variantes: boolean;
};

type ProductoStorefront = {
  producto_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock_efectivo: number;
  usa_variantes: boolean;
};

type PageProps = {
  empresaId: string | null;
  productos: ProductoStorefront[];
  error: string | null;
};

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
) => {
  const rawEmpresaId = context.query.empresa_id;
  const empresaId =
    typeof rawEmpresaId === "string" && rawEmpresaId.trim().length > 0
      ? rawEmpresaId.trim()
      : null;

  if (!empresaId) {
    return {
      props: {
        empresaId: null,
        productos: [],
        error: "empresa_id_required",
      },
    };
  }

  const { data: productosData, error: productosError } = await supabaseServer
    .from("producto")
    .select("id, nombre, descripcion, precio, estado, stock")
    .eq("empresa_id", empresaId)
    .eq("estado", "published")
    .order("nombre", { ascending: true })
    .returns<ProductoRow[]>();

  if (productosError) {
    return {
      props: {
        empresaId,
        productos: [],
        error: "product_read_failed",
      },
    };
  }

  const { data: resumenData } = await supabaseServer
    .from("producto_stock_resumen")
    .select("producto_id, stock_total, usa_variantes")
    .eq("empresa_id", empresaId)
    .returns<StockResumenRow[]>();

  const resumenMap = new Map<string, StockResumenRow>(
    (resumenData ?? []).map((row) => [row.producto_id, row])
  );

  const productos: ProductoStorefront[] = (productosData ?? []).map((p) => {
    const resumen = resumenMap.get(p.id);
    const stockBase = typeof p.stock === "number" ? p.stock : 0;

    return {
      producto_id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      stock_efectivo:
        typeof resumen?.stock_total === "number" ? resumen.stock_total : stockBase,
      usa_variantes:
        typeof resumen?.usa_variantes === "boolean" ? resumen.usa_variantes : false,
    };
  });

  return {
    props: {
      empresaId,
      productos,
      error: null,
    },
  };
};

const ColeccionPage: React.FC<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = ({ empresaId, productos, error }) => {
  const { sessionUser, dbUser } = useAuth();
  const [direccionEnvioId, setDireccionEnvioId] = useState("");
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [pedidoResult, setPedidoResult] = useState<{
    pedido_id: string;
    producto_id: string;
  } | null>(null);
  const [pedidoError, setPedidoError] = useState<string | null>(null);
  const [pedidoIdParaPago, setPedidoIdParaPago] = useState("");
  const [creatingIntento, setCreatingIntento] = useState(false);
  const [intentoError, setIntentoError] = useState<string | null>(null);
  const [intentoResult, setIntentoResult] = useState<{
    id: string;
    pedido_id: string;
    estado: string;
    preference_id: string;
    init_point: string;
  } | null>(null);

  const canCreatePedido = useMemo(() => {
    return Boolean(sessionUser && dbUser?.id && dbUser?.empresa_id && empresaId);
  }, [dbUser?.empresa_id, dbUser?.id, empresaId, sessionUser]);

  const handleCrearPedido = async (producto: ProductoStorefront) => {
    if (!canCreatePedido || !dbUser?.id || !dbUser.empresa_id || !empresaId) {
      setPedidoError(
        "Necesitás iniciar sesión con un usuario válido para crear el pedido."
      );
      return;
    }

    const direccionId = direccionEnvioId.trim();
    if (!direccionId) {
      setPedidoError(
        "Ingresá un direccion_envio_id válido antes de crear el pedido."
      );
      return;
    }

    setCreatingFor(producto.producto_id);
    setPedidoError(null);
    setPedidoResult(null);

    try {
      const response = await fetch("/api/ecommerce/pedido", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuario_id: dbUser.id,
          empresa_id: empresaId,
          direccion_envio_id: direccionId,
          items: [
            {
              producto_id: producto.producto_id,
              cantidad: 1,
            },
          ],
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { pedido_id?: string; error?: string }
        | null;

      if (!response.ok || !body?.pedido_id) {
        setPedidoError(body?.error ?? "pedido_creation_failed");
        return;
      }

      setPedidoResult({
        pedido_id: body.pedido_id,
        producto_id: producto.producto_id,
      });
      setPedidoIdParaPago(body.pedido_id);
    } catch (err) {
      console.error(err);
      setPedidoError("unexpected_error");
    } finally {
      setCreatingFor(null);
    }
  };

  const handleCrearIntentoPago = async () => {
    const pedidoId = pedidoIdParaPago.trim();

    if (!pedidoId) {
      setIntentoError("Ingresá un pedido_id válido antes de crear el intento de pago.");
      return;
    }

    setCreatingIntento(true);
    setIntentoError(null);
    setIntentoResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token ?? null;

      if (sessionError || !accessToken) {
        setIntentoError("Necesitás iniciar sesión para crear el intento de pago.");
        return;
      }

      const response = await fetch("/api/ecommerce/intento-pago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pedido_id: pedidoId,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            intento_pago?: {
              id: string;
              pedido_id: string;
              estado: string;
              preference_id: string;
              init_point: string;
            };
            error?: string;
          }
        | null;

      if (!response.ok || !body?.intento_pago) {
        setIntentoError(body?.error ?? "intento_pago_creation_failed");
        return;
      }

      setIntentoResult(body.intento_pago);
    } catch (err) {
      console.error(err);
      setIntentoError("unexpected_error");
    } finally {
      setCreatingIntento(false);
    }
  };

  return (
    <main className="container mx-auto p-4">
      <h1 className="mb-4 text-3xl font-bold">Colección</h1>

      {!empresaId && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Falta <code>empresa_id</code> en la URL. Usá un enlace como
          <code> /coleccion?empresa_id=&lt;uuid&gt;</code>.
        </p>
      )}

      {empresaId && error === "product_read_failed" && (
        <p className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          No se pudieron cargar los productos publicados para esta empresa.
        </p>
      )}

      {empresaId && !error && productos.length === 0 && (
        <p className="text-sm text-slate-600">
          No hay productos publicados para esta empresa.
        </p>
      )}

      {empresaId && !error && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Crear pedido de validación
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Camino mínimo: producto simple, cantidad fija 1 y dirección ingresada
            manualmente.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">direccion_envio_id</span>
              <input
                type="text"
                value={direccionEnvioId}
                onChange={(e) => setDireccionEnvioId(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="uuid de public.direccion_usuario"
              />
            </label>

            <div className="text-sm text-slate-600">
              {canCreatePedido
                ? `Usuario: ${dbUser?.correo ?? dbUser?.id}`
                : "Iniciá sesión para habilitar la creación del pedido."}
            </div>
          </div>

          {pedidoError && (
            <p className="mt-3 text-sm text-rose-700">Error: {pedidoError}</p>
          )}

          {pedidoResult && (
            <p className="mt-3 text-sm text-emerald-700">
              Pedido creado: <code>{pedidoResult.pedido_id}</code> para producto{" "}
              <code>{pedidoResult.producto_id}</code>
            </p>
          )}
        </section>
      )}

      {empresaId && !error && (
        <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Crear intento de pago de validación
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Camino mínimo: usar un pedido pendiente existente y abrir el bridge de Mercado Pago.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">pedido_id</span>
              <input
                type="text"
                value={pedidoIdParaPago}
                onChange={(e) => setPedidoIdParaPago(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                placeholder="uuid de public.pedido"
              />
            </label>

            <button
              type="button"
              onClick={handleCrearIntentoPago}
              disabled={creatingIntento || !pedidoIdParaPago.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {creatingIntento ? "Creando intento..." : "Crear intento de pago"}
            </button>
          </div>

          {intentoError && (
            <p className="mt-3 text-sm text-rose-700">Error: {intentoError}</p>
          )}

          {intentoResult && (
            <div className="mt-3 space-y-2 text-sm text-emerald-700">
              <p>
                Intento creado: <code>{intentoResult.id}</code>
              </p>
              <p>
                Preference: <code>{intentoResult.preference_id}</code>
              </p>
              <p>
                Estado: <code>{intentoResult.estado}</code>
              </p>
              <p>
                <a
                  href={intentoResult.init_point}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  Abrir Checkout Pro
                </a>
              </p>
            </div>
          )}
        </section>
      )}

      {productos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productos.map((producto) => (
            <article
              key={producto.producto_id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {producto.nombre}
                </h2>
                {producto.usa_variantes && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                    Variantes
                  </span>
                )}
              </div>

              {producto.descripcion && (
                <p className="mb-3 text-sm text-slate-600">{producto.descripcion}</p>
              )}

              <dl className="space-y-1 text-sm text-slate-700">
                <div className="flex justify-between gap-3">
                  <dt>Precio</dt>
                  <dd>
                    {producto.precio.toLocaleString("es-UY", {
                      style: "currency",
                      currency: "UYU",
                    })}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Stock</dt>
                  <dd>{producto.stock_efectivo}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>ID</dt>
                  <dd className="font-mono text-xs">{producto.producto_id}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleCrearPedido(producto)}
                  disabled={
                    !canCreatePedido ||
                    producto.usa_variantes ||
                    producto.stock_efectivo <= 0 ||
                    creatingFor === producto.producto_id
                  }
                  className="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {creatingFor === producto.producto_id
                    ? "Creando pedido..."
                    : "Crear pedido (1 unidad)"}
                </button>

                {producto.usa_variantes && (
                  <p className="mt-2 text-xs text-amber-700">
                    Este camino mínimo no soporta variantes.
                  </p>
                )}

                {producto.stock_efectivo <= 0 && (
                  <p className="mt-2 text-xs text-rose-700">
                    Stock no disponible para prueba controlada.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
};

export default ColeccionPage;
