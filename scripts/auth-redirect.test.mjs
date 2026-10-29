import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildOAuthCallbackUrl } from "../src/config/instance.ts";

async function source(path) {
  return readFile(new URL(`../src/pages/auth/${path}`, import.meta.url), "utf8");
}

test("S5: the callback URL belongs to the origin it is built for", () => {
  assert.equal(buildOAuthCallbackUrl("https://ferreteria.example"), "https://ferreteria.example/auth/callback");
  assert.equal(buildOAuthCallbackUrl("http://localhost:3000"), "http://localhost:3000/auth/callback");
});

test("S5: sign-up by email and by Google returns to the current store domain", async () => {
  const register = await source("register.tsx");
  const callbacks = register.match(/buildOAuthCallbackUrl\([^)]*\)/g);
  assert.deepEqual(callbacks, [
    "buildOAuthCallbackUrl(window.location.origin)",
    "buildOAuthCallbackUrl(window.location.origin)",
  ]);
});

test("S6: Google login keeps returning to the current origin", async () => {
  const login = await source("login.tsx");
  assert.match(login, /`\$\{window\.location\.origin\}\/auth\/callback\?next=\$\{encodeURIComponent\(returnTo\)\}`/);
});
