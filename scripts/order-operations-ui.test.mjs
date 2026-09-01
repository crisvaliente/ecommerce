import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getOrderOperationAction,
  getPaymentConsolidationStatus,
  submitOrderOperation,
} from "../src/lib/orderOperationsUi.ts";

const PEDIDO_ID = "11111111-1111-4111-8111-111111111111";
const ACCESS_TOKEN = "panel-access-token";

function response(status) {
  return { ok: status >= 200 && status < 300, status };
}

test("shows only the next valid operation for each actionable state", () => {
  assert.deepEqual(getOrderOperationAction("pagado", "staff"), {
    label: "Iniciar preparación",
    expectedState: "pagado",
    targetState: "en_preparacion",
    requiresConfirmation: false,
  });
  assert.deepEqual(getOrderOperationAction("en_preparacion", "staff"), {
    label: "Marcar como enviado",
    expectedState: "en_preparacion",
    targetState: "enviado",
    requiresConfirmation: false,
  });
  assert.deepEqual(getOrderOperationAction("enviado", "staff"), {
    label: "Marcar como entregado",
    expectedState: "enviado",
    targetState: "entregado",
    requiresConfirmation: false,
  });
});

test("uses financial evidence to keep paid fulfillment states consolidated", async (t) => {
  for (const state of ["pagado", "en_preparacion", "enviado", "entregado"]) {
    await t.test(state, () => {
      assert.equal(
        getPaymentConsolidationStatus({
          state,
          consolidatedPaymentAttemptId: "22222222-2222-4222-8222-222222222222",
          paymentAttemptState: "aprobado",
        }),
        "consolidated",
      );
    });
  }
});

test("keeps approved but unconsolidated payment representable", () => {
  assert.equal(
    getPaymentConsolidationStatus({
      state: "bloqueado",
      consolidatedPaymentAttemptId: null,
      paymentAttemptState: "aprobado",
    }),
    "approved_not_consolidated",
  );
});

test("does not expose operations for blocked or terminal states", () => {
  for (const state of ["bloqueado", "entregado", "cancelado"]) {
    assert.equal(getOrderOperationAction(state, "admin"), null);
  }
});

test("staff cannot see cancellation while admin can", () => {
  assert.equal(getOrderOperationAction("pendiente_pago", "staff"), null);
  assert.deepEqual(getOrderOperationAction("pendiente_pago", "admin"), {
    label: "Cancelar pedido",
    expectedState: "pendiente_pago",
    targetState: "cancelado",
    requiresConfirmation: true,
  });
});

test("cancellation requires explicit confirmation and does not request when declined", async () => {
  let requests = 0;
  let confirmations = 0;
  const result = await submitOrderOperation({
    pedidoId: PEDIDO_ID,
    accessToken: ACCESS_TOKEN,
    action: getOrderOperationAction("pendiente_pago", "admin"),
    confirmCancellation: () => {
      confirmations += 1;
      return false;
    },
    request: async () => {
      requests += 1;
      return response(200);
    },
    refresh: async () => {},
  });

  assert.equal(confirmations, 1);
  assert.equal(requests, 0);
  assert.deepEqual(result, { kind: "cancelled" });
});

test("sends the current expected and target states and refreshes only after success", async () => {
  let captured;
  let resolveRequest;
  let refreshes = 0;
  const pending = submitOrderOperation({
    pedidoId: PEDIDO_ID,
    accessToken: ACCESS_TOKEN,
    action: getOrderOperationAction("pagado", "staff"),
    confirmCancellation: () => true,
    request: async (url, init) => {
      captured = { url, init };
      return await new Promise((resolve) => {
        resolveRequest = resolve;
      });
    },
    refresh: async () => {
      refreshes += 1;
    },
  });

  await Promise.resolve();
  assert.equal(refreshes, 0, "the order must not update optimistically");
  assert.equal(captured.url, `/api/panel/pedidos/${PEDIDO_ID}`);
  assert.equal(captured.init.method, "PATCH");
  assert.equal(captured.init.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
  assert.equal(captured.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(captured.init.body), {
    expected_state: "pagado",
    target_state: "en_preparacion",
  });

  resolveRequest(response(200));
  assert.deepEqual(await pending, {
    kind: "success",
    message: "Pedido actualizado correctamente.",
  });
  assert.equal(refreshes, 1);
});

test("409 refreshes server state and reports a controlled conflict", async () => {
  let refreshes = 0;
  const result = await submitOrderOperation({
    pedidoId: PEDIDO_ID,
    accessToken: ACCESS_TOKEN,
    action: getOrderOperationAction("enviado", "staff"),
    confirmCancellation: () => true,
    request: async () => response(409),
    refresh: async () => {
      refreshes += 1;
    },
  });

  assert.equal(refreshes, 1);
  assert.deepEqual(result, {
    kind: "conflict",
    message: "El pedido cambió desde la última carga. Revisá el estado actualizado.",
  });
});

test("maps API and network failures to controlled messages", async (t) => {
  const cases = [
    [401, "Tu sesión no es válida. Volvé a iniciar sesión."],
    [403, "No tenés permisos para realizar esta acción."],
    [404, "El pedido ya no está disponible."],
    [500, "No se pudo actualizar el pedido. Intentá nuevamente."],
  ];

  for (const [status, message] of cases) {
    await t.test(String(status), async () => {
      const result = await submitOrderOperation({
        pedidoId: PEDIDO_ID,
        accessToken: ACCESS_TOKEN,
        action: getOrderOperationAction("pagado", "staff"),
        confirmCancellation: () => true,
        request: async () => response(status),
        refresh: async () => {},
      });
      assert.deepEqual(result, { kind: "error", message });
    });
  }

  const networkResult = await submitOrderOperation({
    pedidoId: PEDIDO_ID,
    accessToken: ACCESS_TOKEN,
    action: getOrderOperationAction("pagado", "staff"),
    confirmCancellation: () => true,
    request: async () => {
      throw new Error("internal network detail");
    },
    refresh: async () => {},
  });
  assert.deepEqual(networkResult, {
    kind: "error",
    message: "No se pudo actualizar el pedido. Intentá nuevamente.",
  });
});

test("page wiring disables the operation during submit and does not render a state selector", async () => {
  const source = await readFile(
    new URL("../src/pages/panel/pedidos/[id].tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /disabled=\{operationPending\}/);
  assert.match(source, /operationPending\s*\?\s*["']Actualizando\.\.\.["']/);
  assert.equal((source.match(/getPaymentConsolidationStatus\(\{/g) ?? []).length, 2);
  assert.doesNotMatch(
    source,
    /intento_pago\.estado\s*===\s*["']aprobado["'][^\n]*pedido\.estado/,
  );
  assert.doesNotMatch(source, /<select[\s>]/i);
});
