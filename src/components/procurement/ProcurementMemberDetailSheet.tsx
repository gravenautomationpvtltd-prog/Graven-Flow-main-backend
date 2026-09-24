import { useState } from 'react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle, 
  Package, 
  FileText, 
  Truck, 
  User,
  ChevronDown,
  ChevronRight,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { useProcurementMemberDetail, PurchaseOrderDetail, GrnDetail } from '@/hooks/useProcurementMemberDetail';
import { ProcurementUserStats } from '@/hooks/useProcurementPerformance';

interface ProcurementMemberDetailSheetProps {
  userId: string | null;
  userName: string | null;
  stats: ProcurementUserStats | null;
  startDate: string;
  endDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProcurementMemberDetailSheet({
  userId,
  userName,
  stats,
  startDate,
  endDate,
  open,
  onOpenChange,
}: ProcurementMemberDetailSheetProps) {
  const { data: details, isLoading } = useProcurementMemberDetail(userId, startDate, endDate);
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [expandedGRNs, setExpandedGRNs] = useState<Set<string>>(new Set());

  const togglePO = (poId: string) => {
    setExpandedPOs(prev => {
      const next = new Set(prev);
      if (next.has(poId)) {
        next.delete(poId);
      } else {
        next.add(poId);
      }
      return next;
    });
  };

  const toggleGRN = (grnId: string) => {
    setExpandedGRNs(prev => {
      const next = new Set(prev);
      if (next.has(grnId)) {
        next.delete(grnId);
      } else {
        next.add(grnId);
      }
      return next;
    });
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const formatTime = (hours: number | null) => {
    if (hours === null) return '-';
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
  };

  const getTimeColor = (hours: number | null) => {
    if (hours === null) return 'text-muted-foreground';
    if (hours < 24) return 'text-green-600';
    if (hours < 48) return 'text-amber-600';
    return 'text-red-600';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'MMM dd, yyyy');
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'MMM dd, HH:mm');
  };

  const getPriceMargin = (resolved: number | null, target: number | null) => {
    if (!resolved || !target || target === 0) return null;
    return ((target - resolved) / target) * 100;
  };

  const getMarginDisplay = (margin: number | null) => {
    if (margin === null) return { icon: Minus, color: 'text-muted-foreground', text: '-' };
    if (margin > 0) return { icon: TrendingDown, color: 'text-green-600', text: `${margin.toFixed(1)}% below` };
    if (margin < 0) return { icon: TrendingUp, color: 'text-red-600', text: `${Math.abs(margin).toFixed(1)}% above` };
    return { icon: Minus, color: 'text-muted-foreground', text: 'On target' };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-hidden flex flex-col">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-xl">{userName || 'Team Member'}</SheetTitle>
              <SheetDescription>Procurement Performance Details</SheetDescription>
            </div>
          </div>
          
          {stats && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="text-center p-2 rounded-md bg-muted">
                <p className="text-lg font-bold">{stats.priceResolutions}</p>
                <p className="text-xs text-muted-foreground">Prices</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted">
                <p className="text-lg font-bold">{stats.productsUpdated}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted">
                <p className="text-lg font-bold">{stats.posCreated}</p>
                <p className="text-xs text-muted-foreground">POs</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted">
                <p className="text-lg font-bold">{stats.grnsProcessed}</p>
                <p className="text-xs text-muted-foreground">GRNs</p>
              </div>
            </div>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="prices" className="flex-1 flex flex-col overflow-hidden mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="prices" className="text-xs sm:text-sm">
                <CheckCircle className="h-3 w-3 mr-1 hidden sm:inline" />
                Prices ({details?.priceResolutions.length || 0})
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs sm:text-sm">
                <Package className="h-3 w-3 mr-1 hidden sm:inline" />
                Products ({details?.products.length || 0})
              </TabsTrigger>
              <TabsTrigger value="pos" className="text-xs sm:text-sm">
                <FileText className="h-3 w-3 mr-1 hidden sm:inline" />
                POs ({details?.purchaseOrders.length || 0})
              </TabsTrigger>
              <TabsTrigger value="grns" className="text-xs sm:text-sm">
                <Truck className="h-3 w-3 mr-1 hidden sm:inline" />
                GRNs ({details?.grns.length || 0})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              {/* Price Resolutions Tab */}
              <TabsContent value="prices" className="mt-0">
                {details?.priceResolutions.length === 0 ? (
                  <EmptyState icon={CheckCircle} text="No price resolutions this period" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">Resolved</TableHead>
                        <TableHead className="text-center">Margin</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details?.priceResolutions.map((pr) => {
                        const margin = getPriceMargin(pr.resolvedPrice, pr.targetRate);
                        const marginDisplay = getMarginDisplay(margin);
                        const MarginIcon = marginDisplay.icon;
                        
                        return (
                          <TableRow key={pr.id}>
                            <TableCell className="font-medium">
                              <div>
                                <p className="truncate max-w-[120px]">{pr.productName || 'N/A'}</p>
                                {pr.productSku && (
                                  <p className="text-xs text-muted-foreground">{pr.productSku}</p>
                                )}
                                {pr.supplierName && (
                                  <p className="text-xs text-blue-600">{pr.supplierName}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="truncate max-w-[100px] text-sm">
                                {pr.leadTitle || 'N/A'}
                              </p>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {pr.quantity || '-'}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {pr.targetRate ? formatCurrency(pr.targetRate) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {pr.resolvedPrice ? formatCurrency(pr.resolvedPrice) : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className={`flex items-center justify-center gap-1 ${
                                margin !== null && margin > 0 ? 'text-green-600 dark:text-green-400' :
                                margin !== null && margin < 0 ? 'text-destructive' :
                                'text-muted-foreground'
                              }`}>
                                <MarginIcon className="h-3 w-3" />
                                <span className="text-xs">{marginDisplay.text}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={getTimeColor(pr.resolutionTimeHours)}>
                                {formatTime(pr.resolutionTimeHours)}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Products Tab */}
              <TabsContent value="products" className="mt-0">
                {details?.products.length === 0 ? (
                  <EmptyState icon={Package} text="No products updated this period" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Sale Price</TableHead>
                        <TableHead className="text-right">Purchase</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details?.products.map((prod) => (
                        <TableRow key={prod.id}>
                          <TableCell className="font-medium">
                            <div>
                              <p className="truncate max-w-[150px]">{prod.name}</p>
                              {prod.sku && (
                                <p className="text-xs text-muted-foreground">{prod.sku}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {prod.defaultRate ? formatCurrency(prod.defaultRate) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {prod.purchasePrice ? formatCurrency(prod.purchasePrice) : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(prod.updatedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Purchase Orders Tab with Expandable Items */}
              <TabsContent value="pos" className="mt-0">
                {details?.purchaseOrders.length === 0 ? (
                  <EmptyState icon={FileText} text="No purchase orders this period" />
                ) : (
                  <div className="space-y-2">
                    {details?.purchaseOrders.map((po) => (
                      <POExpandableRow 
                        key={po.id} 
                        po={po} 
                        expanded={expandedPOs.has(po.id)}
                        onToggle={() => togglePO(po.id)}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* GRNs Tab with Expandable Items */}
              <TabsContent value="grns" className="mt-0">
                {details?.grns.length === 0 ? (
                  <EmptyState icon={Truck} text="No GRNs processed this period" />
                ) : (
                  <div className="space-y-2">
                    {details?.grns.map((grn) => (
                      <GRNExpandableRow 
                        key={grn.id} 
                        grn={grn} 
                        expanded={expandedGRNs.has(grn.id)}
                        onToggle={() => toggleGRN(grn.id)}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function POExpandableRow({ 
  po, 
  expanded, 
  onToggle,
  formatCurrency,
  formatDate 
}: { 
  po: PurchaseOrderDetail; 
  expanded: boolean;
  onToggle: () => void;
  formatCurrency: (v: number) => string;
  formatDate: (d: string | null) => string;
}) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{po.poNumber}</p>
                <p className="text-xs text-muted-foreground">{po.supplierName || 'No supplier'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{formatCurrency(po.grandTotal)}</p>
                <p className="text-xs text-muted-foreground">{po.itemCount} items</p>
              </div>
              {po.expectedDelivery && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Due: {formatDate(po.expectedDelivery)}</span>
                </div>
              )}
              <Badge variant={
                po.status === 'completed' ? 'default' :
                po.status === 'pending' ? 'secondary' :
                'outline'
              }>
                {po.status}
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-3">
            <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
              <span>Order Date: {formatDate(po.orderDate || po.createdAt)}</span>
              {po.supplierPhone && <span>Phone: {po.supplierPhone}</span>}
              {po.supplierContact && <span>Contact: {po.supplierContact}</span>}
            </div>
            {po.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[180px]">{item.productName || 'N/A'}</p>
                          {item.productSku && (
                            <p className="text-xs text-muted-foreground">{item.productSku}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right">
                        {item.taxPercent ? `${item.taxPercent}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
            )}
            {po.notes && (
              <div className="mt-3 p-2 bg-muted rounded text-sm">
                <span className="font-medium">Notes:</span> {po.notes}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function GRNExpandableRow({ 
  grn, 
  expanded, 
  onToggle,
  formatDate 
}: { 
  grn: GrnDetail; 
  expanded: boolean;
  onToggle: () => void;
  formatDate: (d: string | null) => string;
}) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{grn.grnNumber}</p>
                <p className="text-xs text-muted-foreground">PO: {grn.poNumber || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm">{grn.itemCount} items received</p>
                <p className="text-xs text-muted-foreground">{formatDate(grn.receivedDate)}</p>
              </div>
              <Badge variant={
                grn.status === 'completed' ? 'default' :
                grn.status === 'partial' ? 'secondary' :
                'outline'
              }>
                {grn.status}
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-3">
            {grn.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Accepted</TableHead>
                    <TableHead className="text-right">Rejected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grn.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[180px]">{item.productName || 'N/A'}</p>
                          {item.productSku && (
                            <p className="text-xs text-muted-foreground">{item.productSku}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.orderedQuantity}</TableCell>
                      <TableCell className="text-right">{item.receivedQuantity}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">{item.acceptedQuantity}</TableCell>
                      <TableCell className="text-right">
                        {item.rejectedQuantity > 0 ? (
                          <span className="text-destructive">{item.rejectedQuantity}</span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No items found</p>
            )}
            {grn.notes && (
              <div className="mt-3 p-2 bg-muted rounded text-sm">
                <span className="font-medium">Notes:</span> {grn.notes}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-12 w-12 mb-3 opacity-30" />
      <p>{text}</p>
    </div>
  );
}
