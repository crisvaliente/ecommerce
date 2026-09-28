import React, { useCallback, useEffect, useRef, useState } from "react";
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

type CategoriasApiResponse = {
  items: Categoria[];
};

type CategoriaWrite = {
  method: "POST" | "PATCH" | "DELETE";
  id?: string;
  body?: Pick<Categoria, "nombre" | "slug" | "descripcion" | "orden">;
};

const CATEGORIAS_ENDPOINT = "/api/panel/categorias";

const WRITE_ERROR_MESSAGES: Record<string, string> = {
  categoria_duplicada: "Ya existe una categoría con ese nombre.",
  categoria_en_uso: "No se puede eliminar: hay productos que usan esta categoría.",
  categoria_no_encontrada: "La categoría ya no existe. Recargá el listado.",
};

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) console.error("[categorias] getSession error:", error);
  return session?.access_token ?? null;
}

/** Returns null on success, or the API error code. */
async function sendCategoriaWrite({ method, id, body }: CategoriaWrite): Promise<string | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return "unauthorized";

  const url = id ? `${CATEGORIAS_ENDPOINT}?id=${encodeURIComponent(id)}` : CATEGORIAS_ENDPOINT;
  const response = await fetch(
    url,
    body
      ? {
          method,
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { method, headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (response.ok) return null;

  const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
  const code = typeof payload?.error === "string" ? payload.error : "unknown_error";
  console.error("[categorias] write error:", method, response.status, code);
  return code;
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
  const listingRequestId = useRef(0);

  const empresaId = dbUser?.empresa_id;

  const fetchCategorias = useCallback(async () => {
    const requestId = ++listingRequestId.current;
    const isCurrentRequest = () => listingRequestId.current === requestId;

    try {
      setLoadingCategorias(true);

      const accessToken = await getAccessToken();
      if (!accessToken) {
        if (isCurrentRequest()) {
          setCategorias([]);
          setErrorMsg("Sesión no válida. Volvé a iniciar sesión.");
        }
        return;
      }

      const response = await fetch(CATEGORIAS_ENDPOINT, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error("[categorias] endpoint error:", response.status, text);
        if (isCurrentRequest()) {
          setCategorias([]);
          setErrorMsg("No se pudieron cargar las categorías.");
        }
        return;
      }

      const data = (await response.json()) as CategoriasApiResponse;
      if (isCurrentRequest()) {
        setCategorias(data.items ?? []);
      }
    } catch (err) {
      console.error("Error cargando categorías", err);
      if (isCurrentRequest()) {
        setCategorias([]);
        setErrorMsg("No se pudieron cargar las categorías.");
      }
    } finally {
      if (isCurrentRequest()) setLoadingCategorias(false);
    }
  }, []);

  // dbUser.company remains a reload trigger; the API owns listing authorization.
  useEffect(() => {
    if (!empresaId) return;
    void fetchCategorias();
  }, [empresaId, fetchCategorias]);

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
      setErrorMsg(null);
      const errorCode = await sendCategoriaWrite({ method: "DELETE", id });
      if (errorCode) {
        setErrorMsg(WRITE_ERROR_MESSAGES[errorCode] ?? "No se pudo eliminar la categoría.");
        return;
      }
      await fetchCategorias();
    } catch (err) {
      console.error("Error eliminando categoría", err);
      setErrorMsg("No se pudo eliminar la categoría.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      setErrorMsg("El nombre es obligatorio.");
      return;
    }

    const finalSlug = slug.trim() || slugify(nombre);

    try {
      setSaving(true);
      setErrorMsg(null);

      const errorCode = await sendCategoriaWrite({
        method: editingId ? "PATCH" : "POST",
        id: editingId ?? undefined,
        body: {
          nombre: nombre.trim(),
          slug: finalSlug,
          descripcion: descripcion.trim() || null,
          orden: typeof orden === "number" ? orden : null,
        },
      });
      if (errorCode) {
        setErrorMsg(WRITE_ERROR_MESSAGES[errorCode] ?? "No se pudo guardar la categoría.");
        return;
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
                        disabled={saving}
                        className="text-red-600 hover:underline disabled:opacity-50"
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
