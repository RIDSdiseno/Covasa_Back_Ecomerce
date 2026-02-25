-- Add KLAP as a valid ecommerce payment method.
ALTER TYPE "EcommerceMetodoPago" ADD VALUE IF NOT EXISTS 'KLAP';
