-- Add 'ready_to_dispatch' to the order status constraint
-- First, we need to update the check constraint on sales_orders.status column
-- Since sales_orders uses text with values, we just need to ensure the code accepts it

-- Note: The sales_orders table uses text type for status, not an enum,
-- so no database migration is needed - just code updates