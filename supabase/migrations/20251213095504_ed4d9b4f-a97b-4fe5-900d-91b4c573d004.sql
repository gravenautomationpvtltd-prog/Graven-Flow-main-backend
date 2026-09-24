-- Add timing columns to offices table
ALTER TABLE public.offices 
ADD COLUMN opening_time TIME DEFAULT '09:00:00',
ADD COLUMN closing_time TIME DEFAULT '18:00:00';