export type PanelOrderRole = "admin" | "staff" | "cliente";

export type OrderOperationalState =
  | "pendiente_pago"
  | "pagado"
  | "bloqueado"
  | "en_preparacion"
  | "enviado"
  | "entregado"
  | "cancelado";

export type PaymentAttemptState =
  | "iniciado"
  | "aprobado"
  | "rechazado"
  | "cancelado"
  | "expirado";

export type PaymentConsolidationStatus =
  | "consolidated"
  | "approved_not_consolidated"
  | "none";

export type OrderOperationAction = {
  label: string;
  expectedState: OrderOperationalState;
  targetState: OrderOperationalState;
  requiresConfirmation: boolean;
};

export type OrderOperationResult =
  | { kind: "cancelled" }
  | { kind: "success" | "conflict" | "error"; message: string };

type RequestResponse = {
  ok: boolean;
  status: number;
};

type OrderOperationRequest = (
  input: string,
  init: {
    method: "PATCH";
    headers: { Authorization: string; "Content-Type": "application/json" };
    body: string;
  },
) => Promise<RequestResponse>;

const ACTIONS_BY_STATE: Partial<Record<OrderOperationalState, OrderOperationAction>> = {
  pagado: {
    label: "Iniciar preparación",
    expectedState: "pagado",
    targetState: "en_preparacion",
    requiresConfirmation: false,
  },
  en_preparacion: {
    label: "Marcar como enviado",
    expectedState: "en_preparacion",
    targetState: "enviado",
    requiresConfirmation: false,
  },
  enviado: {
    label: "Marcar como entregado",
    expectedState: "enviado",
    targetState: "entregado",
    requiresConfirmation: false,
  },
};

export function getPaymentConsolidationStatus(payment: {
  state: OrderOperationalState;
  consolidatedPaymentAttemptId: string | null;
  paymentAttemptState: PaymentAttemptState | null;
}): PaymentConsolidationStatus {
  if (payment.consolidatedPaymentAttemptId) {
    return "consolidated";
  }

  if (payment.paymentAttemptState === "aprobado") {
    return "approved_not_consolidated";
  }

  return "none";
}

export function getOrderOperationAction(
  state: OrderOperationalState,
  role: PanelOrderRole | null | undefined,
): OrderOperationAction | null {
  if (state === "pendiente_pago") {
    return role === "admin"
      ? {
          label: "Cancelar pedido",
          expectedState: "pendiente_pago",
          targetState: "cancelado",
          requiresConfirmation: true,
        }
      : null;
  }

  return ACTIONS_BY_STATE[state] ?? null;
}

function controlledErrorMessage(status: number): string {
  switch (status) {
    case 401:
      return "Tu sesión no es válida. Volvé a iniciar sesión.";
    case 403:
      return "No tenés permisos para realizar esta acción.";
    case 404:
      return "El pedido ya no está disponible.";
    default:
      return "No se pudo actualizar el pedido. Intentá nuevamente.";
  }
}

export async function submitOrderOperation({
  pedidoId,
  accessToken,
  action,
  confirmCancellation,
  refresh,
  request = fetch,
}: {
  pedidoId: string;
  accessToken: string;
  action: OrderOperationAction | null;
  confirmCancellation: () => boolean;
  refresh: () => Promise<void>;
  request?: OrderOperationRequest;
}): Promise<OrderOperationResult> {
  if (!action) {
    return {
      kind: "error",
      message: "No hay una acción disponible para el estado actual.",
    };
  }

  if (action.requiresConfirmation && !confirmCancellation()) {
    return { kind: "cancelled" };
  }

  try {
    const response = await request(`/api/panel/pedidos/${encodeURIComponent(pedidoId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expected_state: action.expectedState,
        target_state: action.targetState,
      }),
    });

    if (response.ok) {
      await refresh();
      return {
        kind: "success",
        message: "Pedido actualizado correctamente.",
      };
    }

    if (response.status === 409) {
      await refresh();
      return {
        kind: "conflict",
        message: "El pedido cambió desde la última carga. Revisá el estado actualizado.",
      };
    }

    return {
      kind: "error",
      message: controlledErrorMessage(response.status),
    };
  } catch {
    return {
      kind: "error",
      message: "No se pudo actualizar el pedido. Intentá nuevamente.",
    };
  }
}
