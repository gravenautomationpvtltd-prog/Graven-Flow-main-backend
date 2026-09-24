import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, MessageSquare, User, Building2, FileText, Clock, Send, Paperclip, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { NewCommunicationDialog } from '@/components/supplier-network/NewCommunicationDialog';

type MessageType = 'message' | 'clarification' | 'negotiation' | 'note' | 'system';

interface SupplierCommunication {
  id: string;
  supplier_id: string;
  rfq_id: string | null;
  quotation_id: string | null;
  parent_id: string | null;
  message_type: MessageType;
  subject: string | null;
  content: string;
  is_internal_note: boolean | null;
  sent_by: string | null;
  sent_by_supplier: boolean | null;
  read_at: string | null;
  created_at: string;
  suppliers?: { name: string } | null;
  rfqs?: { rfq_number: string; title: string } | null;
  profiles?: { full_name: string } | null;
}

export default function SupplierCommunications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['supplier-communications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_communications')
        .select(`
          *,
          suppliers(name),
          rfqs(rfq_number, title),
          profiles!supplier_communications_sent_by_fkey(full_name)
        `)
        .is('parent_id', null) // Only get root messages
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as SupplierCommunication[];
    },
  });

  const { data: threadMessages = [] } = useQuery({
    queryKey: ['thread-messages', selectedThread],
    queryFn: async () => {
      if (!selectedThread) return [];
      
      const { data, error } = await supabase
        .from('supplier_communications')
        .select(`
          *,
          profiles!supplier_communications_sent_by_fkey(full_name)
        `)
        .or(`id.eq.${selectedThread},parent_id.eq.${selectedThread}`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as unknown as SupplierCommunication[];
    },
    enabled: !!selectedThread,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-comms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('application_status', 'approved')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async ({ parentId, content }: { parentId: string; content: string }) => {
      const parentMessage = communications.find(c => c.id === parentId);
      if (!parentMessage) throw new Error('Parent message not found');

      const { error } = await supabase
        .from('supplier_communications')
        .insert({
          supplier_id: parentMessage.supplier_id,
          rfq_id: parentMessage.rfq_id,
          quotation_id: parentMessage.quotation_id,
          parent_id: parentId,
          message_type: parentMessage.message_type,
          content,
          sent_by: profile?.id,
          is_internal_note: false,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-communications'] });
      queryClient.invalidateQueries({ queryKey: ['thread-messages'] });
      setReplyContent('');
      toast.success('Reply sent');
    },
    onError: () => {
      toast.error('Failed to send reply');
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplier_communications')
        .update({ 
          read_at: new Date().toISOString(),
          read_by: profile?.id,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-communications'] });
    },
  });

  const getFilteredCommunications = () => {
    let filtered = communications;
    
    if (supplierFilter !== 'all') {
      filtered = filtered.filter(c => c.supplier_id === supplierFilter);
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.message_type === typeFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.subject?.toLowerCase().includes(query) ||
        c.content?.toLowerCase().includes(query) ||
        c.suppliers?.name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const getTypeBadge = (type: MessageType, isInternal: boolean | null) => {
    if (isInternal) {
      return <Badge variant="secondary">Internal Note</Badge>;
    }
    
    const config: Record<MessageType, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      message: { label: 'Message', variant: 'default' },
      clarification: { label: 'Clarification', variant: 'outline' },
      negotiation: { label: 'Negotiation', variant: 'outline' },
      note: { label: 'Note', variant: 'secondary' },
      system: { label: 'System', variant: 'secondary' },
    };
    
    const typeConfig = config[type];
    return <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>;
  };

  const filteredCommunications = getFilteredCommunications();
  const selectedMessage = communications.find(c => c.id === selectedThread);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Communications</h1>
          <p className="text-muted-foreground">Threaded communication with suppliers linked to RFQs and quotations</p>
        </div>
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Message
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6 h-[calc(100vh-220px)]">
        {/* Message List */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="message">Messages</SelectItem>
                  <SelectItem value="clarification">Clarifications</SelectItem>
                  <SelectItem value="negotiation">Negotiations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-380px)]">
              <div className="divide-y">
                {isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading...</div>
                ) : filteredCommunications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">No messages</div>
                ) : (
                  filteredCommunications.map((comm) => (
                    <div
                      key={comm.id}
                      className={`p-4 cursor-pointer hover:bg-muted/50 ${selectedThread === comm.id ? 'bg-muted' : ''} ${!comm.read_at ? 'bg-primary/5' : ''}`}
                      onClick={() => {
                        setSelectedThread(comm.id);
                        if (!comm.read_at) {
                          markAsReadMutation.mutate(comm.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{comm.suppliers?.name}</span>
                            {!comm.read_at && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {comm.subject || comm.content.substring(0, 50)}...
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {getTypeBadge(comm.message_type, comm.is_internal_note)}
                            {comm.rfqs && (
                              <span className="text-xs text-muted-foreground">
                                {comm.rfqs.rfq_number}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(comm.created_at), 'MMM dd')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="col-span-2">
          {selectedThread && selectedMessage ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedMessage.subject || 'No Subject'}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Building2 className="h-4 w-4" />
                      {selectedMessage.suppliers?.name}
                      {selectedMessage.rfqs && (
                        <>
                          <span className="mx-2">•</span>
                          <FileText className="h-4 w-4" />
                          {selectedMessage.rfqs.rfq_number}
                        </>
                      )}
                    </CardDescription>
                  </div>
                  {getTypeBadge(selectedMessage.message_type, selectedMessage.is_internal_note)}
                </div>
              </CardHeader>
              <CardContent className="p-0 flex flex-col h-[calc(100vh-380px)]">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {threadMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sent_by_supplier ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.sent_by_supplier
                              ? 'bg-muted'
                              : msg.is_internal_note
                              ? 'bg-yellow-100 dark:bg-yellow-900/30'
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {msg.sent_by_supplier ? selectedMessage.suppliers?.name : msg.profiles?.full_name || 'System'}
                            </span>
                            {msg.is_internal_note && (
                              <Badge variant="outline" className="text-xs">
                                <EyeOff className="h-3 w-3 mr-1" />
                                Internal
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <div className="flex items-center justify-end gap-2 mt-2">
                            <span className="text-xs opacity-70">
                              {format(new Date(msg.created_at), 'MMM dd, HH:mm')}
                            </span>
                            {msg.read_at && !msg.sent_by_supplier && (
                              <Eye className="h-3 w-3 opacity-70" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        size="icon"
                        onClick={() => sendReplyMutation.mutate({ parentId: selectedThread, content: replyContent })}
                        disabled={!replyContent.trim() || sendReplyMutation.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <NewCommunicationDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        suppliers={suppliers}
      />
    </div>
  );
}
