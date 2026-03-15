// src/pages/panel/productos/index.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";

type ProductoEstado = "draft" | "published";
type FiltroEstado = "all" | "published" | "draft";

type ProductoUI = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  estado: ProductoEstado;
  stockTotal: number;
  usaVariantes: boolean;
};

// DTO esperado desde /api/panel/productos
type ProductoPanelDTO = {
  producto_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  estado: ProductoEstado;
  usa_variantes: boolean;
  stock_base: number;
  stock_efectivo: number;
  stock_source: "view" | "legacy";
};

type ApiOk = {
  items: ProductoPanelDTO[];
  meta: {
    empresa_id: string;
    source_mode: "tolerante";
    resumen_ok: boolean;
    resumen_count: number;
    auth_mode: "bearer_or_cookie";
  };
};





const ProductosPage: React.FC = () => {
  const { dbUser } = useAuth();

  const [productos, setProductos] = useState<ProductoUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uiMessage, setUiMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("all");

  const fetchProductos = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setUiMessage(null);

      if (!dbUser?.empresa_id) {
        setProductos([]);
        return;
      }

      // Fuente de verdad para token (según tu AuthContext): supabase.auth.getSession()
      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) console.error("[productos] getSession error:", sessErr);

      const accessToken = session?.access_token;
      if (!accessToken) {
        setProductos([]);
        setErrorMsg("Sesión no válida. Volvé a iniciar sesión.");
        return;
      }

      const url = `/api/panel/productos?empresa_id=${encodeURIComponent(
        dbUser.empresa_id
      )}`;

      const r = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.error("[productos] endpoint error:", r.status, txt);
        setProductos([]);
        setErrorMsg("No se pudieron cargar los productos.");
        return;
      }

      const data = (await r.json()) as ApiOk;

      // UI: sin lógica de stock/pertenencia. Renderiza lo que viene del endpoint.
      const ui: ProductoUI[] = (data.items ?? []).map((p) => ({
        id: p.producto_id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: Number(p.precio),
        estado: p.estado,
        stockTotal: Number(p.stock_efectivo ?? 0),
        usaVariantes: Boolean(p.usa_variantes),
      }));

      setProductos(ui);
      setUiMessage(
        ui.length > 0
          ? "Listado actualizado correctamente."
          : "No hay productos cargados por ahora."
      );
    } catch (err) {
      console.error(err);
      setProductos([]);
      setErrorMsg("Ocurrió un error al cargar los productos.");
    } finally {
      setLoading(false);
    }
  }, [dbUser?.empresa_id]);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  const productosFiltrados = useMemo(() => {
    if (filtro === "all") return productos;
    return productos.filter((p) => p.estado === filtro);
  }, [productos, filtro]);

  const resumen = useMemo(() => {
    return {
      all: productos.length,
      published: productos.filter((p) => p.estado === "published").length,
      draft: productos.filter((p) => p.estado === "draft").length,
    };
  }, [productos]);

  // Mutación permitida por ancla (deuda consciente TD-001)
  const handleDelete = async (id: string) => {
    const producto = productos.find((item) => item.id === id);
    const ok = window.confirm(
      `Vas a eliminar ${producto?.nombre ?? "este producto"}. Esta accion no se puede deshacer.`
    );
    if (!ok) return;

    if (!dbUser?.empresa_id) {
      setErrorMsg("No se encontró empresa asociada al usuario.");
      return;
    }

    setDeletingId(id);
    setErrorMsg(null);

    const { error } = await supabase
      .from("producto")
      .delete()
      .eq("id", id)
      .eq("empresa_id", dbUser.empresa_id);

    if (error) {
      console.error("[productos] delete error:", error);
      setErrorMsg("No se pudo eliminar el producto.");
      setDeletingId(null);
      return;
    }

    setProductos((prev) => prev.filter((p) => p.id !== id));
    setUiMessage(`Producto eliminado: ${producto?.nombre ?? "sin nombre"}.`);
    setDeletingId(null);
  };

  const renderEstadoBadge = (estado: ProductoEstado) => {
    if (estado === "published") {
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-0.5 text-xs font-medium text-emerald-200">
          Publicado
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-600/20 px-2.5 py-0.5 text-xs font-medium text-amber-200">
        Borrador
      </span>
    );
  };

  const renderVariantesBadge = (usaVariantes: boolean) => {
    if (!usaVariantes) return null;
    return (
      <span className="ml-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-200">
        Variantes
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-slate-300">
            Organizá el catalogo de tu tienda y revisa que este listo para publicar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            aria-label="Filtrar productos por estado"
          >
            <option value="all">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </select>

          <button
            type="button"
            onClick={fetchProductos}
            disabled={loading}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-60"
          >
            {loading ? "Cargando…" : "Refrescar"}
          </button>

          <Link
            href="/panel/productos/nuevo"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Nuevo producto
          </Link>
        </div>
      </div>

      <section className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-100">Resumen del catalogo</p>
            <p className="mt-1 text-xs text-slate-400">
              Usa el filtro para revisar que esta publicado y que sigue en borrador.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
              Todos: {resumen.all}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              Publicados: {resumen.published}
            </span>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-200">
              Borradores: {resumen.draft}
            </span>
          </div>
        </div>
      </section>

      {loading && <p className="text-sm text-slate-300">Cargando productos…</p>}

      {uiMessage && !loading && !errorMsg && (
        <p className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {uiMessage}
        </p>
      )}

      {errorMsg && !loading && (
        <p className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {errorMsg}
        </p>
      )}

      {!loading && !errorMsg && productos.length === 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-center">
          <p className="text-base font-medium text-slate-100">
            Todavia no tenes productos cargados.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Crea tu primer producto para empezar a armar el catalogo de la tienda.
          </p>
          <Link
            href="/panel/productos/nuevo"
            className="mt-4 inline-flex rounded-lg bg-[#E30B13] px-4 py-2 text-sm font-medium text-white hover:bg-[#c70911]"
          >
            Crear primer producto
          </Link>
        </section>
      )}

      {!loading && !errorMsg && productos.length > 0 && productosFiltrados.length === 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-center">
          <p className="text-base font-medium text-slate-100">
            No hay productos para este filtro.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Cambia el filtro para revisar el resto del catalogo.
          </p>
        </section>
      )}

      {!loading && productosFiltrados.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Nombre
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Precio
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Stock
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-300">
                  Estado
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-300">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {productosFiltrados.map((p) => (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="px-4 py-2">
                    {p.nombre}
                    {renderVariantesBadge(p.usaVariantes)}
                  </td>

                  <td className="px-4 py-2">
                    {Number(p.precio).toLocaleString("es-UY", {
                      style: "currency",
                      currency: "UYU",
                    })}
                  </td>

                  <td className="px-4 py-2">
                    <span
                      className={
                        p.stockTotal <= 0 ? "text-rose-300" : "text-slate-200"
                      }
                    >
                      {p.stockTotal}
                    </span>
                  </td>

                  <td className="px-4 py-2">{renderEstadoBadge(p.estado)}</td>

                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-3">
                      <Link
                        href={`/panel/productos/${p.id}`}
                        className="text-xs font-medium text-emerald-400 hover:underline"
                      >
                        Editar
                      </Link>

                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => handleDelete(p.id)}
                        className={`text-xs font-medium ${
                          deletingId === p.id
                            ? "cursor-not-allowed text-slate-500"
                            : "text-rose-400 hover:underline"
                        }`}
                      >
                        {deletingId === p.id ? "Eliminando…" : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};

export default ProductosPage;
