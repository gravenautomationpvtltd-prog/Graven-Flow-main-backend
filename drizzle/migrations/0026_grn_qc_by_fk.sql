ALTER TABLE public.goods_receipt_notes
  ADD CONSTRAINT goods_receipt_notes_qc_by_fkey
  FOREIGN KEY (qc_by) REFERENCES public.profiles(id) ON DELETE SET NULL;