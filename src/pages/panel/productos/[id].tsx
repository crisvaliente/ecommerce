import React from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import ProductForm from "./ProductForm";

const EditarProductoPage: React.FC = () => {
  const router = useRouter();
  const { dbUser } = useAuth();
  const { id } = router.query;

  const goBackToList = () => router.push("/panel/productos");

  // Mientras Next resuelve el id, mostramos un loading suave
  if (!id || typeof id !== "string") {
    return (
      <AdminLayout>
        <p className="p-4 text-sm text-slate-300">Cargando producto…</p>
      </AdminLayout>
    );
  }

  const hasEmpresa = Boolean(dbUser?.empresa_id);

  return (
    <AdminLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Editar producto</h1>
          <p className="text-sm text-slate-300">Actualizá los datos del producto.</p>
        </div>

        <button
          onClick={goBackToList}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          Volver al listado
        </button>
      </div>

      {!hasEmpresa && (
        <p className="mb-4 text-sm text-rose-400">
          No se encontró una empresa asociada a tu usuario. Volvé al inicio y seleccioná una
          empresa válida.
        </p>
      )}

      {/* ProductForm se encarga de cargar el producto, manejar estado y guardar */}
      {hasEmpresa && (
        <div className="max-w-lg rounded-xl border border-slate-800 bg-slate-950/40">
          <ProductForm productoId={id} />
        </div>
      )}
    </AdminLayout>
  );
};

export default EditarProductoPage;
