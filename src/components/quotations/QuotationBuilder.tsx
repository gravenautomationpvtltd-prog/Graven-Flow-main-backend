import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FileText, Send, Download, MessageSquare, Mail, Pencil, Save, Cloud, Loader2 } from 'lucide-react';
import { QuotationLineItem } from './QuotationLineItem';
import { useProducts, useCreateQuotation, useUpdateQuotation, type QuotationItem, type QuotationWithDetails } from '@/hooks/useQuotations';
import { useCreateDraftQuotation, useUpdateDraftQuotation } from '@/hooks/useDraftQuotation';
import { useAuth } from '@/hooks/useAuth';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { CURRENCY_OPTIONS, formatCurrencyWithSymbol, getCurrencySymbol, convertFromINR, type CurrencyCode } from '@/lib/currency-utils';
import { ExchangeRateDialog } from '@/components/ui/exchange-rate-dialog';
import { pickBestDescription } from '@/lib/description-utils';

// Type for items that can be pre-populated from enquiry items
export interface PrePopulatedItem {
  id?: string; // enquiry_item_id for linking
  product_query_text: string;
  quantity: number | null;
  target_rate?: number | null;
  matched_product?: {
    id: string;
    name: string;
    description?: string | null;
    model_number?: string | null;
    default_rate: number | null;
    hsn_code?: string | null;
    unit?: string | null;
    tax_rate?: number | null;
  } | null;
}

interface QuotationBuilderProps {
  leadId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  existingQuotation?: QuotationWithDetails;
  /** Source quotation to copy from (creates a brand-new quotation, source untouched) */
  duplicateSource?: QuotationWithDetails;
  /** Explicit line items to seed with (used when duplicating a subset of a quotation) */
  itemsOverride?: QuotationItem[];
  prePopulatedItems?: PrePopulatedItem[];
  existingDraftId?: string; // ID of an existing draft to continue editing
  onSuccess?: (quotationId: string) => void;
  onCancel?: () => void;
}

const defaultItem: QuotationItem = {
  description: '',
  hsn_code: '',
  quantity: 1,
  unit: 'Nos',
  rate: 0,
  discount_percent: 0,
  discount_amount: 0,
  tax_percent: 18,
  tax_amount: 0,
  amount: 0,
  sort_order: 0,
  lead_time_days: null,
};

// Convert pre-populated enquiry items to quotation line items
function convertEnquiryToQuotationItems(enquiryItems: PrePopulatedItem[]): QuotationItem[] {
  return enquiryItems.map((item, index) => {
    const product = item.matched_product;
    const productDescription = pickBestDescription(
      item.product_query_text,
      product?.description || null,
      product?.model_number || null,
    );
    const baseItem: QuotationItem = {
      description: productDescription || item.product_query_text,
      model_number: product?.model_number || null,
      product_description: productDescription || null,
      hsn_code: product?.hsn_code || '',
      quantity: item.quantity || 1,
      unit: product?.unit || 'Nos',
      rate: product?.default_rate || 0,
      target_rate: item.target_rate || null,
      discount_percent: 0,
      discount_amount: 0,
      tax_percent: product?.tax_rate || 18,
      tax_amount: 0,
      amount: 0,
      sort_order: index,
      product_id: product?.id,
      enquiry_item_id: item.id, // Link back to enquiry item
    };
    
    // Calculate amounts
    const baseAmount = baseItem.quantity * baseItem.rate;
    const discountAmount = (baseAmount * baseItem.discount_percent) / 100;
    const afterDiscount = baseAmount - discountAmount;
    const taxAmount = (afterDiscount * baseItem.tax_percent) / 100;
    
    return {
      ...baseItem,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      amount: afterDiscount + taxAmount,
    };
  });
}

export function QuotationBuilder({
  leadId,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  existingQuotation,
  duplicateSource,
  itemsOverride,
  prePopulatedItems,
  existingDraftId,
  onSuccess,
  onCancel,
}: QuotationBuilderProps) {
  const { user } = useAuth();
  const { data: products = [] } = useProducts();
  const { branding } = useTenantBranding();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const createDraft = useCreateDraftQuotation();
  const updateDraft = useUpdateDraftQuotation();

  const isEditing = !!existingQuotation;
  // Seed source: an edited quotation, or a quotation being duplicated into a new one
  const seed = existingQuotation || duplicateSource;
  const [draftQuotationId, setDraftQuotationId] = useState<string | undefined>(existingDraftId);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'unsaved'>('unsaved');
  const isAutoSavingRef = useRef(false);

  // Determine initial items: explicit override > seed quotation > pre-populated items > default
  const getInitialItems = (): QuotationItem[] => {
    if (itemsOverride?.length) {
      return itemsOverride.map((item, index) => ({ ...item, sort_order: index }));
    }
    if (seed?.items?.length) {
      return seed.items.map((item) => {
        const copy: any = { ...item };
        if (!existingQuotation) {
          // Duplicating: drop identifiers so new rows are inserted
          delete copy.id;
          delete copy.quotation_id;
          delete copy.created_at;
          delete copy.updated_at;
          copy.enquiry_item_id = null;
        }
        return copy as QuotationItem;
      });
    }
    if (prePopulatedItems?.length) {
      return convertEnquiryToQuotationItems(prePopulatedItems);
    }
    return [{ ...defaultItem }];
  };

  const [subject, setSubject] = useState(seed?.subject || '');
  const [notes, setNotes] = useState(seed?.notes || '');
  const [termsConditions, setTermsConditions] = useState(
    seed?.terms_conditions || 
    '1. Payment Terms: 100% Advance against PI.\n2. Dispatch Time: 2-3 Weeks (MAY VARY).\n3. Freight Charges: Freight will be charged extra as per actual.\n4. Jurisdiction: All disputes under Lucknow jurisdiction only.\n5. As per brand warranty\n6. Once goods sold will not be taken back'
  );
  const [validUntil, setValidUntil] = useState(
    existingQuotation?.valid_until 
      ? format(new Date(existingQuotation.valid_until), 'yyyy-MM-dd')
      : format(addDays(new Date(), 15), 'yyyy-MM-dd')
  );
  const [items, setItems] = useState<QuotationItem[]>(getInitialItems);
  const [currency, setCurrency] = useState<CurrencyCode>(
    (seed?.currency as CurrencyCode) || 'INR'
  );
  const [exchangeRate, setExchangeRate] = useState<number>(
    (seed as any)?.exchange_rate || 1
  );
  const [showExchangeRateDialog, setShowExchangeRateDialog] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<CurrencyCode>('INR');

  // Calculate totals - need these before auto-save useEffect
  const subtotal = items.reduce((sum, item) => {
    const base = item.quantity * item.rate;
    const discount = (base * item.discount_percent) / 100;
    return sum + (base - discount);
  }, 0);
  const totalDiscount = items.reduce((sum, item) => sum + item.discount_amount, 0);
  const totalTax = items.reduce((sum, item) => sum + item.tax_amount, 0);
  const grandTotal = items.reduce((sum, item) => sum + item.amount, 0);

  // ===== Payment schedule (advance / balance) =====
  const [advanceMode, setAdvanceMode] = useState<'percent' | 'amount'>(
    (seed as any)?.advance_percent == null && (seed as any)?.advance_amount != null ? 'amount' : 'percent'
  );
  const [advancePercentInput, setAdvancePercentInput] = useState<string>(
    (seed as any)?.advance_percent != null ? String((seed as any).advance_percent) : ''
  );
  const [advanceAmountInput, setAdvanceAmountInput] = useState<string>(
    (seed as any)?.advance_amount != null ? String((seed as any).advance_amount) : ''
  );
  const [paymentRemark, setPaymentRemark] = useState<string>((seed as any)?.payment_remark || '');
  const [advanceRemark, setAdvanceRemark] = useState<string>((seed as any)?.advance_remark || '');
  const [balanceRemark, setBalanceRemark] = useState<string>((seed as any)?.balance_remark || '');


  const round2 = (n: number) => Math.round(n * 100) / 100;
  const parsedAdvancePercent = advanceMode === 'percent' ? parseFloat(advancePercentInput) : NaN;
  const parsedAdvanceAmount = advanceMode === 'amount' ? parseFloat(advanceAmountInput) : NaN;
  const hasPaymentSplit =
    (advanceMode === 'percent' && !isNaN(parsedAdvancePercent) && parsedAdvancePercent > 0 && parsedAdvancePercent < 100) ||
    (advanceMode === 'amount' && !isNaN(parsedAdvanceAmount) && parsedAdvanceAmount > 0 && parsedAdvanceAmount < grandTotal);

  const advanceAmountCalc = hasPaymentSplit
    ? (advanceMode === 'percent' ? round2((parsedAdvancePercent / 100) * grandTotal) : round2(parsedAdvanceAmount))
    : null;
  const balanceAmountCalc = advanceAmountCalc !== null ? round2(grandTotal - advanceAmountCalc) : null;
  const advancePercentCalc = advanceAmountCalc !== null && grandTotal > 0
    ? (advanceMode === 'percent' ? parsedAdvancePercent : round2((advanceAmountCalc / grandTotal) * 100))
    : null;

  const paymentFields = {
    advance_percent: advancePercentCalc,
    advance_amount: advanceAmountCalc,
    balance_amount: balanceAmountCalc,
    payment_remark: paymentRemark.trim() || null,
    advance_remark: advanceRemark.trim() || null,
    balance_remark: balanceRemark.trim() || null,
  };



  // Auto-save draft to DATABASE with debounce (only for new quotations, not editing)
  useEffect(() => {
    if (isEditing) return; // Don't auto-save when editing existing quotation
    
    // Only save if there are items with descriptions
    const hasContent = items.some(item => item.description.trim());
    if (!hasContent) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setDraftStatus('unsaved');

    // Set new timer for 3 seconds (slightly longer for DB operations)
    autoSaveTimerRef.current = setTimeout(async () => {
      // Prevent concurrent auto-saves
      if (isAutoSavingRef.current) return;
      isAutoSavingRef.current = true;
      
      setDraftStatus('saving');
      
      const draftData = {
        subject,
        notes,
        termsConditions,
        validUntil,
        currency,
        exchangeRate,
        subtotal,
        totalDiscount,
        totalTax,
        grandTotal,
        advancePercent: advancePercentCalc,
        advanceAmount: advanceAmountCalc,
        balanceAmount: balanceAmountCalc,
        paymentRemark: paymentRemark.trim() || null,
        advanceRemark: advanceRemark.trim() || null,
        balanceRemark: balanceRemark.trim() || null,


        items: items.map((item, index) => ({
          ...item,
          sort_order: index,
        })),
      };
      
      try {
        if (draftQuotationId) {
          // Update existing draft
          await updateDraft.mutateAsync({
            id: draftQuotationId,
            leadId,
            data: draftData,
          });
        } else {
          // Create new draft
          const result = await createDraft.mutateAsync({
            leadId,
            customerId,
            data: draftData,
          });
          setDraftQuotationId(result.id);
        }
        setDraftStatus('saved');
      } catch (error) {
        console.error('Auto-save failed:', error);
        setDraftStatus('unsaved');
      } finally {
        isAutoSavingRef.current = false;
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isEditing, subject, notes, termsConditions, validUntil, currency, exchangeRate, items, draftQuotationId, leadId, customerId, subtotal, totalDiscount, totalTax, grandTotal]);

  const calculateItemAmount = useCallback((item: QuotationItem): QuotationItem => {
    const baseAmount = item.quantity * item.rate;
    const discountAmount = (baseAmount * item.discount_percent) / 100;
    const afterDiscount = baseAmount - discountAmount;
    const taxAmount = (afterDiscount * item.tax_percent) / 100;
    const totalAmount = afterDiscount + taxAmount;

    return {
      ...item,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      amount: totalAmount,
    };
  }, []);

  const handleUpdateItem = useCallback(
    (index: number, field: keyof QuotationItem, value: unknown) => {
      setItems((prev) => {
        const newItems = [...prev];
        newItems[index] = { ...newItems[index], [field]: value };
        newItems[index] = calculateItemAmount(newItems[index]);
        return newItems;
      });
    },
    [calculateItemAmount]
  );

  const handleProductSelect = useCallback(
    (index: number, productId: string) => {
      if (productId === 'custom') {
        handleUpdateItem(index, 'product_id', null);
        return;
      }

      const product = products.find((p) => p.id === productId);
      if (product) {
        setItems((prev) => {
          const newItems = [...prev];
          const productDescription = pickBestDescription(
            newItems[index]?.product_description || newItems[index]?.description,
            product.description || null,
            product.model_number || null,
          );
          newItems[index] = calculateItemAmount({
            ...newItems[index],
            product_id: product.id,
            model_number: product.model_number || null,
            product_description: productDescription || null,
            description: productDescription || product.model_number || '',
            hsn_code: product.hsn_code || '',
            unit: product.unit || 'Nos',
            rate: product.default_rate || 0,
            tax_percent: product.tax_rate || 18,
          });
          return newItems;
        });
      }
    },
    [products, calculateItemAmount]
  );

  const lastItemRef = useRef<HTMLDivElement>(null);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...defaultItem, sort_order: prev.length }]);
    setTimeout(() => {
      lastItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      toast.error('At least one item is required');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const formatCurrency = (amount: number) => {
    return formatCurrencyWithSymbol(amount, currency);
  };
  
  const currencySymbol = getCurrencySymbol(currency);

  // Handle currency change - show dialog for non-INR currencies
  const handleCurrencyChange = (newCurrency: CurrencyCode) => {
    if (newCurrency === 'INR') {
      // If switching back to INR, convert rates back
      if (exchangeRate > 1) {
        setItems(prev => prev.map(item => {
          const inrRate = item.rate * exchangeRate;
          const baseAmount = item.quantity * inrRate;
          const discountAmount = (baseAmount * item.discount_percent) / 100;
          const afterDiscount = baseAmount - discountAmount;
          const taxAmount = (afterDiscount * item.tax_percent) / 100;
          return {
            ...item,
            rate: inrRate,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            amount: afterDiscount + taxAmount,
          };
        }));
      }
      setCurrency('INR');
      setExchangeRate(1);
    } else {
      setPendingCurrency(newCurrency);
      setShowExchangeRateDialog(true);
    }
  };

  // Apply exchange rate conversion to all items
  const handleExchangeRateConfirm = (rate: number) => {
    setExchangeRate(rate);
    setCurrency(pendingCurrency);
    setShowExchangeRateDialog(false);
    
    // Convert all item rates from INR to new currency
    setItems(prev => prev.map(item => {
      const convertedRate = convertFromINR(item.rate, rate);
      const baseAmount = item.quantity * convertedRate;
      const discountAmount = (baseAmount * item.discount_percent) / 100;
      const afterDiscount = baseAmount - discountAmount;
      const taxAmount = (afterDiscount * item.tax_percent) / 100;
      return {
        ...item,
        rate: convertedRate,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        amount: afterDiscount + taxAmount,
      };
    }));
    
    toast.success(`Converted to ${pendingCurrency} at rate 1 ${pendingCurrency} = ${rate} INR`);
  };

  const handleExchangeRateCancel = () => {
    setShowExchangeRateDialog(false);
    setPendingCurrency('INR');
  };

  const handleSave = async (sendVia?: 'whatsapp' | 'email') => {
    // Validate
    if (items.every((item) => !item.description.trim())) {
      toast.error('Please add at least one item with a description');
      return;
    }

    const validItems = items.filter((item) => item.description.trim());

    try {
      if (isEditing && existingQuotation) {
        await updateQuotation.mutateAsync({
          id: existingQuotation.id,
          quotation: {
            subject: subject || `Quotation for ${customerName || 'Customer'}`,
            notes,
            terms_conditions: termsConditions,
            ...paymentFields,
            subtotal,
            total_discount: totalDiscount,
            total_tax: totalTax,
            grand_total: grandTotal,
            valid_until: validUntil,
            currency,
            exchange_rate: exchangeRate,
            status: 'pending',
          } as any,
          items: validItems,
        });

        if (sendVia === 'whatsapp' && customerPhone) {
          let cleanPhone = customerPhone.replace(/\D/g, '');
          if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
          const message = encodeURIComponent(
            `Dear ${customerName || 'Sir/Madam'},\n\nPlease find our updated quotation ${existingQuotation.quotation_number} for ${formatCurrency(grandTotal)}.\n\nValid until: ${format(new Date(validUntil), 'dd MMM yyyy')}\n\nThank you.\n\nRegards,\n${branding.companyName}`
          );
          window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${message}`, '_blank');
        }

        onSuccess?.(existingQuotation.id);
      } else if (draftQuotationId) {
        // Draft exists in DB - update it to 'pending' instead of creating duplicate
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        
        await updateQuotation.mutateAsync({
          id: draftQuotationId,
          quotation: {
            lead_id: leadId,
            customer_id: customerId,
            created_by: user?.id,
            subject: subject || `Quotation for ${customerName || 'Customer'}`,
            notes,
            terms_conditions: termsConditions,
            ...paymentFields,
            subtotal,
            total_discount: totalDiscount,
            total_tax: totalTax,
            grand_total: grandTotal,
            valid_until: validUntil,
            currency,
            exchange_rate: exchangeRate,
            status: 'pending',
          } as any,
          items: validItems,
        });

        if (sendVia === 'whatsapp' && customerPhone) {
          let cleanPhone = customerPhone.replace(/\D/g, '');
          if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
          const message = encodeURIComponent(
            `Dear ${customerName || 'Sir/Madam'},\n\nPlease find our quotation for ${formatCurrency(grandTotal)}.\n\nValid until: ${format(new Date(validUntil), 'dd MMM yyyy')}\n\nThank you for your enquiry.\n\nRegards,\n${branding.companyName}`
          );
          window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${message}`, '_blank');
        }

        onSuccess?.(draftQuotationId);
      } else {
        // No draft exists - cancel auto-save and wait for any in-progress auto-save
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        while (isAutoSavingRef.current) {
          await new Promise(r => setTimeout(r, 100));
        }
        
        // Re-check if a draft was created by auto-save while we waited
        if (draftQuotationId) {
          await updateQuotation.mutateAsync({
            id: draftQuotationId,
            quotation: {
              lead_id: leadId,
              customer_id: customerId,
              created_by: user?.id,
              subject: subject || `Quotation for ${customerName || 'Customer'}`,
              notes,
              terms_conditions: termsConditions,
              ...paymentFields,
              subtotal,
              total_discount: totalDiscount,
              total_tax: totalTax,
              grand_total: grandTotal,
              valid_until: validUntil,
              currency,
              exchange_rate: exchangeRate,
              status: 'pending',
            } as any,
            items: validItems,
          });
          onSuccess?.(draftQuotationId);
          return;
        }
        
        const result = await createQuotation.mutateAsync({
          quotation: {
            lead_id: leadId,
            customer_id: customerId,
            created_by: user?.id,
            subject: subject || `Quotation for ${customerName || 'Customer'}`,
            notes,
            terms_conditions: termsConditions,
            ...paymentFields,
            subtotal,
            total_discount: totalDiscount,
            total_tax: totalTax,
            grand_total: grandTotal,
            valid_until: validUntil,
            currency,
            exchange_rate: exchangeRate,
            status: 'pending',
          } as any,
          items: validItems,
        });

        if (sendVia === 'whatsapp' && customerPhone) {
          let cleanPhone = customerPhone.replace(/\D/g, '');
          if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
          const message = encodeURIComponent(
            `Dear ${customerName || 'Sir/Madam'},\n\nPlease find our quotation ${result.quotation_number} for ${formatCurrency(grandTotal)}.\n\nValid until: ${format(new Date(validUntil), 'dd MMM yyyy')}\n\nThank you for your enquiry.\n\nRegards,\n${branding.companyName}`
          );
          window.open(`https://web.whatsapp.com/send?phone=${cleanPhone}&text=${message}`, '_blank');
        }

        onSuccess?.(result.id);
      }
    } catch {
      // Error handled in hook
    }
  };

  const isPending = createQuotation.isPending || updateQuotation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{isEditing ? 'Edit Quotation' : 'Create Quotation'}</h2>
          {customerName && (
            <p className="text-sm text-muted-foreground">For: {customerName}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Draft status indicator - only for new quotations */}
          {!isEditing && items.some(item => item.description.trim()) && (
            <Badge 
              variant="outline" 
              className={`text-xs ${
                draftStatus === 'saved' ? 'text-green-600 border-green-300' : 
                draftStatus === 'saving' ? 'text-yellow-600 border-yellow-300' : 
                'text-muted-foreground'
              }`}
            >
              {draftStatus === 'saved' ? (
                <>
                  <Save className="h-3 w-3 mr-1" />
                  Draft saved
                </>
              ) : draftStatus === 'saving' ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Cloud className="h-3 w-3 mr-1" />
                  Unsaved
                </>
              )}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {existingQuotation?.status || 'Draft'}
          </Badge>
        </div>
      </div>

      {/* Subject & Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Quotation Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g., Supply of Automation Equipment"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validUntil">Valid Until</Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => handleCurrencyChange(v as CurrencyCode)}>
                <SelectTrigger>
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Line Items</CardTitle>
            <Button size="sm" variant="outline" onClick={handleAddItem}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Header hint */}
          <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-b mb-2">
            Product & description on top; quantity, rate, tax and totals below.
          </div>


          {/* Items */}
          <div className="space-y-2">
            {items.map((item, index) => {
              // Find the selected product name from the products array (for display purposes)
              const selectedProduct = products.find(p => p.id === item.product_id);
              return (
                <div key={index} ref={index === items.length - 1 ? lastItemRef : undefined}>
                  <QuotationLineItem
                    item={item}
                    index={index}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    onProductSelect={handleProductSelect}
                    selectedProductName={selectedProduct?.name}
                    selectedProductModel={selectedProduct?.model_number}
                  />
                </div>
              );
            })}
          </div>

          {/* Bottom Add Item button for convenience with long lists */}
          {items.length >= 3 && (
            <div className="mt-3">
              <Button type="button" size="sm" variant="outline" onClick={handleAddItem} className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          )}

          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Discount</span>
                <span className="text-green-600">-{formatCurrency(totalDiscount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Tax (GST)</span>
                <span>{formatCurrency(totalTax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-semibold">
                <span>Grand Total</span>
                <span className="text-primary">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Payment Terms (advance / balance split) */}
          <div className="mt-6 rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Payment Terms (Optional)</Label>
              <div className="flex items-center gap-1 text-xs">
                <Button
                  type="button"
                  size="sm"
                  variant={advanceMode === 'percent' ? 'default' : 'outline'}
                  onClick={() => setAdvanceMode('percent')}
                >
                  %
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={advanceMode === 'amount' ? 'default' : 'outline'}
                  onClick={() => setAdvanceMode('amount')}
                >
                  Fixed amount
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="advance-input" className="text-xs text-muted-foreground">
                  {advanceMode === 'percent' ? 'Advance %' : `Advance amount (${currency})`}
                </Label>
                <Input
                  id="advance-input"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={advanceMode === 'percent' ? 'e.g. 80' : 'e.g. 8000'}
                  value={advanceMode === 'percent' ? advancePercentInput : advanceAmountInput}
                  onChange={(e) =>
                    advanceMode === 'percent'
                      ? setAdvancePercentInput(e.target.value)
                      : setAdvanceAmountInput(e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Advance Payable</p>
                <p className="font-semibold">
                  {advanceAmountCalc !== null
                    ? `${formatCurrency(advanceAmountCalc)}${advancePercentCalc !== null ? ` (${advancePercentCalc}%)` : ''}`
                    : '—'}
                </p>
                <Input
                  id="advance-remark"
                  placeholder="Advance remark, e.g. Advance with PO"
                  value={advanceRemark}
                  onChange={(e) => setAdvanceRemark(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Balance Payable</p>
                <p className="font-semibold">
                  {balanceAmountCalc !== null
                    ? `${formatCurrency(balanceAmountCalc)}${advancePercentCalc !== null ? ` (${Math.round((100 - advancePercentCalc) * 100) / 100}%)` : ''}`
                    : '—'}
                </p>
                <Input
                  id="balance-remark"
                  placeholder="Balance remark, e.g. Before delivery"
                  value={balanceRemark}
                  onChange={(e) => setBalanceRemark(e.target.value)}
                />
              </div>
            </div>


            <div className="space-y-2">
              <Label htmlFor="payment-remark" className="text-xs text-muted-foreground">
                Payment Remark
              </Label>
              <Textarea
                id="payment-remark"
                rows={2}
                placeholder="e.g. 80% advance along with PO, 20% before dispatch"
                value={paymentRemark}
                onChange={(e) => setPaymentRemark(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave advance blank to print the full amount only.
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Notes & Terms */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes for the customer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="terms">Terms & Conditions</Label>
            <Textarea
              id="terms"
              value={termsConditions}
              onChange={(e) => setTermsConditions(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave()}
            disabled={isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {isEditing ? 'Save Changes' : 'Save Draft'}
          </Button>

          {customerEmail && (
            <Button
              variant="outline"
              onClick={() => handleSave('email')}
              disabled={isPending}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
          )}

          {customerPhone && (
            <Button
              onClick={() => handleSave('whatsapp')}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Send WhatsApp
            </Button>
          )}

          <Button onClick={() => handleSave()} disabled={isPending}>
            <Send className="h-4 w-4 mr-2" />
            {isEditing ? 'Update Quotation' : 'Create Quotation'}
          </Button>
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
