import React, { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../lib/supabaseClient";

interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  orden: number | null;
}

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const CategoriasPage: React.FC = () => {
  const { dbUser, loading } = useAuth();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [orden, setOrden] = useState<number | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const empresaId = dbUser?.empresa_id;

  // Cargar categorías de la empresa
  useEffect(() => {
    if (!empresaId) return;
    fetchCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const fetchCategorias = async () => {
    try {
      setLoadingCategorias(true);
      const { data, error } = await supabase
        .from("categoria")
        .select("id, nombre, slug, descripcion, orden")
        .eq("empresa_id", empresaId)
        .order("orden", { ascending: true, nullsFirst: true });

      if (error) throw error;
      setCategorias(data || []);
    } catch (err) {
      console.error("Error cargando categorías", err);
      setErrorMsg("No se pudieron cargar las categorías.");
    } finally {
      setLoadingCategorias(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setNombre("");
    setSlug("");
    setDescripcion("");
    setOrden(undefined);
    setErrorMsg(null);
  };

  const handleEdit = (cat: Categoria) => {
    setEditingId(cat.id);
    setNombre(cat.nombre);
    setSlug(cat.slug);
    setDescripcion(cat.descripcion || "");
    setOrden(cat.orden ?? undefined);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría? (Si hay productos usándola, puede fallar)")) return;
    try {
      setSaving(true);
      const { error } = await supabase.from("categoria").delete().eq("id", id);
      if (error) throw error;
      await fetchCategorias();
    } catch (err) {
      console.error("Error eliminando categoría", err);
      setErrorMsg(
        "No se pudo eliminar la categoría. Verificá si no tiene productos asociados."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresaId) {
      setErrorMsg("No se encontró empresa asociada al usuario.");
      return;
    }
    if (!nombre.trim()) {
      setErrorMsg("El nombre es obligatorio.");
      return;
    }

    const finalSlug = slug.trim() || slugify(nombre);

    try {
      setSaving(true);
      setErrorMsg(null);

      if (editingId) {
        const { error } = await supabase
          .from("categoria")
          .update({
            nombre: nombre.trim(),
            slug: finalSlug,
            descripcion: descripcion.trim() || null,
            orden: typeof orden === "number" ? orden : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("categoria").insert({
          empresa_id: empresaId,
          nombre: nombre.trim(),
          slug: finalSlug,
          descripcion: descripcion.trim() || null,
          orden: typeof orden === "number" ? orden : null,
        });

        if (error) throw error;
      }

      resetForm();
      await fetchCategorias();
    } catch (err) {
      console.error("Error guardando categoría", err);
      setErrorMsg("No se pudo guardar la categoría.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !dbUser) {
    return (
      <AdminLayout>
        <p className="p-4">Cargando sesión...</p>
      </AdminLayout>
    );
  }

  if (!dbUser) {
    return (
      <AdminLayout>
        <p className="p-4">Debes iniciar sesión para ver esta página.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold mb-4">Categorías</h1>

        {errorMsg && (
          <div className="bg-red-100 text-red-800 px-4 py-2 rounded">
            {errorMsg}
          </div>
        )}

        {/* Formulario crear/editar */}
        <form
          onSubmit={handleSubmit}
          className="bg-white shadow rounded p-4 space-y-4 max-w-xl"
        >
          <h2 className="text-lg font-semibold">
            {editingId ? "Editar categoría" : "Nueva categoría"}
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                if (!slug) {
                  setSlug(slugify(e.target.value));
                }
              }}
              className="w-full border rounded px-3 py-2"
              placeholder="Ej: Remeras"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className="w-full border rounded px-3 py-2"
              placeholder="remeras"
            />
            <p className="text-xs text-gray-500 mt-1">
              Usado para URLs amigables en el futuro.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
              placeholder="Opcional: descripción breve de la categoría"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Orden</label>
            <input
              type="number"
              value={orden ?? ""}
              onChange={(e) =>
                setOrden(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-full border rounded px-3 py-2"
              placeholder="0, 1, 2..."
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-gray-600 hover:underline"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>

        {/* Listado */}
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-3">Listado de categorías</h2>

          {loadingCategorias ? (
            <p>Cargando categorías...</p>
          ) : categorias.length === 0 ? (
            <p className="text-gray-600">Todavía no hay categorías.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Nombre</th>
                  <th className="text-left py-2">Slug</th>
                  <th className="text-left py-2">Orden</th>
                  <th className="text-right py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((cat) => (
                  <tr key={cat.id} className="border-b last:border-none">
                    <td className="py-2">{cat.nombre}</td>
                    <td className="py-2 text-gray-600">{cat.slug}</td>
                    <td className="py-2">{cat.orden ?? "-"}</td>
                    <td className="py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(cat)}
                        className="text-blue-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id)}
                        className="text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default CategoriasPage;
