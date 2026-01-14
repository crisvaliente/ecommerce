// src/utils/storageProductoImagen.ts
import { supabase } from "../lib/supabaseClient";

export const BUCKET_PRODUCTO_IMAGENES = "producto-imagenes" as const;

export type UploadProductoImagenResult = {
  path: string;            // VERDAD
  legacyUrlImagen: string; // por contrato: mismo path
  mimeType: string;
  size: number;
  originalName: string;
};

function getExt(file: File): string {
  const n = file.name || "";
  const dot = n.lastIndexOf(".");
  if (dot !== -1 && dot < n.length - 1) return n.slice(dot + 1).toLowerCase();

  const mime = (file.type || "").toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

export function buildProductoImagenPath(productoId: string, ext: string) {
  const uuid = crypto.randomUUID();
  const safeExt = (ext || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `${productoId}/${uuid}.${safeExt}`;
}

export async function uploadProductoImagen(productoId: string, file: File): Promise<UploadProductoImagenResult> {
  if (!productoId) throw new Error("Falta productoId.");
  if (!file) throw new Error("Falta file.");

  const ext = getExt(file);
  const path = buildProductoImagenPath(productoId, ext);

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
  };
}

export async function createSignedUrl(path: string, expiresInSec = 60 * 10) {
  const { data, error } = await supabase.storage
    .from(BUCKET_PRODUCTO_IMAGENES)
    .createSignedUrl(path, expiresInSec);

  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteProductoImagen(path: string) {
  const { error } = await supabase.storage
    .from(BUCKET_PRODUCTO_IMAGENES)
    .remove([path]);

  if (error) throw new Error(error.message);
}
