import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Receipt, ExternalLink, Paperclip, Loader2 } from 'lucide-react';
import { OrderDocument, useOrderDocuments } from '@/hooks/useSalesOrders';
import { downloadFile } from '@/lib/download-utils';
import { toast } from 'sonner';

interface OrderDocumentsListProps {
  salesOrderId?: string | null;
  documents?: OrderDocument[];
  className?: string;
  compact?: boolean;
}

export function OrderDocumentsList({
  salesOrderId,
  documents: initialDocuments,
  className = '',
  compact = false,
}: OrderDocumentsListProps) {
  // If documents not passed or passed as empty array while salesOrderId is present, load via hook
  const hasProvidedDocs = Array.isArray(initialDocuments) && initialDocuments.length > 0;
  const { data: fetchedDocuments = [], isLoading } = useOrderDocuments(
    !hasProvidedDocs && salesOrderId ? salesOrderId : undefined
  );

  const docs = hasProvidedDocs ? initialDocuments : fetchedDocuments;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (doc: OrderDocument) => {
    try {
      setDownloadingId(doc.id);
      await downloadFile(doc.file_url, doc.file_name);
    } catch (err) {
      console.error('Failed to download document:', err);
      toast.error('Could not download file directly. Opening in new tab.');
      window.open(doc.file_url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  };

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case 'customer_po':
        return <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-xs">Customer PO</Badge>;
      case 'payment_receipt':
        return <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs">Receipt</Badge>;
      case 'tax_invoice':
        return <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-xs">Tax Invoice</Badge>;
      case 'eway_bill':
        return <Badge className="bg-indigo-600 text-white hover:bg-indigo-700 text-xs">E-Way Bill</Badge>;
      default:
        return <Badge variant="outline" className="text-xs uppercase">{type.replace(/_/g, ' ')}</Badge>;
    }
  };

  if (isLoading && !docs.length) {
    return <p className="text-xs text-muted-foreground animate-pulse">Loading documents...</p>;
  }

  if (!docs || docs.length === 0) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        <p className="text-xs italic text-muted-foreground">No documents attached</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {docs.map((doc) => (
          <div
            key={doc.id}
            className="inline-flex items-center rounded-md border border-input bg-background/90 p-0.5 text-xs shadow-xs"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 hover:bg-muted font-normal"
              onClick={() => handleDownload(doc)}
              disabled={downloadingId === doc.id}
              title={`Download ${doc.file_name || doc.document_type}`}
            >
              {downloadingId === doc.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : doc.document_type === 'payment_receipt' ? (
                <Receipt className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-blue-600" />
              )}
              <span className="max-w-[120px] truncate">{doc.file_name || doc.document_type}</span>
              <Download className="h-3 w-3 text-muted-foreground ml-0.5" />
            </Button>
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 px-1.5 hover:text-primary text-muted-foreground transition-colors border-l border-border/50"
              title="Open / View document in new tab"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {docs.map((doc) => {
        const isPO = doc.document_type === 'customer_po' || doc.file_name?.toLowerCase().includes('po');
        return (
          <div
            key={doc.id}
            className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
              isPO
                ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900'
                : 'bg-muted/40 hover:bg-muted/60 border-border'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 mr-2">
              <div
                className={`p-1.5 rounded-md ${
                  isPO
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {doc.document_type === 'payment_receipt' ? (
                  <Receipt className="h-4 w-4" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate text-foreground">
                  {doc.file_name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {getDocTypeBadge(doc.document_type)}
                  {doc.created_at && (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs gap-1 hover:bg-background"
                onClick={() => handleDownload(doc)}
                disabled={downloadingId === doc.id}
              >
                {downloadingId === doc.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Download
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-background"
                asChild
              >
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
