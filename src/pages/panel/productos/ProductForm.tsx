// src/pages/panel/productos/ProductForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import {
  uploadProductoImagen,
  createSignedUrl,
  deleteProductoImagen,
} from "../../../utils/storageProductoImagen";

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

// ===== Imágenes =====
type ImagenProductoRow = {
  id: string;
  producto_id: string;
  url_imagen: string; // legacy = path
  descripcion: string | null;
  creado_en: string | null;
  orden: number;
  es_principal: boolean;
  path: string | null; // canonical (recomendado)
  deleted_at: string | null;

};

type ImagenProductoUI = ImagenProductoRow & {
  signedUrl?: string;
};

type PublishChecklistItem = {
  label: string;
  done: boolean;
};

const ProductForm: React.FC<Props> = ({ productoId }) => {
  const router = useRouter();
  const { dbUser } = useAuth();
  const empresaId = dbUser?.empresa_id as string | undefined;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);

  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

  const publishChecklist = useMemo<PublishChecklistItem[]>(() => {
    return [
      {
        label: "Nombre del producto",
        done: form.nombre.trim().length > 0,
      },
      {
        label: "Precio valido",
        done: Number.isFinite(Number(form.precio)) && Number(form.precio) > 0,
      },
      {
        label: usaVariantes ? "Stock por talles configurado" : "Stock general configurado",
        done: usaVariantes || (Number.isFinite(Number(form.stock)) && Number(form.stock) >= 0),
      },
      {
        label: "Categoria o descripcion opcional revisada",
        done: Boolean(form.categoria_id || form.descripcion.trim().length > 0),
      },
    ];
  }, [form.categoria_id, form.descripcion, form.nombre, form.precio, form.stock, usaVariantes]);

  const publishReadyCount = publishChecklist.filter((item) => item.done).length;
  const publishReady = publishReadyCount === publishChecklist.length;

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
  // Imágenes state
  // ============================
  const [imagenes, setImagenes] = useState<ImagenProductoUI[]>([]);
  const [loadingImagenes, setLoadingImagenes] = useState(false);
  const [uploadingImagen, setUploadingImagen] = useState(false);

  const showError = (message: string) => {
    setSaveErr(message);
    setSaveMessage(null);
  };

  const showSuccess = (message: string) => {
    setSaveErr(null);
    setSaveMessage(message);
  };

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
// Imágenes: fetch list + signed urls
// ============================
const fetchImagenes = async (preserveOnError = false) => {
  if (!productoId) return;

  setLoadingImagenes(true);

  const { data, error } = await supabase
    .from("imagen_producto")
    .select(
      "id,producto_id,url_imagen,descripcion,creado_en,orden,es_principal,path,deleted_at"
    )
    .eq("producto_id", productoId)
    .is("deleted_at", null) // ✅ SOLO activas
    .order("es_principal", { ascending: false })
    .order("orden", { ascending: true })
    .order("creado_en", { ascending: true });

  if (error) {
    console.error("Error cargando imagenes:", error);
    setLoadingImagenes(false);
    if (!preserveOnError) {
      setImagenes([]);
    }
    return false;
  }

  const rows = (data ?? []) as ImagenProductoRow[];

  const enriched: ImagenProductoUI[] = [];
  for (const r of rows) {
    const rawPath = r.path ?? r.url_imagen;
    try {
      const signedUrl = await createSignedUrl(rawPath, 60 * 10);
      enriched.push({ ...r, signedUrl });
    } catch (e) {
      console.warn("No se pudo firmar url para", rawPath, e);
      enriched.push({ ...r, signedUrl: undefined });
    }
  }

  setImagenes(enriched);
  setLoadingImagenes(false);
  return true;
};


  // ============================
  // Imágenes: set principal
  // ============================
// ============================

// ============================
// Imágenes: set principal
// ============================
const setPrincipalImagen = async (imagenId: string) => {
  if (!productoId) return;

  // 1) desmarcar principal SOLO en activas
  const { error: e1 } = await supabase
    .from("imagen_producto")
    .update({ es_principal: false })
    .eq("producto_id", productoId)
    .is("deleted_at", null);

  if (e1) {
    console.error("Error limpiando principal:", e1);
    showError("No se pudo actualizar la imagen principal.");
    return;
  }

  // 2) marcar elegida como principal SOLO si está activa
  const { error: e2 } = await supabase
    .from("imagen_producto")
    .update({ es_principal: true })
    .eq("id", imagenId)
    .eq("producto_id", productoId)
    .is("deleted_at", null);

  if (e2) {
    console.error("Error seteando principal:", e2);
    showError("No se pudo actualizar la imagen principal.");
    return;
  }

  setImagenes((prev) =>
    prev.map((img) => ({ ...img, es_principal: img.id === imagenId }))
  );
  showSuccess("Imagen principal actualizada.");
};

// ============================
// Imágenes: delete (DB first + storage best-effort)
// ============================
const handleDeleteImagen = async (img: ImagenProductoUI) => {
  if (!productoId) return;

  const ok = confirm("¿Eliminar esta imagen?");
  if (!ok) return;

  try {
    // 0) Guardas rápidas de coherencia
    if (img.producto_id !== productoId) {
      showError("La imagen no pertenece al producto actual.");
      return;
    }

    const rawPath = img.path ?? img.url_imagen;

    // 1) Soft delete en DB vía RPC (evita RLS UPDATE fantasma)
    const { error: rpcErr } = await supabase.rpc("soft_delete_imagen_producto", {
      p_imagen_id: img.id,
    });

    if (rpcErr) {
      console.error("[delete-image] RPC error:", rpcErr);
      showError("No se pudo eliminar la imagen.");
      return;
    }

    // 2) UI optimista
    setImagenes((prev) => prev.filter((x) => x.id !== img.id));

    // 3) Si borraste la principal, elegimos una nueva desde DB (DB manda)
    if (img.es_principal) {
      const { data: actives, error: selErr } = await supabase
        .from("imagen_producto")
        .select("id")
        .eq("producto_id", productoId)
        .is("deleted_at", null)
        .order("orden", { ascending: true })
        .order("creado_en", { ascending: true })
        .limit(1);

      if (selErr) {
        console.error("[delete-image] select next principal error:", selErr);
      } else {
        const nextId = actives?.[0]?.id;

        if (nextId) {
          // marcar nueva principal
          const { error: pErr } = await supabase
            .from("imagen_producto")
            .update({ es_principal: true })
            .eq("id", nextId)
            .eq("producto_id", productoId)
            .is("deleted_at", null);

          if (pErr) console.error("[delete-image] set principal error:", pErr);
        }
      }
    }

    // 4) Storage best-effort (no bloquea DB)
    try {
      await deleteProductoImagen(rawPath);
    } catch (storageErr: unknown) {
      console.warn(
        "[delete-image] storage delete best-effort falló:",
        storageErr
      );
    }

    // 5) Consistencia final (DB manda)
    await fetchImagenes();
    showSuccess("Imagen eliminada correctamente.");
  } catch (e: unknown) {
    console.error("[handleDeleteImagen] catch:", e);
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Error eliminando imagen.";
    showError(message);
  }
};





// ============================
// Imágenes: upload + insert DB (B2 runtime)
// ============================
const uploadImagen = async (file: File) => {
  if (!productoId) {
    throw new Error("Primero creá el producto para poder subir imágenes.");
  }

  if (!empresaId) {
    throw new Error("No se encontró una empresa asociada al usuario.");
  }

  console.log("[B2] ==== PRE-FLIGHT ====");
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    console.error("[B2] getUser error:", userErr);
    throw new Error(userErr.message);
  }

  console.log("[B2] uid:", userRes.user?.id ?? null);
  console.log("[B2] empresaId:", empresaId ?? null);
  console.log("[B2] productoId:", productoId ?? null);

  if (!userRes.user?.id) {
    throw new Error("Necesitás una sesión válida para subir imágenes.");
  }

  let storagePath: string | null = null;

  try {
    // 1) subir a storage (ruta obligatoria)
    const up = await uploadProductoImagen({ empresaId, productoId, file });
    storagePath = up.path;
    console.log("[B2] upload OK path:", storagePath);

    // 2) next orden (SOLO activas)
    const { data: lastRow, error: lastErr } = await supabase
      .from("imagen_producto")
      .select("orden")
      .eq("producto_id", productoId)
      .is("deleted_at", null)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle<{ orden: number }>();

    if (lastErr) throw new Error(lastErr.message);
    const nextOrden = (lastRow?.orden ?? 0) + 1;

    // 3) principal condicional SOLO activas
    const { data: existentes, error: selErr } = await supabase
      .from("imagen_producto")
      .select("id, es_principal")
      .eq("producto_id", productoId)
      .is("deleted_at", null);

    if (selErr) throw new Error(selErr.message);

    const yaHayPrincipalActiva = (existentes ?? []).some(
      (x: { es_principal?: boolean }) => x.es_principal === true
    );
    const shouldBePrincipal = !yaHayPrincipalActiva;

    // 4) insert DB
    const { data: inserted, error: insErr } = await supabase
      .from("imagen_producto")
      .insert({
        producto_id: productoId,
        url_imagen: storagePath, // legacy
        path: storagePath, // canonical
        orden: nextOrden,
        es_principal: shouldBePrincipal,
      })
      .select(
        "id,producto_id,url_imagen,descripcion,creado_en,orden,es_principal,path"
      )
      .single<ImagenProductoRow>();

    if (insErr || !inserted) {
      throw new Error(insErr?.message || "No se pudo insertar imagen en DB.");
    }

    console.log("[B2] insert OK:", inserted);

    // 5) signed url preview
    let signedUrl: string | undefined;
    try {
      signedUrl = await createSignedUrl(
        inserted.path ?? inserted.url_imagen,
        60 * 10
      );
      console.log("[B2] signedUrl OK");
    } catch (signedErr) {
      console.warn("[B2] signedUrl WARN:", signedErr);
    }

    return { ...inserted, signedUrl };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error subiendo imagen.";
    console.error("[B2] ERROR:", message);

    // compensación best-effort si DB falló o algo rompió después del upload
    if (storagePath) {
      try {
        await deleteProductoImagen(storagePath);
        console.log("[B2] compensación OK:", storagePath);
      } catch (delErr: unknown) {
        console.warn(
          "[B2] compensación FALLÓ:",
          delErr instanceof Error ? delErr.message : delErr
        );
      }
    }

    throw new Error(message);
  }
};

const handleUploadImagen = async (files: File | FileList | File[]) => {
  const listaArchivos = Array.isArray(files)
    ? files
    : files instanceof File
      ? [files]
      : Array.from(files);

  if (listaArchivos.length === 0) return;

  setUploadingImagen(true);
  setSaveErr(null);

  let uploadedCount = 0;
  let lastError: string | null = null;
  let refreshOk = true;

  try {
    // Semántica actual del lote: secuencial y stop-on-first-error.
    for (const file of listaArchivos) {
      const uploaded = await uploadImagen(file);

      if (!uploaded) {
        continue;
      }

      uploadedCount += 1;
      setImagenes((prev) => [...prev, uploaded]);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error subiendo imagen.";
    lastError = uploadedCount > 0
      ? `Se subieron ${uploadedCount} imagen${uploadedCount === 1 ? "" : "es"}, pero falló la siguiente: ${message}`
      : message;
  } finally {
    refreshOk = (await fetchImagenes(true)) !== false;
    setUploadingImagen(false);
  }

  if (!refreshOk) {
    showError(
      uploadedCount > 0
        ? "Las imágenes se subieron, pero no se pudo refrescar el listado final."
        : "No se pudo refrescar el listado de imágenes."
    );
    return;
  }

  if (lastError) {
    showError(lastError);
    return;
  }

  showSuccess(
    uploadedCount === 1
      ? "Imagen subida correctamente."
      : `${uploadedCount} imágenes subidas correctamente.`
  );
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
  // 2.2) Si edición → traer imágenes
  // ============================
  useEffect(() => {
    if (!productoId) return;
    void fetchImagenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId]);

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
  // Helpers: guardar producto
  // ============================
  const saveProducto = async (overrideEstado?: ProductoEstado) => {
    if (!empresaId) {
      throw new Error("No se encontró una empresa asociada al usuario.");
    }

    if (!form.nombre.trim()) {
      throw new Error("El nombre es obligatorio.");
    }

    if (!Number.isFinite(Number(form.precio)) || Number(form.precio) <= 0) {
      throw new Error("Ingresá un precio válido mayor a 0.");
    }

    if (!usaVariantes && (!Number.isFinite(Number(form.stock)) || Number(form.stock) < 0)) {
      throw new Error("Ingresá un stock válido igual o mayor a 0.");
    }

    const estadoToSave = overrideEstado ?? form.estado;

    const shouldWriteLegacyStock = !usaVariantes;

    const basePayload = {
      ...(productoId ? { id: productoId } : {}),
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: Number(form.precio),
      tipo: form.tipo || null,
      categoria_id: form.categoria_id,
      empresa_id: empresaId,
      estado: estadoToSave,
    };

    const payload = shouldWriteLegacyStock
      ? { ...basePayload, stock: Number(form.stock) }
      : basePayload;

if (productoId) {
  const { data, error } = await supabase
    .from("producto")
    .update(payload)
    .eq("id", productoId)
    .eq("empresa_id", empresaId)
    .select("id, estado, updated_at")
    .single();

  if (error) {
    console.error("Error actualizando producto:", error);
    throw error;
  }
  if (!data?.id) {
    throw new Error("UPDATE no devolvió fila (0 rows?)");
  }

  // ✅ DB manda (tu trigger puede forzar draft)
  const estadoDB = toProductoEstado(data.estado);

  if (estadoDB !== estadoToSave) {
    console.warn("[producto] estado override por trigger", {
      requested: estadoToSave,
      db: data.estado,
    });
  }

  setForm((p) => ({ ...p, estado: estadoDB }));
  return { ok: true as const, id: productoId };
}

    const { data, error } = await supabase
      .from("producto")
      .insert(payload)
      .select("id, estado")
      .single<{ id: string; estado: string | null }>();

    if (error || !data) {
      console.error("Error creando producto:", error);
      throw new Error(error?.message || "Error creando producto.");
    }

    setForm((p) => ({ ...p, estado: toProductoEstado(data.estado) }));
    return { ok: true as const, id: data.id };
  };

  const maybeSetUsaVariantesAfterCreate = async (newId: string) => {
    if (productoId) return;
    if (!crearEnModoVariantes) return;
    if (!empresaId) return;

    const { error } = await supabase
      .from("producto")
      .update({ usa_variantes: true })
      .eq("id", newId)
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("Error seteando usa_variantes post-create:", error);
      showError(
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
  setSaveErr(null);
  setSaveMessage(null);

  try {
    const res = await saveProducto();

    setSaveMessage(productoId ? "Cambios guardados correctamente." : "Producto creado correctamente.");

    if (!productoId && res.id) {
      await maybeSetUsaVariantesAfterCreate(res.id);
      router.replace(`/panel/productos/${res.id}`);
      return;
    }
  } catch (err: unknown) {
    console.error("[handleSubmit] error:", err);
    setSaveErr(err instanceof Error ? err.message : "Error guardando producto.");
  } finally {
    setSaving(false);
  }
};

  // ============================
  // 5) Transiciones de estado
  // ============================
const handlePublish = async () => {
  if (transitioning || saving) return;

  setTransitioning(true);
  setSaveErr(null);
  setSaveMessage(null);

  try {
    const res = await saveProducto("published");

    setSaveMessage(
      productoId
        ? "Producto publicado correctamente."
        : "Producto creado y publicado correctamente."
    );

    if (!productoId && res.id) {
      await maybeSetUsaVariantesAfterCreate(res.id);
      router.replace(`/panel/productos/${res.id}`);
      return;
    }
  } catch (err: unknown) {
    console.error("[handlePublish] error:", err);
    setSaveErr(err instanceof Error ? err.message : "Error publicando.");
  } finally {
    setTransitioning(false);
  }
};

const handleDraft = async () => {
  if (!productoId) {
    setForm((p) => ({ ...p, estado: "draft" }));
    return;
  }

  if (transitioning || saving) return;

  setTransitioning(true);
  setSaveErr(null);
  setSaveMessage(null);

  try {
    await saveProducto("draft");

    setSaveMessage("Producto guardado como borrador.");
  } catch (err: unknown) {
    console.error("[handleDraft] error:", err);
    setSaveErr(err instanceof Error ? err.message : "Error pasando a borrador.");
  } finally {
    setTransitioning(false);
  }
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
      showError("El talle es obligatorio para guardar la variante.");
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
        showError("No se pudo guardar la variante.");
        setVarSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("producto_variante").insert(payload);

      if (error) {
        console.error("Error creando variante:", error);
        showError("No se pudo crear la variante.");
        setVarSaving(false);
        return;
      }
    }

    await fetchVariantes();
    await fetchResumenStock();

    setVarSaving(false);
    setVarModalOpen(false);
    showSuccess(varEditingId ? "Variante actualizada correctamente." : "Variante creada correctamente.");
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
      showError("No se pudo actualizar el estado de la variante.");
      return;
    }

    setVariantes((prev) =>
      prev.map((x) => (x.id === v.id ? { ...x, activo: nextActivo } : x))
    );
    await fetchResumenStock();
    showSuccess(
      nextActivo ? "Variante activada correctamente." : "Variante desactivada correctamente."
    );
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
      showError("No se pudo eliminar la variante.");
      return;
    }

    setVariantes((prev) => prev.filter((x) => x.id !== v.id));
    await fetchResumenStock();
    showSuccess("Variante eliminada correctamente.");
  };

  // ============================
  // UX transición: Pasar a variantes (B1.4 asistida)
  // ============================
  const handlePasarAVariantes = async () => {
    if (!productoId) {
      showError("Primero creá el producto para poder activar variantes.");
      return;
    }
    if (!empresaId) return;

    setSwitchingToVariantes(true);

    try {
      const { data: prod, error: prodErr } = await supabase
        .from("producto")
        .select("id, empresa_id, stock, usa_variantes")
        .eq("id", productoId)
        .eq("empresa_id", empresaId)
        .single<{
          id: string;
          empresa_id: string;
          stock: number;
          usa_variantes: boolean | null;
        }>();

      if (prodErr) throw prodErr;
      if (!prod) throw new Error("Producto no encontrado.");

      if (prod.usa_variantes) {
        await fetchResumenStock();
        await fetchVariantes();
        setUsaVariantes(true);
        showSuccess("El producto ya estaba configurado para usar variantes.");
        return;
      }

      const stockDB = Number(prod.stock ?? 0);
      const stockToMigrate = Number.isFinite(stockDB) ? stockDB : 0;

      const confirmMessage =
        stockToMigrate > 0
          ? `¿Pasar a modo variantes?\n\nEste producto tiene stock simple actual (${stockToMigrate}). Ese stock se migrará a una variante inicial \"Único\" y, a partir de entonces, el stock se gestionará desde variantes.`
          : "¿Pasar a modo variantes?\n\nA partir de este cambio, el stock se gestionará desde variantes.";

      const ok = confirm(confirmMessage);
      if (!ok) return;

      const shouldMigrate = stockToMigrate > 0;

      if (shouldMigrate) {
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

      const { error: updErr } = await supabase
        .from("producto")
        .update({ usa_variantes: true })
        .eq("id", productoId)
        .eq("empresa_id", empresaId);

      if (updErr) throw updErr;

      await fetchResumenStock();
      setUsaVariantes(true);
      await fetchVariantes();
      showSuccess("Modo variantes activado correctamente.");
    } catch (err: unknown) {
      console.error("Error pasando a variantes (B1.4):", err);

      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "No se pudo activar el modo variantes.";

      showError(message);
    } finally {
      setSwitchingToVariantes(false);
    }
  };

  if (loadingProducto) {
    return (
      <div className="rounded-xl border border-border bg-black/[0.02] p-6 text-sm text-muted">
        Estamos cargando la ficha del producto.
      </div>
    );
  }

  const showStockLegacyInput = !usaVariantes;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-4">
      {(saveErr || saveMessage) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            saveErr
              ? "border-red-500/20 bg-red-500/10 text-rose-700"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
          }`}
        >
          {saveErr ? `No pudimos guardar los cambios: ${saveErr}` : saveMessage}
        </div>
      )}

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
            <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
              Este producto esta en <b>borrador</b>. Todavia no aparece en la tienda.
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              Este producto esta <b>publicado</b> y listo para verse en la tienda.
            </div>
          )}

          <div className="mt-2 rounded-lg border border-border bg-black/[0.02] px-3 py-2 text-sm text-text">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-text">Stock disponible hoy:</span>
              <span className="font-semibold text-text">
                {typeof stockTotal === "number" ? stockTotal : "—"}
              </span>
              {usaVariantes ? (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
                  stock por talle
                </span>
              ) : (
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted">
                  stock general
                </span>
              )}
            </div>

            {usaVariantes ? (
              <div className="mt-1 text-xs text-muted">
                El stock se organiza desde las variantes. En esta ficha no editas un unico stock general.
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted">
                Este numero es el stock que estas administrando para vender este producto.
              </div>
            )}
          </div>

          <div className="mt-2 rounded-lg border border-border bg-black/[0.03] px-3 py-3 text-sm text-text">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-text">Listo para publicar</p>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-medium " +
                  (publishReady
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-amber-500/10 text-amber-700")
                }
              >
                {publishReady ? "Listo" : `${publishReadyCount}/${publishChecklist.length} completo`}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {publishChecklist.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-xs"
                >
                  <span
                    className={
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold " +
                      (item.done
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-black/[0.05] text-muted")
                    }
                  >
                    {item.done ? "OK" : "-"}
                  </span>
                  <span className={item.done ? "text-text" : "text-muted"}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {form.estado === "draft" ? (
            <Button
              variant="primary"
              onClick={handlePublish}
              disabled={saving || transitioning}
            >
              {transitioning ? "Publicando..." : "Publicar en tienda"}
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleDraft}
              disabled={saving || transitioning}
              className="border border-amber-500/20 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
            >
              {transitioning ? "Pasando a borrador..." : "Ocultar y pasar a borrador"}
            </Button>
          )}
        </div>
      </div>

      <section className="space-y-5 rounded-lg border border-border bg-black/[0.02] p-4">
        <div>
          <h2 className="text-base font-semibold text-text">Datos principales</h2>
          <p className="mt-1 text-sm text-muted">
            Completa la informacion esencial del producto. Lo demas puedes sumarlo despues.
          </p>
        </div>

        {!productoId && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <label className="flex items-start gap-3 text-sm text-text">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={crearEnModoVariantes}
                onChange={(e) => setCrearEnModoVariantes(e.target.checked)}
              />
              <span>
                <span className="font-medium">Crear con variantes desde el inicio</span>
                <span className="block text-xs text-muted">
                  Opcional. Si prefieres avanzar rapido, puedes crear un producto simple y sumar talles despues.
                </span>
              </span>
            </label>
          </div>
        )}

        <div>
          <label className="block font-medium">Nombre *</label>
          <Input
            type="text"
            name="nombre"
            className="text-text"
            value={form.nombre}
            onChange={handleChange}
            required
          />
          <div className="mt-1 text-xs text-muted">
            Usa el nombre con el que quieres mostrarlo en la tienda.
          </div>
        </div>

        <div>
          <label className="block font-medium">Descripcion</label>
          <Input
            as="textarea"
            name="descripcion"
            className="min-h-28 text-text"
            value={form.descripcion}
            onChange={handleChange}
          />
          <div className="mt-1 text-xs text-muted">
            Opcional. Suma contexto util para quien compra.
          </div>
        </div>

        <div>
          <label className="block font-medium">Precio *</label>
          <Input
            type="number"
            name="precio"
            className="text-text"
            value={form.precio}
            onChange={handleChange}
            required
          />
          <div className="mt-1 text-xs text-muted">
            Ingresa el precio final con el que saldra publicado.
          </div>
        </div>

        {showStockLegacyInput && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-text">Stock general</div>
                <div className="text-xs text-muted">
                  Mientras no uses variantes, este es el stock que ve y compra tu cliente.
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={handlePasarAVariantes}
                disabled={!productoId || switchingToVariantes}
                className="px-3 py-2"
                title={!productoId ? "Primero crea el producto" : "Pasar a variantes"}
              >
                {switchingToVariantes ? "Pasando..." : "Organizar por talles"}
              </Button>
            </div>

            <div className="mt-3">
              <label className="block font-medium">Stock</label>
              <Input
                type="number"
                name="stock"
                className="text-text"
                value={form.stock}
                onChange={handleChange}
                required
                min={0}
              />
              <div className="mt-1 text-xs text-muted">
                Obligatorio para vender este producto sin variantes.
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block font-medium">Tipo</label>
          <Input
            type="text"
            name="tipo"
            className="text-text"
            value={form.tipo}
            onChange={handleChange}
          />
          <div className="mt-1 text-xs text-muted">
            Opcional. Puedes usarlo para clasificar internamente el producto.
          </div>
        </div>

        <div>
          <label className="block font-medium">Categoria</label>
          <Input
            as="select"
            name="categoria_id"
            value={form.categoria_id ?? ""}
            onChange={handleChange}
            className="text-text"
            disabled={loadingCategorias}
          >
            <option value="">
              {loadingCategorias ? "Cargando..." : "Sin categoria"}
            </option>

            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre}
              </option>
            ))}
          </Input>
          <div className="mt-1 text-xs text-muted">
            Opcional. Puedes asignarla ahora o hacerlo mas adelante.
          </div>
        </div>
      </section>

      {/* ============================
          Imágenes (B1.5)
         ============================ */}
      <details className="rounded-lg border border-border bg-black/[0.02] p-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-text">
          Opciones avanzadas: imagenes
        </summary>
        <div className="mt-3">
        <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-text">Imágenes</div>
              <div className="text-xs text-muted">
                Suma imagenes del producto y marca la principal para mostrar mejor la ficha.
              </div>
            </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                void fetchImagenes();
              }}
              disabled={loadingImagenes || !productoId}
            >
              {loadingImagenes ? "Cargando..." : "Refrescar"}
            </Button>

            <label className="cursor-pointer">
              <Button as="span" variant="primary">
                {uploadingImagen ? "Subiendo..." : "Subir imagen"}
              </Button>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={!productoId || uploadingImagen}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) handleUploadImagen(files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {!productoId && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            Guarda el producto primero para poder subir imagenes.
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loadingImagenes ? (
            <div className="text-muted">Cargando imagenes...</div>
          ) : imagenes.length === 0 ? (
            <div className="text-muted">Todavia no cargaste imagenes.</div>
          ) : (
            imagenes.map((img) => (
              <div
                key={img.id}
                className="rounded-xl border border-border bg-surface p-2"
              >
                <div className="aspect-square w-full overflow-hidden rounded-lg bg-black/[0.03]">
                  {img.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.signedUrl}
                      alt={img.descripcion ?? "Imagen producto"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted">
                      (sin preview)
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  {img.es_principal ? (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
                      Principal
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => setPrincipalImagen(img.id)}
                      className="px-2 py-1 text-xs"
                    >
                      Hacer principal
                    </Button>
                  )}

                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteImagen(img)}
                      className="px-2 py-1 text-xs text-rose-700 hover:bg-rose-500/10"
                    >
                      Eliminar
                    </Button>
                </div>

              </div>
            ))
          )}
        </div>
        </div>
      </details>

      {/* ============================
          Variantes block (solo si usa_variantes)
         ============================ */}
      {usaVariantes && (
        <details className="rounded-lg border border-border bg-black/[0.02] p-3">
          <summary className="cursor-pointer list-none text-sm font-medium text-text">
            Opciones avanzadas: variantes y stock por talle
          </summary>
          <div className="mt-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-text">Variantes</div>
              <div className="text-xs text-muted">
                Este producto usa variantes. Aqui organizas stock y disponibilidad por talle.
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={fetchVariantes}
                disabled={loadingVariantes}
              >
                {loadingVariantes ? "Cargando..." : "Refrescar"}
              </Button>

              <Button
                variant="primary"
                onClick={openCreateVariante}
                disabled={!productoId}
              >
                Nueva variante
              </Button>
            </div>
          </div>

        {!productoId && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            Guarda el producto primero para poder agregar variantes.
          </div>
        )}

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead className="text-muted">
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
                    <td colSpan={4} className="py-3 text-muted">
                      Cargando variantes...
                    </td>
                  </tr>
                ) : variantes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-muted">
                      No hay variantes todavía.
                    </td>
                  </tr>
                ) : (
                  variantes.map((v) => (
                    <tr key={v.id} className="rounded-lg bg-surface">
                      <td className="px-2 py-2 text-text">{v.talle}</td>
                      <td className="px-2 py-2 text-right font-semibold text-text">
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
                          <Button
                            variant="secondary"
                            onClick={() => openEditVariante(v)}
                            className="px-3 py-1.5 text-xs"
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => deleteVariante(v)}
                            className="px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-500/10"
                          >
                            Eliminar
                          </Button>
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
                      Ajusta el talle y el stock disponible para esta opcion.
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={closeVarianteModal}
                    className="px-3 py-1.5 text-sm"
                    disabled={varSaving}
                  >
                    Cerrar
                  </Button>
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <label className="block text-sm font-medium text-white/90">
                      Talle
                    </label>
                    <Input
                      name="nombre"
                      value={varForm.nombre}
                      onChange={handleVarFormChange}
                      className="mt-1 bg-white/5 text-white placeholder:text-white/40"
                      placeholder="Ej: S / M / L"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-white/90">
                        Stock
                      </label>
                      <Input
                        name="stock"
                        type="number"
                        min={0}
                        value={varForm.stock}
                        onChange={handleVarFormChange}
                        className="mt-1 bg-white/5 text-white"
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
                    <Button
                      variant="secondary"
                      onClick={closeVarianteModal}
                      disabled={varSaving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="primary"
                      onClick={saveVariante}
                      disabled={varSaving}
                    >
                      {varSaving ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </details>
      )}

      {/* Guardar */}
      <Button
        type="submit"
        variant="secondary"
        disabled={saving || transitioning}
      >
        {saving ? "Guardando..." : productoId ? "Guardar cambios" : "Crear producto"}
      </Button>
    </form>
  );
};

export default ProductForm;
