import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  Circle,
  Plus,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { downloadFile } from "@/lib/download-utils";

interface FinanceDocumentsSectionProps {
  orderId: string;
  orderNumber: string;
}

interface OrderDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  created_at: string;
  uploaded_by: string | null;
  uploader?: {
    full_name: string;
  } | null;
}

const documentTypes = [
  { value: "tax_invoice", label: "Tax Invoice" },
  { value: "eway_bill", label: "E-way Bill" },
  { value: "awb", label: "AWB Copy" },
  { value: "customer_po", label: "Customer PO" },
  { value: "payment_receipt", label: "Payment Receipt" },
  { value: "product_image", label: "Product Image" },
  { value: "other", label: "Other Document" },
] as const;

type DocumentTypeValue = typeof documentTypes[number]["value"];

const keyDocuments: DocumentTypeValue[] = ["tax_invoice", "eway_bill"];

export const FinanceDocumentsSection = ({
  orderId,
  orderNumber,
}: FinanceDocumentsSectionProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["order-documents", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_documents")
        .select(`
          *,
          uploader:profiles!order_documents_uploaded_by_fkey(full_name)
        `)
        .eq("sales_order_id", orderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as OrderDocument[];
    },
    enabled: !!orderId,
  });

  const hasDocument = (type: string) => {
    return documents?.some((doc) => doc.document_type === type);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocType) {
      toast.error("Please select a document type first");
      return;
    }

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${orderId}/${selectedDocType}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("order-documents")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("order-documents")
        .getPublicUrl(fileName);

      // Create document record
      const { error: insertError } = await supabase
        .from("order_documents")
        .insert({
          sales_order_id: orderId,
          document_type: selectedDocType as DocumentTypeValue,
          file_name: file.name,
          file_url: urlData.publicUrl,
          uploaded_by: user?.id,
        });

      if (insertError) throw insertError;

      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: ["order-documents", orderId] });
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
      setSelectedDocType("");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const { error } = await supabase
        .from("order_documents")
        .delete()
        .eq("id", docId);

      if (error) throw error;

      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["order-documents", orderId] });
      queryClient.invalidateQueries({ queryKey: ["finance-orders"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document");
    }
  };

  const handleDownload = async (url: string, fileName: string) => {
    await downloadFile(url, fileName);
  };

  const getDocumentLabel = (type: string) => {
    return documentTypes.find((d) => d.value === type)?.label || type;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents
        </h3>
      </div>

      {/* Key Documents Status */}
      <div className="grid grid-cols-2 gap-4">
        {keyDocuments.map((docType) => {
          const exists = hasDocument(docType);
          const label = getDocumentLabel(docType);
          return (
            <div
              key={docType}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                exists
                  ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                  : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
              }`}
            >
              {exists ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground">
                  {exists ? "Uploaded" : "Pending"}
                </p>
              </div>
              {!exists && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDocType(docType);
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload New Document */}
      <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/30">
        <Select value={selectedDocType} onValueChange={setSelectedDocType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Document type" />
          </SelectTrigger>
          <SelectContent>
            {documentTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedDocType || isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Upload Document
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Uploaded Documents List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Uploaded Documents ({documents.length})
          </p>
          <div className="border rounded-lg divide-y">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{doc.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {getDocumentLabel(doc.document_type)}
                      </Badge>
                      <span>•</span>
                      <span>
                        {format(new Date(doc.created_at), "dd MMM yyyy")}
                      </span>
                      {doc.uploader && (
                        <>
                          <span>•</span>
                          <span>by {doc.uploader.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(doc.file_url, doc.file_name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground border rounded-lg">
          No documents uploaded yet
        </div>
      )}
    </div>
  );
};
