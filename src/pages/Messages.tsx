import { useState, useEffect } from 'react';
import { ChatChannelList } from '@/components/chat/ChatChannelList';
import { ChatMessageArea } from '@/components/chat/ChatMessageArea';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { useInitializeBranchChannel, useChatChannels, useMarkAsRead } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';

export default function Messages() {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const { data: channels, isLoading } = useChatChannels();
  const markAsRead = useMarkAsRead();

  // Initialize branch channel on first load
  useInitializeBranchChannel();

  // Auto-select first channel
  useEffect(() => {
    if (!selectedChannelId && channels && channels.length > 0) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  // Mark as read when selecting channel
  useEffect(() => {
    if (selectedChannelId) {
      markAsRead.mutate(selectedChannelId);
    }
  }, [selectedChannelId]);

  const selectedChannel = channels?.find((c) => c.id === selectedChannelId);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar */}
      <div className="w-80 flex flex-col border rounded-lg bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Messages</h2>
          <Button size="sm" onClick={() => setNewChatOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
        <ChatChannelList
          channels={channels || []}
          selectedChannelId={selectedChannelId}
          onSelectChannel={setSelectedChannelId}
          isLoading={isLoading}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 border rounded-lg bg-card flex flex-col">
        {selectedChannel ? (
          <ChatMessageArea channel={selectedChannel} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      <NewChatDialog 
        open={newChatOpen} 
        onOpenChange={setNewChatOpen}
        onChannelCreated={(channelId) => {
          setSelectedChannelId(channelId);
          setNewChatOpen(false);
        }}
      />
    </div>
  );
}
