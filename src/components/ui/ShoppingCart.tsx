import React, { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaShoppingCart, FaTrash, FaPlus, FaMinus } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ensureCheckoutMarker,
  getCheckoutMarkerForCart,
  isHttpsInitPoint,
  persistCheckoutPedidoId,
  removeCheckoutMarker,
  type CheckoutMarker,
} from '../../lib/buyerCheckout';
import { formatCurrency } from '../../lib/formatters';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { getCartIdentityKey, useCart } from './CartContext';

interface ShoppingCartProps {
  isOpen: boolean;
  onClose: () => void;
}

type CheckoutState =
  | 'idle'
  | 'creating-order'
  | 'creating-payment'
  | 'redirecting'
  | 'error';

type CheckoutError = {
  message: string;
  action: 'login' | 'address' | 'retry-order' | 'retry-payment' | 'retry-payment-manual' | null;
};

type AddressResponse = {
  direccion?: { id: string } | null;
  error?: string;
};

type OrderResponse = {
  pedido_id?: string;
  error?: string;
};

type PaymentResponse = {
  intento_pago?: {
    pedido_id?: string;
    init_point?: string;
  };
  error?: string;
};

const BUSY_STATES: CheckoutState[] = [
  'creating-order',
  'creating-payment',
  'redirecting',
];

function orderError(error: string | undefined): CheckoutError {
  switch (error) {
    case 'direccion_envio_no_disponible':
    case 'direccion_no_existe':
    case 'direccion_no_pertenece_al_usuario':
      return { message: 'Necesitás una dirección válida para continuar.', action: 'address' };
    case 'variante_sin_stock':
    case 'variante_inactiva':
    case 'producto_no_existe':
      return { message: 'Algunos productos ya no están disponibles. Revisá el carrito.', action: null };
    case 'idempotency_key_reused':
      return {
        message: 'La intención de compra no coincide con el carrito actual. No generamos otro pedido por seguridad.',
        action: null,
      };
    case 'unauthorized':
      return { message: 'Tu sesión venció. Iniciá sesión para continuar.', action: 'login' };
    default:
      return {
        message: 'No pudimos crear el pedido. Podés reintentar sin generar un pedido duplicado.',
        action: 'retry-order',
      };
  }
}

function paymentError(error: string | undefined): CheckoutError {
  switch (error) {
    case 'mercadopago_preference_in_progress':
      return {
        message: 'La preparación del pago sigue en curso. Esperá unos segundos y reintentá.',
        action: 'retry-payment',
      };
    case 'mercadopago_preference_ambiguous':
      return {
        message: 'Mercado Pago todavía no confirmó la preference. Reintentá sobre el mismo pedido.',
        action: 'retry-payment',
      };
    case 'mercadopago_preference_error':
      return {
        message: 'Mercado Pago rechazó la creación de la preference. Podés iniciar un retry manual sobre el mismo pedido.',
        action: 'retry-payment-manual',
      };
    case 'pedido_expirado':
      return { message: 'El pedido venció y ya no puede pagarse.', action: null };
    case 'pedido_bloqueado':
      return { message: 'El pedido está bloqueado y requiere revisión.', action: null };
    case 'pedido_no_pagable':
      return { message: 'El pedido ya no admite nuevos intentos de pago.', action: null };
    case 'unauthorized':
      return { message: 'Tu sesión venció. Iniciá sesión para continuar.', action: 'login' };
    default:
      return {
        message: 'No pudimos iniciar Mercado Pago. El pedido quedó guardado y podés reintentar.',
        action: 'retry-payment',
      };
  }
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ isOpen, onClose }) => {
  const {
    empresaId,
    items,
    incrementItem,
    decrementItem,
    removeItem,
    total,
    isHydrated,
  } = useCart();
  const { sessionUser, loading: authLoading } = useAuth();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
  const [checkoutError, setCheckoutError] = useState<CheckoutError | null>(null);
  const activeCheckout = useRef<Promise<void> | null>(null);
  const busy = BUSY_STATES.includes(checkoutState);

  const runCheckout = async (manualPreferenceRetry: boolean): Promise<void> => {
    setCheckoutError(null);

    if (!sessionUser) {
      setCheckoutState('error');
      setCheckoutError({ message: 'Iniciá sesión para continuar con la compra.', action: 'login' });
      return;
    }
    if (!isHydrated || !empresaId || items.length === 0) {
      setCheckoutState('error');
      setCheckoutError({ message: 'El carrito todavía no está listo para comprar.', action: null });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setCheckoutState('error');
      setCheckoutError({ message: 'Tu sesión venció. Iniciá sesión para continuar.', action: 'login' });
      return;
    }

    const cart = { empresaId, items };
    let marker: CheckoutMarker | null;
    try {
      marker = getCheckoutMarkerForCart(window.localStorage, sessionUser.id, cart);
    } catch {
      setCheckoutState('error');
      setCheckoutError({
        message: 'No pudimos guardar la intención de compra en este navegador.',
        action: null,
      });
      return;
    }

    if (!marker) {
      setCheckoutState('creating-order');
      let addressResponse: Response;
      try {
        addressResponse = await fetch('/api/ecommerce/mi-cuenta/direccion', {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        setCheckoutState('error');
        setCheckoutError({ message: 'No pudimos validar tu dirección. Probá nuevamente.', action: 'retry-order' });
        return;
      }
      const addressBody = (await addressResponse.json().catch(() => null)) as AddressResponse | null;
      if (!addressResponse.ok) {
        setCheckoutState('error');
        setCheckoutError(
          addressResponse.status === 401
            ? { message: 'Tu sesión venció. Iniciá sesión para continuar.', action: 'login' }
            : { message: 'No pudimos validar tu dirección. Probá nuevamente.', action: 'retry-order' },
        );
        return;
      }
      if (!addressBody?.direccion?.id) {
        setCheckoutState('error');
        setCheckoutError({ message: 'Necesitás agregar una dirección antes de comprar.', action: 'address' });
        return;
      }

      try {
        marker = ensureCheckoutMarker({
          storage: window.localStorage,
          userId: sessionUser.id,
          cart,
          direccionEnvioId: addressBody.direccion.id,
        });
      } catch {
        setCheckoutState('error');
        setCheckoutError({
          message: 'No pudimos guardar la intención de compra en este navegador.',
          action: null,
        });
        return;
      }
    }

    if (!marker.pedidoId) {
      setCheckoutState('creating-order');
      let response: Response;
      try {
        response = await fetch('/api/ecommerce/pedido', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Idempotency-Key': marker.idempotencyKey,
          },
          body: JSON.stringify(marker.request),
        });
      } catch {
        setCheckoutState('error');
        setCheckoutError({
          message: 'No recibimos respuesta al crear el pedido. Reintentá con la misma intención.',
          action: 'retry-order',
        });
        return;
      }
      const body = (await response.json().catch(() => null)) as OrderResponse | null;
      if (!response.ok || !body?.pedido_id) {
        if (
          body?.error === 'direccion_envio_no_disponible' ||
          body?.error === 'direccion_no_existe' ||
          body?.error === 'direccion_no_pertenece_al_usuario'
        ) {
          removeCheckoutMarker(window.localStorage);
        }
        setCheckoutState('error');
        setCheckoutError(orderError(body?.error));
        return;
      }

      try {
        marker = persistCheckoutPedidoId(window.localStorage, marker, body.pedido_id);
      } catch {
        setCheckoutState('error');
        setCheckoutError({
          message: 'El pedido fue creado, pero no pudimos guardar su referencia. No iniciamos el pago por seguridad.',
          action: 'retry-order',
        });
        return;
      }
    }

    setCheckoutState('creating-payment');
    let paymentResponse: Response;
    try {
      paymentResponse = await fetch('/api/ecommerce/intento-pago', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pedido_id: marker.pedidoId,
          ...(manualPreferenceRetry ? { retry_failed_preference: true } : {}),
        }),
      });
    } catch {
      setCheckoutState('error');
      setCheckoutError({
        message: 'No recibimos respuesta de la fase de pago. El pedido quedó guardado.',
        action: 'retry-payment',
      });
      return;
    }
    const paymentBody = (await paymentResponse.json().catch(() => null)) as PaymentResponse | null;
    if (!paymentResponse.ok || !paymentBody?.intento_pago) {
      setCheckoutState('error');
      setCheckoutError(paymentError(paymentBody?.error));
      return;
    }
    if (
      paymentBody.intento_pago.pedido_id !== marker.pedidoId ||
      !isHttpsInitPoint(paymentBody.intento_pago.init_point)
    ) {
      setCheckoutState('error');
      setCheckoutError({
        message: 'Mercado Pago devolvió un destino inválido. Conservamos el pedido sin redirigirte.',
        action: 'retry-payment',
      });
      return;
    }

    setCheckoutState('redirecting');
    window.location.assign(paymentBody.intento_pago.init_point);
  };

  const startCheckout = (manualPreferenceRetry = false) => {
    if (activeCheckout.current) return activeCheckout.current;
    const operation = Promise.resolve()
      .then(() => runCheckout(manualPreferenceRetry))
      .catch(() => {
        setCheckoutState('error');
        setCheckoutError({
          message: 'Ocurrió un error inesperado. La intención de compra quedó guardada.',
          action: 'retry-order',
        });
      })
      .finally(() => {
        activeCheckout.current = null;
      });
    activeCheckout.current = operation;
    return operation;
  };

  const checkoutLabel = checkoutState === 'creating-order'
    ? 'Creando pedido...'
    : checkoutState === 'creating-payment'
      ? 'Preparando pago...'
      : checkoutState === 'redirecting'
        ? 'Redirigiendo...'
        : 'Comprar';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={busy ? undefined : onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween' }}
            className="fixed right-0 top-0 h-full w-80 md:w-96 bg-white z-50 shadow-xl rounded-l-2xl"
          >
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center text-gray-800">
                  <FaShoppingCart className="mr-2" />
                  Tu carrito
                </h2>
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-50"
                  aria-label="Cerrar carrito"
                >
                  <span className="text-2xl text-gray-600">&times;</span>
                </button>
              </div>

              <div className="flex-grow overflow-auto p-4 space-y-4">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <FaShoppingCart size={40} className="mb-2" />
                    <p>Tu carrito está vacío</p>
                  </div>
                ) : (
                  <ul className="space-y-4">
                    {items.map((item) => (
                      <li key={getCartIdentityKey(item)} className="flex border-b pb-4">
                        <div className="w-20 h-20 relative mr-4">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="80px"
                            className="rounded-md shadow-sm object-cover"
                          />
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-medium text-gray-800">{item.name}</h3>
                          <p className="text-gray-600">{formatCurrency(item.price)}</p>
                          <div className="flex items-center mt-2">
                            <button
                              onClick={() => decrementItem(item.productoId, item.varianteId)}
                              disabled={busy}
                              className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition disabled:opacity-50"
                              aria-label={`Reducir cantidad de ${item.name}`}
                            >
                              <FaMinus size={12} />
                            </button>
                            <span className="mx-2">{item.quantity}</span>
                            <button
                              onClick={() => incrementItem(item.productoId, item.varianteId)}
                              disabled={busy}
                              className="p-1 rounded-full bg-gray-200 hover:bg-gray-300 transition disabled:opacity-50"
                              aria-label={`Aumentar cantidad de ${item.name}`}
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.productoId, item.varianteId)}
                          disabled={busy}
                          className="text-red-500 p-1 hover:bg-red-50 rounded-full transition disabled:opacity-50"
                          aria-label={`Eliminar ${item.name}`}
                        >
                          <FaTrash />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 border-t mt-auto">
                <div className="flex justify-between text-lg font-semibold mb-4 text-gray-800">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                {checkoutError && (
                  <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" role="alert">
                    <p>{checkoutError.message}</p>
                    {checkoutError.action === 'login' && (
                      <Link href="/auth/login?next=/coleccion" className="mt-2 inline-block font-semibold underline">
                        Iniciar sesión
                      </Link>
                    )}
                    {checkoutError.action === 'address' && (
                      <Link href="/mi-cuenta" className="mt-2 inline-block font-semibold underline">
                        Agregar dirección
                      </Link>
                    )}
                    {checkoutError.action === 'retry-order' && (
                      <button type="button" onClick={() => void startCheckout()} className="mt-2 font-semibold underline">
                        Reintentar
                      </button>
                    )}
                    {checkoutError.action === 'retry-payment' && (
                      <button type="button" onClick={() => void startCheckout()} className="mt-2 font-semibold underline">
                        Reintentar pago
                      </button>
                    )}
                    {checkoutError.action === 'retry-payment-manual' && (
                      <button type="button" onClick={() => void startCheckout(true)} className="mt-2 font-semibold underline">
                        Reintentar pago manualmente
                      </button>
                    )}
                  </div>
                )}

                {!authLoading && !sessionUser ? (
                  <Link
                    href="/auth/login?next=/coleccion"
                    className="block w-full rounded-md bg-stone-900 px-4 py-2 text-center font-medium text-white"
                  >
                    Iniciar sesión para comprar
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startCheckout()}
                    disabled={busy || authLoading || !isHydrated || items.length === 0}
                    className="w-full py-2 px-4 rounded-md text-white font-medium bg-stone-900 hover:bg-stone-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {checkoutLabel}
                  </button>
                )}
                <button
                  onClick={onClose}
                  disabled={busy}
                  className="w-full mt-2 py-2 px-4 rounded-md border border-gray-300 hover:bg-gray-100 transition disabled:opacity-50"
                >
                  Seguir comprando
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShoppingCart;
