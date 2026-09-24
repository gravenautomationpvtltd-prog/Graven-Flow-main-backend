import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface RFQItem {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  target_price: number | null;
  sort_order: number | null;
}

interface VendorQuotation {
  supplierId: string;
  supplierName: string;
  quotationId: string;
  totalAmount: number;
  deliveryDays: number | null;
  itemPrices: Record<string, number>; // rfq_item_id -> unit_price
}

interface Props {
  items: RFQItem[];
  vendors: VendorQuotation[];
  currency: string;
}

export function ComparisonTable({ items, vendors, currency }: Props) {
  if (vendors.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No vendor quotations to compare.</p>;
  }

  const getLowestPriceForItem = (itemId: string) => {
    const prices = vendors.map((v) => v.itemPrices[itemId]).filter((p) => p != null && p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">SR</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="w-16">Qty</TableHead>
            <TableHead className="w-24">Target</TableHead>
            {vendors.map((v) => (
              <TableHead key={v.supplierId} className="w-28 text-center">
                {v.supplierName}
              </TableHead>
            ))}
            <TableHead className="w-24 text-center">Best Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, idx) => {
            const lowest = getLowestPriceForItem(item.id);
            const targetPrice = item.target_price;

            return (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{idx + 1}</TableCell>
                <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                <TableCell>{item.quantity} {item.unit || 'Nos'}</TableCell>
                <TableCell>{targetPrice != null ? `${currency} ${targetPrice.toFixed(2)}` : '-'}</TableCell>
                {vendors.map((v) => {
                  const price = v.itemPrices[item.id];
                  const isLowest = price != null && price === lowest;
                  return (
                    <TableCell
                      key={v.supplierId}
                      className={`text-center ${isLowest ? 'bg-green-500/10 text-green-600 font-semibold' : ''}`}
                    >
                      {price != null ? `${currency} ${price.toFixed(2)}` : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center font-semibold">
                  {lowest != null ? (
                    <span>
                      {currency} {lowest.toFixed(2)}
                      {targetPrice != null && targetPrice > 0 && (
                        <Badge variant={lowest <= targetPrice ? 'default' : 'destructive'} className="ml-1 text-[10px]">
                          {((1 - lowest / targetPrice) * 100).toFixed(1)}%
                        </Badge>
                      )}
                    </span>
                  ) : '-'}
                </TableCell>
              </TableRow>
            );
          })}

          {/* Totals row */}
          <TableRow className="font-bold border-t-2">
            <TableCell colSpan={3}>TOTAL</TableCell>
            <TableCell>
              {currency} {items.reduce((s, i) => s + (i.target_price || 0) * i.quantity, 0).toFixed(2)}
            </TableCell>
            {vendors.map((v) => (
              <TableCell key={v.supplierId} className="text-center">
                {currency} {v.totalAmount.toFixed(2)}
              </TableCell>
            ))}
            <TableCell className="text-center">
              {currency} {Math.min(...vendors.map((v) => v.totalAmount)).toFixed(2)}
            </TableCell>
          </TableRow>

          {/* Delivery row */}
          <TableRow>
            <TableCell colSpan={4} className="font-medium">Delivery (Days)</TableCell>
            {vendors.map((v) => (
              <TableCell key={v.supplierId} className="text-center">
                {v.deliveryDays ?? '-'}
              </TableCell>
            ))}
            <TableCell className="text-center font-semibold">
              {Math.min(...vendors.filter((v) => v.deliveryDays).map((v) => v.deliveryDays!)) || '-'}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
