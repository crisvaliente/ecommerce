import assert from "node:assert/strict";
import test from "node:test";

const storeRequest = await import("../src/lib/storeRequest.ts").catch(() => ({}));

const STORE_A = { hostname: "raeyz.com", empresaId: "11111111-1111-4111-8111-111111111111" };
const STORE_B = { hostname: "ferreteria.example", empresaId: "22222222-2222-4222-8222-222222222222" };

function requireApi(name) {
  assert.equal(typeof storeRequest[name], "function", `storeRequest.${name} must exist`);
  return storeRequest[name];
}

function request(host, headers = {}) {
  return { headers: { host, ...headers }, rawHeaders: ["Host", host] };
}

function lookupFor(stores, calls = []) {
  return async (hostname) => {
    calls.push(hostname);
    const store = stores.find((candidate) => candidate.hostname === hostname);
    return { data: store ? { empresa_id: store.empresaId } : null, error: null };
  };
}

test("S1: each registered domain resolves to its own store", async () => {
  const resolve = requireApi("resolveRequestStore");
  for (const store of [STORE_A, STORE_B]) {
    assert.deepEqual(
      await resolve(request(store.hostname), lookupFor([STORE_A, STORE_B])),
      { ok: true, store: { empresaId: store.empresaId, hostname: store.hostname } },
    );
  }
});

test("S1: forwarded or query tenant hints never change the store", async () => {
  const resolve = requireApi("resolveRequestStore");
  const calls = [];
  const result = await resolve(
    request(STORE_A.hostname, { "x-forwarded-host": STORE_B.hostname, origin: `https://${STORE_B.hostname}` }),
    lookupFor([STORE_A, STORE_B], calls),
  );
  assert.deepEqual(result, { ok: true, store: { empresaId: STORE_A.empresaId, hostname: STORE_A.hostname } });
  assert.deepEqual(calls, [STORE_A.hostname]);
});

test("S1: unknown, invalid and failing hosts are rejected with their own codes", async () => {
  const resolve = requireApi("resolveRequestStore");

  const unknownCalls = [];
  assert.deepEqual(
    await resolve(request("unknown.example"), lookupFor([STORE_A], unknownCalls)),
    { ok: false, status: 404, error: "tienda_no_encontrada" },
  );
  assert.deepEqual(unknownCalls, ["unknown.example"]);

  const invalidCalls = [];
  assert.deepEqual(
    await resolve({ headers: {}, rawHeaders: [] }, lookupFor([STORE_A], invalidCalls)),
    { ok: false, status: 404, error: "tienda_no_encontrada" },
  );
  assert.deepEqual(invalidCalls, []);

  for (const lookup of [
    async () => ({ data: null, error: new Error("down") }),
    async () => { throw new Error("down"); },
  ]) {
    assert.deepEqual(
      await resolve(request(STORE_A.hostname), lookup),
      { ok: false, status: 503, error: "tienda_no_disponible", hostname: STORE_A.hostname },
    );
  }
});

test("S2: only the request's own store origin is trusted", () => {
  const validate = requireApi("validateStoreOrigin");
  const strict = { allowWithoutOrigin: false };

  assert.deepEqual(
    validate({ headers: { origin: "https://raeyz.com" } }, STORE_A.hostname, strict),
    { ok: true, origin: "https://raeyz.com" },
  );
  assert.deepEqual(
    validate({ headers: { origin: "http://localhost:3000" } }, "localhost", strict),
    { ok: true, origin: "http://localhost:3000" },
  );
  assert.deepEqual(
    validate({ headers: { referer: "https://raeyz.com/coleccion?x=1" } }, STORE_A.hostname, strict),
    { ok: true, origin: "https://raeyz.com" },
  );

  for (const origin of [
    `https://${STORE_B.hostname}`,
    "https://evil.example",
    "https://raeyz.com.evil.example",
    "not a url",
    "ftp://raeyz.com",
  ]) {
    assert.deepEqual(
      validate({ headers: { origin } }, STORE_A.hostname, strict),
      { ok: false, reason: "untrusted_origin", origin },
      origin,
    );
  }
});

test("S2: a request without origin keeps the caller's allowWithoutOrigin rule", () => {
  const validate = requireApi("validateStoreOrigin");
  assert.deepEqual(
    validate({ headers: {} }, STORE_A.hostname, { allowWithoutOrigin: true }),
    { ok: true, origin: null },
  );
  assert.deepEqual(
    validate({ headers: {} }, STORE_A.hostname, { allowWithoutOrigin: false }),
    { ok: false, reason: "missing_origin", origin: null },
  );
});

test("S4: the store URL is the validated origin, else https on the store hostname", () => {
  const storeOriginUrl = requireApi("storeOriginUrl");
  assert.equal(storeOriginUrl({ ok: true, origin: "http://localhost:3000" }, "localhost"), "http://localhost:3000");
  assert.equal(storeOriginUrl({ ok: true, origin: null }, STORE_B.hostname), "https://ferreteria.example");
});

test("the shared lookup reads one exact hostname from empresa_dominio", async () => {
  const createLookup = requireApi("createStoreDomainLookup");
  const calls = [];
  const client = {
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) { calls.push(["select", columns]); return this; },
        eq(column, value) { calls.push(["eq", column, value]); return this; },
        async maybeSingle() {
          calls.push(["maybeSingle"]);
          return { data: { empresa_id: STORE_B.empresaId }, error: null };
        },
      };
    },
  };
  assert.deepEqual(
    await createLookup(client)(STORE_B.hostname),
    { data: { empresa_id: STORE_B.empresaId }, error: null },
  );
  assert.deepEqual(calls, [
    ["from", "empresa_dominio"],
    ["select", "empresa_id"],
    ["eq", "hostname", STORE_B.hostname],
    ["maybeSingle"],
  ]);
});
