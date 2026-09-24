import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { PackageCheck, ShieldAlert, Truck, ClipboardList, Plus, Search, Boxes } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import {
  PendingPO,
  ReleaseOrderRow,
  useHeldStock,
  useOrdersForRelease,
  usePendingReceipts,
  useQCReceipts,
  useResolveHeldStock,
} from '@/hooks/useQC';
import { useInventory } from '@/hooks/useInventory';
import { ReceiveMaterialDialog } from '@/components/qc/ReceiveMaterialDialog';
import { DirectReceiptDialog } from '@/components/qc/DirectReceiptDialog';
import { ReleaseGoodsDialog } from '@/components/qc/ReleaseGoodsDialog';
import { ProductStockDialog } from '@/components/inventory/ProductStockDialog';

export default function QCWorkspace() {
  const { isQC, isAdmin } = useAuth();
  const [selectedPO, setSelectedPO] = useState<PendingPO | null>(null);
  const [directOpen, setDirectOpen] = useState(false);
  const [releaseOrder, setReleaseOrder] = useState<ReleaseOrderRow | null>(null);
  const [heldQty, setHeldQty] = useState<Record<string, string>>({});
  const [poSearch, setPoSearch] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [stockTarget, setStockTarget] = useState<{ id: string; label: string; unit: string | null } | null>(null);

  const { data: pending = [], isLoading: loadingPending, error: pendingError } = usePendingReceipts();
  const { data: held = [], isLoading: loadingHeld } = useHeldStock();
  const { data: awaiting = [], isLoading: loadingAwaiting } = useOrdersForRelease(false);
  const { data: released = [] } = useOrdersForRelease(true);
  const { data: receipts = [] } = useQCReceipts();
  const { data: inventory = [] } = useInventory();
  const resolveHeld = useResolveHeldStock();

  const canAct = isQC || isAdmin;

  const filteredPOs = useMemo(() => {
    const term = poSearch.trim().toLowerCase();
    if (!term) return pending;
    return pending.filter(
      (po) =>
        po.po_number?.toLowerCase().includes(term) || (po.supplier?.name || '').toLowerCase().includes(term),
    );
  }, [pending, poSearch]);

  const filteredStock = useMemo(() => {
    const term = stockSearch.trim().toLowerCase();
    const rows = inventory as any[];
    if (!term) return rows.slice(0, 200);
    return rows
      .filter((r) => (r.product?.name || '').toLowerCase().includes(term) || (r.product?.hsn_code || '').toLowerCase().includes(term))
      .slice(0, 200);
  }, [inventory, stockSearch]);

  if (!canAct) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          This area is for the Quality Control team.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quality Control</h1>
          <p className="text-muted-foreground">Receive material, check it, and release goods to the warehouse</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDirectOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Direct receipt
          </Button>
          <Button variant="outline" asChild>
            <Link to="/stock-ledger">
              <ClipboardList className="h-4 w-4 mr-2" />
              Stock ledger
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting receipt</CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pending.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Held material</CardTitle>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{held.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting release</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{awaiting.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="receive">
        <TabsList>
          <TabsTrigger value="receive">Receive material</TabsTrigger>
          <TabsTrigger value="held">Held material</TabsTrigger>
          <TabsTrigger value="release">Release for dispatch</TabsTrigger>
          <TabsTrigger value="stock">Warehouse stock</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="receive" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search purchase order or supplier…"
              value={poSearch}
              onChange={(e) => setPoSearch(e.target.value)}
            />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase order</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Pending items</TableHead>
                    <TableHead>Pending quantity</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPending && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                    </TableRow>
                  )}
                  {!loadingPending && pendingError && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-destructive">
                        Could not load pending deliveries: {(pendingError as Error).message}
                      </TableCell>
                    </TableRow>
                  )}
                  {!loadingPending && !pendingError && filteredPOs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nothing waiting to be received. Use “Direct receipt” for material without a purchase order.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredPOs.map((po) => {
                    const openLines = (po.items || []).filter(
                      (i) => Number(i.received_quantity || 0) < Number(i.quantity || 0),
                    );
                    const pendingQty = openLines.reduce(
                      (s, i) => s + (Number(i.quantity || 0) - Number(i.received_quantity || 0)),
                      0,
                    );
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{po.po_number}</TableCell>
                        <TableCell>{po.supplier?.name || '—'}</TableCell>
                        <TableCell>
                          {po.expected_delivery ? format(new Date(po.expected_delivery), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>{openLines.length}</TableCell>
                        <TableCell>{pendingQty}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => setSelectedPO(po)}>
                            Receive &amp; check
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="held" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Held</TableHead>
                    <TableHead>Since</TableHead>
                    <TableHead className="w-64 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingHeld && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                    </TableRow>
                  )}
                  {!loadingHeld && held.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No material is being held.
                      </TableCell>
                    </TableRow>
                  )}
                  {held.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.product?.model_number || row.product?.name}</TableCell>
                      <TableCell>{row.office?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-amber-400 text-amber-600">
                          {row.held_quantity} {row.product?.unit || ''}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(row.updated_at), 'dd MMM yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Input
                            className="w-20"
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={heldQty[row.id] ?? String(row.held_quantity)}
                            onChange={(e) => setHeldQty((p) => ({ ...p, [row.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            disabled={resolveHeld.isPending}
                            onClick={() =>
                              resolveHeld.mutate({
                                inventory_id: row.id,
                                product_id: row.product_id,
                                office_id: row.office_id,
                                quantity: Number(heldQty[row.id] ?? row.held_quantity),
                                action: 'release',
                              })
                            }
                          >
                            Into stock
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resolveHeld.isPending}
                            onClick={() =>
                              resolveHeld.mutate({
                                inventory_id: row.id,
                                product_id: row.product_id,
                                office_id: row.office_id,
                                quantity: Number(heldQty[row.id] ?? row.held_quantity),
                                action: 'writeoff',
                              })
                            }
                          >
                            Write off
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="release" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Waiting for your release</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAwaiting && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                    </TableRow>
                  )}
                  {!loadingAwaiting && awaiting.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No orders are waiting for release.
                      </TableCell>
                    </TableRow>
                  )}
                  {awaiting.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link className="hover:underline" to={`/orders/${order.id}`}>
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>{order.customer?.company_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.status.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => setReleaseOrder(order)}>
                          Release goods
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recently released</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Released on</TableHead>
                    <TableHead>Released by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {released.slice(0, 15).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>
                        {order.qc_released_at ? format(new Date(order.qc_released_at), 'dd MMM yyyy HH:mm') : '—'}
                      </TableCell>
                      <TableCell>{order.releaser?.full_name || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {released.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                        Nothing released yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search item…"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
            />
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Sellable</TableHead>
                    <TableHead>Held</TableHead>
                    <TableHead>Last restocked</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStock.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No stock lines found.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredStock.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        <Link className="hover:underline" to={`/products/${row.product_id}`}>
                          {row.product?.name || 'Item'}
                        </Link>
                      </TableCell>
                      <TableCell>{row.office?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={Number(row.quantity) > 0 ? 'secondary' : 'outline'}>
                          {row.quantity} {row.product?.unit || ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {Number(row.held_quantity || 0) > 0 ? (
                          <Badge variant="outline" className="border-amber-400 text-amber-600">
                            {row.held_quantity}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {row.last_restocked_at ? format(new Date(row.last_restocked_at), 'dd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setStockTarget({
                              id: row.product_id,
                              label: row.product?.name || 'Item',
                              unit: row.product?.unit ?? null,
                            })
                          }
                        >
                          <Boxes className="h-4 w-4 mr-1" />
                          Adjust
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Purchase order</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Passed</TableHead>
                    <TableHead>Held</TableHead>
                    <TableHead>Checked by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No receipts recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {receipts.map((r) => {
                    const passed = (r.items || []).reduce((s, i) => s + Number(i.accepted_quantity || 0), 0);
                    const heldQ = (r.items || []).reduce((s, i) => s + Number(i.rejected_quantity || 0), 0);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.grn_number}</TableCell>
                        <TableCell>{r.po?.po_number || '—'}</TableCell>
                        <TableCell>{r.supplier?.name || '—'}</TableCell>
                        <TableCell>{r.received_date ? format(new Date(r.received_date), 'dd MMM yyyy') : '—'}</TableCell>
                        <TableCell>{passed}</TableCell>
                        <TableCell>
                          {heldQ > 0 ? (
                            <Badge variant="outline" className="border-amber-400 text-amber-600">{heldQ}</Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>{r.checker?.full_name || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReceiveMaterialDialog po={selectedPO} open={!!selectedPO} onOpenChange={(open) => !open && setSelectedPO(null)} />
      <DirectReceiptDialog open={directOpen} onOpenChange={setDirectOpen} />
      <ReleaseGoodsDialog
        order={releaseOrder}
        open={!!releaseOrder}
        onOpenChange={(open) => !open && setReleaseOrder(null)}
      />
      {stockTarget && (
        <ProductStockDialog
          open={!!stockTarget}
          onOpenChange={(open) => !open && setStockTarget(null)}
          productId={stockTarget.id}
          productLabel={stockTarget.label}
          unit={stockTarget.unit}
        />
      )}
    </div>
  );
}
