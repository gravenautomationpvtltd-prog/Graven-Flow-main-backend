import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Plus, Eye, Send, FileText, Users, Clock, CheckCircle, XCircle, BarChart3, Download, Upload, GitCompare } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { CreateRFQDialog } from '@/components/supplier-network/CreateRFQDialog';
import { ViewRFQDialog } from '@/components/supplier-network/ViewRFQDialog';
import { DistributeRFQDialog } from '@/components/supplier-network/DistributeRFQDialog';
import { ImportVendorResponseDialog } from '@/components/supplier-network/ImportVendorResponseDialog';
import { exportRFQToExcel, exportRFQToPDF, exportRFQToCSV } from '@/lib/rfq-export';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

type RFQStatus = 'draft' | 'issued' | 'responses_received' | 'evaluation' | 'awarded' | 'closed' | 'cancelled';

interface RFQ {
  id: string;
  rfq_number: string;
  title: string;
  category_id: string | null;
  base_currency: string;
  deadline_date: string;
  status: RFQStatus;
  created_at: string;
  issue_date: string | null;
  supplier_categories?: { name: string } | null;
  description?: string | null;
  [key: string]: unknown;
}

interface RFQWithStats extends RFQ {
  distributions_count: number;
  responses_count: number;
}

export default function RFQs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQWithStats | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ['rfqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfqs')
        .select(`
          *,
          supplier_categories(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get distribution counts for each RFQ
      const rfqIds = data.map(r => r.id);
      const { data: distributions } = await supabase
        .from('rfq_distributions')
        .select('rfq_id, response_status')
        .in('rfq_id', rfqIds);

      const distributionCounts: Record<string, { total: number; responses: number }> = {};
      distributions?.forEach(d => {
        if (!distributionCounts[d.rfq_id]) {
          distributionCounts[d.rfq_id] = { total: 0, responses: 0 };
        }
        distributionCounts[d.rfq_id].total++;
        if (d.response_status === 'quoted') {
          distributionCounts[d.rfq_id].responses++;
        }
      });

      return data.map(rfq => ({
        ...rfq,
        distributions_count: distributionCounts[rfq.id]?.total || 0,
        responses_count: distributionCounts[rfq.id]?.responses || 0,
      })) as RFQWithStats[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RFQStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'issued') {
        updateData.issue_date = new Date().toISOString().split('T')[0];
      }
      if (status === 'closed' || status === 'cancelled') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('rfqs')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success('RFQ status updated');
    },
    onError: () => {
      toast.error('Failed to update RFQ status');
    },
  });

  const getFilteredRFQs = () => {
    let filtered = rfqs;
    
    if (activeTab !== 'all') {
      filtered = filtered.filter(r => r.status === activeTab);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.rfq_number?.toLowerCase().includes(query) ||
        r.title?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const getStatusBadge = (status: RFQStatus) => {
    const config: Record<RFQStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Draft', variant: 'secondary' },
      issued: { label: 'Issued', variant: 'default' },
      responses_received: { label: 'Responses Received', variant: 'outline' },
      evaluation: { label: 'Evaluation', variant: 'outline' },
      awarded: { label: 'Awarded', variant: 'default' },
      closed: { label: 'Closed', variant: 'secondary' },
      cancelled: { label: 'Cancelled', variant: 'destructive' },
    };
    
    const statusConfig = config[status];
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const days = differenceInDays(new Date(deadline), new Date());
    if (days < 0) return <span className="text-destructive">Expired</span>;
    if (days === 0) return <span className="text-yellow-600">Today</span>;
    if (days <= 3) return <span className="text-yellow-600">{days} days</span>;
    return <span>{days} days</span>;
  };

  const filteredRFQs = getFilteredRFQs();

  const tabCounts = {
    all: rfqs.length,
    draft: rfqs.filter(r => r.status === 'draft').length,
    issued: rfqs.filter(r => r.status === 'issued').length,
    responses_received: rfqs.filter(r => r.status === 'responses_received').length,
    evaluation: rfqs.filter(r => r.status === 'evaluation').length,
    awarded: rfqs.filter(r => r.status === 'awarded').length,
    closed: rfqs.filter(r => r.status === 'closed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Request for Quotations</h1>
          <p className="text-muted-foreground">Create and manage RFQs, distribute to suppliers, and track responses</p>
        </div>
        <Button onClick={() => navigate('/supplier-network/rfqs/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Create RFQ
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tabCounts.issued}</div>
            <p className="text-sm text-muted-foreground">Active RFQs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tabCounts.responses_received}</div>
            <p className="text-sm text-muted-foreground">Awaiting Evaluation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tabCounts.evaluation}</div>
            <p className="text-sm text-muted-foreground">Under Evaluation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tabCounts.awarded}</div>
            <p className="text-sm text-muted-foreground">Awarded This Month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>RFQ List</CardTitle>
              <CardDescription>All request for quotations and their current status</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search RFQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
              <TabsTrigger value="draft">Draft ({tabCounts.draft})</TabsTrigger>
              <TabsTrigger value="issued">Issued ({tabCounts.issued})</TabsTrigger>
              <TabsTrigger value="responses_received">Responses ({tabCounts.responses_received})</TabsTrigger>
              <TabsTrigger value="evaluation">Evaluation ({tabCounts.evaluation})</TabsTrigger>
              <TabsTrigger value="awarded">Awarded ({tabCounts.awarded})</TabsTrigger>
              <TabsTrigger value="closed">Closed ({tabCounts.closed})</TabsTrigger>
            </TabsList>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RFQ Number</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Suppliers</TableHead>
                    <TableHead>Responses</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading RFQs...
                      </TableCell>
                    </TableRow>
                  ) : filteredRFQs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No RFQs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRFQs.map((rfq) => (
                      <TableRow key={rfq.id}>
                        <TableCell className="font-mono font-medium">{rfq.rfq_number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{rfq.title}</TableCell>
                        <TableCell>{rfq.supplier_categories?.name || '-'}</TableCell>
                        <TableCell>{rfq.base_currency}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {rfq.distributions_count}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {rfq.responses_count}/{rfq.distributions_count}
                          </div>
                        </TableCell>
                        <TableCell>{getDaysUntilDeadline(rfq.deadline_date)}</TableCell>
                        <TableCell>{getStatusBadge(rfq.status)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedRFQ(rfq); setViewDialogOpen(true); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {rfq.status === 'draft' && (
                                <>
                                  <DropdownMenuItem onClick={() => { setSelectedRFQ(rfq); setDistributeDialogOpen(true); }}>
                                    <Send className="mr-2 h-4 w-4" />
                                    Distribute to Suppliers
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: rfq.id, status: 'issued' })}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Issue RFQ
                                  </DropdownMenuItem>
                                </>
                              )}
                              {rfq.status === 'issued' && rfq.responses_count > 0 && (
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: rfq.id, status: 'responses_received' })}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Mark Responses Received
                                </DropdownMenuItem>
                              )}
                              {rfq.status === 'responses_received' && (
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: rfq.id, status: 'evaluation' })}>
                                  <BarChart3 className="mr-2 h-4 w-4" />
                                  Start Evaluation
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={async () => {
                                const { data: items } = await supabaseClient.from('rfq_items').select('*').eq('rfq_id', rfq.id).order('sort_order');
                                exportRFQToExcel(rfq, (items || []).map(i => ({ ...i, specifications: i.specifications as Record<string, string> | null })));
                              }}>
                                <Download className="mr-2 h-4 w-4" />
                                Export Excel
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                const { data: items } = await supabaseClient.from('rfq_items').select('*').eq('rfq_id', rfq.id).order('sort_order');
                                exportRFQToPDF(rfq, (items || []).map(i => ({ ...i, specifications: i.specifications as Record<string, string> | null })));
                              }}>
                                <Download className="mr-2 h-4 w-4" />
                                Export PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedRFQ(rfq); setImportDialogOpen(true); }}>
                                <Upload className="mr-2 h-4 w-4" />
                                Import Vendor Response
                              </DropdownMenuItem>
                              {rfq.responses_count > 0 && (
                                <DropdownMenuItem onClick={() => navigate(`/supplier-network/rfqs/${rfq.id}/compare`)}>
                                  <GitCompare className="mr-2 h-4 w-4" />
                                  Compare Vendors
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {rfq.status !== 'closed' && rfq.status !== 'cancelled' && (
                                <>
                                  <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: rfq.id, status: 'closed' })}>
                                    <Clock className="mr-2 h-4 w-4" />
                                    Close RFQ
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: rfq.id, status: 'cancelled' })} className="text-destructive">
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel RFQ
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {selectedRFQ && (
        <>
          <ViewRFQDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen} rfq={selectedRFQ} />
          <DistributeRFQDialog open={distributeDialogOpen} onOpenChange={setDistributeDialogOpen} rfq={selectedRFQ} />
          <ImportVendorResponseDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} rfqId={selectedRFQ.id} />
        </>
      )}
    </div>
  );
}
