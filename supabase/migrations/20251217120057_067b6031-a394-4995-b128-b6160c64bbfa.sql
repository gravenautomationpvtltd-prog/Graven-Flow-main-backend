-- Create security definer function to check chat membership
CREATE OR REPLACE FUNCTION public.is_chat_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE user_id = _user_id
      AND channel_id = _channel_id
  )
$$;

-- Create security definer function to check chat admin status
CREATE OR REPLACE FUNCTION public.is_chat_admin(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_members
    WHERE user_id = _user_id
      AND channel_id = _channel_id
      AND is_admin = true
  )
$$;

-- Drop existing recursive policies
DROP POLICY IF EXISTS "Users can view members of their channels" ON public.chat_members;
DROP POLICY IF EXISTS "Channel admins can remove members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can view channels they are members of" ON public.chat_channels;
DROP POLICY IF EXISTS "Channel admins can update channels" ON public.chat_channels;
DROP POLICY IF EXISTS "Users can view messages in their channels" ON public.chat_messages;
DROP POLICY IF EXISTS "Members can send messages to their channels" ON public.chat_messages;

-- Recreate chat_members policies using functions
CREATE POLICY "Users can view members of their channels"
ON public.chat_members FOR SELECT
USING (public.is_chat_member(auth.uid(), channel_id));

CREATE POLICY "Channel admins can remove members"
ON public.chat_members FOR DELETE
USING (
  user_id = auth.uid()
  OR public.is_chat_admin(auth.uid(), channel_id)
);

-- Recreate chat_channels policies using functions
CREATE POLICY "Users can view channels they are members of"
ON public.chat_channels FOR SELECT
USING (
  public.is_chat_member(auth.uid(), id)
  OR type = 'announcement'
);

CREATE POLICY "Channel admins can update channels"
ON public.chat_channels FOR UPDATE
USING (
  public.is_chat_admin(auth.uid(), id)
  OR is_admin_or_above(auth.uid())
);

-- Recreate chat_messages policies using functions
CREATE POLICY "Users can view messages in their channels"
ON public.chat_messages FOR SELECT
USING (public.is_chat_member(auth.uid(), channel_id));

CREATE POLICY "Members can send messages to their channels"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_chat_member(auth.uid(), channel_id)
);