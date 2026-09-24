CREATE POLICY "BIE reads tender files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tender-documents' AND public.is_bie_member(auth.uid()));

CREATE POLICY "BIE uploads tender files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tender-documents' AND public.is_bie_member(auth.uid()));

CREATE POLICY "BIE deletes tender files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tender-documents' AND public.is_bie_member(auth.uid()));