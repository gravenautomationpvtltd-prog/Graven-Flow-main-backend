import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  FileText,
  Target,
  History,
  Package,
  Edit,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  useProductPriceHistory,
  useProductQuotations,
  useProductNegotiations,
  useDeleteNegotiation,
  type ProductPricingMetrics,
} from '@/hooks/usePricingIntelligence';
import { EditNegotiationDialog } from './EditNegotiationDialog';
import { DoubleConfirmDeleteDialog } from '@/components/ui/double-confirm-delete-dialog';
import { ViewQuotationDialog } from '@/components/quotations/ViewQuotationDialog';
import { useQuotation } from '@/hooks/useQuotations';

interface ProductPricingDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductPricingMetrics | null;
}

export function ProductPricingDetailDialog({
  open,
  onOpenChange,
  product,
}: ProductPricingDetailDialogProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [editingNegotiation, setEditingNegotiation] = useState<any>(null);
  const [deletingNegotiationId, setDeletingNegotiationId] = useState<string | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [viewQuotationOpen, setViewQuotationOpen] = useState(false);

  const { data: priceHistory, isLoading: loadingHistory } = useProductPriceHistory(product?.product_id || null);
  const { data: quotations, isLoading: loadingQuotations } = useProductQuotations(product?.product_id || null);
  const { data: negotiations, isLoading: loadingNegotiations } = useProductNegotiations(product?.product_id || null);
  const deleteNegotiation = useDeleteNegotiation();
  const { data: selectedQuotation } = useQuotation(selectedQuotationId ?? undefined);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'won':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Won</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Lost</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'won':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Won</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Lost</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>;
      default:
        return <Badge variant="outline">{outcome}</Badge>;
    }
  };

  const handleDeleteNegotiation = async () => {
    if (deletingNegotiationId) {
      await deleteNegotiation.mutateAsync(deletingNegotiationId);
      setDeletingNegotiationId(null);
    }
  };

  if (!product) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {product.product_name}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <Target className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="price-history" className="flex items-center gap-1">
                <History className="h-4 w-4" />
                Price History
              </TabsTrigger>
              <TabsTrigger value="quotations" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Quotations
              </TabsTrigger>
              <TabsTrigger value="negotiations" className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Negotiations
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Times Quoted</p>
                  <p className="text-2xl font-bold">{product.times_quoted}</p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <p className="text-sm text-green-600">Times Won</p>
                  <p className="text-2xl font-bold text-green-600">{product.times_won}</p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-lg">
                  <p className="text-sm text-red-600">Times Lost</p>
                  <p className="text-2xl font-bold text-red-600">{product.times_lost}</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-sm text-primary">Win Rate</p>
                  <p className="text-2xl font-bold text-primary">
                    {isNaN(product.win_rate) ? '0' : product.win_rate.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Average Quoted Price</p>
                  <p className="text-xl font-semibold">{formatCurrency(product.avg_initial_price)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-semibold text-green-600">{formatCurrency(product.total_revenue)}</p>
                </div>
              </div>

              {/* Quick stats from negotiations */}
              {negotiations && negotiations.length > 0 && (
                <div className="mt-4 p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Recent Negotiations</h4>
                  <div className="flex gap-4 text-sm">
                    <span>Total: {negotiations.length}</span>
                    <span className="text-green-600">
                      Won: {negotiations.filter(n => n.outcome === 'won').length}
                    </span>
                    <span className="text-red-600">
                      Lost: {negotiations.filter(n => n.outcome === 'lost').length}
                    </span>
                    <span className="text-yellow-600">
                      Pending: {negotiations.filter(n => n.outcome === 'pending').length}
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Price History Tab */}
            <TabsContent value="price-history" className="mt-4">
              <ScrollArea className="h-[400px]">
                {loadingHistory ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : priceHistory && priceHistory.length > 0 ? (
                  <div className="space-y-3">
                    {priceHistory.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 border rounded-lg"
                      >
                        <div className={`p-2 rounded-full ${
                          entry.old_rate && entry.new_rate > entry.old_rate
                            ? 'bg-red-500/10'
                            : 'bg-green-500/10'
                        }`}>
                          {entry.old_rate && entry.new_rate > entry.old_rate ? (
                            <ArrowUpRight className="h-4 w-4 text-red-500" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {entry.old_rate ? formatCurrency(entry.old_rate) : 'N/A'}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{formatCurrency(entry.new_rate)}</span>
                            {entry.old_rate && (
                              <Badge variant="outline" className={
                                entry.new_rate > entry.old_rate
                                  ? 'text-red-500'
                                  : 'text-green-500'
                              }>
                                {entry.new_rate > entry.old_rate ? '+' : ''}
                                {((entry.new_rate - entry.old_rate) / entry.old_rate * 100).toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>{format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}</span>
                            {entry.changed_by_name && (
                              <span> • By {entry.changed_by_name}</span>
                            )}
                            {entry.supplier_name && (
                              <span> • From {entry.supplier_name}</span>
                            )}
                          </div>
                          {entry.change_reason && (
                            <p className="text-sm mt-1">{entry.change_reason}</p>
                          )}
                          <Badge variant="outline" className="mt-1 text-xs">
                            {entry.source}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No price history recorded yet. Price changes will be tracked automatically.
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Quotations Tab */}
            <TabsContent value="quotations" className="mt-4">
              <ScrollArea className="h-[400px]">
                {loadingQuotations ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : quotations && quotations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quotation</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotations.map((q) => (
                        <TableRow 
                          key={q.quotation_id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedQuotationId(q.quotation_id);
                            setViewQuotationOpen(true);
                          }}
                        >
                          <TableCell className="font-medium">{q.quotation_number}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{q.customer_name}</TableCell>
                          <TableCell className="text-right">{q.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(q.rate)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(q.amount)}</TableCell>
                          <TableCell>{getStatusBadge(q.lead_status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {q.created_at ? format(new Date(q.created_at), 'MMM d, yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No quotations found for this product.
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Negotiations Tab */}
            <TabsContent value="negotiations" className="mt-4">
              <ScrollArea className="h-[400px]">
                {loadingNegotiations ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : negotiations && negotiations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Initial</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">Final</TableHead>
                        <TableHead className="text-right">Gap</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {negotiations.map((n) => (
                        <TableRow 
                          key={n.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            if (n.lead_id) {
                              onOpenChange(false);
                              navigate(`/leads/${n.lead_id}`);
                            }
                          }}
                        >
                          <TableCell className="font-medium max-w-[120px] truncate">
                            {n.lead_title}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">{n.customer_name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(n.initial_quoted_rate)}</TableCell>
                          <TableCell className="text-right">
                            {n.target_rate ? formatCurrency(n.target_rate) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {n.final_rate ? formatCurrency(n.final_rate) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {n.price_gap !== null ? (
                              <span className={n.price_gap > 0 ? 'text-red-500' : 'text-green-500'}>
                                {formatCurrency(Math.abs(n.price_gap))}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{getOutcomeBadge(n.outcome)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNegotiation(n);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingNegotiationId(n.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No negotiations recorded for this product.
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Negotiation Dialog */}
      <EditNegotiationDialog
        open={!!editingNegotiation}
        onOpenChange={(open) => !open && setEditingNegotiation(null)}
        negotiation={editingNegotiation}
      />

      {/* Delete Confirmation Dialog */}
      <DoubleConfirmDeleteDialog
        open={!!deletingNegotiationId}
        onOpenChange={(open) => !open && setDeletingNegotiationId(null)}
        onConfirm={handleDeleteNegotiation}
        title="Delete Negotiation Record"
        description="This will permanently delete this negotiation record. This action cannot be undone."
        isLoading={deleteNegotiation.isPending}
      />

      {/* View Quotation Dialog */}
      <ViewQuotationDialog
        open={viewQuotationOpen}
        onOpenChange={setViewQuotationOpen}
        quotation={selectedQuotation || null}
        onEdit={() => {}}
        onSendWhatsApp={() => {}}
        onSendEmail={() => {}}
      />
    </>
  );
}
