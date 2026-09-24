-- Create storage bucket for enquiry attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('enquiry-attachments', 'enquiry-attachments', true);

-- RLS Policy: Allow authenticated users to upload to enquiry-attachments bucket
CREATE POLICY "Allow authenticated uploads to enquiry-attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'enquiry-attachments');

-- RLS Policy: Allow authenticated users to read from enquiry-attachments bucket
CREATE POLICY "Allow authenticated reads from enquiry-attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'enquiry-attachments');

-- RLS Policy: Allow authenticated users to delete their uploads from enquiry-attachments bucket
CREATE POLICY "Allow authenticated deletes from enquiry-attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'enquiry-attachments');

-- Create enquiry_item_attachments table
CREATE TABLE public.enquiry_item_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enquiry_item_id UUID NOT NULL REFERENCES public.enquiry_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups by enquiry_item_id
CREATE INDEX idx_enquiry_item_attachments_enquiry_item_id 
  ON public.enquiry_item_attachments(enquiry_item_id);

-- Enable Row Level Security
ALTER TABLE public.enquiry_item_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow authenticated users to read all attachments
CREATE POLICY "Allow authenticated users to read attachments"
  ON public.enquiry_item_attachments FOR SELECT TO authenticated USING (true);

-- RLS Policy: Allow authenticated users to insert attachments
CREATE POLICY "Allow authenticated users to insert attachments"
  ON public.enquiry_item_attachments FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = uploaded_by);

-- RLS Policy: Allow attachment owners to delete their attachments
CREATE POLICY "Allow attachment owners to delete"
  ON public.enquiry_item_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());