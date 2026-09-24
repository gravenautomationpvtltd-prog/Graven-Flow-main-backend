-- Fix: Add creator visibility to chat_channels SELECT policy
-- This allows the creator to see their channel immediately after creation
-- before they are added to chat_members

DROP POLICY IF EXISTS "Users can view channels they are members of" ON public.chat_channels;

CREATE POLICY "Users can view channels they are members of"
ON public.chat_channels FOR SELECT
USING (
  public.is_chat_member(auth.uid(), id)
  OR type = 'announcement'
  OR created_by = auth.uid()
);