import { useState } from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SalesOrderWithDetails, useUpdateSalesOrder } from '@/hooks/useSalesOrders';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LinkedPO {
  id: string;
  po_number: string;
  status: string;
  created_at: string;
}

interface LinkedGRN {
  id: string;
  grn_number: string;
  status: string;
  received_date: string;
}

interface LinkedDispatch {
  id: string;
  dispatch_number: string;
  status: string;
  dispatch_date: string | null;
}

interface OrderStatusTimelineProps {
  order: SalesOrderWithDetails;
  linkedPOs: LinkedPO[];
  linkedGRNs: LinkedGRN[];
  linkedDispatches: LinkedDispatch[];
  onStatusUpdate?: () => void;
}

type TimelineStep = {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
  details?: string;
  targetStatus?: SalesOrderWithDetails['status'];
};

// Map timeline step IDs to order statuses
const stepToStatusMap: Record<string, SalesOrderWithDetails['status']> = {
  documents: 'ready_for_procurement',
  procurement: 'in_procurement',
  received: 'partially_fulfilled',
  ready_to_dispatch: 'ready_to_dispatch',
  dispatched: 'fulfilled',
  fulfilled: 'fulfilled',
};

export function OrderStatusTimeline({
  order,
  linkedPOs,
  linkedGRNs,
  linkedDispatches,
  onStatusUpdate,
}: OrderStatusTimelineProps) {
  const [updatingStep, setUpdatingStep] = useState<string | null>(null);
  const updateOrder = useUpdateSalesOrder();

  // Determine timeline steps based on order status and linked items
  const steps: TimelineStep[] = [];

  // Step 1: Order Created
  steps.push({
    id: 'created',
    label: 'Order Created',
    status: 'completed',
    date: order.created_at,
    details: `${order.order_number} - ₹${order.order_value?.toLocaleString()}`,
  });

  // Step 2: Documents Uploaded
  const hasDocuments = order.status !== 'pending_documents';
  steps.push({
    id: 'documents',
    label: 'Documents Uploaded',
    status: hasDocuments ? 'completed' : order.status === 'pending_documents' ? 'current' : 'pending',
    date: hasDocuments ? order.updated_at : undefined,
    details: hasDocuments ? 'Customer PO & Payment Receipt' : 'Awaiting documents',
    targetStatus: 'ready_for_procurement',
  });

  // Step 3: Procurement Started
  // If order is cancelled or postponed, show a special indicator
  const isCancelledOrPostponed = order.status === 'cancelled' || order.status === 'postponed';

  if (isCancelledOrPostponed) {
    return (
      <TooltipProvider>
        <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 text-center">
          <Badge className={order.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'}>
            {order.status === 'cancelled' ? 'Cancelled' : `Postponed${order.postponed_until ? ` until ${format(new Date(order.postponed_until), 'dd MMM yyyy')}` : ''}`}
          </Badge>
          {order.status_change_reason && (
            <p className="text-sm text-muted-foreground mt-2">Reason: {order.status_change_reason}</p>
          )}
        </div>
      </TooltipProvider>
    );
  }

  const procurementStarted = ['in_procurement', 'partially_fulfilled', 'ready_to_dispatch', 'fulfilled'].includes(order.status);
  const hasPOs = linkedPOs.length > 0;
  steps.push({
    id: 'procurement',
    label: 'Procurement Started',
    status: procurementStarted || hasPOs ? 'completed' : order.status === 'ready_for_procurement' ? 'current' : 'pending',
    date: hasPOs ? linkedPOs[linkedPOs.length - 1]?.created_at : undefined,
    details: hasPOs ? `${linkedPOs.length} PO(s) created` : 'Awaiting procurement',
    targetStatus: 'in_procurement',
  });

  // Step 4: Goods Received - Use order status as fallback
  const hasGRNs = linkedGRNs.length > 0;
  const allGRNsVerified = hasGRNs && linkedGRNs.every((grn) => grn.status === 'verified');
  const goodsReceivedFromStatus = ['partially_fulfilled', 'ready_to_dispatch', 'fulfilled'].includes(order.status);
  
  steps.push({
    id: 'received',
    label: 'Goods Received',
    status: allGRNsVerified || ['ready_to_dispatch', 'fulfilled'].includes(order.status)
      ? 'completed' 
      : (hasGRNs || goodsReceivedFromStatus) 
        ? 'current' 
        : 'pending',
    date: hasGRNs ? linkedGRNs[0]?.received_date : undefined,
    details: hasGRNs ? `${linkedGRNs.length} GRN(s) recorded` : goodsReceivedFromStatus ? 'In progress' : 'Awaiting delivery',
    targetStatus: 'partially_fulfilled',
  });

  // Step 5: Ready to Dispatch
  const isReadyToDispatch = ['ready_to_dispatch', 'fulfilled'].includes(order.status);
  steps.push({
    id: 'ready_to_dispatch',
    label: 'Ready to Dispatch',
    status: order.status === 'fulfilled' ? 'completed' : 
            order.status === 'ready_to_dispatch' ? 'current' : 'pending',
    date: isReadyToDispatch ? order.updated_at : undefined,
    details: isReadyToDispatch ? 'Ready for shipping' : 'Awaiting goods receipt',
    targetStatus: 'ready_to_dispatch',
  });

  // Step 6: Dispatched to Customer - Use order status as fallback
  const hasDispatches = linkedDispatches.length > 0;
  const allDelivered = hasDispatches && linkedDispatches.every((d) => d.status === 'delivered');
  const dispatchedFromStatus = order.status === 'fulfilled';
  
  steps.push({
    id: 'dispatched',
    label: 'Dispatched',
    status: allDelivered || dispatchedFromStatus
      ? 'completed'
      : hasDispatches
        ? 'current'
        : 'pending',
    date: hasDispatches ? linkedDispatches[0]?.dispatch_date || undefined : undefined,
    details: hasDispatches ? `${linkedDispatches.length} dispatch(es)` : dispatchedFromStatus ? 'Completed' : 'Awaiting dispatch',
    targetStatus: 'fulfilled',
  });

  // Step 7: Fulfilled
  const isFulfilled = order.status === 'fulfilled';
  steps.push({
    id: 'fulfilled',
    label: 'Order Fulfilled',
    status: isFulfilled ? 'completed' : 'pending',
    date: isFulfilled ? order.updated_at : undefined,
    details: isFulfilled ? 'Order completed' : 'Pending completion',
    targetStatus: 'fulfilled',
  });

  // Find the next step that can be clicked (first pending step after current)
  const currentIndex = steps.findIndex(s => s.status === 'current');
  const nextClickableIndex = currentIndex >= 0 ? currentIndex + 1 : steps.findIndex(s => s.status === 'pending');

  const handleStepClick = async (step: TimelineStep, index: number) => {
    // Can only click on the next pending step
    if (step.status !== 'pending' || index !== nextClickableIndex) return;
    if (!step.targetStatus || step.id === 'created') return;

    setUpdatingStep(step.id);
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        status: step.targetStatus,
      });
      toast.success(`Order status updated to "${step.label}"`);
      onStatusUpdate?.();
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      setUpdatingStep(null);
    }
  };

  const isStepClickable = (step: TimelineStep, index: number) => {
    return step.status === 'pending' && index === nextClickableIndex && step.id !== 'created';
  };

  return (
    <TooltipProvider>
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const clickable = isStepClickable(step, index);
            const isUpdating = updatingStep === step.id;
            
            return (
              <div key={step.id} className="flex-1 relative">
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'absolute top-3 left-1/2 w-full h-0.5',
                      step.status === 'completed' ? 'bg-green-500' : 'bg-muted'
                    )}
                  />
                )}

                {/* Step */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "relative flex flex-col items-center",
                        clickable && "cursor-pointer group"
                      )}
                      onClick={() => clickable && handleStepClick(step, index)}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'z-10 flex items-center justify-center w-6 h-6 rounded-full transition-all',
                          step.status === 'completed' && 'bg-green-500 text-white',
                          step.status === 'current' && 'bg-blue-500 text-white',
                          step.status === 'pending' && 'bg-muted text-muted-foreground',
                          clickable && 'hover:bg-primary hover:text-primary-foreground hover:scale-110 ring-2 ring-transparent hover:ring-primary/30',
                          isUpdating && 'animate-pulse'
                        )}
                      >
                        {step.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : step.status === 'current' ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                      </div>

                      {/* Label */}
                      <div className="mt-2 text-center">
                        <p
                          className={cn(
                            'text-xs font-medium transition-colors',
                            step.status === 'completed' && 'text-green-600',
                            step.status === 'current' && 'text-blue-600',
                            step.status === 'pending' && 'text-muted-foreground',
                            clickable && 'group-hover:text-primary'
                          )}
                        >
                          {step.label}
                        </p>
                        {step.date && (
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(step.date), 'dd MMM')}
                          </p>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="font-medium">{step.label}</p>
                    {step.details && <p className="text-xs text-muted-foreground">{step.details}</p>}
                    {clickable && (
                      <p className="text-xs text-primary mt-1 font-medium">Click to mark as complete</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}