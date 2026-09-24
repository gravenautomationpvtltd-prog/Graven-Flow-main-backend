import { useState } from 'react';
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
import { Search, MoreHorizontal, Plus, Eye, Star, XCircle, MessageSquare, BarChart3, Award } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { SubmitQuotationDialog } from '@/components/supplier-network/SubmitQuotationDialog';
import { ViewQuotationDialog } from '@/components/supplier-network/ViewQuotationDialog';
import { QuotationComparisonPanel } from '@/components/supplier-network/QuotationComparisonPanel';
import { AwardQuotationDialog } from '@/components/supplier-network/AwardQuotationDialog';

type QuotationStatus = 'draft' | 'submitted' | 'under_review' | 'shortlisted' | 'negotiation' | 'accepted' | 'rejected' | 'withdrawn';

interface SupplierQuotation {
  id: string;
  quotation_number: string;
  rfq_id: string;
  supplier_id: string;
  quoted_currency: string;
  fx_rate_to_base: number | null;
  total_original: number;
  total_converted: number | null;
  lead_time_days: number | null;
  validity_days: number | null;
  moq: number | null;
  status: QuotationStatus;
  is_shortlisted: boolean | null;
  submitted_at: string;
  suppliers?: { name: string; country: string | null } | null;
  rfqs?: { rfq_number: string; title: string; base_currency: string } | null;
  [key: string]: unknown;
}

export default function SupplierQuotations() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<SupplierQuotation | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [awardQuotationId, setAwardQuotationId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['supplier-quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_quotations')
        .select(`
          *,
          suppliers(name, country),
          rfqs(rfq_number, title, base_currency)
        `)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data as SupplierQuotation[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, shortlist }: { id: string; status?: QuotationStatus; shortlist?: boolean }) => {
      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (shortlist !== undefined) {
        updateData.is_shortlisted = shortlist;
        if (shortlist) {
          updateData.shortlisted_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('supplier_quotations')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-quotations'] });
      toast.success('Quotation updated');
    },
    onError: () => {
      toast.error('Failed to update quotation');
    },
  });

  const getFilteredQuotations = () => {
    let filtered = quotations;
    
    if (activeTab !== 'all') {
      if (activeTab === 'shortlisted') {
        filtered = filtered.filter(q => q.is_shortlisted);
      } else {
        filtered = filtered.filter(q => q.status === activeTab);
      }
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q => 
        q.quotation_number?.toLowerCase().includes(query) ||
        q.suppliers?.name?.toLowerCase().includes(query) ||
        q.rfqs?.rfq_number?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const getStatusBadge = (status: QuotationStatus, isShortlisted: boolean | null) => {
    if (isShortlisted) {
      return <Badge className="bg-yellow-100 text-yellow-800">Shortlisted</Badge>;
    }
    
    const config: Record<QuotationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Draft', variant: 'secondary' },
      submitted: { label: 'Submitted', variant: 'default' },
      under_review: { label: 'Under Review', variant: 'outline' },
      shortlisted: { label: 'Shortlisted', variant: 'default' },
      negotiation: { label: 'Negotiation', variant: 'outline' },
      accepted: { label: 'Accepted', variant: 'default' },
      rejected: { label: 'Rejected', variant: 'destructive' },
      withdrawn: { label: 'Withdrawn', variant: 'secondary' },
    };
    
    const statusConfig = config[status];
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const filteredQuotations = getFilteredQuotations();

  const tabCounts = {
    all: quotations.length,
    submitted: quotations.filter(q => q.status === 'submitted').length,
    under_review: quotations.filter(q => q.status === 'under_review').length,
    shortlisted: quotations.filter(q => q.is_shortlisted).length,
    negotiation: quotations.filter(q => q.status === 'negotiation').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
    rejected: quotations.filter(q => q.status === 'rejected').length,
  };

  // Get unique RFQs for comparison
  const rfqsWithQuotations = [...new Set(quotations.map(q => q.rfq_id))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supplier Quotations</h1>
          <p className="text-muted-foreground">View and manage quotations received from suppliers</p>
        </div>
        <div className="flex gap-2">
          {rfqsWithQuotations.length > 0 && (
            <Button variant="outline" onClick={() => setComparisonOpen(true)}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Compare Quotations
            </Button>
          )}
          <Button onClick={() => setSubmitDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Enter Quotation
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tabCounts.submitted + tabCounts.under_review}</div>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tabCounts.shortlisted}</div>
            <p className="text-sm text-muted-foreground">Shortlisted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tabCounts.negotiation}</div>
            <p className="text-sm text-muted-foreground">In Negotiation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{tabCounts.accepted}</div>
            <p className="text-sm text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quotations</CardTitle>
              <CardDescription>All supplier quotations received against RFQs</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search quotations..."
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
              <TabsTrigger value="submitted">Submitted ({tabCounts.submitted})</TabsTrigger>
              <TabsTrigger value="under_review">Under Review ({tabCounts.under_review})</TabsTrigger>
              <TabsTrigger value="shortlisted">Shortlisted ({tabCounts.shortlisted})</TabsTrigger>
              <TabsTrigger value="negotiation">Negotiation ({tabCounts.negotiation})</TabsTrigger>
              <TabsTrigger value="accepted">Accepted ({tabCounts.accepted})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({tabCounts.rejected})</TabsTrigger>
            </TabsList>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>RFQ</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Amount (Original)</TableHead>
                    <TableHead>Amount (Base)</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading quotations...
                      </TableCell>
                    </TableRow>
                  ) : filteredQuotations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No quotations found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotations.map((quotation) => (
                      <TableRow key={quotation.id}>
                        <TableCell className="font-mono font-medium">{quotation.quotation_number}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{quotation.rfqs?.rfq_number}</span>
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {quotation.rfqs?.title}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{quotation.suppliers?.name}</span>
                            <span className="text-xs text-muted-foreground">{quotation.suppliers?.country}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(quotation.total_original, quotation.quoted_currency)}</TableCell>
                        <TableCell>
                          {quotation.total_converted ? (
                            <div className="flex flex-col">
                              <span>{formatCurrency(quotation.total_converted, quotation.rfqs?.base_currency || 'INR')}</span>
                              {quotation.fx_rate_to_base && (
                                <span className="text-xs text-muted-foreground">
                                  FX: {quotation.fx_rate_to_base.toFixed(4)}
                                </span>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{quotation.lead_time_days ? `${quotation.lead_time_days} days` : '-'}</TableCell>
                        <TableCell>{quotation.validity_days ? `${quotation.validity_days} days` : '-'}</TableCell>
                        <TableCell>{getStatusBadge(quotation.status, quotation.is_shortlisted)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedQuotation(quotation); setViewDialogOpen(true); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: quotation.id, status: 'under_review' })}>
                                Start Review
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: quotation.id, shortlist: true })}>
                                <Star className="mr-2 h-4 w-4" />
                                Shortlist
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: quotation.id, status: 'negotiation' })}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Start Negotiation
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => {
                                  setAwardQuotationId(quotation.id);
                                  setAwardDialogOpen(true);
                                }}
                                className="text-green-600"
                              >
                                <Award className="mr-2 h-4 w-4" />
                                Award & Create PO
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: quotation.id, status: 'rejected' })}
                                className="text-destructive"
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </DropdownMenuItem>
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

      <SubmitQuotationDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
      />

      {selectedQuotation && (
        <ViewQuotationDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          quotation={selectedQuotation}
        />
      )}

      <QuotationComparisonPanel
        open={comparisonOpen}
        onOpenChange={setComparisonOpen}
      />

      {awardQuotationId && (
        <AwardQuotationDialog
          open={awardDialogOpen}
          onOpenChange={setAwardDialogOpen}
          quotationId={awardQuotationId}
        />
      )}
    </div>
  );
}
