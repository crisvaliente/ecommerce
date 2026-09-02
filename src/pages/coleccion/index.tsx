import React, { useState } from "react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import ProductCard from "../../components/ui/ProductCard";
import { useCart } from "../../components/ui/CartContext";
import { instanceConfig } from "../../config/instance";
import { supabaseServer } from "../../lib/supabaseServer";
import {
  loadStorefrontCatalog,
  resolveStorefrontServerSideProps,
  type ProductoStorefront,
} from "../../lib/storefrontCatalog";

const STOREFRONT_TENANT = instanceConfig.store;
type PageProps = {
  empresaId: string | null;
  productos: ProductoStorefront[];
  error: string | null;
};

function formatStockLabel(stock: number): string {
  if (stock <= 0) return "Sin stock";
  if (stock === 1) return "1 unidad disponible";
  return `${stock} unidades disponibles`;
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (context) =>
  resolveStorefrontServerSideProps(context, {
    findByHostname: async (hostname) => {
      const { data, error } = await supabaseServer
        .from("empresa_dominio")
        .select("empresa_id")
        .eq("hostname", hostname)
        .maybeSingle<{ empresa_id: string }>();
      return { data, error };
    },
    loadCatalog: (empresaId) => loadStorefrontCatalog(empresaId, supabaseServer),
    logLookupFailure: (hostname) => {
      console.error("[storefront-tenant] lookup_failed", { hostname });
    },
  });

const ColeccionPage: React.FC<
  InferGetServerSidePropsType<typeof getServerSideProps>
> = ({ empresaId, productos, error }) => {
  const { addItem, empresaId: cartEmpresaId } = useCart();
  const [selectedVarianteByProducto, setSelectedVarianteByProducto] = useState<
    Record<string, string>
  >({});
  const cartBelongsToAnotherCompany =
    cartEmpresaId !== null && cartEmpresaId !== empresaId;

  const handleAgregarAlCarrito = (
    producto: ProductoStorefront,
    varianteId?: string | null
  ) => {
    if (!empresaId || producto.precio <= 0) {
      return;
    }

    const varianteSeleccionada = producto.usa_variantes
      ? producto.variantes.find((variante) => variante.variante_id === varianteId)
      : null;

    if (producto.usa_variantes && !varianteSeleccionada) {
      return;
    }

    addItem(empresaId, {
      productoId: producto.producto_id,
      varianteId: varianteSeleccionada?.variante_id ?? null,
      name: varianteSeleccionada
        ? `${producto.nombre} - Talle ${varianteSeleccionada.talle}`
        : producto.nombre,
      price: producto.precio,
      image: instanceConfig.store.assets.logo,
    });
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
              Coleccion disponible para agregar al carrito.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-5 text-stone-300">
              Elegi un producto disponible y prepara tu carrito.
            </p>
          </div>
        </section>

        {!empresaId && error === "storefront_unavailable" && (
          <section className="mt-4 rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-medium">La tienda no esta disponible ahora.</p>
              <p className="mt-1 text-amber-800">
                Probá nuevamente en unos minutos.
              </p>
            </div>
          </section>
        )}

        {empresaId && error === "product_read_failed" && (
          <section className="mt-4 rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
              <p className="font-medium">No pudimos cargar la coleccion ahora.</p>
              <p className="mt-1 text-rose-800">
                Actualiza la pagina o volve a intentar en unos minutos.
              </p>
            </div>
          </section>
        )}

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
                        : cartBelongsToAnotherCompany
                          ? "Vacia el carrito de la otra tienda antes de agregar este producto."
                          : producto.usa_variantes
                            ? "Elegi un talle disponible para agregarlo al carrito."
                            : "Agrega este producto al carrito para continuar comprando."
                  }
                  action={{
                    label:
                      cartBelongsToAnotherCompany
                        ? "Carrito de otra tienda"
                        : producto.usa_variantes &&
                            !selectedVarianteByProducto[producto.producto_id]
                          ? "Elegir talle"
                          : "Agregar al carrito",
                    onClick: () =>
                      handleAgregarAlCarrito(
                        producto,
                        producto.usa_variantes
                          ? selectedVarianteByProducto[producto.producto_id] ?? null
                          : null
                      ),
                    disabled:
                      producto.precio <= 0 ||
                      producto.stock_efectivo <= 0 ||
                      cartBelongsToAnotherCompany ||
                      (producto.usa_variantes &&
                        !selectedVarianteByProducto[producto.producto_id]),
                  }}
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
                      }}
                      disabled={producto.stock_efectivo <= 0}
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
