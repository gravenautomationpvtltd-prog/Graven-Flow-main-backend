import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, FileText, Eye, CheckCircle2, AlertCircle, Plus, FileCheck, Truck } from "lucide-react";
import { format } from "date-fns";
import { FinanceOrderDetailDialog } from "./FinanceOrderDetailDialog";
import { AccountsRecordOrderDialog } from "./AccountsRecordOrderDialog";
import { GenerateEInvoiceDialog } from "@/components/orders/GenerateEInvoiceDialog";
import { useCreateInvoiceFromOrder } from "@/hooks/useInvoices";
import { useToast } from "@/hooks/use-toast";

interface SalesOrderWithDetails {
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
  documents: {
    id: string;
    document_type: string;
  }[];
  invoices: {
    id: string;
    invoice_number: string;
    grand_total: number | null;
    status: string;
    irn: string | null;
    einvoice_status: string | null;
    created_at: string;
  }[];
  dispatches: {
    id: string;
    dispatch_number: string;
    eway_bill_number: string | null;
    eway_bill_status: string | null;
    created_at: string;
  }[];
}

export const FinanceOrdersTab = () => {
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [recordOrderOpen, setRecordOrderOpen] = useState(false);
  const [einvoiceOrder, setEinvoiceOrder] = useState<SalesOrderWithDetails | null>(null);
  const createInvoice = useCreateInvoiceFromOrder();
  const { toast } = useToast();

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["finance-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          id,
          order_number,
          order_value,
          status,
          payment_status,
          created_at,
          customer:customers(id, company_name),
          documents:order_documents(id, document_type),
          invoices:invoices(id, invoice_number, grand_total, status, irn, einvoice_status, created_at),
          dispatches:dispatches(id, dispatch_number, eway_bill_number, eway_bill_status, created_at)
        `)
        .order("created_at", { ascending: false })
        .order("created_at", { ascending: false, referencedTable: "invoices" })
        .order("created_at", { ascending: false, referencedTable: "dispatches" });

      if (error) throw error;
      return data as SalesOrderWithDetails[];
    },
  });

  const filteredOrders = useMemo(() => {
    let result = orders || [];

    // Filter by sub-tab
    if (subTab === "ready_to_dispatch") {
      result = result.filter((order) => order.status === "ready_to_dispatch");
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (order) =>
          order.order_number.toLowerCase().includes(searchLower) ||
          order.customer?.company_name.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [orders, subTab, search]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending_documents: { label: "Pending Docs", variant: "outline" },
      ready_for_procurement: { label: "Ready for Procurement", variant: "secondary" },
      in_procurement: { label: "In Procurement", variant: "secondary" },
      partially_fulfilled: { label: "Partially Fulfilled", variant: "default" },
      ready_to_dispatch: { label: "Ready to Dispatch", variant: "default" },
      fulfilled: { label: "Fulfilled", variant: "default" },
      cancelled: { label: "Cancelled", variant: "destructive" },
      postponed: { label: "Postponed", variant: "outline" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getInvoiceBadge = (irn: string | null | undefined, einvoiceStatus: string | null | undefined) => {
    if (irn) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          IRN Generated
        </Badge>
      );
    }
    if (einvoiceStatus === "failed") {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const getEwayBadge = (ewayBillNumber: string | null | undefined, ewayBillStatus: string | null | undefined) => {
    if (ewayBillNumber) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Generated
        </Badge>
      );
    }
    if (ewayBillStatus === "failed") {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const selectedOrder = orders?.find((o) => o.id === selectedOrderId);

  const handleCreateInvoice = async (order: SalesOrderWithDetails) => {
    try {
      await createInvoice.mutateAsync(order.id);
      toast({ title: "Invoice created", description: `Invoice drafted for ${order.order_number}` });
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to create invoice", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All Orders</TabsTrigger>
            <TabsTrigger value="ready_to_dispatch">
              Ready to Dispatch
              {orders?.filter((o) => o.status === "ready_to_dispatch").length ? (
                <Badge variant="secondary" className="ml-2">
                  {orders.filter((o) => o.status === "ready_to_dispatch").length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setRecordOrderOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Order
            </Button>
          </div>
        </div>

        <TabsContent value="all" className="mt-4">
          <OrdersTable
            orders={filteredOrders}
            isLoading={isLoading}
            onViewOrder={setSelectedOrderId}
            getStatusBadge={getStatusBadge}
            getInvoiceBadge={getInvoiceBadge}
            getEwayBadge={getEwayBadge}
            onCreateInvoice={handleCreateInvoice}
            onGenerateDocuments={setEinvoiceOrder}
            creatingInvoiceId={createInvoice.isPending ? createInvoice.variables : undefined}
          />
        </TabsContent>

        <TabsContent value="ready_to_dispatch" className="mt-4">
          <OrdersTable
            orders={filteredOrders}
            isLoading={isLoading}
            onViewOrder={setSelectedOrderId}
            getStatusBadge={getStatusBadge}
            getInvoiceBadge={getInvoiceBadge}
            getEwayBadge={getEwayBadge}
            onCreateInvoice={handleCreateInvoice}
            onGenerateDocuments={setEinvoiceOrder}
            creatingInvoiceId={createInvoice.isPending ? createInvoice.variables : undefined}
          />
        </TabsContent>
      </Tabs>

      <FinanceOrderDetailDialog
        order={selectedOrder || null}
        open={!!selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
      />

      <GenerateEInvoiceDialog
        open={!!einvoiceOrder}
        onOpenChange={(open) => !open && setEinvoiceOrder(null)}
        orderId={einvoiceOrder?.id || ""}
        orderNumber={einvoiceOrder?.order_number || ""}
      />

      <AccountsRecordOrderDialog
        open={recordOrderOpen}
        onOpenChange={setRecordOrderOpen}
      />
    </div>
  );
};

interface OrdersTableProps {
  orders: SalesOrderWithDetails[];
  isLoading: boolean;
  onViewOrder: (id: string) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  getInvoiceBadge: (irn: string | null | undefined, einvoiceStatus: string | null | undefined) => React.ReactNode;
  getEwayBadge: (ewayBillNumber: string | null | undefined, ewayBillStatus: string | null | undefined) => React.ReactNode;
  onCreateInvoice: (order: SalesOrderWithDetails) => void;
  onGenerateDocuments: (order: SalesOrderWithDetails) => void;
  creatingInvoiceId?: string;
}

const OrdersTable = ({
  orders,
  isLoading,
  onViewOrder,
  getStatusBadge,
  getInvoiceBadge,
  getEwayBadge,
  onCreateInvoice,
  onGenerateDocuments,
  creatingInvoiceId,
}: OrdersTableProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No orders found
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invoice / E-Invoice</TableHead>
            <TableHead>E-Way Bill</TableHead>
            <TableHead className="text-right sticky right-0 bg-card z-10">Actions</TableHead>

          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const latestInvoice = order.invoices?.[0];
            const latestDispatch = order.dispatches?.[0];
            const canGenerateDocuments = order.status === "ready_to_dispatch" || order.status === "fulfilled";

            return (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.order_number}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{format(new Date(order.created_at), 'dd MMM yyyy')}</TableCell>
                <TableCell>{order.customer?.company_name || "N/A"}</TableCell>
                <TableCell className="text-right">
                  ₹{order.order_value?.toLocaleString("en-IN") || "0"}
                </TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {latestInvoice ? latestInvoice.invoice_number : "No invoice"}
                    </p>
                    {getInvoiceBadge(latestInvoice?.irn, latestInvoice?.einvoice_status)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {latestDispatch ? latestDispatch.dispatch_number : "No dispatch"}
                    </p>
                    {getEwayBadge(latestDispatch?.eway_bill_number, latestDispatch?.eway_bill_status)}
                  </div>
                </TableCell>
                <TableCell className="text-right sticky right-0 bg-card z-10">

                  <div className="flex items-center justify-end gap-1">
                    {!latestInvoice && canGenerateDocuments && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title="Create invoice"
                        onClick={() => onCreateInvoice(order)}
                        disabled={creatingInvoiceId === order.id}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {latestInvoice && canGenerateDocuments && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        title="Generate e-invoice / e-way bill"
                        onClick={() => onGenerateDocuments(order)}
                      >
                        <FileCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="View order"
                      onClick={() => onViewOrder(order.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>

              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
