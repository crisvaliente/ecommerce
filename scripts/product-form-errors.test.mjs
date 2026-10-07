import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { productFormErrorMessage } from "../src/lib/productFormErrors.ts";

const PENDING_ORDER = { code: "55006", message: "producto_en_pedido_activo" };
const DUPLICATE = { code: "23505", message: "duplicate key value violates unique constraint" };

test("a pending-order guard explains why the action was blocked", () => {
  assert.equal(
    productFormErrorMessage(PENDING_ORDER, "variant_delete"),
    "No se puede eliminar la variante: está en un pedido pendiente de pago. Probá de nuevo cuando el pedido se pague o venza.",
  );
  assert.equal(
    productFormErrorMessage(PENDING_ORDER, "variant_mode_switch"),
    "No se puede pasar a variantes: el producto está en un pedido pendiente de pago. Probá de nuevo cuando el pedido se pague o venza.",
  );
});

test("the panel API pending-order error maps like the database code", () => {
  assert.equal(
    productFormErrorMessage({ error: "producto_en_pedido_activo" }, "variant_mode_switch"),
    productFormErrorMessage(PENDING_ORDER, "variant_mode_switch"),
  );
});

test("a duplicate size is reported only when saving a variant", () => {
  assert.equal(productFormErrorMessage(DUPLICATE, "variant_save"), "Ya existe una variante con ese talle.");
  assert.equal(productFormErrorMessage(DUPLICATE, "variant_delete"), "No se pudo eliminar la variante.");
});

test("unknown failures fall back without exposing database text", async (t) => {
  const cases = [
    [{ code: "42501", message: "new row violates row-level security policy" }, "variant_save", "No se pudo guardar la variante."],
    [new Error("fetch failed"), "variant_mode_switch", "No se pudo activar el modo variantes."],
    [null, "variant_delete", "No se pudo eliminar la variante."],
    [{ code: 55006 }, "variant_delete", "No se pudo eliminar la variante."],
  ];
  for (const [error, context, expected] of cases) {
    await t.test(String(context), () => assert.equal(productFormErrorMessage(error, context), expected));
  }
});

test("ProductForm maps variant and mode-switch errors through the shared helper", async () => {
  const source = await readFile(new URL("../src/pages/panel/productos/ProductForm.tsx", import.meta.url), "utf8");
  assert.match(source, /productFormErrorMessage\(error, "variant_delete"\)/);
  assert.equal(source.match(/productFormErrorMessage\(error, "variant_save"\)/g)?.length, 2);
  assert.match(source, /productFormErrorMessage\(payload, "variant_mode_switch"\)/);
});

test("Pasar a variantes goes through the atomic panel endpoint", async () => {
  const source = await readFile(new URL("../src/pages/panel/productos/ProductForm.tsx", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("const handlePasarAVariantes"), source.indexOf("if (loadingProducto)"));
  assert.match(handler, /`\/api\/panel\/productos\/\$\{encodeURIComponent\(productoId\)\}\/modo-variantes`/);
  assert.match(handler, /method: "POST"/);
  assert.doesNotMatch(handler, /supabase\s*\.from\(/);
});
