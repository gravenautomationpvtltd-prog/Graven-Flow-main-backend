import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useChatMessages, useSendMessage, useUploadAttachment, useEditMessage, useDeleteMessage } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Send, Paperclip, Image, FileText, X, Users, Building2, Megaphone, User, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

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
}

interface ChatMessageAreaProps {
  channel: ChatChannel;
}

export function ChatMessageArea({ channel }: ChatMessageAreaProps) {
  const { user, isAdmin } = useAuth();
  const { data: messages, isLoading } = useChatMessages(channel.id);
  const sendMessage = useSendMessage();
  const uploadAttachment = useUploadAttachment();
  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const { toast } = useToast();
  
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<{ url: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getChannelDisplayName = () => {
    if (channel.name) return channel.name;
    if (channel.type === 'dm') {
      const otherMember = channel.members.find((m) => m.user_id !== user?.id);
      return otherMember?.profile?.full_name || 'Unknown User';
    }
    return 'Chat';
  };

  const getChannelIcon = () => {
    switch (channel.type) {
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

  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const handleSend = async () => {
    if (!newMessage.trim() && !attachment) return;

    await sendMessage.mutateAsync({
      channelId: channel.id,
      content: newMessage.trim() || (attachment ? `Sent an attachment: ${attachment.name}` : ''),
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.name,
      attachmentType: attachment?.type,
    });

    setNewMessage('');
    setAttachment(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadAttachment.mutateAsync(file);
      setAttachment(result);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingMessage || !editingMessage.content.trim()) return;
    
    try {
      await editMessage.mutateAsync({
        messageId: editingMessage.id,
        content: editingMessage.content.trim(),
      });
      toast({ title: 'Message updated' });
      setEditingMessage(null);
    } catch (error) {
      toast({ title: 'Failed to edit message', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deletingMessageId) return;
    
    try {
      await deleteMessage.mutateAsync(deletingMessageId);
      toast({ title: 'Message deleted' });
      setDeletingMessageId(null);
    } catch (error) {
      toast({ title: 'Failed to delete message', variant: 'destructive' });
    }
  };

  const ChannelIcon = getChannelIcon();

  // Group messages by date
  const groupedMessages: { date: Date; messages: typeof messages }[] = [];
  messages?.forEach((msg) => {
    const msgDate = new Date(msg.created_at);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (!lastGroup || !isSameDay(lastGroup.date, msgDate)) {
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      lastGroup.messages!.push(msg);
    }
  });

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <ChannelIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">{getChannelDisplayName()}</h3>
          <p className="text-xs text-muted-foreground">
            {channel.members.length} member{channel.members.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-16 w-64 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-6">
            {groupedMessages.map((group, groupIdx) => (
              <div key={groupIdx}>
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium">
                    {formatMessageDate(group.date)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-4">
                  {group.messages?.map((message, idx) => {
                    const isOwn = message.sender_id === user?.id;
                    const showAvatar = idx === 0 || 
                      group.messages![idx - 1]?.sender_id !== message.sender_id;
                    const canEdit = isOwn || isAdmin;
                    const canDelete = isOwn || isAdmin;

                    return (
                      <div
                        key={message.id}
                        className={cn('flex gap-3 group', isOwn && 'flex-row-reverse')}
                      >
                        {!isOwn && showAvatar ? (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={message.sender?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {message.sender ? getInitials(message.sender.full_name) : '?'}
                            </AvatarFallback>
                          </Avatar>
                        ) : !isOwn ? (
                          <div className="w-8" />
                        ) : null}
                        <div className={cn('max-w-[70%] relative', isOwn && 'items-end')}>
                          {!isOwn && showAvatar && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {message.sender?.full_name}
                            </p>
                          )}
                          <div className="flex items-start gap-1">
                            {isOwn && (canEdit || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canEdit && (
                                    <DropdownMenuItem onClick={() => setEditingMessage({ id: message.id, content: message.content })}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem 
                                      onClick={() => setDeletingMessageId(message.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <div
                              className={cn(
                                'rounded-lg px-3 py-2',
                                isOwn
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              {message.attachment_url && (
                                <div className="mt-2">
                                  {message.attachment_type?.startsWith('image/') ? (
                                    <img
                                      src={message.attachment_url}
                                      alt={message.attachment_name || 'Attachment'}
                                      className="max-w-xs rounded"
                                    />
                                  ) : (
                                    <a
                                      href={message.attachment_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-xs underline"
                                    >
                                      <FileText className="h-4 w-4" />
                                      {message.attachment_name}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                            {!isOwn && (canEdit || canDelete) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  {canEdit && (
                                    <DropdownMenuItem onClick={() => setEditingMessage({ id: message.id, content: message.content })}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem 
                                      onClick={() => setDeletingMessageId(message.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                          <p className={cn('text-xs text-muted-foreground mt-1', isOwn && 'text-right')}>
                            {format(new Date(message.created_at), 'h:mm a')}
                            {message.is_edited && <span className="ml-1 italic">(edited)</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}
      </ScrollArea>

      {/* Attachment preview */}
      {attachment && (
        <div className="px-4 py-2 border-t bg-muted/50">
          <div className="flex items-center gap-2">
            {attachment.type.startsWith('image/') ? (
              <Image className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="text-sm truncate flex-1">{attachment.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setAttachment(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
            disabled={sendMessage.isPending}
          />
          <Button
            onClick={handleSend}
            disabled={(!newMessage.trim() && !attachment) || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit Message Dialog */}
      <Dialog open={!!editingMessage} onOpenChange={() => setEditingMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
          </DialogHeader>
          <Input
            value={editingMessage?.content || ''}
            onChange={(e) => setEditingMessage(prev => prev ? { ...prev, content: e.target.value } : null)}
            placeholder="Edit your message..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEditSave();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMessage(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editMessage.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingMessageId} onOpenChange={() => setDeletingMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
