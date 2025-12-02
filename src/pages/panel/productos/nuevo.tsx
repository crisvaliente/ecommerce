import React from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import ProductForm from "./ProductForm";

const NuevoProductoPage: React.FC = () => {
  const router = useRouter();
  const { dbUser } = useAuth();

  const goBackToList = () => router.push("/panel/productos");

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

      {/* El ProductForm se encarga de todo: estado, validaciones básicas y upsert */}
      <div className="max-w-lg rounded-xl border border-slate-800 bg-slate-950/40">
        <ProductForm />
      </div>
    </AdminLayout>
  );
};

export default NuevoProductoPage;
