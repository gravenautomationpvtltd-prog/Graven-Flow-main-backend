-- Add enquiry_item_id column to quotation_items for direct linking
ALTER TABLE public.quotation_items 
ADD COLUMN enquiry_item_id UUID REFERENCES public.enquiry_items(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_quotation_items_enquiry_item_id ON public.quotation_items(enquiry_item_id);

-- Comment explaining the purpose
COMMENT ON COLUMN public.quotation_items.enquiry_item_id IS 'Links quotation item back to original enquiry item for target rate synchronization';