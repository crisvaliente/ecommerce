import React, { useMemo, useState } from "react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import ProductCard from "../../components/ui/ProductCard";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { supabaseServer } from "../../lib/supabaseServer";
import { BUCKET_PRODUCTO_IMAGENES } from "../../utils/storageProductoImagen";

const STOREFRONT_TENANT =
  process.env.NODE_ENV === "production"
    ? { slug: "raeyz", name: "Raeyz" }
    : { slug: "empresa-smoke", name: "EMPRESA_SMOKE" };
const CHECKOUT_REDIRECT_DELAY_MS = 700;

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

type ProductoVarianteRow = {
  id: string;
  producto_id: string;
  talle: string;
  stock: number;
};

type ProductoVarianteStorefront = {
  variante_id: string;
  talle: string;
  stock: number;
};

type ImagenProductoRow = {
  producto_id: string;
  path: string | null;
  url_imagen: string | null;
  es_principal: boolean | null;
  creado_en: string | null;
};

type ProductoStorefront = {
  producto_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock_efectivo: number;
  usa_variantes: boolean;
  variantes: ProductoVarianteStorefront[];
  imagen_url: string | null;
};

type PageProps = {
  empresaId: string | null;
  productos: ProductoStorefront[];
  error: string | null;
  tenantSource: "default" | "query";
};

function formatStockLabel(stock: number): string {
  if (stock <= 0) return "Sin stock";
  if (stock === 1) return "1 unidad disponible";
  return `${stock} unidades disponibles`;
}

async function resolveEmpresaId(rawEmpresaId: unknown): Promise<{
  empresaId: string | null;
  tenantSource: "default" | "query";
  error: string | null;
}> {
  if (typeof rawEmpresaId === "string" && rawEmpresaId.trim().length > 0) {
    return {
      empresaId: rawEmpresaId.trim(),
      tenantSource: "query",
      error: null,
    };
  }

  const { data: empresaBySlug, error: slugError } = await supabaseServer
    .from("empresa")
    .select("id")
    .eq("slug", STOREFRONT_TENANT.slug)
    .maybeSingle<{ id: string }>();

  if (slugError) {
    return {
      empresaId: null,
      tenantSource: "default",
      error: "storefront_tenant_not_found",
    };
  }

  if (empresaBySlug?.id) {
    return {
      empresaId: empresaBySlug.id,
      tenantSource: "default",
      error: null,
    };
  }

  const { data: empresaByName, error: nameError } = await supabaseServer
    .from("empresa")
    .select("id")
    .ilike("nombre", STOREFRONT_TENANT.name)
    .maybeSingle<{ id: string }>();

  if (nameError || !empresaByName?.id) {
    return {
      empresaId: null,
      tenantSource: "default",
      error: "storefront_tenant_not_found",
    };
  }

  return {
    empresaId: empresaByName.id,
    tenantSource: "default",
    error: null,
  };
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context
) => {
  const { empresaId, tenantSource, error: tenantError } = await resolveEmpresaId(
    context.query.empresa_id
  );

  if (!empresaId) {
    return {
      props: {
        empresaId: null,
        productos: [],
        error: tenantError,
        tenantSource,
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
        tenantSource,
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

  const productoIds = (productosData ?? []).map((producto) => producto.id);

  const { data: variantesData } = productoIds.length > 0
    ? await supabaseServer
        .from("producto_variante")
        .select("id, producto_id, talle, stock")
        .in("producto_id", productoIds)
        .eq("activo", true)
        .order("talle", { ascending: true })
        .returns<ProductoVarianteRow[]>()
    : { data: [] as ProductoVarianteRow[] };

  const variantesMap = new Map<string, ProductoVarianteStorefront[]>();

  (variantesData ?? []).forEach((variante) => {
    if (!(variante.stock > 0)) {
      return;
    }

    const current = variantesMap.get(variante.producto_id) ?? [];
    current.push({
      variante_id: variante.id,
      talle: variante.talle,
      stock: variante.stock,
    });
    variantesMap.set(variante.producto_id, current);
  });
  let imageMap = new Map<string, string>();

  if (productoIds.length > 0) {
    const { data: imagenesData } = await supabaseServer
      .from("imagen_producto")
      .select("producto_id, path, url_imagen, es_principal, creado_en")
      .in("producto_id", productoIds)
      .is("deleted_at", null)
      .order("es_principal", { ascending: false })
      .order("creado_en", { ascending: true })
      .returns<ImagenProductoRow[]>();

    const signedEntries = await Promise.all(
      (imagenesData ?? []).map(async (imagen) => {
        const rawPath = imagen.path ?? imagen.url_imagen;

        if (!rawPath) {
          return null;
        }

        try {
          const { data } = await supabaseServer.storage
            .from(BUCKET_PRODUCTO_IMAGENES)
            .createSignedUrl(rawPath, 60 * 60);

          if (!data?.signedUrl) {
            return null;
          }

          return {
            producto_id: imagen.producto_id,
            signedUrl: data.signedUrl,
          };
        } catch {
          return null;
        }
      })
    );

    imageMap = new Map<string, string>(
      signedEntries
        .filter((entry): entry is { producto_id: string; signedUrl: string } =>
          Boolean(entry?.producto_id && entry?.signedUrl)
        )
        .filter(
          (entry, index, entries) =>
            entries.findIndex((candidate) => candidate.producto_id === entry.producto_id) ===
            index
        )
        .map((entry) => [entry.producto_id, entry.signedUrl])
    );
  }

  const productos: ProductoStorefront[] = (productosData ?? [])
    .map((p) => {
      const resumen = resumenMap.get(p.id);
      const stockBase = typeof p.stock === "number" ? p.stock : 0;
      const variantes = variantesMap.get(p.id) ?? [];

      return {
        producto_id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: Number(p.precio),
        stock_efectivo: resumen?.usa_variantes
          ? variantes.reduce((total, variante) => total + variante.stock, 0)
          : typeof resumen?.stock_total === "number"
            ? resumen.stock_total
            : stockBase,
        usa_variantes:
          typeof resumen?.usa_variantes === "boolean" ? resumen.usa_variantes : false,
        variantes,
        imagen_url: imageMap.get(p.id) ?? null,
      };
    });

  return {
    props: {
      empresaId,
      productos,
      error: null,
      tenantSource,
    },
  };
};

const ColeccionPage: React.FC<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = ({ empresaId, productos, error, tenantSource }) => {
  const { sessionUser, dbUser } = useAuth();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [selectedVarianteByProducto, setSelectedVarianteByProducto] = useState<
    Record<string, string>
  >({});
  const [hasAddress, setHasAddress] = useState<boolean | null>(null);
  const [intentoResult, setIntentoResult] = useState<{
    id: string;
    pedido_id: string;
    estado: string;
    preference_id: string;
    init_point: string;
  } | null>(null);

  const canCreatePedido = useMemo(() => {
    return Boolean(sessionUser && dbUser?.id && empresaId);
  }, [dbUser?.id, empresaId, sessionUser]);

  const isRedirectingToCheckout = Boolean(intentoResult && !creatingFor);

  const getCheckoutErrorMessage = (code: string | null) => {
    switch (code) {
      case "direccion_envio_no_disponible":
        return "Agregá una dirección en tu cuenta para poder continuar con la compra.";
      case "direccion_no_existe":
      case "direccion_no_pertenece_al_usuario":
        return "No pudimos usar tu dirección guardada. Probá actualizarla y volvé a intentar.";
      case "pedido_expirado":
      case "pedido_bloqueado":
      case "pedido_no_pagable":
        return "Este pedido ya no se puede pagar. Probá iniciar la compra nuevamente.";
      case "mercadopago_preference_error":
        return "No pudimos abrir el checkout ahora. Probá nuevamente en unos segundos.";
      case "unauthorized":
        return "Necesitás iniciar sesión para continuar con la compra.";
      case "variante_sin_stock":
        return "La variante seleccionada ya no tiene stock. Elegi otra talla.";
      default:
        return "No pudimos iniciar la compra en este momento. Probá nuevamente.";
    }
  };

  const ensureUserHasAddress = async () => {
    if (!dbUser?.id) {
      return false;
    }

    const { count, error } = await supabase
      .from("direccion_usuario")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", dbUser.id);

    if (error) {
      throw error;
    }

    const available = (count ?? 0) > 0;
    setHasAddress(available);
    return available;
  };

  const handleComprar = async (
    producto: ProductoStorefront,
    varianteId?: string | null
  ) => {
    if (!canCreatePedido || !dbUser?.id || !empresaId) {
      setCheckoutError("Necesitás iniciar sesión para continuar con la compra.");
      return;
    }

    if (producto.precio <= 0) {
      setCheckoutError("Este producto no esta disponible para compra en este momento.");
      return;
    }

    if (producto.usa_variantes && !varianteId) {
      setCheckoutError("Elegí un talle disponible para continuar con la compra.");
      return;
    }

    if (producto.usa_variantes && varianteId) {
      const varianteValida = producto.variantes.some((variante) => variante.variante_id === varianteId);

      if (!varianteValida) {
        setCheckoutError("Elegí un talle disponible para continuar con la compra.");
        return;
      }
    }

    setCreatingFor(producto.producto_id);
    setCheckoutError(null);
    setIntentoResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token ?? null;

      if (sessionError || !accessToken) {
        setCheckoutError(getCheckoutErrorMessage("unauthorized"));
        return;
      }

      const addressAvailable = await ensureUserHasAddress();

      if (!addressAvailable) {
        setCheckoutError("Agrega una direccion en tu cuenta para poder continuar con la compra.");
        return;
      }

      const pedidoResponse = await fetch("/api/ecommerce/pedido", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          empresa_id: empresaId,
          items: [
            {
              producto_id: producto.producto_id,
              variante_id: producto.usa_variantes ? varianteId : undefined,
              cantidad: 1,
            },
          ],
        }),
      });

      const pedidoBody = (await pedidoResponse.json().catch(() => null)) as
        | { pedido_id?: string; error?: string }
        | null;

      if (!pedidoResponse.ok || !pedidoBody?.pedido_id) {
        setCheckoutError(getCheckoutErrorMessage(pedidoBody?.error ?? null));
        return;
      }

      const intentoResponse = await fetch("/api/ecommerce/intento-pago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pedido_id: pedidoBody.pedido_id,
        }),
      });

      const intentoBody = (await intentoResponse.json().catch(() => null)) as
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

      if (!intentoResponse.ok || !intentoBody?.intento_pago) {
        setCheckoutError(getCheckoutErrorMessage(intentoBody?.error ?? null));
        return;
      }

      setIntentoResult(intentoBody.intento_pago);
      await new Promise((resolve) => setTimeout(resolve, CHECKOUT_REDIRECT_DELAY_MS));
      window.location.assign(intentoBody.intento_pago.init_point);
    } catch (err) {
      console.error(err);
      setCheckoutError(getCheckoutErrorMessage(null));
    } finally {
      setCreatingFor(null);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-900 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[24px] border border-stone-200 bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 px-5 py-4 text-stone-50 shadow-sm sm:px-6 sm:py-5">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/80">
              {STOREFRONT_TENANT.name}
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              Coleccion disponible para compra directa.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-5 text-stone-300">
              Elegi un producto disponible y segui al checkout con tu cuenta.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              {tenantSource === "query" && (
                <span className="rounded-full border border-amber-300/30 bg-amber-200/10 px-2.5 py-1 text-amber-100">
                  Vista temporal de prueba
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          {!empresaId && error === "storefront_tenant_not_found" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-medium">La tienda no esta disponible ahora.</p>
              <p className="mt-1 text-amber-800">
                Probá nuevamente en unos minutos.
              </p>
            </div>
          )}

          {empresaId && error === "product_read_failed" && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
              <p className="font-medium">No pudimos cargar la coleccion ahora.</p>
              <p className="mt-1 text-rose-800">
                Actualiza la pagina o volve a intentar en unos minutos.
              </p>
            </div>
          )}

          {empresaId && !error && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-900">
                  {canCreatePedido
                    ? `Comprando como ${dbUser?.correo ?? "tu cuenta"}`
                    : "Inicia sesion para comprar de forma segura"}
                </p>
                <p className="mt-1 text-xs text-stone-600 sm:text-sm">
                  {canCreatePedido
                    ? "Armamos tu pedido y te llevamos directo a Mercado Pago para completar el pago."
                    : "Necesitas una cuenta con una direccion guardada para avanzar al checkout."}
                </p>
                {canCreatePedido && hasAddress === false && (
                  <p className="mt-2 text-xs text-rose-700 sm:text-sm">
                    Antes de comprar, necesitas guardar una direccion en tu cuenta.
                  </p>
                )}
              </div>

              {!canCreatePedido && (
                <Link
                  href="/auth/login"
                  className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                >
                  Iniciar sesion
                </Link>
              )}
            </div>
          )}

          {creatingFor && (
            <div className="mt-4 rounded-2xl border border-stone-200 bg-[#EEECE1] px-4 py-4 text-sm text-stone-900">
              <p className="font-medium">Estamos preparando tu compra.</p>
              <p className="mt-1 text-stone-700">
                En unos segundos te redirigimos a Mercado Pago para completar el pago.
              </p>
            </div>
          )}

          {checkoutError && (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {checkoutError}
            </p>
          )}

          {isRedirectingToCheckout && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Tu pago ya esta listo. Si Mercado Pago no se abre automaticamente, usa este{" "}
              <a
                href={intentoResult.init_point}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                enlace de pago
              </a>
              .
            </div>
          )}
        </section>

        {empresaId && !error && productos.length === 0 && (
          <section className="mt-5 rounded-[28px] border border-stone-200 bg-white p-6 text-center shadow-sm">
            <p className="text-base font-medium text-stone-900">
              Estamos preparando la coleccion
            </p>
            <p className="mt-2 text-sm text-stone-600">
              Muy pronto vas a poder ver los productos disponibles.
            </p>
          </section>
        )}

        {productos.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {productos.map((producto) => (
              <div key={producto.producto_id} className="space-y-3">
                <ProductCard
                  nombre={producto.nombre}
                  descripcion={producto.descripcion}
                  precio={producto.precio}
                  stockLabel={formatStockLabel(producto.stock_efectivo)}
                  disponible={producto.stock_efectivo > 0}
                  canBuy={producto.stock_efectivo > 0 && producto.precio > 0}
                  imageUrl={producto.imagen_url}
                  imageAlt={producto.nombre}
                  helperText={
                    producto.precio <= 0
                      ? "Este producto no esta disponible para compra en este momento."
                      : producto.stock_efectivo <= 0
                      ? "Este producto volvera a estar disponible cuando repongamos stock."
                      : producto.usa_variantes
                        ? "Elegi un talle disponible para continuar con la compra."
                        : canCreatePedido
                          ? "Vas a completar el pago en Mercado Pago, sin pasos intermedios."
                          : "Inicia sesion para continuar con una compra segura."
                  }
                  action={
                    canCreatePedido
                      ? {
                          label:
                            creatingFor === producto.producto_id
                              ? "Preparando tu pago..."
                              : producto.usa_variantes &&
                                  !selectedVarianteByProducto[producto.producto_id]
                                ? "Elegir talle"
                                : "Comprar ahora",
                          onClick: () =>
                            handleComprar(
                              producto,
                              producto.usa_variantes
                                ? selectedVarianteByProducto[producto.producto_id] ?? null
                                : null
                            ),
                          disabled:
                            producto.precio <= 0 ||
                            producto.stock_efectivo <= 0 ||
                            creatingFor === producto.producto_id ||
                            (producto.usa_variantes &&
                              !selectedVarianteByProducto[producto.producto_id]),
                        }
                      : {
                          label: "Iniciar sesion para comprar",
                          href: "/auth/login",
                        }
                  }
                />

                {producto.usa_variantes && (
                  <div className="rounded-[24px] border border-stone-200 bg-white px-4 py-4 shadow-sm">
                    <label className="mb-2 block text-sm font-medium text-stone-900" htmlFor={`variante-${producto.producto_id}`}>
                      Talle
                    </label>
                    <select
                      id={`variante-${producto.producto_id}`}
                      value={selectedVarianteByProducto[producto.producto_id] ?? ""}
                      onChange={(event) => {
                        setSelectedVarianteByProducto((prev) => ({
                          ...prev,
                          [producto.producto_id]: event.target.value,
                        }));
                        setCheckoutError(null);
                      }}
                      disabled={producto.stock_efectivo <= 0 || creatingFor === producto.producto_id}
                      className="w-full rounded-full border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-500 disabled:cursor-not-allowed disabled:bg-stone-100"
                    >
                      <option value="">Elegi un talle</option>
                      {producto.variantes.map((variante) => (
                        <option key={variante.variante_id} value={variante.variante_id}>
                          {variante.talle}
                        </option>
                      ))}
                    </select>
                    {producto.variantes.length === 0 && (
                      <p className="mt-2 text-xs text-stone-500">
                        No hay variantes activas disponibles ahora.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default ColeccionPage;
