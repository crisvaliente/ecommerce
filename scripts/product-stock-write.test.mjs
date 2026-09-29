import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { STOCK_CONFLICT_MESSAGE, parseStockInput, planStockWrite } from "../src/lib/productStockWrite.ts";

test("an unchanged stock is never written, so a sale in between is kept", () => {
  assert.equal(planStockWrite(10, 10), null);
  assert.equal(planStockWrite(10, "10"), null);
  assert.equal(planStockWrite(0, ""), null);
});

test("a changed stock is written only against the value that was read", () => {
  assert.deepEqual(planStockWrite(10, 12), { stock: 12, expectedStock: 10 });
  assert.deepEqual(planStockWrite(10, "0"), { stock: 0, expectedStock: 10 });
});

test("a blank or non-numeric stock is never written as zero", () => {
  assert.equal(planStockWrite(10, "abc"), null);
  assert.equal(planStockWrite(10, ""), null);
  assert.equal(planStockWrite(10, "  "), null);
});

test("stock input must be a non-negative integer", () => {
  assert.equal(parseStockInput(7), 7);
  assert.equal(parseStockInput(" 12 "), 12);
  assert.equal(parseStockInput("0"), 0);
  for (const value of ["", "  ", "abc", "5x", "-1", "1.5", Number.NaN]) {
    assert.equal(parseStockInput(value), null, String(value));
  }
});

test("the conflict message asks to reload instead of overwriting", () => {
  assert.match(STOCK_CONFLICT_MESSAGE, /stock cambió/);
  assert.match(STOCK_CONFLICT_MESSAGE, /Recargá/);
});

test("ProductForm writes product and variant stock with compare-and-set", async () => {
  const source = await readFile(new URL("../src/pages/panel/productos/ProductForm.tsx", import.meta.url), "utf8");
  const saveProducto = source.slice(source.indexOf("const saveProducto"), source.indexOf("const maybeSetUsaVariantesAfterCreate"));
  const saveVariante = source.slice(source.indexOf("const saveVariante"), source.indexOf("const toggleVarianteActivo"));

  for (const block of [saveProducto, saveVariante]) {
    assert.match(block, /planStockWrite\(/);
    assert.match(block, /\.eq\("stock", stockWrite\.expectedStock\)/);
    assert.match(block, /STOCK_CONFLICT_MESSAGE/);
  }
  assert.match(saveProducto, /shouldWriteLegacyStock && loadedStock !== null\s*\? planStockWrite/);
  for (const block of [saveProducto, saveVariante]) assert.match(block, /parseStockInput\(/);
  assert.doesNotMatch(saveVariante, /Number\(varForm\.stock\) \|\| 0/);
  assert.doesNotMatch(saveProducto, /\{ \.\.\.basePayload, stock: Number\(form\.stock\) \}\s*:\s*basePayload;\s*\n\s*if \(productoId\)/);
});
