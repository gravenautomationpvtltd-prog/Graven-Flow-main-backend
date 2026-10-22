import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { requireTenantId } from "@/utils/tenantUtils";
import { ensureFreshSession } from "@/utils/sessionGuard";

interface AccountsRecordOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountsRecordOrderDialog({
  open,
  onOpenChange,
}: AccountsRecordOrderDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [poFile, setPoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch salespersons
  const { data: salespersons } = useQuery({
    queryKey: ["accounts-salespersons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch customers based on search
  const { data: customers } = useQuery({
    queryKey: ["accounts-customers", customerSearch],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("id, company_name, contact_person, phone")
        .is("deleted_at", null)
        .order("company_name")
        .limit(50);

      if (customerSearch) {
        query = query.or(
          `company_name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch quotations for selected customer
  const { data: quotations } = useQuery({
    queryKey: ["accounts-quotations", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const { data, error } = await supabase
        .from("quotations")
        .select("id, quotation_number, grand_total")
        .eq("customer_id", selectedCustomerId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCustomerId && open,
  });

  const selectedQuotation = quotations?.find(
    (q) => q.id === selectedQuotationId
  );

  const handlePoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPoFile(file);
  };

  const resetForm = () => {
    setSelectedSalesperson("");
    setSelectedCustomerId("");
    setSelectedQuotationId("");
    setCustomerSearch("");
    setNotes("");
    setPoFile(null);
    isSubmittingRef.current = false;
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    if (!selectedSalesperson) {
      toast.error("Please select a salesperson");
      return;
    }
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    if (!selectedQuotationId) {
      toast.error("Please select a quotation");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await ensureFreshSession();
      const tenantId = await requireTenantId();
      const orderValue = selectedQuotation?.grand_total || 0;

      // Idempotency pre-check: prevent duplicate orders for the same quotation
      const { data: existingOrder } = await supabase
        .from("sales_orders")
        .select("id, order_number, status")
        .eq("quotation_id", selectedQuotationId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingOrder && existingOrder.status !== "pending_documents") {
        toast.error(`Order already exists for this quotation (${existingOrder.order_number})`);
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const effectiveUserId = user?.id || authUser?.id || null;

      let order = existingOrder;
      if (!order) {
        // Create the sales order (do NOT hardcode "TEMP", let sequence/trigger generate order_number)
        const insertPayload = {
          customer_id: selectedCustomerId,
          quotation_id: selectedQuotationId,
          created_by: selectedSalesperson || effectiveUserId,
          order_value: orderValue,
          status: "pending_documents" as const,
          payment_status: "pending" as const,
          payment_amount: 0,
          notes: notes || null,
          tenant_id: tenantId,
        } as any;

        let { data: newOrder, error: orderError } = await supabase
          .from("sales_orders")
          .insert(insertPayload)
          .select()
          .single();

        // Retry once on collision
        if (orderError?.code === "23505" && orderError?.message?.includes("order_number")) {
          const retryRes = await supabase
            .from("sales_orders")
            .insert(insertPayload)
            .select()
            .single();
          newOrder = retryRes.data;
          orderError = retryRes.error;
        }

        if (orderError) throw orderError;
        order = newOrder;
      }

      // Upload PO if provided
      if (poFile && order) {
        const fileExt = poFile.name.split(".").pop();
        const fileName = `${order.id}/customer_po-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("order-documents")
          .upload(fileName, poFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("order-documents")
            .getPublicUrl(fileName);

          await supabase.from("order_documents").insert({
            sales_order_id: order.id,
            document_type: "customer_po",
            file_name: poFile.name,
            file_url: urlData.publicUrl,
            uploaded_by: effectiveUserId,
          });
        }
      }

      toast.success(`Order ${order.order_number} created successfully`);
      // Invalidate queries across all role dashboards
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer-po-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["employee-orders"] });
      queryClient.invalidateQueries({ queryKey: ["employee-deals"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Order creation error:", error);
      toast.error(error.message || "Failed to create order");
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record New Order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Salesperson */}
          <div className="space-y-2">
            <Label>Salesperson *</Label>
            <Select
              value={selectedSalesperson}
              onValueChange={setSelectedSalesperson}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select salesperson" />
              </SelectTrigger>
              <SelectContent>
                {salespersons?.map((sp) => (
                  <SelectItem key={sp.id} value={sp.id}>
                    {sp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Search */}
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Input
              placeholder="Search customer by name or phone..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setSelectedCustomerId("");
                setSelectedQuotationId("");
              }}
            />
            {customers && customers.length > 0 && !selectedCustomerId && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setCustomerSearch(c.company_name);
                    }}
                  >
                    <span className="font-medium">{c.company_name}</span>
                    {c.phone && (
                      <span className="text-muted-foreground ml-2">
                        {c.phone}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedCustomerId && (
              <p className="text-sm text-primary">
                ✓ Customer selected
              </p>
            )}
          </div>

          {/* Quotation */}
          {selectedCustomerId && (
            <div className="space-y-2">
              <Label>Quotation *</Label>
              <Select
                value={selectedQuotationId}
                onValueChange={setSelectedQuotationId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select quotation" />
                </SelectTrigger>
                <SelectContent>
                  {quotations?.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.quotation_number} — ₹
                      {q.grand_total?.toLocaleString("en-IN")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedQuotation && (
                <p className="text-sm text-muted-foreground">
                  Order Value: ₹
                  {selectedQuotation.grand_total?.toLocaleString("en-IN")}
                </p>
              )}
            </div>
          )}

          {/* Customer PO Upload */}
          <div className="space-y-2">
            <Label>Customer PO (optional)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload PO
              </Button>
              {poFile && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[200px]">{poFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPoFile(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handlePoFileChange}
              className="hidden"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any notes about the order..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
