import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKOUT_MARKER_STORAGE_KEY,
  createCartMarker,
  createSingleFlight,
  ensureCheckoutMarker,
  getCheckoutMarkerForCart,
  getSafeAuthReturn,
  isHttpsInitPoint,
  persistCheckoutPedidoId,
  readCheckoutMarker,
  removeCheckoutMarkerIfMatches,
  shouldPollPedido,
} from "../src/lib/buyerCheckout.ts";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMPRESA_ID = "22222222-2222-4222-8222-222222222222";
const DIRECCION_ID = "33333333-3333-4333-8333-333333333333";
const PEDIDO_ID = "44444444-4444-4444-8444-444444444444";
const IDEMPOTENCY_KEY = "55555555-5555-4555-8555-555555555555";

const cart = {
  empresaId: EMPRESA_ID,
  items: [
    {
      productoId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      varianteId: null,
      name: "B",
      price: 200,
      image: "/b.jpg",
      quantity: 2,
    },
    {
      productoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      varianteId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      name: "A",
      price: 100,
      image: "/a.jpg",
      quantity: 1,
    },
  ],
};

class MemoryStorage {
  values = new Map();
  writes = [];

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.writes.push({ key, value });
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("cart marker is canonical and changes only with checkout semantics", () => {
  const reordered = { ...cart, items: [...cart.items].reverse() };
  assert.equal(createCartMarker(cart), createCartMarker(reordered));
  assert.notEqual(
    createCartMarker(cart),
    createCartMarker({
      ...cart,
      items: cart.items.map((item, index) =>
        index === 0 ? { ...item, quantity: item.quantity + 1 } : item,
      ),
    }),
  );
});

test("checkout marker is persisted before use and reuses one key for the same intention", () => {
  const storage = new MemoryStorage();
  const first = ensureCheckoutMarker({
    storage,
    userId: USER_ID,
    cart,
    direccionEnvioId: DIRECCION_ID,
    createUuid: () => IDEMPOTENCY_KEY,
    now: () => "2026-08-03T12:00:00.000Z",
  });

  assert.equal(storage.writes.length, 1);
  assert.equal(storage.writes[0].key, CHECKOUT_MARKER_STORAGE_KEY);
  assert.equal(readCheckoutMarker(storage)?.idempotencyKey, IDEMPOTENCY_KEY);

  const second = ensureCheckoutMarker({
    storage,
    userId: USER_ID,
    cart,
    direccionEnvioId: DIRECCION_ID,
    createUuid: () => "66666666-6666-4666-8666-666666666666",
  });

  assert.equal(second.idempotencyKey, first.idempotencyKey);
  assert.deepEqual(second.request, first.request);
  assert.equal(storage.writes.length, 1);
});

test("pedido id is persisted on the existing intention before payment retry", () => {
  const storage = new MemoryStorage();
  const marker = ensureCheckoutMarker({
    storage,
    userId: USER_ID,
    cart,
    direccionEnvioId: DIRECCION_ID,
    createUuid: () => IDEMPOTENCY_KEY,
  });

  const persisted = persistCheckoutPedidoId(storage, marker, PEDIDO_ID);
  assert.equal(persisted.pedidoId, PEDIDO_ID);
  assert.equal(getCheckoutMarkerForCart(storage, USER_ID, cart)?.pedidoId, PEDIDO_ID);
  assert.equal(persisted.idempotencyKey, IDEMPOTENCY_KEY);
});

test("marker lookup and removal require the same user, order and cart", () => {
  const storage = new MemoryStorage();
  const marker = persistCheckoutPedidoId(
    storage,
    ensureCheckoutMarker({
      storage,
      userId: USER_ID,
      cart,
      direccionEnvioId: DIRECCION_ID,
      createUuid: () => IDEMPOTENCY_KEY,
    }),
    PEDIDO_ID,
  );

  assert.equal(getCheckoutMarkerForCart(storage, "other-user", cart), null);
  assert.equal(
    removeCheckoutMarkerIfMatches(storage, marker, "other-order", USER_ID),
    false,
  );
  assert.ok(readCheckoutMarker(storage));
  assert.equal(
    removeCheckoutMarkerIfMatches(storage, marker, PEDIDO_ID, USER_ID),
    true,
  );
  assert.equal(readCheckoutMarker(storage), null);
});

test("single-flight shares one active operation and allows a later run", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const run = createSingleFlight(async (value) => {
    calls += 1;
    await gate;
    return value;
  });

  const first = run("first");
  const second = run("second");
  assert.equal(first, second);
  assert.equal(calls, 1);
  release();
  assert.equal(await first, "first");
  assert.equal(await run("third"), "third");
  assert.equal(calls, 2);
});

test("UI wiring persists marker and order before payment and ignores provider status", async () => {
  const { readFile } = await import("node:fs/promises");
  const cartSource = await readFile(
    new URL("../src/components/ui/ShoppingCart.tsx", import.meta.url),
    "utf8",
  );
  const resultSource = await readFile(
    new URL("../src/pages/checkout/resultado.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(cartSource.indexOf("ensureCheckoutMarker({") < cartSource.indexOf("fetch('/api/ecommerce/pedido'"));
  assert.ok(cartSource.indexOf("persistCheckoutPedidoId(") < cartSource.indexOf("fetch('/api/ecommerce/intento-pago'"));
  assert.match(cartSource, /if \(activeCheckout\.current\) return activeCheckout\.current/);
  assert.match(cartSource, /window\.location\.assign\(paymentBody\.intento_pago\.init_point\)/);
  assert.doesNotMatch(resultSource, /router\.query\.status/);
  assert.match(resultSource, /pedidoEstado !== "pagado"/);
  assert.match(resultSource, /clearCartIfMatches\(marker\.cartMarker\)/);
});

test("redirect, polling and auth-return guards fail closed", () => {
  assert.equal(isHttpsInitPoint("https://www.mercadopago.com/checkout"), true);
  assert.equal(isHttpsInitPoint("http://www.mercadopago.com/checkout"), false);
  assert.equal(isHttpsInitPoint("javascript:alert(1)"), false);
  assert.equal(shouldPollPedido("pendiente_pago", 0, 5), true);
  assert.equal(shouldPollPedido("pendiente_pago", 5, 5), false);
  assert.equal(shouldPollPedido("pagado", 0, 5), false);
  assert.equal(shouldPollPedido("bloqueado", 0, 5), false);
  assert.equal(getSafeAuthReturn("/coleccion"), "/coleccion");
  assert.equal(getSafeAuthReturn("https://evil.example"), "/coleccion");
  assert.equal(getSafeAuthReturn("/panel"), "/coleccion");
});
