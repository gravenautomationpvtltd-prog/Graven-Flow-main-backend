import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteChannel } from '@/hooks/useChat';
import { formatDistanceToNow } from 'date-fns';
import { Users, Building2, Megaphone, User, Trash2 } from 'lucide-react';

interface ChatMember {
  id: string;
  user_id: string;
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface ChatChannel {
  id: string;
  name: string | null;
  type: 'dm' | 'branch' | 'group' | 'announcement';
  members: ChatMember[];
  unread_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender?: {
      full_name: string;
    };
  };
}

interface ChatChannelListProps {
  channels: ChatChannel[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  isLoading: boolean;
}

export function ChatChannelList({
  channels,
  selectedChannelId,
  onSelectChannel,
  isLoading,
}: ChatChannelListProps) {
  const { user, isAdmin } = useAuth();
  const deleteChannel = useDeleteChannel();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<ChatChannel | null>(null);

  const getChannelDisplayName = (channel: ChatChannel) => {
    if (channel.name) return channel.name;
    
    if (channel.type === 'dm') {
      const otherMember = channel.members.find((m) => m.user_id !== user?.id);
      return otherMember?.profile?.full_name || 'Unknown User';
    }
    
    return 'Unnamed Chat';
  };

  const getChannelAvatar = (channel: ChatChannel) => {
    if (channel.type === 'dm') {
      const otherMember = channel.members.find((m) => m.user_id !== user?.id);
      return otherMember?.profile?.avatar_url || undefined;
    }
    return undefined;
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'dm':
        return User;
      case 'branch':
        return Building2;
      case 'group':
        return Users;
      case 'announcement':
        return Megaphone;
      default:
        return Users;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">No conversations yet</p>
        <p className="text-xs mt-1">Start a new chat to begin messaging</p>
      </div>
    );
  }

  // Group channels by type
  const groupedChannels = {
    announcement: channels.filter((c) => c.type === 'announcement'),
    branch: channels.filter((c) => c.type === 'branch'),
    group: channels.filter((c) => c.type === 'group'),
    dm: channels.filter((c) => c.type === 'dm'),
  };

  const handleDeleteClick = (e: React.MouseEvent, channel: ChatChannel) => {
    e.stopPropagation();
    setChannelToDelete(channel);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (channelToDelete) {
      deleteChannel.mutate(channelToDelete.id, {
        onSuccess: () => {
          if (selectedChannelId === channelToDelete.id) {
            onSelectChannel('');
          }
          setChannelToDelete(null);
        },
      });
    }
  };

  const renderChannelGroup = (title: string, items: ChatChannel[], icon: React.ElementType) => {
    if (items.length === 0) return null;
    const Icon = icon;
    
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-3 w-3" />
          {title}
        </div>
        {items.map((channel) => {
          const displayName = getChannelDisplayName(channel);
          const avatarUrl = getChannelAvatar(channel);
          const ChannelIcon = getChannelIcon(channel.type);

          return (
            <div
              key={channel.id}
              className={cn(
                'group relative w-full flex items-center gap-3 px-3 py-2 hover:bg-accent/50 transition-colors',
                selectedChannelId === channel.id && 'bg-accent'
              )}
            >
              <button
                onClick={() => onSelectChannel(channel.id)}
                className="flex-1 flex items-center gap-3 text-left min-w-0"
              >
                {channel.type === 'dm' ? (
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <ChannelIcon className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{displayName}</span>
                    {channel.last_message && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(channel.last_message.created_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  {channel.last_message && (
                    <p className="text-xs text-muted-foreground truncate">
                      {channel.type !== 'dm' && channel.last_message.sender && (
                        <span>{channel.last_message.sender.full_name.split(' ')[0]}: </span>
                      )}
                      {channel.last_message.content}
                    </p>
                  )}
                </div>
                {channel.unread_count > 0 && (
                  <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs shrink-0">
                    {channel.unread_count}
                  </Badge>
                )}
              </button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDeleteClick(e, channel)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <ScrollArea className="flex-1">
        {renderChannelGroup('Announcements', groupedChannels.announcement, Megaphone)}
        {renderChannelGroup('Team Channels', groupedChannels.branch, Building2)}
        {renderChannelGroup('Groups', groupedChannels.group, Users)}
        {renderChannelGroup('Direct Messages', groupedChannels.dm, User)}
      </ScrollArea>

      <DoubleConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Channel"
        description="Are you sure you want to delete this channel? All messages and members will be permanently removed."
        itemDetails={
          channelToDelete && (
            <>
              <p><strong>Channel:</strong> {getChannelDisplayName(channelToDelete)}</p>
              <p><strong>Type:</strong> {channelToDelete.type}</p>
              <p><strong>Members:</strong> {channelToDelete.members.length}</p>
            </>
          )
        }
        isLoading={deleteChannel.isPending}
      />
    </>
  );
}
