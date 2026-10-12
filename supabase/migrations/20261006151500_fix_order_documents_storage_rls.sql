-- Migration: 20261006151500_fix_order_documents_storage_rls.sql
-- Description: Restore and enforce secure RLS policies for storage buckets (order-documents, payment-receipts, etc.)
-- and allow order creators to roll back pending orders on failure.

-- 1. Helper function for verifying active authenticated employee status
CREATE OR REPLACE FUNCTION public.is_authorized_employee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_authorized_employee() TO authenticated;

-- 2. Storage Policies on order-documents
DROP POLICY IF EXISTS "Order documents are accessible" ON storage.objects;
CREATE POLICY "Order documents are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'order-documents');

DROP POLICY IF EXISTS "Authorized employees can upload order documents" ON storage.objects;
CREATE POLICY "Authorized employees can upload order documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'order-documents'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Authorized employees can update order documents" ON storage.objects;
CREATE POLICY "Authorized employees can update order documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'order-documents'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Authorized employees can delete order documents" ON storage.objects;
CREATE POLICY "Authorized employees can delete order documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'order-documents'
  AND public.is_authorized_employee()
);

-- 3. Storage Policies on payment-receipts
DROP POLICY IF EXISTS "Payment receipts are accessible" ON storage.objects;
CREATE POLICY "Payment receipts are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "Authorized employees can upload payment receipts" ON storage.objects;
CREATE POLICY "Authorized employees can upload payment receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Authorized employees can update payment receipts" ON storage.objects;
CREATE POLICY "Authorized employees can update payment receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Authorized employees can delete payment receipts" ON storage.objects;
CREATE POLICY "Authorized employees can delete payment receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.is_authorized_employee()
);

-- 4. Other key buckets (rfq-attachments, dispatch-documents, enquiry-attachments, chat-attachments, avatars, tenant-logos, attendance-selfies)
DROP POLICY IF EXISTS "RFQ attachments are accessible" ON storage.objects;
CREATE POLICY "RFQ attachments are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'rfq-attachments');

DROP POLICY IF EXISTS "Authorized employees can upload rfq attachments" ON storage.objects;
CREATE POLICY "Authorized employees can upload rfq attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'rfq-attachments'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Dispatch documents are accessible" ON storage.objects;
CREATE POLICY "Dispatch documents are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'dispatch-documents');

DROP POLICY IF EXISTS "Authorized employees can upload dispatch documents" ON storage.objects;
CREATE POLICY "Authorized employees can upload dispatch documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dispatch-documents'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Enquiry attachments are accessible" ON storage.objects;
CREATE POLICY "Enquiry attachments are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'enquiry-attachments');

DROP POLICY IF EXISTS "Authorized employees can upload enquiry attachments" ON storage.objects;
CREATE POLICY "Authorized employees can upload enquiry attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'enquiry-attachments'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Chat attachments are accessible" ON storage.objects;
CREATE POLICY "Chat attachments are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authorized employees can upload chat attachments" ON storage.objects;
CREATE POLICY "Authorized employees can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Avatars are accessible" ON storage.objects;
CREATE POLICY "Avatars are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Tenant logos are accessible" ON storage.objects;
CREATE POLICY "Tenant logos are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos');

DROP POLICY IF EXISTS "Authorized employees can upload tenant logos" ON storage.objects;
CREATE POLICY "Authorized employees can upload tenant logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND public.is_authorized_employee()
);

DROP POLICY IF EXISTS "Attendance selfies are accessible" ON storage.objects;
CREATE POLICY "Attendance selfies are accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'attendance-selfies');

DROP POLICY IF EXISTS "Authenticated users can upload attendance selfies" ON storage.objects;
CREATE POLICY "Authenticated users can upload attendance selfies"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attendance-selfies'
  AND auth.role() = 'authenticated'
);

-- 5. Allow order creators to delete their pending orders during cleanup/rollback
DROP POLICY IF EXISTS "Creator can delete pending orders" ON public.sales_orders;
CREATE POLICY "Creator can delete pending orders"
ON public.sales_orders FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND status = 'pending_documents'
);
