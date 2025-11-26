import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabaseClient";

type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  empresa_id: string;
};

const EditarProductoPage: React.FC = () => {
  const router = useRouter();
  const { dbUser } = useAuth();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState<string>("");
  const [stock, setStock] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false); // 👈 NUEVO
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const productoId = router.query.id;

  const goBackToList = () => router.push("/panel/productos");

  // 🔹 Cargar producto al montar la página
  useEffect(() => {
    const fetchProducto = async () => {
      if (!productoId || typeof productoId !== "string") return;
      if (!dbUser?.empresa_id) {
        setErrorMsg("No se encontró la empresa activa.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("producto")
        .select("id, nombre, descripcion, precio, stock, empresa_id")
        .eq("id", productoId)
        .single();

      if (error) {
        console.error("[editar producto] error al cargar:", error);
        setErrorMsg("No se pudo cargar el producto.");
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg("Producto no encontrado.");
        setLoading(false);
        return;
      }

      const p = data as Producto;

      // Cargamos estado inicial del formulario
      setProducto(p);
      setNombre(p.nombre);
      setDescripcion(p.descripcion ?? "");
      setPrecio(String(p.precio));
      setStock(String(p.stock));
      setLoading(false);
    };

    fetchProducto();
  }, [productoId, dbUser?.empresa_id]);

  // 🔹 Guardar cambios (blindado)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!producto) {
      setErrorMsg("No hay producto cargado.");
      return;
    }

    if (!dbUser?.empresa_id) {
      setErrorMsg("No se encontró la empresa activa.");
      return;
    }

    // 🔐 Validación de nombre
    const nombreTrim = nombre.trim();
    if (!nombreTrim) {
      setErrorMsg("El nombre del producto es obligatorio.");
      return;
    }
    if (nombreTrim.length > 120) {
      setErrorMsg("El nombre es demasiado largo (máx. 120 caracteres).");
      return;
    }

    // 🔐 Validación de precio
    const precioNumber = Number(precio.replace(",", "."));
    if (isNaN(precioNumber) || precioNumber <= 0) {
      setErrorMsg("Ingresá un precio válido mayor a 0.");
      return;
    }
    if (precioNumber > 9_999_999) {
      setErrorMsg("El precio es demasiado alto para ser válido.");
      return;
    }

    // 🔐 Validación de stock
    const stockNumber = parseInt(stock, 10);
    if (isNaN(stockNumber) || stockNumber < 0) {
      setErrorMsg("Ingresá un stock válido (0 o más).");
      return;
    }
    if (stockNumber > 999_999) {
      setErrorMsg("El stock es demasiado alto para ser válido.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("producto")
      .update({
        nombre: nombreTrim,
        descripcion: descripcion.trim() || null,
        precio: precioNumber,
        stock: stockNumber,
      })
      .eq("id", producto.id);

    if (error) {
      console.error("[editar producto] error al guardar:", error);
      setErrorMsg("No se pudieron guardar los cambios.");
      setSaving(false);
      return;
    }

    // ✅ Guardado OK → volvemos al listado
    goBackToList();
  };

  // 🔹 Eliminar producto
  const handleDelete = async () => {
    if (!producto) {
      setErrorMsg("No hay producto cargado.");
      return;
    }

    if (!dbUser?.empresa_id) {
      setErrorMsg("No se encontró la empresa activa.");
      return;
    }

    const confirmar = window.confirm(
      "¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer."
    );
    if (!confirmar) return;

    setDeleting(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("producto")
      .delete()
      .eq("id", producto.id);

    if (error) {
      console.error("[eliminar producto] error:", error);
      setErrorMsg("No se pudo eliminar el producto.");
      setDeleting(false);
      return;
    }

    // ✅ Eliminado OK → volvemos al listado
    goBackToList();
  };

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Editar producto</h1>
          <p className="text-sm text-slate-300">
            Actualizá los datos del producto.
          </p>
        </div>
        <button
          onClick={goBackToList}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Volver al listado
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-300">Cargando producto…</p>
      )}

      {!loading && errorMsg && (
        <p className="mb-4 text-sm text-rose-400">{errorMsg}</p>
      )}

      {!loading && !errorMsg && producto && (
        <form
          onSubmit={handleSubmit}
          className="max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
        >
          <div className="mb-2 text-xs text-slate-400">
            ID: <span className="font-mono">{producto.id}</span>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Nombre
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Descripción (opcional)
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Precio (UYU)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
              Stock
            </label>
            <input
              type="number"
              min="0"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
            />
          </div>

          {errorMsg && (
            <p className="text-sm text-rose-400">{errorMsg}</p>
          )}

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={saving || !dbUser?.empresa_id}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-900/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Eliminando…" : "Eliminar producto"}
            </button>
          </div>
        </form>
      )}
    </AdminLayout>
  );
};

export default EditarProductoPage;
