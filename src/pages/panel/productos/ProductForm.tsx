import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

type Categoria = {
  id: string;
  nombre: string;
};

type ProductoEstado = "draft" | "published";

type ProductoFormState = {
  nombre: string;
  descripcion: string;
  precio: number | string;
  stock: number | string;
  tipo: string;
  categoria_id: string | null;
  estado: ProductoEstado; // ✅ B1
};

interface Props {
  productoId?: string;
}

const ProductForm: React.FC<Props> = ({ productoId }) => {
  const router = useRouter();
  const { dbUser } = useAuth();
  const empresaId = dbUser?.empresa_id as string | undefined;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);

  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // ✅ si estamos editando, arrancamos en “cargando producto”
  const [loadingProducto, setLoadingProducto] = useState(!!productoId);

  const [form, setForm] = useState<ProductoFormState>({
    nombre: "",
    descripcion: "",
    precio: "",
    stock: "",
    tipo: "",
    categoria_id: null,
    estado: "draft", // ✅ por defecto, nuevo producto arranca como borrador
  });

  const badge = useMemo(() => {
    if (form.estado === "published") {
      return {
        label: "Publicado",
        cls: "bg-emerald-600/20 text-emerald-200 border-emerald-500/40",
      };
    }
    return {
      label: "Borrador",
      cls: "bg-amber-600/20 text-amber-200 border-amber-500/40",
    };
  }, [form.estado]);

  // ============================
  // 1) Traer categorías
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

      if (!error && data) setCategorias(data);
      else console.error("Error cargando categorías:", error);

      setLoadingCategorias(false);
    };

    fetchCategorias();
  }, [empresaId]);

  // ============================
  // 2) Si edición → cargar producto (incluye estado)
  //    ✅ PATCH: esperar empresaId + filtrar por empresa_id
  // ============================
  useEffect(() => {
    if (!productoId) return;
    if (!empresaId) return; // ✅ evita pedir el producto sin tenancy (RLS/0 rows)

    const fetchProducto = async () => {
      setLoadingProducto(true);

      const { data, error } = await supabase
        .from("producto")
        // ✅ mejor contrato: no select("*")
        .select("id,nombre,descripcion,precio,stock,tipo,estado,categoria_id")
        .eq("id", productoId)
        .eq("empresa_id", empresaId) // ✅ clave: scope por tenant
        .single();

      if (!error && data) {
        setForm({
          nombre: data.nombre ?? "",
          descripcion: data.descripcion ?? "",
          precio: data.precio ?? "",
          stock: data.stock ?? "",
          tipo: data.tipo ?? "",
          categoria_id: data.categoria_id ?? null,
          estado: (data.estado as ProductoEstado) || "draft",
        });
      } else {
        console.error("Error cargando producto:", error);
      }

      setLoadingProducto(false);
    };

    fetchProducto();
  }, [productoId, empresaId]); // ✅ patch: agregar empresaId

  // ============================
  // 3) Handler inputs
  // ============================
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === "categoria_id" && value === "" ? null : value,
    }));
  };

  // ============================
  // Helpers: guardar (sin cambiar estado)
  // ============================
  const saveProducto = async (overrideEstado?: ProductoEstado) => {
    if (!empresaId) {
      alert("No se encontró empresa asociada al usuario.");
      return { ok: false as const, id: null as string | null };
    }

    // Validaciones mínimas (por si publicás directo)
    if (!form.nombre.trim()) {
      alert("El nombre es obligatorio.");
      return { ok: false as const, id: null as string | null };
    }

    const estadoToSave = overrideEstado ?? form.estado;

    const payload = {
      ...(productoId ? { id: productoId } : {}),
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: Number(form.precio),
      stock: Number(form.stock),
      tipo: form.tipo || null,
      categoria_id: form.categoria_id,
      empresa_id: empresaId,
      estado: estadoToSave, // ✅ B1
    };

    if (productoId) {
      // update
      const { error } = await supabase
        .from("producto")
        .update(payload)
        .eq("id", productoId)
        .eq("empresa_id", empresaId); // ✅ extra safety: no cross-tenant update

      if (error) {
        console.error("Error actualizando producto:", error);
        alert("Error guardando producto.");
        return { ok: false as const, id: null as string | null };
      }

      setForm((p) => ({ ...p, estado: estadoToSave }));
      return { ok: true as const, id: productoId };
    }

    // insert (necesitamos el id devuelto para “crear y publicar”)
    const { data, error } = await supabase
      .from("producto")
      .insert(payload)
      .select("id, estado")
      .single();

    if (error || !data) {
      console.error("Error creando producto:", error);
      alert("Error creando producto.");
      return { ok: false as const, id: null as string | null };
    }

    setForm((p) => ({ ...p, estado: (data.estado as ProductoEstado) || estadoToSave }));
    return { ok: true as const, id: data.id as string };
  };

  // ============================
  // 4) Guardar normal (no cambia estado)
  // ============================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    const res = await saveProducto();
    setSaving(false);

    if (!res.ok) return;

    // ✅ vuelve al listado; el listado debería mostrar estado/badges
    router.push("/panel/productos");
  };

  // ============================
  // 5) Transiciones de estado (Publicar / Borrador)
  // ============================
  const handlePublish = async () => {
    if (transitioning || saving) return;

    setTransitioning(true);

    // Si no existe aún, crea y publica en un paso
    const res = await saveProducto("published");

    setTransitioning(false);

    if (!res.ok) return;

    // Si venías desde "Nuevo", dejá el form ya en edición (URL con id)
    if (!productoId && res.id) {
      router.replace(`/panel/productos/editar/${res.id}`);
      return;
    }
  };

  const handleDraft = async () => {
    if (!productoId) {
      // nuevo sin guardar ya es draft
      setForm((p) => ({ ...p, estado: "draft" }));
      return;
    }

    if (transitioning || saving) return;

    setTransitioning(true);
    const res = await saveProducto("draft");
    setTransitioning(false);

    if (!res.ok) return;
  };

  if (loadingProducto) {
    return <div className="p-4">Cargando producto...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-4">
      {/* Header estado */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${badge.cls}`}
          >
            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
            {badge.label}
          </div>

          {form.estado === "draft" ? (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Este producto está en <b>borrador</b>. No debería mostrarse en la tienda hasta publicarlo.
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Este producto está <b>publicado</b>. Se considera visible en la tienda.
            </div>
          )}
        </div>

        {/* Acciones de estado */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {form.estado === "draft" ? (
            <button
              type="button"
              onClick={handlePublish}
              disabled={saving || transitioning}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {transitioning ? "Publicando..." : "Publicar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDraft}
              disabled={saving || transitioning}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:opacity-60"
            >
              {transitioning ? "Pasando a borrador..." : "Pasar a borrador"}
            </button>
          )}
        </div>
      </div>

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
          <option value="">{loadingCategorias ? "Cargando..." : "Sin categoría"}</option>

          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Guardar */}
      <button
        type="submit"
        disabled={saving || transitioning}
        className="px-4 py-2 bg-black text-white rounded hover:bg-neutral-800 disabled:opacity-60"
      >
        {saving ? "Guardando..." : productoId ? "Guardar cambios" : "Crear producto"}
      </button>
    </form>
  );
};

export default ProductForm;

