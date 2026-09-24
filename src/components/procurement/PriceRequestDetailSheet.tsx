import { useState } from 'react';
import { SupplierPicker } from '@/components/procurement/SupplierPicker';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Trash2, Plus, Target, XCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  usePriceQuotes,
  usePriceRounds,
  useAddPriceQuote,
  useDeletePriceQuote,
  usePushQuoteToSales,
  useRequestRevision,
  useRespondToRound,
  useSetSalesOutcome,
} from '@/hooks/usePriceRequestQuotes';
import type { QueueRow } from '@/hooks/usePriceRequestQueue';
import { useCanSeeCustomerName, useIsProcurementOnly, useCanViewSupplierQuotes, requestRef } from '@/lib/procurement-privacy';

interface Props {
  request: QueueRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}

const inr = (n?: number | null) =>
  n == null ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

export function PriceRequestDetailSheet({ request, open, onOpenChange, onChanged }: Props) {
  const navigate = useNavigate();
  const canSeeCustomer = useCanSeeCustomerName();
  const isProcurementOnly = useIsProcurementOnly();
  const canViewQuotes = useCanViewSupplierQuotes();
  const { data: quotes = [], isLoading: quotesLoading } = usePriceQuotes(request?.id);
  const { data: rounds = [] } = usePriceRounds(request?.id);
  const addQuote = useAddPriceQuote();
  const delQuote = useDeletePriceQuote();
  const pushQuote = usePushQuoteToSales();
  const requestRevision = useRequestRevision();
  const respondRound = useRespondToRound();
  const setOutcome = useSetSalesOutcome();

  const [supplierName, setSupplierName] = useState('');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [targetAsk, setTargetAsk] = useState('');

  if (!request) return null;

  const resetForm = () => {
    setSupplierName('');
    setSupplierId(null);
    setPurchasePrice('');
    setSalePrice('');
    setLeadTime('');
    setValidUntil('');
    setNotes('');
  };

  const handleAddQuote = async () => {
    const pp = Number(purchasePrice);
    if (!pp || pp <= 0) {
      toast.error('Enter a valid purchase price');
      return;
    }
    await addQuote.mutateAsync({
      price_request_id: request.id,
      round: request.current_round || 1,
      supplier_id: supplierId,
      supplier_name: supplierName || null,
      purchase_price: pp,
      sale_price: salePrice ? Number(salePrice) : null,
      lead_time_days: leadTime ? Number(leadTime) : null,
      valid_until: validUntil || null,
      notes: notes || null,
    });
    resetForm();
    onChanged?.();
  };

  const markNoPrice = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('price_requests')
      .update({
        status: 'no_price',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id ?? null,
      })
      .eq('id', request.id);
    if (error) {
      toast.error('Failed: ' + error.message);
      return;
    }
    toast.success('Marked as no price available');
    onChanged?.();
    onOpenChange(false);
  };

  const openRound = rounds.find((r) => r.outcome === 'open');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8">{request.product_text}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className={canSeeCustomer ? '' : 'font-mono text-muted-foreground'}>
              {canSeeCustomer ? request.customer_name : requestRef(request.id)}
            </span>
            {request.quantity != null && <Badge variant="outline">Qty {request.quantity}</Badge>}
            <Badge variant="outline">Round {request.current_round || 1}</Badge>
            {request.target_rate != null && (
              <Badge variant="secondary">Target {inr(request.target_rate)}</Badge>
            )}
            {request.target_matched_at && (
              <Badge className="bg-green-500/10 text-green-600 border-green-200">
                <Target className="h-3 w-3 mr-1" /> Target matched
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          {request.lead_id && canSeeCustomer && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/leads/${request.lead_id}`)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open lead
            </Button>
          )}
          {request.status !== 'no_price' && (
            <Button variant="outline" size="sm" onClick={markNoPrice}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> No price available
            </Button>
          )}
        </div>

        {canViewQuotes && <Separator className="my-4" />}

        {/* Add quote */}
        {canViewQuotes && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">
            Add supplier quote{' '}
            <span className="text-xs font-normal text-muted-foreground">
              · procurement only, sales never sees this list
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Supplier</Label>
              <SupplierPicker
                value={{ supplierId, supplierName }}
                onChange={(v) => {
                  setSupplierId(v.supplierId);
                  setSupplierName(v.supplierName);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Purchase price (₹)</Label>
              <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sale price to customer (₹)</Label>
              <Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lead time (days)</Label>
              <Input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valid until</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={handleAddQuote} disabled={addQuote.isPending}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Save quote
          </Button>
        </div>
        )}

        {canViewQuotes && <Separator className="my-4" />}

        {/* Quote list */}
        {canViewQuotes && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Quotes ({quotes.length})</h3>
          {quotesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quotes recorded yet.</p>
          ) : (
            quotes.map((q) => (
              <Card key={q.id} className={q.is_pushed ? 'border-primary' : ''}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{q.supplier_name || 'Supplier'}</p>
                      <p className="text-xs text-muted-foreground">
                        Buy {inr(q.purchase_price)} · Sell {inr(q.sale_price)} · Round {q.round}
                        {q.lead_time_days ? ` · ${q.lead_time_days}d` : ''}
                        {q.valid_until ? ` · valid till ${format(new Date(q.valid_until), 'dd MMM yy')}` : ''}
                      </p>
                      {q.notes && <p className="text-xs mt-1">{q.notes}</p>}
                    </div>
                    {q.is_pushed && <Badge>Pushed to sales</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={q.is_pushed ? 'outline' : 'default'}
                      disabled={pushQuote.isPending}
                      onClick={async () => {
                        await pushQuote.mutateAsync({
                          quote: q,
                          request: {
                            id: request.id,
                            lead_id: request.lead_id,
                            enquiry_item_id: request.enquiry_item_id,
                            requested_by: request.requested_by,
                            target_rate: request.target_rate,
                            product_text: request.product_text,
                          },
                        });
                        onChanged?.();
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" /> Push to sales
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => delQuote.mutate({ id: q.id, priceRequestId: request.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        )}

        <Separator className="my-4" />

        {/* Negotiation */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Negotiation rounds</h3>
          {rounds.length === 0 && (
            <p className="text-sm text-muted-foreground">No revision requested yet.</p>
          )}
          {rounds.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Round {r.round}</span>
                  <Badge variant={r.outcome === 'open' ? 'secondary' : 'outline'}>{r.outcome}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Target asked {inr(r.target_price)}
                  {r.revised_price != null && ` · revised to ${inr(r.revised_price)}`}
                  {` · ${format(new Date(r.requested_at), 'dd MMM yy')}`}
                </p>
                {r.notes && <p className="text-xs">{r.notes}</p>}
                {r.sales_decision && (
                  <p className="text-xs">
                    <Badge
                      variant="outline"
                      className={
                        r.sales_decision === 'accepted'
                          ? 'bg-green-500/10 text-green-600 border-green-200'
                          : 'bg-destructive/10 text-destructive border-destructive/20'
                      }
                    >
                      Sales {r.sales_decision}
                    </Badge>
                    {r.sales_decision_notes && (
                      <span className="ml-2 text-muted-foreground">“{r.sales_decision_notes}”</span>
                    )}
                  </p>
                )}
                {r.outcome === 'open' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        respondRound.mutate({
                          roundId: r.id,
                          priceRequestId: request.id,
                          declined: true,
                        })
                      }
                    >
                      Can't match
                    </Button>
                    <span className="text-xs text-muted-foreground self-center">
                      Add a new quote above, then push it to answer this round.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {!openRound && !isProcurementOnly && (
            <div className="flex items-end gap-2">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">Ask procurement for a better price (₹)</Label>
                <Input type="number" value={targetAsk} onChange={(e) => setTargetAsk(e.target.value)} />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!targetAsk || requestRevision.isPending}
                onClick={async () => {
                  await requestRevision.mutateAsync({
                    request: {
                      id: request.id,
                      current_round: request.current_round,
                      last_priced_by: request.last_priced_by,
                    },
                    targetPrice: Number(targetAsk),
                  });
                  setTargetAsk('');
                  onChanged?.();
                }}
              >
                Request revision
              </Button>
            </div>
          )}
        </div>

        {request.target_matched_at && (
          <>
            <Separator className="my-4" />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Sales outcome</h3>
              <div className="flex flex-wrap gap-2">
                {['quoted', 'won', 'lost', 'on_hold'].map((o) => (
                  <Button
                    key={o}
                    size="sm"
                    variant={request.sales_outcome === o ? 'default' : 'outline'}
                    onClick={() => setOutcome.mutate({ id: request.id, outcome: o })}
                  >
                    {o.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
