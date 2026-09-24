import { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { POLineItem, POLineItemData } from './POLineItem';
import { CURRENCY_OPTIONS, formatCurrencyAmount, getCurrencySymbol, convertFromINR, type CurrencyCode } from '@/lib/currency-utils';
import { ExchangeRateDialog } from '@/components/ui/exchange-rate-dialog';
import { toast } from 'sonner';

interface POBuilderProps {
  items: POLineItemData[];
  onChange: (items: POLineItemData[]) => void;
  currency: CurrencyCode;
  onCurrencyChange: (currency: CurrencyCode, exchangeRate: number) => void;
  exchangeRate: number;
}

export function POBuilder({ items, onChange, currency, onCurrencyChange, exchangeRate }: POBuilderProps) {
  const [showExchangeRateDialog, setShowExchangeRateDialog] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<CurrencyCode>('INR');
  const addItem = () => {
    const newItem: POLineItemData = {
      id: crypto.randomUUID(),
      product_id: null,
      description: '',
      hsn_code: null,
      quantity: 1,
      rate: 0,
      tax_percent: 18,
      tax_amount: 0,
      amount: 0,
      received_quantity: 0,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof POLineItemData, value: unknown) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Recalculate amounts
    const item = updatedItems[index];
    const itemAmount = item.quantity * item.rate;
    const taxAmount = (itemAmount * item.tax_percent) / 100;
    updatedItems[index].tax_amount = taxAmount;
    updatedItems[index].amount = itemAmount + taxAmount;
    
    onChange(updatedItems);
  };

  const handleProductSelect = (index: number, productId: string | null, product?: { name: string; hsn_code: string | null; default_rate: number | null; tax_rate: number | null }) => {
    const updatedItems = [...items];
    
    if (productId === null) {
      // Custom item - just clear product_id
      updatedItems[index] = { ...updatedItems[index], product_id: null };
    } else if (product) {
      // Use the product data passed from POLineItem
      const rate = product.default_rate || 0;
      const taxPercent = product.tax_rate || 18;
      const quantity = updatedItems[index].quantity;
      const itemAmount = quantity * rate;
      const taxAmount = (itemAmount * taxPercent) / 100;
      
      updatedItems[index] = {
        ...updatedItems[index],
        product_id: productId,
        description: product.name,
        hsn_code: product.hsn_code,
        rate: rate,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        amount: itemAmount + taxAmount,
      };
    }
    
    onChange(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    onChange(updatedItems);
  };

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const totalTax = items.reduce((sum, item) => {
    const itemAmount = item.quantity * item.rate;
    return sum + (itemAmount * item.tax_percent) / 100;
  }, 0);
  const grandTotal = subtotal + totalTax;
  const currencySymbol = getCurrencySymbol(currency);

  // Handle currency change - show dialog for non-INR currencies
  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    if (newCurrency === 'INR') {
      // If switching back to INR, convert rates back
      if (exchangeRate > 1) {
        const updatedItems = items.map(item => {
          const inrRate = item.rate * exchangeRate;
          const itemAmount = item.quantity * inrRate;
          const taxAmount = (itemAmount * item.tax_percent) / 100;
          return {
            ...item,
            rate: inrRate,
            tax_amount: taxAmount,
            amount: itemAmount + taxAmount,
          };
        });
        onChange(updatedItems);
      }
      onCurrencyChange('INR', 1);
    } else {
      setPendingCurrency(newCurrency);
      setShowExchangeRateDialog(true);
    }
  };

  // Apply exchange rate conversion to all items
  const handleExchangeRateConfirm = (rate: number) => {
    onCurrencyChange(pendingCurrency, rate);
    setShowExchangeRateDialog(false);
    
    // Convert all item rates from INR to new currency
    const updatedItems = items.map(item => {
      const convertedRate = convertFromINR(item.rate, rate);
      const itemAmount = item.quantity * convertedRate;
      const taxAmount = (itemAmount * item.tax_percent) / 100;
      return {
        ...item,
        rate: convertedRate,
        tax_amount: taxAmount,
        amount: itemAmount + taxAmount,
      };
    });
    onChange(updatedItems);
    
    toast.success(`Converted to ${pendingCurrency} at rate 1 ${pendingCurrency} = ${rate} INR`);
  };

  const handleExchangeRateCancel = () => {
    setShowExchangeRateDialog(false);
    setPendingCurrency('INR');
  };

  return (
    <div className="space-y-4">
      {/* Currency Selector */}
      <div className="flex justify-end">
        <div className="w-48">
          <Label className="text-xs text-muted-foreground mb-1 block">Currency</Label>
          <Select value={currency} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((cur) => (
                <SelectItem key={cur.code} value={cur.code}>
                  {cur.symbol} {cur.code} - {cur.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currency !== 'INR' && exchangeRate > 1 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span>1 {currency} = {exchangeRate} INR</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1"
                onClick={() => {
                  setPendingCurrency(currency);
                  setShowExchangeRateDialog(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <POLineItem
            key={item.id}
            item={item}
            index={index}
            onChange={updateItem}
            onProductSelect={handleProductSelect}
            onRemove={removeItem}
            canRemove={items.length > 1}
          />
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addItem} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Line Item
      </Button>

      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{currencySymbol}{formatCurrencyAmount(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax:</span>
            <span>{currencySymbol}{formatCurrencyAmount(totalTax, currency)}</span>
          </div>
          <div className="flex justify-between font-semibold text-base border-t pt-2">
            <span>Grand Total:</span>
            <span>{currencySymbol}{formatCurrencyAmount(grandTotal, currency)}</span>
          </div>
        </div>
      </div>

      {/* Exchange Rate Dialog */}
      <ExchangeRateDialog
        open={showExchangeRateDialog}
        onOpenChange={setShowExchangeRateDialog}
        targetCurrency={pendingCurrency}
        currentRate={exchangeRate}
        sampleAmount={subtotal > 0 ? subtotal : 10000}
        onConfirm={handleExchangeRateConfirm}
        onCancel={handleExchangeRateCancel}
      />
    </div>
  );
}
