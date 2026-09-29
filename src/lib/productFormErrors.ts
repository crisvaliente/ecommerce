export type ProductFormErrorContext = "variant_delete" | "variant_save" | "variant_mode_switch";

const RETRY_HINT = "Probá de nuevo cuando el pedido se pague o venza.";

const FALLBACK_MESSAGES: Record<ProductFormErrorContext, string> = {
  variant_delete: "No se pudo eliminar la variante.",
  variant_save: "No se pudo guardar la variante.",
  variant_mode_switch: "No se pudo activar el modo variantes.",
};

// SQLSTATE 55006: the database blocks catalog changes referenced by a pending
// order (triggers from migrations 20260928190000 and 20260928210000).
const PENDING_ORDER_MESSAGES: Partial<Record<ProductFormErrorContext, string>> = {
  variant_delete: `No se puede eliminar la variante: está en un pedido pendiente de pago. ${RETRY_HINT}`,
  variant_mode_switch: `No se puede pasar a variantes: el producto está en un pedido pendiente de pago. ${RETRY_HINT}`,
};

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** User-facing message for a Supabase error; database text is never shown. */
export function productFormErrorMessage(error: unknown, context: ProductFormErrorContext): string {
  const code = errorCode(error);

  if (code === "55006" && PENDING_ORDER_MESSAGES[context]) {
    return PENDING_ORDER_MESSAGES[context];
  }
  if (code === "23505" && context === "variant_save") {
    return "Ya existe una variante con ese talle.";
  }

  return FALLBACK_MESSAGES[context];
}
