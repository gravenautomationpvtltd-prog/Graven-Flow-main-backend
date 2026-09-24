-- Add parsed_data column to store extracted product details
ALTER TABLE public.enquiry_item_attachments
ADD COLUMN parsed_data JSONB DEFAULT NULL,
ADD COLUMN parsing_status TEXT DEFAULT 'pending' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN parsing_error TEXT DEFAULT NULL;