import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, FileCheck, Truck, CheckCircle } from "lucide-react";
import { useGenerateEInvoice, useGenerateEwayBill } from "@/hooks/useGstApi";

interface GenerateEInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
}

export const GenerateEInvoiceDialog = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
}: GenerateEInvoiceDialogProps) => {
  const [step, setStep] = useState<"config" | "processing" | "done">("config");
  const [generateEway, setGenerateEway] = useState(true);
  const [transporterName, setTransporterName] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("R");
  const [transportMode, setTransportMode] = useState("1");
  const [distance, setDistance] = useState("");
  const [results, setResults] = useState<{
    irn?: string;
    ewayBillNumber?: string;
    error?: string;
  }>({});

  const generateEInvoice = useGenerateEInvoice();
  const generateEwayBill = useGenerateEwayBill();

  // Fetch linked invoice and dispatch
  const { data: linkedData } = useQuery({
    queryKey: ["order-einvoice-data", orderId],
    queryFn: async () => {
      const [invoiceRes, dispatchRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, grand_total, irn, einvoice_status")
          .eq("sales_order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("dispatches")
          .select("id, dispatch_number, eway_bill_number, eway_bill_status, courier_name")
          .eq("sales_order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        invoice: invoiceRes.data,
        dispatch: dispatchRes.data,
      };
    },
    enabled: open,
  });

  const invoice = linkedData?.invoice;
  const dispatch = linkedData?.dispatch;

  const hasIRN = !!invoice?.irn;
  const hasEway = !!dispatch?.eway_bill_number;

  const handleGenerate = async () => {
    setStep("processing");
    const newResults: typeof results = {};

    try {
      // Step 1: Generate E-Invoice if not already done
      if (invoice && !hasIRN) {
        const einvResult = await generateEInvoice.mutateAsync(invoice.id);
        newResults.irn = einvResult.irn;
      } else if (hasIRN) {
        newResults.irn = invoice?.irn || undefined;
      }

      // Step 2: Generate E-Way Bill if checked
      if (generateEway && dispatch && !hasEway) {
        if (!transporterName || !vehicleNumber || !distance) {
          newResults.error = "Please fill transporter details";
          setResults(newResults);
          setStep("config");
          return;
        }
        const ewayResult = await generateEwayBill.mutateAsync({
          dispatch_id: dispatch.id,
          transporter_name: transporterName,
          transporter_id: transporterId || undefined,
          vehicle_number: vehicleNumber,
          vehicle_type: vehicleType as "R" | "O",
          transport_mode: transportMode as "1" | "2" | "3" | "4",
          distance: Number(distance),
          invoice_id: invoice?.id,
        });
        newResults.ewayBillNumber = ewayResult.eway_bill_number;
      }

      setResults(newResults);
      setStep("done");
    } catch (err) {
      newResults.error = (err as Error).message;
      setResults(newResults);
      setStep("config");
    }
  };

  const handleClose = () => {
    setStep("config");
    setResults({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Generate E-Invoice & E-Way Bill
          </DialogTitle>
          <DialogDescription>
            Order: {orderNumber}
          </DialogDescription>
        </DialogHeader>

        {step === "config" && (
          <div className="space-y-4">
            {/* Invoice Status */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">E-Invoice</span>
                {hasIRN ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Generated
                  </Badge>
                ) : invoice ? (
                  <Badge variant="secondary">Ready</Badge>
                ) : (
                  <Badge variant="destructive">No Invoice Found</Badge>
                )}
              </div>
              {invoice && (
                <p className="text-xs text-muted-foreground">
                  {invoice.invoice_number} — ₹{invoice.grand_total?.toLocaleString("en-IN")}
                  {hasIRN && ` | IRN: ${invoice.irn}`}
                </p>
              )}
            </div>

            {/* E-Way Bill Section */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">E-Way Bill</span>
                {hasEway ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Generated
                  </Badge>
                ) : dispatch ? (
                  <Badge variant="secondary">Ready</Badge>
                ) : (
                  <Badge variant="destructive">No Dispatch Found</Badge>
                )}
              </div>
              {dispatch && !hasEway && (
                <p className="text-xs text-muted-foreground">
                  {dispatch.dispatch_number}
                </p>
              )}
              {hasEway && (
                <p className="text-xs text-muted-foreground">
                  E-Way Bill No: {dispatch?.eway_bill_number}
                </p>
              )}
            </div>

            {results.error && (
              <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                {results.error}
              </p>
            )}

            {/* Transport Details for E-Way Bill */}
            {dispatch && !hasEway && (
              <>
                <Separator />
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4" />
                  <Label className="font-medium">Transport Details</Label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Transporter Name *</Label>
                    <Input
                      value={transporterName}
                      onChange={(e) => setTransporterName(e.target.value)}
                      placeholder="e.g. Blue Dart Express"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Transporter GSTIN</Label>
                    <Input
                      value={transporterId}
                      onChange={(e) => setTransporterId(e.target.value)}
                      placeholder="Optional"
                      maxLength={15}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vehicle Number *</Label>
                    <Input
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="e.g. UP32AB1234"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Transport Mode</Label>
                    <Select value={transportMode} onValueChange={setTransportMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Road</SelectItem>
                        <SelectItem value="2">Rail</SelectItem>
                        <SelectItem value="3">Air</SelectItem>
                        <SelectItem value="4">Ship</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Distance (km) *</Label>
                    <Input
                      type="number"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="e.g. 250"
                      min={0}
                      max={9999}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Vehicle Type</Label>
                    <Select value={vehicleType} onValueChange={setVehicleType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="R">Regular</SelectItem>
                        <SelectItem value="O">Over Dimensional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={
                  (!invoice && !hasIRN) ||
                  (generateEInvoice.isPending || generateEwayBill.isPending)
                }
              >
                {hasIRN && hasEway
                  ? "Already Generated"
                  : "Generate Now"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {generateEInvoice.isPending
                ? "Generating E-Invoice..."
                : "Generating E-Way Bill..."}
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <CheckCircle className="h-12 w-12 text-green-600" />
              <p className="font-medium text-lg">Generated Successfully!</p>
            </div>

            {results.irn && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">IRN Number</p>
                <p className="text-sm font-mono break-all">{results.irn}</p>
              </div>
            )}

            {results.ewayBillNumber && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">E-Way Bill Number</p>
                <p className="text-sm font-mono">{results.ewayBillNumber}</p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
