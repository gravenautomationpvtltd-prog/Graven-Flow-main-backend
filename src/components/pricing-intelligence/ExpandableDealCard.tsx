import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Package, 
  Building2, 
  Calendar, 
  Tag, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  Copy,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { WIN_REASONS, LOST_REASONS } from '@/components/leads/WinLossReasonDialog';

export interface DealWithDetails {
  id: string;
  lead_id: string;
  lead_title: string;
  customer_name: string;
  product_name: string;
  initial_rate: number;
  target_rate: number | null;
  final_rate: number | null;
  gap_to_target: number | null;
  outcome: 'won' | 'lost' | 'pending';
  reason: string | null;
  created_at: string;
  // Penny-level details
  quantity?: number;
  unit?: string;
  discount_percent?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  total_amount?: number;
  quotation_id?: string;
  quotation_number?: string;
}

interface ExpandableDealCardProps {
  deal: DealWithDetails;
  type: 'won' | 'lost';
  index: number;
}

export function ExpandableDealCard({ deal, type, index }: ExpandableDealCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCurrencyCompact = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const colorClass = type === 'won' ? 'text-green-500' : 'text-red-500';
  const bgClass = type === 'won' 
    ? 'hover:border-green-500/50 hover:bg-green-500/5 border-green-500/20' 
    : 'hover:border-red-500/50 hover:bg-red-500/5 border-red-500/20';

  const dealValue = deal.final_rate || deal.initial_rate || 0;
  const quantity = deal.quantity || 1;
  const subtotal = dealValue * quantity;
  const discountAmount = deal.discount_amount || 0;
  const discountPercent = deal.discount_percent || 0;
  const taxPercent = deal.tax_percent || 18; // Default GST
  const taxAmount = deal.tax_amount || (subtotal * taxPercent / 100);
  const totalAmount = deal.total_amount || (subtotal - discountAmount + taxAmount);

  const handleCopyDetails = () => {
    const details = `
Product: ${deal.product_name}
Customer: ${deal.customer_name}
Quantity: ${quantity} ${deal.unit || 'Nos'}
Unit Rate: ${formatCurrency(dealValue)}
Subtotal: ${formatCurrency(subtotal)}
${discountAmount > 0 ? `Discount: ${formatCurrency(discountAmount)} (${discountPercent}%)` : ''}
GST (${taxPercent}%): ${formatCurrency(taxAmount)}
Total: ${formatCurrency(totalAmount)}
Status: ${type === 'won' ? 'Won' : 'Lost'}
Date: ${format(new Date(deal.created_at), 'MMM dd, yyyy')}
    `.trim();
    
    navigator.clipboard.writeText(details);
    toast.success('Deal details copied to clipboard');
  };

  const reasons = type === 'won' ? WIN_REASONS : LOST_REASONS;
  const reasonObj = reasons.find(r => r.value === deal.reason);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.02 }}
      className={`rounded-lg border transition-all ${bgClass} ${isExpanded ? 'shadow-md' : ''}`}
    >
      {/* Main Row - Always Visible with Penny-Level Summary */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium truncate">{deal.product_name}</span>
            </div>
            
            {deal.customer_name && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{deal.customer_name}</span>
              </div>
            )}

            {/* Penny-Level Summary - Always Visible */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1 mb-2 bg-muted/30 rounded px-2 py-1.5">
              <span className="font-medium text-foreground">
                {quantity} {deal.unit || 'Nos'} × {formatCurrency(dealValue)}
              </span>
              {discountAmount > 0 && (
                <span className="text-green-600">
                  -{formatCurrencyCompact(discountAmount)}
                </span>
              )}
              <span className="text-muted-foreground">
                +GST {taxPercent}%
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(deal.created_at), 'MMM dd, yyyy')}
              </div>
              {deal.reason && (
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${
                    type === 'won' 
                      ? 'bg-green-500/10 text-green-600' 
                      : 'bg-red-500/10 text-red-600'
                  }`}
                >
                  <Tag className="h-3 w-3 mr-1" />
                  {reasonObj?.label || deal.reason}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
            <div className={`text-lg font-bold ${colorClass} flex items-center gap-1 whitespace-nowrap`}>
              {type === 'won' ? (
                <ArrowUpRight className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ArrowDownRight className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Total incl. GST
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 mt-1"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t">
              {/* Pricing Breakdown */}
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Pricing Breakdown
                </h4>
                
                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="font-medium">{quantity} {deal.unit || 'Nos'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit Rate</span>
                    <span className="font-medium">{formatCurrency(dealValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        Discount ({discountPercent}%)
                      </span>
                      <span className="font-medium">- {formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST ({taxPercent}%)</span>
                    <span className="font-medium">{formatCurrency(taxAmount)}</span>
                  </div>
                  
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span className={colorClass}>{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Rate Comparison */}
                {(deal.target_rate || deal.initial_rate !== deal.final_rate) && (
                  <div className="bg-muted/30 rounded-lg p-3 mt-3">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Rate Comparison</h5>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Initial</p>
                        <p className="font-medium">{formatCurrency(deal.initial_rate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="font-medium">{deal.target_rate ? formatCurrency(deal.target_rate) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Final</p>
                        <p className={`font-medium ${colorClass}`}>
                          {deal.final_rate ? formatCurrency(deal.final_rate) : '-'}
                        </p>
                      </div>
                    </div>
                    {deal.gap_to_target !== null && (
                      <div className="mt-2 pt-2 border-t text-xs">
                        <span className="text-muted-foreground">Gap to Target: </span>
                        <span className={deal.gap_to_target > 0 ? 'text-red-500' : 'text-green-500'}>
                          {deal.gap_to_target > 0 ? '+' : ''}{formatCurrency(deal.gap_to_target)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lead Info */}
              {deal.lead_title && (
                <div className="mt-3 p-3 bg-muted/30 rounded-lg text-sm">
                  <span className="text-muted-foreground">Lead: </span>
                  <span className="font-medium">{deal.lead_title}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyDetails();
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Details
                </Button>
                <Link to={`/leads/${deal.lead_id}`} onClick={(e) => e.stopPropagation()}>
                  <Button variant="default" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Lead
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
