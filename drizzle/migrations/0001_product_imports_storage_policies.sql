DO $$ BEGIN
  CREATE POLICY "Authenticated can upload product imports"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'product-imports');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can read product imports"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'product-imports');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
