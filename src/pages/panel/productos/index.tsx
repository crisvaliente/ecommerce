import React, { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabaseClient";
import Link from "next/link";

type Producto = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  estado?: string | null;
};

const ProductosPage: React.FC = () => {
  const { dbUser } = useAuth();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        if (!dbUser?.empresa_id) {
          setProductos([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("producto")
          .select("id, nombre, descripcion, precio")
          .eq("empresa_id", dbUser.empresa_id);

        if (error) {
          console.error("[productos] error:", error);
          setErrorMsg("No se pudieron cargar los productos.");
        } else {
          setProductos((data as Producto[]) ?? []);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Ocurrió un error al cargar los productos.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, [dbUser?.empresa_id]);

  const handleDelete = async (id: string) => {
    const ok = window.confirm("¿Seguro que querés eliminar este producto?");
    if (!ok) return;

    setDeletingId(id);
    setErrorMsg(null);

    const { error } = await supabase
      .from("producto")
      .delete()
      .eq("id", id)
      .eq("empresa_id", dbUser?.empresa_id);

    if (error) {
      console.error("[productos] delete error:", error);
      setErrorMsg("No se pudo eliminar el producto.");
      setDeletingId(null);
      return;
    }

    setProductos((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
  };

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Productos</h1>
          <p className="text-sm text-slate-300">
            Gestioná los productos de tu tienda.
          </p>
        </div>

        <Link
          href="/panel/productos/nuevo"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Nuevo producto
        </Link>
      </div>

      {loading && (
        <p className="text-sm text-slate-300">Cargando productos…</p>
      )}

      {errorMsg && !loading && (
        <p className="mb-3 text-sm text-rose-400">{errorMsg}</p>
      )}

      {!loading && !errorMsg && productos.length === 0 && (
        <p className="text-sm text-slate-400">
          Todavía no tenés productos cargados. Creá el primero con el botón
          “Nuevo producto”.
        </p>
      )}

      {!loading && productos.length > 0 && (
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
                  Estado
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-300">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {productos.map((p) => (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="px-4 py-2">{p.nombre}</td>

                  <td className="px-4 py-2">
                    {Number(p.precio).toLocaleString("es-UY", {
                      style: "currency",
                      currency: "UYU",
                    })}
                  </td>

                  <td className="px-4 py-2">{p.estado ?? "activo"}</td>

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
                            ? "text-slate-500 cursor-not-allowed"
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
