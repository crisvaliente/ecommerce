import assert from "node:assert/strict";
import test from "node:test";

import {
  FIXED_PRODUCT_IMAGE_PATH_TEMPLATE,
  FIXED_STORAGE_BUCKET,
  buildOAuthCallbackUrl,
  parseInstanceConfig,
  parseAppBaseUrl,
} from "../src/config/instance.ts";

const VALID_CONFIG = {
  version: 1,
  instanceKey: "raeyz",
  store: {
    name: "Raeyz",
    slug: "raeyz",
    description: "Raeyz storefront",
  },
  locale: "es-UY",
  currency: "UYU",
};

test("accepts the minimum supported instance contract", () => {
  const config = parseInstanceConfig(VALID_CONFIG);

  assert.equal(config.store.slug, "raeyz");
  assert.equal(config.currency, "UYU");
  assert.equal(config.storage.productImagesBucket, FIXED_STORAGE_BUCKET);
  assert.equal(config.storage.productImagePathTemplate, FIXED_PRODUCT_IMAGE_PATH_TEMPLATE);
});

test("rejects unsupported currencies", () => {
  assert.throws(
    () => parseInstanceConfig({ ...VALID_CONFIG, currency: "USD" }),
    /currency must be UYU/,
  );
});

test("rejects invalid instance and storefront identifiers", () => {
  assert.throws(
    () => parseInstanceConfig({ ...VALID_CONFIG, instanceKey: "Raeyz Store" }),
    /instanceKey/,
  );
  assert.throws(
    () =>
      parseInstanceConfig({
        ...VALID_CONFIG,
        store: { ...VALID_CONFIG.store, slug: "Raeyz Store" },
      }),
    /store.slug/,
  );
});

test("normalizes a canonical base URL and derives the OAuth callback", () => {
  assert.equal(parseAppBaseUrl("http://localhost:3000/"), "http://localhost:3000");
  assert.equal(
    buildOAuthCallbackUrl("https://shop.example.com/"),
    "https://shop.example.com/auth/callback",
  );
});

test("rejects base URLs with credentials, query strings, or non-root paths", () => {
  for (const value of [
    "https://user:pass@shop.example.com",
    "https://shop.example.com/store",
    "https://shop.example.com?preview=1",
  ]) {
    assert.throws(() => parseAppBaseUrl(value), /APP_BASE_URL/);
  }
});
