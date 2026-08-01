REVOKE EXECUTE ON FUNCTION public.consolidar_pago_pedido(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.procesar_notificacion_intento_pago(uuid, public.intento_pago_estado) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consolidar_pago_pedido(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.procesar_notificacion_intento_pago(uuid, public.intento_pago_estado) TO service_role;
