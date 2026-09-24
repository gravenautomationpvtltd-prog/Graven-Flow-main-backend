-- Give CEO (super_admin) full visibility into all chat communications

-- 1. Update chat_channels SELECT policy
DROP POLICY IF EXISTS "Users can view channels they are members of" ON public.chat_channels;

CREATE POLICY "Users can view channels they are members of"
ON public.chat_channels FOR SELECT
USING (
  public.is_chat_member(auth.uid(), id)
  OR type = 'announcement'
  OR created_by = auth.uid()
  OR public.is_admin_or_above(auth.uid())
);

-- 2. Update chat_messages SELECT policy
DROP POLICY IF EXISTS "Users can view messages in their channels" ON public.chat_messages;

CREATE POLICY "Users can view messages in their channels"
ON public.chat_messages FOR SELECT
USING (
  public.is_chat_member(auth.uid(), channel_id)
  OR public.is_admin_or_above(auth.uid())
);

-- 3. Update chat_members SELECT policy
DROP POLICY IF EXISTS "Users can view members of their channels" ON public.chat_members;

CREATE POLICY "Users can view members of their channels"
ON public.chat_members FOR SELECT
USING (
  public.is_chat_member(auth.uid(), channel_id)
  OR public.is_admin_or_above(auth.uid())
);