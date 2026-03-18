import React from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
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
          <h1 className="font-raleway text-2xl font-semibold text-text">Editar producto</h1>
          <p className="text-sm text-muted">Actualiza los datos del producto.</p>
        </div>

        <Button variant="secondary" onClick={goBackToList}>
          Volver al listado
        </Button>
      </div>

      {!hasEmpresa && (
        <p className="mb-4 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
          No se encontró una empresa asociada a tu usuario. Volvé al inicio y seleccioná una
          empresa válida.
        </p>
      )}

      {/* ProductForm se encarga de cargar el producto, manejar estado y guardar */}
      {hasEmpresa && (
        <Card className="max-w-3xl">
          <ProductForm productoId={id} />
        </Card>
      )}
    </AdminLayout>
  );
};

export default EditarProductoPage;
