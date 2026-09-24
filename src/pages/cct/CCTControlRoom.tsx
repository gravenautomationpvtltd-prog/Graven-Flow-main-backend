import { useMemo, useState, useEffect } from 'react';
import { useCCTDecisions, type CCTDecision, type SourcingType, type CCTPriority, useUpdateCCTDecision, useHandoffCCTDecision } from '@/hooks/useCCTDecisions';
import { useCCTOrderInbox, type CCTOrderGroup } from '@/hooks/useCCTOrderInbox';
import { useCCTOrderDetail } from '@/hooks/useCCTOrderDetail';
import { useAllCCTStages, STAGE_LABEL, STAGE_ORDER, useAddCCTStage, type CCTStageName } from '@/hooks/useCCTStages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Inbox, Sliders, Layers, AlertTriangle, TrendingUp, Lock, Send, FileText, ExternalLink, History } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CCTDateRangeFilter, resolveCCTRange, type CCTRange } from '@/components/cct/CCTDateRangeFilter';
import { CustomerLedgerDialog } from '@/components/cct/CustomerLedgerDialog';

function payBadgeVariant(s: 'unpaid' | 'partial' | 'paid'): 'default' | 'secondary' | 'destructive' {
  if (s === 'paid') return 'default';
  if (s === 'partial') return 'secondary';
  return 'destructive';
}

const sourcingOptions: { value: SourcingType; label: string }[] = [
  { value: 'domestic', label: 'Domestic' },
  { value: 'import', label: 'Import' },
  { value: 'hybrid', label: 'Hybrid' },
];

const priorityOptions: { value: CCTPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function priorityVariant(p: CCTPriority) {
  if (p === 'urgent') return 'destructive';
  if (p === 'high') return 'default';
  return 'secondary';
}

function fmtINR(n: number | null | undefined) {
  if (n === null || n === undefined) return '—';
  return `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;
}

// ---- Order-level Decide Dialog ----
interface RowState {
  id: string;
  target_price: string;
  sourcing_type: SourcingType;
}

function OrderDecideDialog({
  salesOrderId,
  onClose,
}: {
  salesOrderId: string | null;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useCCTOrderDetail(salesOrderId);
  const update = useUpdateCCTDecision();
  const handoff = useHandoffCCTDecision();

  const [rows, setRows] = useState<RowState[]>([]);
  const [priority, setPriority] = useState<CCTPriority>('normal');
  const [timeline, setTimeline] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!detail?.decisions) return;
    setRows(
      detail.decisions.map((d) => ({
        id: d.id,
        target_price: d.target_price?.toString() ?? '',
        sourcing_type: (d.sourcing_type as SourcingType) ?? 'domestic',
      }))
    );
    const first = detail.decisions[0];
    if (first) {
      setPriority((first.priority as CCTPriority) ?? 'normal');
      setTimeline(first.timeline_date ?? '');
      setNotes(first.notes ?? '');
    }
  }, [detail]);

  if (!salesOrderId) return null;

  const order = detail?.order;
  const customer = detail?.customer;
  const received = (detail?.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const orderValue = Number(order?.order_value || 0);
  const pending = Math.max(0, orderValue - received);

  const customerPO = (detail?.documents || []).find((d) => d.document_type === 'customer_po');

  const allReady = rows.length > 0 && rows.every((r) => parseFloat(r.target_price) > 0 && r.sourcing_type);

  const setRow = (idx: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const save = async (forward: boolean) => {
    setSubmitting(true);
    try {
      for (const r of rows) {
        const tp = parseFloat(r.target_price) || null;
        await update.mutateAsync({
          id: r.id,
          target_price: tp,
          sourcing_type: r.sourcing_type,
          assigned_team: r.sourcing_type === 'import' ? 'import_procurement' : 'domestic_procurement',
          priority,
          timeline_date: timeline || null,
          notes: notes || null,
          status: forward ? 'handed_off' : 'decided',
        } as any);
        if (forward) {
          await handoff.mutateAsync(r.id);
        }
      }
      toast.success(forward ? 'Forwarded to Procurement' : 'Draft saved');
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!salesOrderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            CCT Decision — <span className="text-muted-foreground font-normal">{order?.order_number ?? '…'}</span>
          </DialogTitle>
          <DialogDescription>
            Review the customer PO, set per-item target price and route, then forward to procurement.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !detail ? (
          <p className="text-sm text-muted-foreground py-6">Loading order details…</p>
        ) : (
          <div className="space-y-4">
            {/* Customer + Order context */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Customer</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="font-medium">{customer?.company_name ?? '—'}</div>
                  {customer?.contact_person && <div className="text-muted-foreground">{customer.contact_person}</div>}
                  {customer?.gst_number && <div>GST: <span className="font-mono">{customer.gst_number}</span></div>}
                  {customer?.phone && <div>📞 {customer.phone}</div>}
                  {customer?.email && <div>✉️ {customer.email}</div>}
                  {(customer?.address || customer?.city) && (
                    <div className="text-muted-foreground text-xs pt-1">
                      {[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Order & Payment</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span className="font-medium">{order?.order_number}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{order?.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Order Value</span><span className="font-medium">{fmtINR(orderValue)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Received</span><span className="text-green-600 font-medium">{fmtINR(received)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pending</span><span className="text-amber-600 font-medium">{fmtINR(pending)}</span></div>
                  {customerPO && (
                    <a href={customerPO.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline pt-1 text-xs">
                      <FileText className="h-3 w-3" /> {customerPO.file_name} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* PO Items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">PO Line Items — set Target Price & Route per item</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="w-[160px]">Target Price</TableHead>
                      <TableHead className="w-[140px]">Route</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.decisions.map((d, idx) => {
                      const r = rows[idx];
                      if (!r) return null;
                      const qitem = d.order_item_id ? detail.itemsById[d.order_item_id] : null;
                      const qty = Number(d.quantity ?? qitem?.quantity ?? 0);
                      const lineTotal = Number(d.selling_price ?? qitem?.amount ?? 0);
                      const unitPrice = qitem?.rate ? Number(qitem.rate) : (qty > 0 ? lineTotal / qty : lineTotal);
                      const tp = parseFloat(r.target_price) || 0;
                      const margin = lineTotal > 0 && tp > 0 ? ((lineTotal - tp * qty) / lineTotal) * 100 : null;
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="max-w-[260px]">
                            <div className="font-medium break-words">{d.product_description ?? qitem?.description ?? '—'}</div>
                          </TableCell>
                          <TableCell>{d.brand ?? '—'}</TableCell>
                          <TableCell className="text-right">{qty || '—'}</TableCell>
                          <TableCell className="text-right">{fmtINR(unitPrice)}</TableCell>
                          <TableCell className="text-right font-medium">{fmtINR(lineTotal)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={r.target_price}
                              onChange={(e) => setRow(idx, { target_price: e.target.value })}
                              placeholder="Per unit ₹"
                              className="h-8"
                            />
                            {margin !== null && (
                              <div className={`text-[10px] mt-0.5 ${margin > 0 ? 'text-green-600' : 'text-destructive'}`}>
                                Margin {margin.toFixed(1)}%
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select value={r.sourcing_type} onValueChange={(v) => setRow(idx, { sourcing_type: v as SourcingType })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {sourcingOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Order-level fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as CCTPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Timeline</Label>
                <Input type="date" value={timeline} onChange={(e) => setTimeline(e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={() => save(false)} disabled={submitting}>Save Draft</Button>
          <Button onClick={() => save(true)} disabled={submitting || !allReady}>
            <Send className="h-4 w-4 mr-1" /> Forward to Procurement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Add Stage Dialog ----
function AddStageDialog({
  decision,
  onClose,
}: {
  decision: CCTDecision | null;
  onClose: () => void;
}) {
  const addStage = useAddCCTStage();
  const [stage, setStage] = useState<CCTStageName>('in_sourcing');
  const [supplier, setSupplier] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [notes, setNotes] = useState('');

  if (!decision) return null;

  const handleAdd = async () => {
    await addStage.mutateAsync({
      decision_id: decision.id,
      tenant_id: decision.tenant_id,
      stage,
      supplier_name: supplier || null,
      final_price: finalPrice ? parseFloat(finalPrice) : null,
      lead_time_days: leadTime ? parseInt(leadTime, 10) : null,
      notes: notes || null,
    } as any);
    onClose();
  };

  return (
    <Dialog open={!!decision} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Stage Update — {decision.sales_orders?.order_number}</DialogTitle>
          <DialogDescription>Record progress on this order item.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as CCTStageName)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_ORDER.map(s => <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Supplier Name</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Final Price</Label>
              <Input type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} />
            </div>
            <div>
              <Label>Lead Time (days)</Label>
              <Input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={addStage.isPending}>Add Stage</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Page ----
export default function CCTControlRoom() {
  const { isCCT, loading } = useAuth();
  const { data: decisions = [], isLoading: decLoading } = useCCTDecisions();
  
  const { data: allStages = [] } = useAllCCTStages();

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [staging, setStaging] = useState<CCTDecision | null>(null);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);
  const [range, setRange] = useState<CCTRange>({ preset: '30d' });
  const { from, to } = resolveCCTRange(range);
  const { data: orderGroups = [], isLoading: groupsLoading } = useCCTOrderInbox({ from, to });

  const latestStageByDecision = useMemo(() => {
    const map = new Map<string, { stage: CCTStageName; final_price: number | null }>();
    for (const s of allStages) {
      if (!map.has(s.decision_id)) {
        map.set(s.decision_id, { stage: s.stage, final_price: s.final_price });
      }
    }
    return map;
  }, [allStages]);

  const inboxGroups = orderGroups.filter((g) => g.status === 'pending');
  const draftGroups = orderGroups.filter((g) => g.status === 'decided');
  const active = decisions.filter((d) => d.status === 'handed_off');

  const variance = useMemo(() => {
    const items = decisions
      .filter((d) => d.target_price)
      .map((d) => {
        const latest = latestStageByDecision.get(d.id);
        const fp = latest?.final_price;
        if (!fp) return null;
        return {
          decision: d,
          target: d.target_price!,
          final: fp,
          delta: fp - d.target_price!,
          deltaPct: ((fp - d.target_price!) / d.target_price!) * 100,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return items;
  }, [decisions, latestStageByDecision]);

  const exceedingTarget = variance.filter((v) => v.delta > 0);

  if (loading) return null;
  if (!isCCT) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            CCT Control Room
          </h1>
          <p className="text-sm text-muted-foreground">
            Commercial Control between Sales (SPT) and Procurement — sourcing decisions, target prices, and execution tracking.
          </p>
        </div>
        <CCTDateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Inbox className="h-3.5 w-3.5" /> Inbox (Orders)</CardDescription>
            <CardTitle className="text-3xl">{inboxGroups.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Active Items</CardDescription>
            <CardTitle className="text-3xl">{active.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Exceeding Target</CardDescription>
            <CardTitle className="text-3xl text-destructive">{exceedingTarget.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Decisions Made</CardDescription>
            <CardTitle className="text-3xl">{decisions.filter((d) => d.target_price).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox">Inbox ({inboxGroups.length})</TabsTrigger>
          <TabsTrigger value="active">Active Orders ({active.length})</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({exceedingTarget.length})</TabsTrigger>
        </TabsList>

        {/* INBOX */}
        <TabsContent value="inbox">
          <Card>
            <CardHeader>
              <CardTitle>New Confirmed POs awaiting CCT decision</CardTitle>
              <CardDescription>One row per Sales Order. Click Decide to set per-item target price & sourcing route.</CardDescription>
            </CardHeader>
            <CardContent>
              {(decLoading || groupsLoading) ? <p className="text-sm text-muted-foreground">Loading…</p> : inboxGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No new orders. ✓</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Order Value</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead>Order Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inboxGroups.map((g) => (
                      <TableRow key={g.sales_order_id}>
                        <TableCell className="font-medium">{g.order_number}</TableCell>
                        <TableCell>
                          {g.customer_id ? (
                            <button
                              onClick={() => setViewingCustomerId(g.customer_id)}
                              className="text-left hover:underline text-primary inline-flex items-center gap-1"
                            >
                              {g.customer_name}
                              <History className="h-3 w-3 opacity-60" />
                            </button>
                          ) : g.customer_name}
                        </TableCell>
                        <TableCell className="text-right">{fmtINR(g.order_value)}</TableCell>
                        <TableCell className="text-right text-green-600">{fmtINR(g.received)}</TableCell>
                        <TableCell className="text-right text-amber-600">{fmtINR(g.pending)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {(g.order_status || '—').replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={payBadgeVariant(g.payment_status)} className="capitalize text-[10px]">
                            {g.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => setEditingOrderId(g.sales_order_id)}>
                            <Sliders className="h-3.5 w-3.5 mr-1" /> Decide
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {draftGroups.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Drafts (decided but not forwarded)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftGroups.map((g) => (
                      <TableRow key={g.sales_order_id}>
                        <TableCell className="font-medium">{g.order_number}</TableCell>
                        <TableCell>{g.customer_name}</TableCell>
                        <TableCell className="text-right">{g.decisions.length}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setEditingOrderId(g.sales_order_id)}>Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ACTIVE */}
        <TabsContent value="active">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {STAGE_ORDER.map((stage) => {
              const items = active.filter((d) => (latestStageByDecision.get(d.id)?.stage ?? 'assigned') === stage);
              return (
                <Card key={stage} className="min-h-[200px]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{STAGE_LABEL[stage]}</CardTitle>
                    <CardDescription>{items.length}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setStaging(d)}
                        className="w-full text-left p-2 rounded-md border bg-card hover:bg-muted/50 transition text-xs"
                      >
                        <div className="font-medium truncate">{d.sales_orders?.order_number}</div>
                        <div className="text-muted-foreground truncate">{d.sales_orders?.customers?.company_name}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant={priorityVariant(d.priority)} className="text-[10px] px-1">{d.priority}</Badge>
                          <Badge variant="outline" className="text-[10px] px-1">{d.sourcing_type}</Badge>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* PERFORMANCE */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Target vs Final Price</CardTitle>
              <CardDescription>Variance and margin impact for orders with reported final cost.</CardDescription>
            </CardHeader>
            <CardContent>
              {variance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No final prices reported yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Final</TableHead>
                      <TableHead>Δ</TableHead>
                      <TableHead>Δ %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variance.map((v) => (
                      <TableRow key={v.decision.id}>
                        <TableCell className="font-medium">{v.decision.sales_orders?.order_number ?? '—'}</TableCell>
                        <TableCell>{fmtINR(v.target)}</TableCell>
                        <TableCell>{fmtINR(v.final)}</TableCell>
                        <TableCell className={v.delta > 0 ? 'text-destructive' : 'text-green-600'}>
                          {v.delta > 0 ? '+' : ''}{fmtINR(v.delta)}
                        </TableCell>
                        <TableCell className={v.deltaPct > 0 ? 'text-destructive' : 'text-green-600'}>
                          {v.deltaPct > 0 ? '+' : ''}{v.deltaPct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ALERTS */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Orders Exceeding Target Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              {exceedingTarget.length === 0 ? (
                <p className="text-sm text-muted-foreground">All orders are within target. ✓</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Final</TableHead>
                      <TableHead>Overspend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceedingTarget.map((v) => (
                      <TableRow key={v.decision.id}>
                        <TableCell className="font-medium">{v.decision.sales_orders?.order_number ?? '—'}</TableCell>
                        <TableCell>{fmtINR(v.target)}</TableCell>
                        <TableCell>{fmtINR(v.final)}</TableCell>
                        <TableCell className="text-destructive font-medium">+{fmtINR(v.delta)} ({v.deltaPct.toFixed(1)}%)</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <OrderDecideDialog salesOrderId={editingOrderId} onClose={() => setEditingOrderId(null)} />
      <AddStageDialog decision={staging} onClose={() => setStaging(null)} />
      <CustomerLedgerDialog customerId={viewingCustomerId} onClose={() => setViewingCustomerId(null)} />
    </div>
  );
}
