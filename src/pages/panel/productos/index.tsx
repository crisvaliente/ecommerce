// src/pages/panel/productos/index.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import Input from "../../../components/ui/Input";
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
        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
          Publicado
        </span>
      );
    }

    return (
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        Borrador
      </span>
    );
  };

  const renderVariantesBadge = (usaVariantes: boolean) => {
    if (!usaVariantes) return null;
    return (
      <span className="ml-2 inline-flex items-center rounded-full border border-border bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-muted">
        Variantes
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-raleway text-2xl font-semibold text-text">Productos</h1>
          <p className="text-sm text-muted">
            Organizá el catalogo de tu tienda y revisa que este listo para publicar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Input
            as="select"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
            className="min-w-[180px]"
            aria-label="Filtrar productos por estado"
          >
            <option value="all">Todos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
          </Input>

          <Button
            variant="secondary"
            onClick={fetchProductos}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </Button>

          <Link href="/panel/productos/nuevo">
            <Button as="span" variant="primary">
              Nuevo producto
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-4 p-4" muted>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">Resumen del catalogo</p>
            <p className="mt-1 text-xs text-muted">
              Usa el filtro para revisar que esta publicado y que sigue en borrador.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-text">
              Todos: {resumen.all}
            </span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-700">
              Publicados: {resumen.published}
            </span>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-amber-700">
              Borradores: {resumen.draft}
            </span>
          </div>
        </div>
      </Card>

      {loading && <p className="text-sm text-muted">Cargando productos...</p>}

      {uiMessage && !loading && !errorMsg && (
        <p className="mb-3 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          {uiMessage}
        </p>
      )}

      {errorMsg && !loading && (
        <p className="mb-3 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
          {errorMsg}
        </p>
      )}

      {!loading && !errorMsg && productos.length === 0 && (
        <Card className="p-6 text-center" muted>
          <p className="text-base font-medium text-text">
            Todavia no tenes productos cargados.
          </p>
          <p className="mt-2 text-sm text-muted">
            Crea tu primer producto para empezar a armar el catalogo de la tienda.
          </p>
          <div className="mt-4">
            <Link href="/panel/productos/nuevo">
              <Button as="span" variant="primary">
                Crear primer producto
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {!loading && !errorMsg && productos.length > 0 && productosFiltrados.length === 0 && (
        <Card className="p-6 text-center" muted>
          <p className="text-base font-medium text-text">
            No hay productos para este filtro.
          </p>
          <p className="mt-2 text-sm text-muted">
            Cambia el filtro para revisar el resto del catalogo.
          </p>
        </Card>
      )}

      {!loading && productosFiltrados.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/[0.03]">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted">
                  Nombre
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted">
                  Precio
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted">
                  Stock
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted">
                  Estado
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {productosFiltrados.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 text-text">
                    {p.nombre}
                    {renderVariantesBadge(p.usaVariantes)}
                  </td>

                  <td className="px-4 py-3 text-text">
                    {Number(p.precio).toLocaleString("es-UY", {
                      style: "currency",
                      currency: "UYU",
                    })}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={
                        p.stockTotal <= 0 ? "text-rose-700" : "text-text"
                      }
                    >
                      {p.stockTotal}
                    </span>
                  </td>

                  <td className="px-4 py-3">{renderEstadoBadge(p.estado)}</td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-3">
                      <Link
                        href={`/panel/productos/${p.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Editar
                      </Link>

                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => handleDelete(p.id)}
                        className={`text-xs font-medium ${
                          deletingId === p.id
                            ? "cursor-not-allowed text-muted"
                            : "text-rose-700 hover:underline"
                        }`}
                      >
                        {deletingId === p.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AdminLayout>
  );
};

export default ProductosPage;
