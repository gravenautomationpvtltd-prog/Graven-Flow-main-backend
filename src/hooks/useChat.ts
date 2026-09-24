import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ChatChannel {
  id: string;
  name: string | null;
  type: 'dm' | 'branch' | 'group' | 'announcement';
  office_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMember {
  id: string;
  channel_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  is_admin: boolean;
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string;
  };
}

interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface ChannelWithDetails extends ChatChannel {
  members: ChatMember[];
  unread_count: number;
  last_message?: ChatMessage;
}

// Fetch all channels for current user (CEO/COO see ALL channels)
export function useChatChannels() {
  const { user, isAdmin } = useAuth();

  return useQuery({
    queryKey: ['chat-channels', user?.id, isAdmin],
    queryFn: async () => {
      if (!user) return [];

      const channels: ChannelWithDetails[] = [];

      // CEO/COO (super_admin, coo) see ALL channels
      if (isAdmin) {
        const { data: allChannels, error: channelsError } = await supabase
          .from('chat_channels')
          .select('*')
          .order('created_at', { ascending: false });

        if (channelsError) throw channelsError;

        for (const channel of allChannels || []) {
          // Get members for this channel
          const { data: members } = await supabase
            .from('chat_members')
            .select(`
              *,
              profile:profiles(id, full_name, avatar_url, email)
            `)
            .eq('channel_id', channel.id);

          // Get last message
          const { data: lastMessages } = await supabase
            .from('chat_messages')
            .select(`
              *,
              sender:profiles(id, full_name, avatar_url)
            `)
            .eq('channel_id', channel.id)
            .order('created_at', { ascending: false })
            .limit(1);

          // For admin viewing other channels, unread count is 0 (they're not members)
          channels.push({
            ...channel,
            members: (members || []) as ChatMember[],
            unread_count: 0,
            last_message: lastMessages?.[0] as ChatMessage | undefined,
          });
        }
      } else {
        // Regular users - get channels they are members of
        const { data: memberChannels, error: memberError } = await supabase
          .from('chat_members')
          .select(`
            channel_id,
            last_read_at,
            is_admin,
            channel:chat_channels(*)
          `)
          .eq('user_id', user.id);

        if (memberError) throw memberError;

        for (const mc of memberChannels || []) {
          const channel = mc.channel as unknown as ChatChannel;
          if (!channel) continue;

          // Get members for this channel
          const { data: members } = await supabase
            .from('chat_members')
            .select(`
              *,
              profile:profiles(id, full_name, avatar_url, email)
            `)
            .eq('channel_id', channel.id);

          // Get last message
          const { data: lastMessages } = await supabase
            .from('chat_messages')
            .select(`
              *,
              sender:profiles(id, full_name, avatar_url)
            `)
            .eq('channel_id', channel.id)
            .order('created_at', { ascending: false })
            .limit(1);

          // Count unread messages
          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', channel.id)
            .gt('created_at', mc.last_read_at);

          channels.push({
            ...channel,
            members: (members || []) as ChatMember[],
            unread_count: unreadCount || 0,
            last_message: lastMessages?.[0] as ChatMessage | undefined,
          });
        }
      }

      // Sort by last message time
      return channels.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    },
    enabled: !!user,
  });
}

// Fetch messages for a specific channel
export function useChatMessages(channelId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['chat-messages', channelId],
    queryFn: async () => {
      if (!channelId) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles(id, full_name, avatar_url)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!channelId,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`messages-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', channelId] });
          queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  return query;
}

// Send a message
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      channelId,
      content,
      attachmentUrl,
      attachmentName,
      attachmentType,
    }: {
      channelId: string;
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: channelId,
          sender_id: user.id,
          content,
          attachment_url: attachmentUrl || null,
          attachment_name: attachmentName || null,
          attachment_type: attachmentType || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.channelId] });
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    },
  });
}

// Edit a message
export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      messageId,
      content,
    }: {
      messageId: string;
      content: string;
    }) => {
      const { data, error } = await supabase
        .from('chat_messages')
        .update({ content, is_edited: true })
        .eq('id', messageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', data.channel_id] });
    },
  });
}

// Delete a message
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      // First get the channel_id for cache invalidation
      const { data: msg } = await supabase
        .from('chat_messages')
        .select('channel_id')
        .eq('id', messageId)
        .single();

      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      return msg?.channel_id;
    },
    onSuccess: (channelId) => {
      if (channelId) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', channelId] });
        queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      }
    },
  });
}

// Create a new channel
export function useCreateChannel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      name,
      type,
      memberIds,
      officeId,
    }: {
      name?: string;
      type: 'dm' | 'branch' | 'group' | 'announcement';
      memberIds: string[];
      officeId?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // For DMs, check if channel already exists
      if (type === 'dm' && memberIds.length === 1) {
        const otherUserId = memberIds[0];
        
        // Get all DM channels for current user
        const { data: existingChannels } = await supabase
          .from('chat_members')
          .select('channel_id')
          .eq('user_id', user.id);

        if (existingChannels) {
          for (const ec of existingChannels) {
            // Check if other user is in this channel and it's a DM
            const { data: channelInfo } = await supabase
              .from('chat_channels')
              .select('*')
              .eq('id', ec.channel_id)
              .eq('type', 'dm')
              .single();

            if (channelInfo) {
              const { data: otherMember } = await supabase
                .from('chat_members')
                .select('*')
                .eq('channel_id', ec.channel_id)
                .eq('user_id', otherUserId)
                .single();

              if (otherMember) {
                return channelInfo;
              }
            }
          }
        }
      }

      // Create new channel
      const { data: channel, error: channelError } = await supabase
        .from('chat_channels')
        .insert({
          name,
          type,
          office_id: officeId || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (channelError) throw channelError;

      // Add creator as admin member
      const { error: creatorError } = await supabase
        .from('chat_members')
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          is_admin: true,
        });

      if (creatorError) throw creatorError;

      // Add other members
      if (memberIds.length > 0) {
        const { error: membersError } = await supabase
          .from('chat_members')
          .insert(
            memberIds.map((userId) => ({
              channel_id: channel.id,
              user_id: userId,
              is_admin: false,
            }))
          );

        if (membersError) throw membersError;
      }

      return channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      toast({ title: 'Chat created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create chat', description: error.message, variant: 'destructive' });
    },
  });
}

// Mark channel as read
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (channelId: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('chat_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('channel_id', channelId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    },
  });
}

// Delete a channel (CEO/COO only)
export function useDeleteChannel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (channelId: string) => {
      // First delete all messages in the channel
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('channel_id', channelId);
      
      if (messagesError) throw messagesError;

      // Then delete all members
      const { error: membersError } = await supabase
        .from('chat_members')
        .delete()
        .eq('channel_id', channelId);
      
      if (membersError) throw membersError;

      // Finally delete the channel
      const { error: channelError } = await supabase
        .from('chat_channels')
        .delete()
        .eq('id', channelId);
      
      if (channelError) throw channelError;
      
      return channelId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      toast({ title: 'Channel deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete channel', description: error.message, variant: 'destructive' });
    },
  });
}

// Get total unread count for badge
export function useUnreadCount() {
  const { data: channels } = useChatChannels();
  
  const total = channels?.reduce((sum, channel) => sum + channel.unread_count, 0) || 0;
  return total;
}

// Upload attachment
export function useUploadAttachment() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      return {
        url: publicUrl,
        name: file.name,
        type: file.type,
      };
    },
  });
}

// Initialize user's branch channel on first load (with race condition fix)
export function useInitializeBranchChannel() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initBranchChannel() {
      if (!user || !profile?.office_id || initialized) return;

      try {
        // Check if user is already in a branch channel for their office
        const { data: existingMembership } = await supabase
          .from('chat_members')
          .select(`
            channel:chat_channels(*)
          `)
          .eq('user_id', user.id);

        const hasBranchChannel = existingMembership?.some(
          (m) => (m.channel as any)?.type === 'branch' && (m.channel as any)?.office_id === profile.office_id
        );

        if (!hasBranchChannel) {
          // Use maybeSingle() to avoid throwing on no result
          // Also order by created_at to get the oldest (original) channel if duplicates exist
          const { data: branchChannel } = await supabase
            .from('chat_channels')
            .select('*')
            .eq('type', 'branch')
            .eq('office_id', profile.office_id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (branchChannel) {
            // Check if already a member (race condition check)
            const { data: existingMember } = await supabase
              .from('chat_members')
              .select('id')
              .eq('channel_id', branchChannel.id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (!existingMember) {
              // Join existing branch channel
              await supabase.from('chat_members').insert({
                channel_id: branchChannel.id,
                user_id: user.id,
                is_admin: false,
              });
            }
          } else {
            // Double-check no channel was created in the meantime (race condition)
            const { data: recheckChannel } = await supabase
              .from('chat_channels')
              .select('*')
              .eq('type', 'branch')
              .eq('office_id', profile.office_id)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();

            if (recheckChannel) {
              // Channel was created by another user, just join it
              const { data: existingMember } = await supabase
                .from('chat_members')
                .select('id')
                .eq('channel_id', recheckChannel.id)
                .eq('user_id', user.id)
                .maybeSingle();

              if (!existingMember) {
                await supabase.from('chat_members').insert({
                  channel_id: recheckChannel.id,
                  user_id: user.id,
                  is_admin: false,
                });
              }
            } else {
              // Get office name
              const { data: office } = await supabase
                .from('offices')
                .select('name')
                .eq('id', profile.office_id)
                .single();

              // Create branch channel
              const { data: newChannel, error: createError } = await supabase
                .from('chat_channels')
                .insert({
                  name: `${office?.name || 'Office'} Team`,
                  type: 'branch',
                  office_id: profile.office_id,
                  created_by: user.id,
                })
                .select()
                .single();

              // Handle unique constraint violation (another user created it)
              if (createError?.code === '23505') {
                // Unique constraint violation - fetch the existing channel
                const { data: existingChannel } = await supabase
                  .from('chat_channels')
                  .select('*')
                  .eq('type', 'branch')
                  .eq('office_id', profile.office_id)
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .maybeSingle();

                if (existingChannel) {
                  await supabase.from('chat_members').insert({
                    channel_id: existingChannel.id,
                    user_id: user.id,
                    is_admin: false,
                  });
                }
              } else if (newChannel) {
                await supabase.from('chat_members').insert({
                  channel_id: newChannel.id,
                  user_id: user.id,
                  is_admin: true,
                });
              }
            }
          }

          queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
        }

        setInitialized(true);
      } catch (error) {
        console.error('Error initializing branch channel:', error);
        setInitialized(true); // Mark as initialized to prevent infinite retries
      }
    }

    initBranchChannel();
  }, [user, profile?.office_id, initialized, queryClient]);
}
