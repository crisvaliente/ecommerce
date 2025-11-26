import React, { useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabaseClient";

const NuevoProductoPage: React.FC = () => {
  const router = useRouter();
  const { dbUser } = useAuth();

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState<string>("");
  const [stock, setStock] = useState<string>("0"); // 👈 NUEVO

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const goBackToList = () => router.push("/panel/productos");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!dbUser?.empresa_id) {
      setErrorMsg("No se encontró la empresa activa.");
      return;
    }

    const precioNumber = Number(precio.replace(",", "."));
    if (isNaN(precioNumber) || precioNumber <= 0) {
      setErrorMsg("Ingresá un precio válido.");
      return;
    }

    const stockNumber = parseInt(stock, 10); // 👈 NUEVO
    if (isNaN(stockNumber) || stockNumber < 0) {
      setErrorMsg("Ingresá un stock válido (0 o más).");
      return;
    }

    setLoading(true);

    try {
const { error } = await supabase
  .from("producto")
  .insert([
    {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio: precioNumber,
      stock: stockNumber,
      empresa_id: dbUser.empresa_id,
    },
  ]);


      if (error) {
        console.error("[nuevo producto] error:", error);
        setErrorMsg("No se pudo crear el producto.");
        setLoading(false);
        return;
      }

      // ✅ creado OK → volvemos al listado
      goBackToList();
    } catch (err) {
      console.error(err);
      setErrorMsg("Ocurrió un error al crear el producto.");
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nuevo producto</h1>
          <p className="text-sm text-slate-300">
            Creá un producto para tu tienda.
          </p>
        </div>
        <button
          onClick={goBackToList}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Volver al listado
        </button>
      </div>

      {!dbUser?.empresa_id && (
        <p className="mb-4 text-sm text-rose-400">
          No se encontró una empresa asociada a tu usuario. Volvé al inicio y
          seleccioná una empresa válida.
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
      >
        {errorMsg && (
          <p className="text-sm text-rose-400">
            {errorMsg}
          </p>
        )}

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

        {/* 👇 NUEVO CAMPO STOCK */}
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

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !dbUser?.empresa_id}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creando…" : "Crear producto"}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
};

export default NuevoProductoPage;

