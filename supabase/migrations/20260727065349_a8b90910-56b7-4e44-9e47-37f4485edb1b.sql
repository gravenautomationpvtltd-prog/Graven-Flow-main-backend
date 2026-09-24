CREATE POLICY "Authenticated users can upload list price imports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'list-price-imports');

CREATE POLICY "Authenticated users can view list price imports"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'list-price-imports');