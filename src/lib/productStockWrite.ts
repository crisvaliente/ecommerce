export const STOCK_CONFLICT_MESSAGE =
  "El stock cambió mientras editabas (por ejemplo, por una venta). Recargá la página y volvé a cargar el valor.";

export const INVALID_STOCK_MESSAGE = "Ingresá un stock válido: un número entero igual o mayor a 0.";

export type StockWrite = { stock: number; expectedStock: number };

/** A form stock value as a non-negative integer; blank or invalid input is null, never 0. */
export function parseStockInput(value: number | string): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const stock = Number(value);
  return Number.isInteger(stock) && stock >= 0 ? stock : null;
}

/**
 * Sales decrement stock in the database while the panel form is open. The form
 * writes stock only when the admin changed it, and only if the row still holds
 * the value that was read (compare-and-set), so a sale is never overwritten.
 */
export function planStockWrite(readStock: number, formStock: number | string): StockWrite | null {
  const stock = parseStockInput(formStock);
  if (stock === null || stock === readStock) return null;
  return { stock, expectedStock: readStock };
}
