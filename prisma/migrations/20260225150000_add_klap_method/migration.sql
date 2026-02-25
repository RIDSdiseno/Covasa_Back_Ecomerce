-- KLAP payment method + refunded payment state.
ALTER TYPE "EcommerceMetodoPago" ADD VALUE IF NOT EXISTS 'KLAP';
ALTER TYPE "EcommerceEstadoPago" ADD VALUE IF NOT EXISTS 'REEMBOLSADO';
