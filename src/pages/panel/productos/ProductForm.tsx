import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

type Categoria = {
  id: string;
  nombre: string;
};

type ProductoFormState = {
  nombre: string;
  descripcion: string;
  precio: number | string;
  stock: number | string;
  tipo: string;
  categoria_id: string | null;
};

interface Props {
  // si está, es edición; si no, creación
  productoId?: string;
}

const ProductForm: React.FC<Props> = ({ productoId }) => {
  const router = useRouter();

  // 🔧 Acá estaba el problema: en el contexto no hay "user", sino "dbUser"
  const { dbUser } = useAuth();
  const empresaId = dbUser?.empresa_id as string | undefined;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);

  const [saving, setSaving] = useState(false);
  const [loadingProducto, setLoadingProducto] = useState(!!productoId);

  const [form, setForm] = useState<ProductoFormState>({
    nombre: "",
    descripcion: "",
    precio: "",
    stock: "",
    tipo: "",
    categoria_id: null,
  });

  // ============================
  // 1) Traer categorías de la empresa
  // ============================
  useEffect(() => {
    const fetchCategorias = async () => {
      if (!empresaId) {
        setLoadingCategorias(false);
        return;
      }

      const { data, error } = await supabase
        .from("categoria")
        .select("id, nombre")
        .eq("empresa_id", empresaId)
        .order("nombre", { ascending: true });

      if (!error && data) {
        setCategorias(data);
      } else {
        console.error("Error cargando categorías:", error);
      }

      setLoadingCategorias(false);
    };

    fetchCategorias();
  }, [empresaId]);

  // ============================
  // 2) Si es edición → cargar producto
  // ============================
  useEffect(() => {
    if (!productoId) return;

    const fetchProducto = async () => {
      const { data, error } = await supabase
        .from("producto")
        .select("*")
        .eq("id", productoId)
        .single();

      if (!error && data) {
        setForm({
          nombre: data.nombre,
          descripcion: data.descripcion || "",
          precio: data.precio,
          stock: data.stock,
          tipo: data.tipo || "",
          categoria_id: data.categoria_id,
        });
      } else {
        console.error("Error cargando producto:", error);
      }

      setLoadingProducto(false);
    };

    fetchProducto();
  }, [productoId]);

  // ============================
  // 3) Handler de inputs
  // ============================
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "categoria_id" && value === "" ? null : value,
    }));
  };

  // ============================
  // 4) Guardar producto
  // ============================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresaId) {
      alert("No se encontró empresa asociada al usuario.");
      return;
    }

    setSaving(true);

    const payload = {
      id: productoId || undefined,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: Number(form.precio),
      stock: Number(form.stock),
      tipo: form.tipo || null,
      categoria_id: form.categoria_id,
      empresa_id: empresaId,
    };

    const { error } = await supabase.from("producto").upsert(payload);

    setSaving(false);

    if (error) {
      console.error("Error al guardar producto:", error);
      alert("Error guardando producto.");
      return;
    }

    router.push("/panel/productos");
  };

  if (loadingProducto) {
    return <div className="p-4">Cargando producto...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-4">
      {/* Nombre */}
      <div>
        <label className="block font-medium">Nombre</label>
        <input
          type="text"
          name="nombre"
          className="border rounded w-full px-3 py-2"
          value={form.nombre}
          onChange={handleChange}
          required
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block font-medium">Descripción</label>
        <textarea
          name="descripcion"
          className="border rounded w-full px-3 py-2"
          value={form.descripcion}
          onChange={handleChange}
        />
      </div>

      {/* Precio */}
      <div>
        <label className="block font-medium">Precio</label>
        <input
          type="number"
          name="precio"
          className="border rounded w-full px-3 py-2"
          value={form.precio}
          onChange={handleChange}
          required
        />
      </div>

      {/* Stock */}
      <div>
        <label className="block font-medium">Stock</label>
        <input
          type="number"
          name="stock"
          className="border rounded w-full px-3 py-2"
          value={form.stock}
          onChange={handleChange}
          required
        />
      </div>

      {/* Tipo */}
      <div>
        <label className="block font-medium">Tipo</label>
        <input
          type="text"
          name="tipo"
          className="border rounded w-full px-3 py-2"
          value={form.tipo}
          onChange={handleChange}
        />
      </div>

      {/* Categoría */}
      <div>
        <label className="block font-medium">Categoría</label>
        <select
          name="categoria_id"
          value={form.categoria_id ?? ""}
          onChange={handleChange}
          className="border rounded w-full px-3 py-2"
          disabled={loadingCategorias}
        >
        <option value="">
          {loadingCategorias ? "Cargando..." : "Sin categoría"}
        </option>

          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-black text-white rounded hover:bg-neutral-800"
      >
        {saving ? "Guardando..." : productoId ? "Actualizar" : "Crear producto"}
      </button>
    </form>
  );
};

export default ProductForm;
