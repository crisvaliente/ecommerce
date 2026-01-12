import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

type Categoria = {
  id: string;
  nombre: string;
  empresa_id?: string;
};

type ProductoEstado = "draft" | "published";

type ProductoFormState = {
  nombre: string;
  descripcion: string;
  precio: number | string;
  stock: number | string; // legacy (solo si NO usa variantes)
  tipo: string;
  categoria_id: string | null;
  estado: ProductoEstado;
};

interface Props {
  productoId?: string;
}

// ===== Tipos para el fetch del producto (A3.1) =====
type ProductoCategoriaRow = {
  categoria: Categoria | Categoria[] | null;
};

type ProductoRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  tipo: string | null;
  categoria_id: string | null;
  empresa_id: string;
  estado: string | null;
  usa_variantes?: boolean | null;
  producto_categoria: ProductoCategoriaRow[] | null;
};

function pickCategoria(raw: ProductoCategoriaRow["categoria"]): Categoria | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function toProductoEstado(v: string | null | undefined): ProductoEstado {
  return v === "published" ? "published" : "draft";
}

// ===== Variantes (schema real) =====
type ProductoVariante = {
  id: string;
  empresa_id: string;
  producto_id: string;
  talle: string;
  stock: number;
  activo: boolean;
  creado_en: string | null;
  updated_at: string | null;
};

type VarianteFormState = {
  id?: string;
  nombre: string; // UI label (en DB es talle)
  stock: number | string;
  activo: boolean;
};

const ProductForm: React.FC<Props> = ({ productoId }) => {
  const router = useRouter();
  const { dbUser } = useAuth();
  const empresaId = dbUser?.empresa_id as string | undefined;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);

  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const [loadingProducto, setLoadingProducto] = useState(!!productoId);

  // ✅ flags stock real
  const [usaVariantes, setUsaVariantes] = useState(false);
  const [stockTotal, setStockTotal] = useState<number | null>(null);

  const [form, setForm] = useState<ProductoFormState>({
    nombre: "",
    descripcion: "",
    precio: "",
    stock: "",
    tipo: "",
    categoria_id: null,
    estado: "draft",
  });

  // ✅ Capa 2: opción /nuevo
  const [crearEnModoVariantes, setCrearEnModoVariantes] = useState(false);

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
  // Variantes state
  // ============================
  const [variantes, setVariantes] = useState<ProductoVariante[]>([]);
  const [loadingVariantes, setLoadingVariantes] = useState(false);

  const [varModalOpen, setVarModalOpen] = useState(false);
  const [varSaving, setVarSaving] = useState(false);
  const [varEditingId, setVarEditingId] = useState<string | null>(null);

  const [varForm, setVarForm] = useState<VarianteFormState>({
    nombre: "",
    stock: "",
    activo: true,
  });

  const [switchingToVariantes, setSwitchingToVariantes] = useState(false);

  // ============================
  // Helpers stock resumen
  // ============================
  const fetchResumenStock = async () => {
    if (!productoId) return;
    if (!empresaId) return;

    const { data: resumen, error: resumenError } = await supabase
      .from("producto_stock_resumen")
      .select("stock_total, usa_variantes")
      .eq("empresa_id", empresaId)
      .eq("producto_id", productoId)
      .maybeSingle<{ stock_total: number; usa_variantes: boolean }>();

    if (resumenError) {
      console.warn("[producto] resumen warning:", resumenError);
    }

    const _usaVariantes = Boolean(resumen?.usa_variantes);
    const _stockTotal =
      typeof resumen?.stock_total === "number" ? resumen.stock_total : null;

    setUsaVariantes(_usaVariantes);
    setStockTotal(_stockTotal);
  };

  // ============================
  // Variantes: fetch list
  // ============================
  const fetchVariantes = async () => {
    if (!productoId) return;
    if (!empresaId) return;

    setLoadingVariantes(true);

    const { data, error } = await supabase
      .from("producto_variante")
      .select(
        "id, empresa_id, producto_id, talle, stock, activo, creado_en, updated_at"
      )
      .eq("producto_id", productoId)
      .eq("empresa_id", empresaId)
      .order("talle", { ascending: true })
      .order("creado_en", { ascending: true });

    if (error) {
      console.error("Error cargando variantes:", error);
      setVariantes([]);
    } else {
      setVariantes((data ?? []) as ProductoVariante[]);
    }

    setLoadingVariantes(false);
  };

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

      if (!error && data) setCategorias(data as Categoria[]);
      else console.error("Error cargando categorías:", error);

      setLoadingCategorias(false);
    };

    fetchCategorias();
  }, [empresaId]);

  // ============================
  // 2) Si edición → cargar producto + resumen stock
  // ============================
  useEffect(() => {
    if (!productoId) return;
    if (!empresaId) return;

    const fetchProducto = async () => {
      setLoadingProducto(true);

      // A) producto (sin view)
      const { data, error } = await supabase
        .from("producto")
        .select(
          "id,nombre,descripcion,precio,stock,tipo,categoria_id,empresa_id,estado,usa_variantes,producto_categoria(categoria(id,nombre,empresa_id))"
        )
        .eq("id", productoId)
        .eq("empresa_id", empresaId)
        .single<ProductoRow>();

      if (error || !data) {
        console.error("Error cargando producto:", error);
        setLoadingProducto(false);
        return;
      }

      // B) resumen stock (view) por separado
      const { data: resumen, error: resumenError } = await supabase
        .from("producto_stock_resumen")
        .select("stock_total, usa_variantes")
        .eq("empresa_id", empresaId)
        .eq("producto_id", productoId)
        .maybeSingle<{ stock_total: number; usa_variantes: boolean }>();

      if (resumenError) {
        console.warn("[producto] resumen warning:", resumenError);
      }

      const _usaVariantes = Boolean(resumen?.usa_variantes);
      const _stockTotal =
        typeof resumen?.stock_total === "number" ? resumen.stock_total : null;

      setUsaVariantes(_usaVariantes);
      setStockTotal(_stockTotal);

      // bridge-first: si no hay rows en puente, cae a legacy categoria_id
      const pc0 = data.producto_categoria?.[0] ?? null;
      const cat = pc0 ? pickCategoria(pc0.categoria) : null;

      setForm({
        nombre: data.nombre ?? "",
        descripcion: data.descripcion ?? "",
        precio: data.precio ?? "",
        stock: data.stock ?? "",
        tipo: data.tipo ?? "",
        categoria_id: cat?.id ?? data.categoria_id ?? null,
        estado: toProductoEstado(data.estado),
      });

      setLoadingProducto(false);
    };

    fetchProducto();
  }, [productoId, empresaId]);

  // ============================
  // 2.1) Si usa_variantes=true → traer variantes
  // ============================
  useEffect(() => {
    if (!productoId) return;
    if (!empresaId) return;

    if (usaVariantes) {
      fetchVariantes();
    } else {
      setVariantes([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, empresaId, usaVariantes]);

  // ============================
  // 3) Handler inputs producto
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
  // Helpers: guardar producto (sin cambiar estado)
  // ============================
  const saveProducto = async (overrideEstado?: ProductoEstado) => {
    if (!empresaId) {
      alert("No se encontró empresa asociada al usuario.");
      return { ok: false as const, id: null as string | null };
    }

    if (!form.nombre.trim()) {
      alert("El nombre es obligatorio.");
      return { ok: false as const, id: null as string | null };
    }

    const estadoToSave = overrideEstado ?? form.estado;

    // ✅ Regla: si usa variantes, NO tocamos producto.stock (legacy fallback)
    const shouldWriteLegacyStock = !usaVariantes;

    const basePayload = {
      ...(productoId ? { id: productoId } : {}),
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: Number(form.precio),
      tipo: form.tipo || null,
      categoria_id: form.categoria_id, // legacy write
      empresa_id: empresaId,
      estado: estadoToSave,
    };

    const payload = shouldWriteLegacyStock
      ? { ...basePayload, stock: Number(form.stock) }
      : basePayload;

    if (productoId) {
      const { error } = await supabase
        .from("producto")
        .update(payload)
        .eq("id", productoId)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("Error actualizando producto:", error);
        alert("Error guardando producto.");
        return { ok: false as const, id: null as string | null };
      }

      setForm((p) => ({ ...p, estado: estadoToSave }));
      return { ok: true as const, id: productoId };
    }

    const { data, error } = await supabase
      .from("producto")
      .insert(payload)
      .select("id, estado")
      .single<{ id: string; estado: string | null }>();

    if (error || !data) {
      console.error("Error creando producto:", error);
      alert("Error creando producto.");
      return { ok: false as const, id: null as string | null };
    }

    setForm((p) => ({ ...p, estado: toProductoEstado(data.estado) }));
    return { ok: true as const, id: data.id };
  };

  // ============================
  // Capa 2 helper: si se eligió "crear en modo variantes"
  // ============================
  const maybeSetUsaVariantesAfterCreate = async (newId: string) => {
    // Solo aplica en /nuevo
    if (productoId) return;

    // Solo si el usuario lo marcó
    if (!crearEnModoVariantes) return;

    if (!empresaId) return;

    const { error } = await supabase
      .from("producto")
      .update({ usa_variantes: true })
      .eq("id", newId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("Error seteando usa_variantes post-create:", error);
      alert(
        "El producto se creó, pero no se pudo activar modo variantes automáticamente. Podés activarlo desde edición con 'Pasar a variantes'."
      );
    }
  };

  // ============================
  // 4) Guardar normal
  // ============================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    const res = await saveProducto();
    setSaving(false);

    if (!res.ok) return;

    // ✅ Capa 1: si es create → ir a /panel/productos/<id>
    if (!productoId && res.id) {
      // ✅ Capa 2: si marcó "Crear en modo variantes" → update usa_variantes=true
      await maybeSetUsaVariantesAfterCreate(res.id);

      router.replace(`/panel/productos/${res.id}`);
      return;
    }

    // Si es edición: nos quedamos en la pantalla.
  };

  // ============================
  // 5) Transiciones de estado
  // ============================
  const handlePublish = async () => {
    if (transitioning || saving) return;

    setTransitioning(true);
    const res = await saveProducto("published");
    setTransitioning(false);

    if (!res.ok) return;

    // Si estamos en /nuevo y se publica al crear:
    if (!productoId && res.id) {
      await maybeSetUsaVariantesAfterCreate(res.id);
      router.replace(`/panel/productos/${res.id}`);
      return;
    }
  };

  const handleDraft = async () => {
    if (!productoId) {
      setForm((p) => ({ ...p, estado: "draft" }));
      return;
    }

    if (transitioning || saving) return;

    setTransitioning(true);
    const res = await saveProducto("draft");
    setTransitioning(false);

    if (!res.ok) return;
  };

  // ============================
  // Variantes: modal helpers
  // ============================
  const openCreateVariante = () => {
    setVarEditingId(null);
    setVarForm({ nombre: "", stock: "", activo: true });
    setVarModalOpen(true);
  };

  const openEditVariante = (v: ProductoVariante) => {
    setVarEditingId(v.id);
    setVarForm({
      id: v.id,
      nombre: v.talle ?? "",
      stock: typeof v.stock === "number" ? v.stock : "",
      activo: !!v.activo,
    });
    setVarModalOpen(true);
  };

  const closeVarianteModal = () => {
    if (varSaving) return;
    setVarModalOpen(false);
  };

  const handleVarFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;

    setVarForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const saveVariante = async () => {
    if (!productoId) return;
    if (!empresaId) return;

    if (!varForm.nombre.trim()) {
      alert("El talle es obligatorio.");
      return;
    }

    setVarSaving(true);

    const payload = {
      empresa_id: empresaId,
      producto_id: productoId,
      talle: varForm.nombre.trim(),
      stock: Number(varForm.stock) || 0,
      activo: !!varForm.activo,
    };

    if (varEditingId) {
      const { error } = await supabase
        .from("producto_variante")
        .update(payload)
        .eq("id", varEditingId)
        .eq("empresa_id", empresaId);

      if (error) {
        console.error("Error actualizando variante:", error);
        alert("Error guardando variante.");
        setVarSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("producto_variante").insert(payload);

      if (error) {
        console.error("Error creando variante:", error);
        alert("Error creando variante.");
        setVarSaving(false);
        return;
      }
    }

    await fetchVariantes();
    await fetchResumenStock();

    setVarSaving(false);
    setVarModalOpen(false);
  };

  const toggleVarianteActivo = async (v: ProductoVariante) => {
    if (!productoId) return;
    if (!empresaId) return;

    const nextActivo = !v.activo;

    const { error } = await supabase
      .from("producto_variante")
      .update({ activo: nextActivo })
      .eq("id", v.id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("Error toggling activo:", error);
      alert("No se pudo actualizar el estado.");
      return;
    }

    setVariantes((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, activo: nextActivo } : x))
    );
    await fetchResumenStock();
  };

  const deleteVariante = async (v: ProductoVariante) => {
    if (!productoId) return;
    if (!empresaId) return;

    const ok = confirm(`¿Eliminar variante "${v.talle}"?`);
    if (!ok) return;

    const { error } = await supabase
      .from("producto_variante")
      .delete()
      .eq("id", v.id)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("Error eliminando variante:", error);
      alert("No se pudo eliminar la variante.");
      return;
    }

    setVariantes((prev) => prev.filter((x) => x.id !== v.id));
    await fetchResumenStock();
  };

  // ============================
  // UX transición: Pasar a variantes (B1.4 asistida)
  // ============================
  const handlePasarAVariantes = async () => {
    if (!productoId) {
      alert("Primero creá el producto para poder activar variantes.");
      return;
    }
    if (!empresaId) return;

    setSwitchingToVariantes(true);

    try {
      // 1) Traer producto (fuente de verdad)
      const { data: prod, error: prodErr } = await supabase
        .from("producto")
        .select("id, empresa_id, stock, usa_variantes")
        .eq("id", productoId)
        .eq("empresa_id", empresaId)
        .single<{ id: string; empresa_id: string; stock: number; usa_variantes: boolean | null }>();

      if (prodErr) throw prodErr;
      if (!prod) throw new Error("Producto no encontrado.");

      if (prod.usa_variantes) {
        // ya está, refrescamos y salimos
        await fetchResumenStock();
        await fetchVariantes();
        setUsaVariantes(true);
        return;
      }

      const stockDB = Number(prod.stock ?? 0);
      const stockToMigrate = Number.isFinite(stockDB) ? stockDB : 0;

      // 2) Confirm general de pasar a variantes
      const ok = confirm(
        "¿Pasar a modo variantes?\n\nEl stock real se gestionará en variantes. El stock simple quedará como fallback legacy."
      );
      if (!ok) return;

      // 3) Si hay stock legacy, ofrecer migración a variante inicial
      let shouldMigrate = false;
      if (stockToMigrate > 0) {
        shouldMigrate = confirm(
          `Este producto tiene stock actual (${stockToMigrate}).\n\n¿Querés migrarlo a una variante inicial "Único"?`
        );
      }

      if (shouldMigrate) {
        // Evitar duplicar "Único" (chequeo simple)
        const { data: existing, error: exErr } = await supabase
          .from("producto_variante")
          .select("id, talle")
          .eq("empresa_id", empresaId)
          .eq("producto_id", productoId)
          .or("talle.eq.Único,talle.eq.Unico,talle.eq.General")
          .limit(1);

        if (exErr) throw exErr;

        if (!existing || existing.length === 0) {
          const { error: insErr } = await supabase.from("producto_variante").insert([
            {
              empresa_id: empresaId,
              producto_id: productoId,
              talle: "Único",
              stock: stockToMigrate,
              activo: true,
            },
          ]);
          if (insErr) throw insErr;
        }
      }

      // 4) Activar usa_variantes
      const { error: updErr } = await supabase
        .from("producto")
        .update({ usa_variantes: true })
        .eq("id", productoId)
        .eq("empresa_id", empresaId);

      if (updErr) throw updErr;

      // 5) Refrescar UI
      await fetchResumenStock();
      setUsaVariantes(true);
      await fetchVariantes();
    } catch (err: unknown) {
  console.error("Error pasando a variantes (B1.4):", err);

  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "No se pudo activar el modo variantes.";

  alert(message);
} finally {

      setSwitchingToVariantes(false);
    }
  };

  if (loadingProducto) {
    return <div className="p-4">Cargando producto...</div>;
  }

  const showStockLegacyInput = !usaVariantes;

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
              Este producto está en <b>borrador</b>. No debería mostrarse en la
              tienda hasta publicarlo.
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Este producto está <b>publicado</b>. Se considera visible en la
              tienda.
            </div>
          )}

          {/* Resumen stock */}
          <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-white/90">Stock total:</span>
              <span className="font-semibold text-white">
                {typeof stockTotal === "number" ? stockTotal : "—"}
              </span>
              {usaVariantes ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-100">
                  calculado por variantes
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">
                  stock simple (legacy)
                </span>
              )}
            </div>

            {usaVariantes && (
              <div className="mt-1 text-xs text-white/60">
                Nota: en Camino A el stock total suma existencias aunque la
                variante esté inactiva.
              </div>
            )}
          </div>
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

      {/* ✅ Capa 2 (solo /nuevo): opción "Crear en modo variantes" */}
      {!productoId && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <label className="flex items-start gap-3 text-sm text-white/90">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={crearEnModoVariantes}
              onChange={(e) => setCrearEnModoVariantes(e.target.checked)}
            />
            <span>
              <span className="font-medium">Crear en modo variantes</span>
              <span className="block text-xs text-white/60">
                Al crear, se activará <b>usa_variantes=true</b> y luego podrás
                cargar talles/stock desde variantes.
              </span>
            </span>
          </label>
        </div>
      )}

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

      {/* Stock legacy (solo si NO usa variantes) */}
      {showStockLegacyInput && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-white/90">Modo legacy</div>
              <div className="text-xs text-white/60">
                El stock simple aplica solo mientras <b>usa_variantes</b> sea
                false.
              </div>
            </div>

            <button
              type="button"
              onClick={handlePasarAVariantes}
              disabled={!productoId || switchingToVariantes}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-60"
              title={!productoId ? "Primero creá el producto" : "Pasar a modo variantes"}
            >
              {switchingToVariantes ? "Pasando..." : "Pasar a variantes"}
            </button>
          </div>

          <div className="mt-3">
            <label className="block font-medium">Stock</label>
            <input
              type="number"
              name="stock"
              className="border rounded w-full px-3 py-2"
              value={form.stock}
              onChange={handleChange}
              required
              min={0}
            />
            <div className="mt-1 text-xs text-white/60">Stock simple (legacy).</div>
          </div>
        </div>
      )}

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

      {/* ============================
          Variantes block (solo si usa_variantes)
         ============================ */}
      {usaVariantes && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-white/90">Variantes</div>
              <div className="text-xs text-white/60">
                Gestioná stock real por talle/variante. (Camino A: stock total ignora activo)
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={fetchVariantes}
                disabled={loadingVariantes}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-60"
              >
                {loadingVariantes ? "Cargando..." : "Refrescar"}
              </button>

              <button
                type="button"
                onClick={openCreateVariante}
                disabled={!productoId}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                Nueva variante
              </button>
            </div>
          </div>

          {!productoId && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Guardá/creá el producto primero para poder agregar variantes.
            </div>
          )}

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead className="text-white/70">
                <tr>
                  <th className="text-left font-medium">Talle</th>
                  <th className="text-right font-medium">Stock</th>
                  <th className="text-center font-medium">Activa</th>
                  <th className="text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingVariantes ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-white/70">
                      Cargando variantes...
                    </td>
                  </tr>
                ) : variantes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-white/70">
                      No hay variantes todavía.
                    </td>
                  </tr>
                ) : (
                  variantes.map((v) => (
                    <tr key={v.id} className="rounded-lg bg-white/5">
                      <td className="px-2 py-2 text-white">{v.talle}</td>
                      <td className="px-2 py-2 text-right text-white font-semibold">
                        {v.stock}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!!v.activo}
                          onChange={() => toggleVarianteActivo(v)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditVariante(v)}
                            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteVariante(v)}
                            className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/25"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal simple */}
          {varModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-lg rounded-xl border border-white/10 bg-neutral-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {varEditingId ? "Editar variante" : "Nueva variante"}
                    </div>
                    <div className="text-xs text-white/60">
                      El stock real vive en <b>producto_variante.stock</b>.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeVarianteModal}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15"
                    disabled={varSaving}
                  >
                    Cerrar
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <label className="block text-sm font-medium text-white/90">
                      Talle
                    </label>
                    <input
                      name="nombre"
                      value={varForm.nombre}
                      onChange={handleVarFormChange}
                      className="mt-1 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-white"
                      placeholder="Ej: S / M / L"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-white/90">
                        Stock
                      </label>
                      <input
                        name="stock"
                        type="number"
                        min={0}
                        value={varForm.stock}
                        onChange={handleVarFormChange}
                        className="mt-1 w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-white"
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <input
                        id="activo"
                        name="activo"
                        type="checkbox"
                        checked={!!varForm.activo}
                        onChange={handleVarFormChange}
                        className="h-4 w-4"
                      />
                      <label htmlFor="activo" className="text-sm text-white/90">
                        Activa
                      </label>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeVarianteModal}
                      disabled={varSaving}
                      className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={saveVariante}
                      disabled={varSaving}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {varSaving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
