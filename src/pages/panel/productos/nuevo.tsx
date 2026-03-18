import React from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
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
          <h1 className="font-raleway text-2xl font-semibold text-text">Nuevo producto</h1>
          <p className="text-sm text-muted">
            Creá un producto para tu tienda.
          </p>
        </div>
        <Button variant="secondary" onClick={goBackToList}>
          Volver al listado
        </Button>
      </div>

      {!dbUser?.empresa_id && (
        <p className="mb-4 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
          No se encontró una empresa asociada a tu usuario. Volvé al inicio y
          seleccioná una empresa válida.
        </p>
      )}

      {/* El ProductForm se encarga de todo: estado, validaciones básicas y upsert */}
      <Card className="max-w-3xl">
        <ProductForm />
      </Card>
    </AdminLayout>
  );
};

export default NuevoProductoPage;
