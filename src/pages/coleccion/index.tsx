import React from "react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { supabaseServer } from "../../lib/supabaseServer";

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
            </article>
          ))}
        </div>
      )}
    </main>
  );
};

export default ColeccionPage;
