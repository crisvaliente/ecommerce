import assert from "node:assert/strict";
import test from "node:test";

import { resolveCanonicalStorefrontEmpresaId } from "../src/lib/storefrontTenant.ts";

test("resolves the storefront tenant only through the canonical configured slug", async () => {
  const seenSlugs = [];
  const result = await resolveCanonicalStorefrontEmpresaId("raeyz", async (slug) => {
    seenSlugs.push(slug);
    return { data: { id: "tenant-raeyz" }, error: null };
  });

  assert.deepEqual(seenSlugs, ["raeyz"]);
  assert.deepEqual(result, { empresaId: "tenant-raeyz", error: null });
});

test("fails closed when the canonical tenant cannot be resolved", async () => {
  const missing = await resolveCanonicalStorefrontEmpresaId("raeyz", async () => ({
    data: null,
    error: null,
  }));
  const failed = await resolveCanonicalStorefrontEmpresaId("raeyz", async () => ({
    data: null,
    error: new Error("database unavailable"),
  }));

  assert.deepEqual(missing, {
    empresaId: null,
    error: "storefront_tenant_not_found",
  });
  assert.deepEqual(failed, {
    empresaId: null,
    error: "storefront_tenant_not_found",
  });
});
