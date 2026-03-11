-- =========================================
-- Fix: default para pedido.total
-- Evita error NOT NULL al crear pedido
-- =========================================

alter table public.pedido
alter column total
set default 0;