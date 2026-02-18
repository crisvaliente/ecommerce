// src/utils/storageProductoImagen.ts
import { supabase } from "../lib/supabaseClient";

export const BUCKET_PRODUCTO_IMAGENES = "producto-imagenes" as const;

export type UploadProductoImagenResult = {
  path: string;            // VERDAD (guardar 1:1 en DB)
  legacyUrlImagen: string; // por contrato legacy: mismo path
  mimeType: string;
  size: number;
  originalName: string;

  // extra evidencia (no rompe: es backward-compatible)
  imagenId: string;
  ext: string;
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function sanitizeId(x: string): string {
  return (x || "").replace(/[^a-z0-9\-_]/gi, "");
}

function sanitizeExt(ext: string): string {
  const safe = (ext || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return safe || "bin";
}

function getExt(file: File): string {
  const n = file.name || "";
  const dot = n.lastIndexOf(".");
  if (dot !== -1 && dot < n.length - 1) {
    const fromName = n.slice(dot + 1).toLowerCase();
    if (fromName === "jpeg") return "jpg";
    return sanitizeExt(fromName);
  }

  const mime = (file.type || "").toLowerCase();
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "bin";
}

// --------------------------------------------------
// Canonical (B2) — ruta obligatoria
// empresa/{empresaId}/producto/{productoId}/{imagenId}.{ext}
// --------------------------------------------------
export function buildProductoImagenPathCanonical(args: {
  empresaId: string;
  productoId: string;
  imagenId: string;
  ext: string;
}): string {
  const empresaId = sanitizeId(args.empresaId);
  const productoId = sanitizeId(args.productoId);
  const imagenId = sanitizeId(args.imagenId);
  const ext = sanitizeExt(args.ext);

  if (!empresaId) throw new Error("empresaId inválido.");
  if (!productoId) throw new Error("productoId inválido.");
  if (!imagenId) throw new Error("imagenId inválido.");

  return `empresa/${empresaId}/producto/${productoId}/${imagenId}.${ext}`;
}

/**
 * Wrapper legacy (para no romper imports existentes).
 * ⚠️ En B2 runtime NO se debe usar (porque necesita empresaId).
 * Si algún lugar lo sigue usando, va a tirar error con mensaje claro.
 */
export function buildProductoImagenPath(productoId: string, ext: string): string {
  // Mantengo firma vieja, pero no puedo construir canonical sin empresaId.
  throw new Error(
    "buildProductoImagenPath(productoId, ext) quedó obsoleto en B2. Usá buildProductoImagenPathCanonical({ empresaId, productoId, imagenId, ext })."
  );
}

// --------------------------------------------------
// Upload (B2) — firma nueva
// --------------------------------------------------
export async function uploadProductoImagen(args: {
  empresaId: string;
  productoId: string;
  file: File;
}): Promise<UploadProductoImagenResult> {
  const { empresaId, productoId, file } = args;

  if (!empresaId) throw new Error("Falta empresaId.");
  if (!productoId) throw new Error("Falta productoId.");
  if (!file) throw new Error("Falta file.");

  const imagenId = crypto.randomUUID();
  const ext = getExt(file);

  const path = buildProductoImagenPathCanonical({
    empresaId,
    productoId,
    imagenId,
    ext,
  });

  console.log("[B2] upload path:", path);

  const { error } = await supabase.storage
    .from(BUCKET_PRODUCTO_IMAGENES)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });

  if (error) throw new Error(error.message);

  return {
    path,
    legacyUrlImagen: path,
    mimeType: file.type,
    size: file.size,
    originalName: file.name,
    imagenId,
    ext,
  };
}

// --------------------------------------------------
// Signed URL
// --------------------------------------------------
export async function createSignedUrl(path: string, expiresInSec = 60 * 10) {
  if (!path) throw new Error("Falta path.");
  const { data, error } = await supabase.storage
    .from(BUCKET_PRODUCTO_IMAGENES)
    .createSignedUrl(path, expiresInSec);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// --------------------------------------------------
// Delete
// --------------------------------------------------
export async function deleteProductoImagen(path: string) {
  if (!path) return;
  const { error } = await supabase.storage
    .from(BUCKET_PRODUCTO_IMAGENES)
    .remove([path]);

  if (error) throw new Error(error.message);
}
