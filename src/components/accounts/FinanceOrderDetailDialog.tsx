import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { FinanceDocumentsSection } from "./FinanceDocumentsSection";
import { OrderPaymentDialog } from "@/components/orders/OrderPaymentDialog";
import { GenerateEInvoiceDialog } from "@/components/orders/GenerateEInvoiceDialog";
import { IndianRupee, FileCheck } from "lucide-react";
import type { SalesOrderWithDetails } from "@/hooks/useSalesOrders";

interface OrderBasic {
  id: string;
  order_number: string;
  order_value: number;
  status: string;
  payment_status: string;
  created_at: string;
  customer: {
    id: string;
    company_name: string;
  } | null;
}

interface FinanceOrderDetailDialogProps {
  order: OrderBasic | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FinanceOrderDetailDialog = ({
  order,
  open,
  onOpenChange,
}: FinanceOrderDetailDialogProps) => {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [einvoiceDialogOpen, setEinvoiceDialogOpen] = useState(false);
  // Fetch full order details including quotation
  const { data: orderDetails } = useQuery({
    queryKey: ["finance-order-details", order?.id],
    queryFn: async () => {
      if (!order?.id) return null;

      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          customer:customers(id, company_name, email, phone, address, city, state),
          quotation:quotations!sales_orders_quotation_id_fkey(id, quotation_number, grand_total),
          lead:leads(id, title)
        `)
        .eq("id", order.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!order?.id && open,
  });

  if (!order) return null;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending_documents: { label: "Pending Docs", variant: "outline" },
      ready_for_procurement: { label: "Ready for Procurement", variant: "secondary" },
      in_procurement: { label: "In Procurement", variant: "secondary" },
      partially_fulfilled: { label: "Partially Fulfilled", variant: "default" },
      ready_to_dispatch: { label: "Ready to Dispatch", variant: "default" },
      fulfilled: { label: "Fulfilled", variant: "default" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Payment Pending", variant: "destructive" },
      partial: { label: "Partial Payment", variant: "secondary" },
      received: { label: "Payment Received", variant: "default" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Order: {order.order_number}
            {getStatusBadge(order.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{order.customer?.company_name || "N/A"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Order Value</p>
              <p className="font-medium">₹{Math.round(order.order_value || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Status</p>
              {getPaymentBadge(order.payment_status)}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Order Date</p>
              <p className="font-medium">
                {format(new Date(order.created_at), "dd MMM yyyy")}
              </p>
            </div>
          </div>

          {/* Quotation Reference */}
          {orderDetails?.quotation && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Quotation Reference</p>
              <p className="font-medium">
                {orderDetails.quotation.quotation_number} - ₹
                {orderDetails.quotation.grand_total?.toLocaleString("en-IN")}
              </p>
            </div>
          )}

          <Separator />

          {/* Payment Section */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="font-medium">
                ₹{Math.round(orderDetails?.payment_amount || 0).toLocaleString("en-IN")} / ₹{Math.round(order.order_value || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaymentDialogOpen(true)}
            >
              <IndianRupee className="h-4 w-4 mr-1" />
              Record Payment
            </Button>
            {order.status === 'ready_to_dispatch' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEinvoiceDialogOpen(true)}
              >
                <FileCheck className="h-4 w-4 mr-1" />
                E-Invoice & E-Way Bill
              </Button>
            )}
          </div>

          <Separator />

          {/* Documents Section */}
          <FinanceDocumentsSection orderId={order.id} orderNumber={order.order_number} />
        </div>
      </DialogContent>

      {/* Payment Dialog */}
      <OrderPaymentDialog
        order={orderDetails as SalesOrderWithDetails | null}
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />

      <GenerateEInvoiceDialog
        open={einvoiceDialogOpen}
        onOpenChange={setEinvoiceDialogOpen}
        orderId={order.id}
        orderNumber={order.order_number}
      />
    </Dialog>
  );
};
