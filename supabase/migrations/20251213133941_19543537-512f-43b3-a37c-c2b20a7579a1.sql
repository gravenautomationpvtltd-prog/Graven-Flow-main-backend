-- Add customer_id column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_tasks_customer_id ON public.tasks(customer_id);