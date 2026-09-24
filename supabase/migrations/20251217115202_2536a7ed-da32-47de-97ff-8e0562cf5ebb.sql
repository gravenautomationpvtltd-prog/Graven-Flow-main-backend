-- Create chat channel types enum
CREATE TYPE public.chat_channel_type AS ENUM ('dm', 'branch', 'group', 'announcement');

-- Create chat_channels table
CREATE TABLE public.chat_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  type public.chat_channel_type NOT NULL DEFAULT 'dm',
  office_id UUID REFERENCES public.offices(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_members table
CREATE TABLE public.chat_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_admin BOOLEAN DEFAULT false,
  UNIQUE(channel_id, user_id)
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_chat_members_user_id ON public.chat_members(user_id);
CREATE INDEX idx_chat_members_channel_id ON public.chat_members(channel_id);
CREATE INDEX idx_chat_messages_channel_id ON public.chat_messages(channel_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX idx_chat_channels_type ON public.chat_channels(type);
CREATE INDEX idx_chat_channels_office_id ON public.chat_channels(office_id);

-- Enable RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_channels
CREATE POLICY "Users can view channels they are members of"
ON public.chat_channels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.channel_id = chat_channels.id
    AND chat_members.user_id = auth.uid()
  )
  OR type = 'announcement'
);

CREATE POLICY "Authenticated users can create channels"
ON public.chat_channels FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Channel admins can update channels"
ON public.chat_channels FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.channel_id = chat_channels.id
    AND chat_members.user_id = auth.uid()
    AND chat_members.is_admin = true
  )
  OR is_admin_or_above(auth.uid())
);

CREATE POLICY "Admins can delete channels"
ON public.chat_channels FOR DELETE
USING (is_admin_or_above(auth.uid()));

-- RLS Policies for chat_members
CREATE POLICY "Users can view members of their channels"
ON public.chat_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.channel_id = chat_members.channel_id
    AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can join/add members"
ON public.chat_members FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own membership"
ON public.chat_members FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Channel admins can remove members"
ON public.chat_members FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.channel_id = chat_members.channel_id
    AND cm.user_id = auth.uid()
    AND cm.is_admin = true
  )
);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their channels"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.channel_id = chat_messages.channel_id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "Members can send messages to their channels"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_members.channel_id = chat_messages.channel_id
    AND chat_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can edit their own messages"
ON public.chat_messages FOR UPDATE
USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
ON public.chat_messages FOR DELETE
USING (sender_id = auth.uid() OR is_admin_or_above(auth.uid()));

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);

-- Storage policies for chat attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);