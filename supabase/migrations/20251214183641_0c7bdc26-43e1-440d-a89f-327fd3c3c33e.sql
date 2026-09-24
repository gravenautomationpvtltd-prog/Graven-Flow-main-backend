-- Add category column to products table for profit margin grouping
ALTER TABLE public.products
ADD COLUMN category text DEFAULT NULL;