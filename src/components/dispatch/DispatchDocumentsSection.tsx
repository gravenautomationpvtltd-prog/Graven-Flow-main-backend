import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  FileCheck,
  Truck,
  Package,
} from 'lucide-react';
import {
  useDispatchDocuments,
  useUploadDispatchDocument,
  useDeleteDispatchDocument,
} from '@/hooks/useDispatchDocuments';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Database } from '@/integrations/supabase/types';
import { downloadFile } from '@/lib/download-utils';

type DispatchDocumentType = Database['public']['Enums']['dispatch_document_type'];

interface DispatchDocumentsSectionProps {
  dispatchId: string;
}

const documentTypeLabels: Record<DispatchDocumentType, string> = {
  invoice: 'Tax Invoice',
  eway_bill: 'E-Way Bill',
  awb: 'AWB / Docket',
  packing_list: 'Packing List',
  other: 'Other Document',
};

const documentTypeIcons: Record<DispatchDocumentType, React.ReactNode> = {
  invoice: <FileCheck className="h-4 w-4" />,
  eway_bill: <Truck className="h-4 w-4" />,
  awb: <Package className="h-4 w-4" />,
  packing_list: <FileText className="h-4 w-4" />,
  other: <FileText className="h-4 w-4" />,
};

export function DispatchDocumentsSection({ dispatchId }: DispatchDocumentsSectionProps) {
  const [selectedType, setSelectedType] = useState<DispatchDocumentType>('invoice');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: documents, isLoading } = useDispatchDocuments(dispatchId);
  const uploadDocument = useUploadDispatchDocument();
  const deleteDocument = useDeleteDispatchDocument();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadDocument.mutateAsync({
      dispatchId,
      file,
      documentType: selectedType,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteDocument.mutateAsync({ id, dispatchId });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Section */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedType}
            onValueChange={(v) => setSelectedType(v as DispatchDocumentType)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(documentTypeLabels) as DispatchDocumentType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    {documentTypeIcons[type]}
                    {documentTypeLabels[type]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadDocument.isPending}
          >
            <Upload className="h-4 w-4 mr-1" />
            {uploadDocument.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </div>

        {/* Documents List */}
        {!documents || documents.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No documents uploaded yet
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {documentTypeIcons[doc.document_type]}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{doc.file_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {documentTypeLabels[doc.document_type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {format(new Date(doc.created_at), 'dd MMM yyyy, hh:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => downloadFile(doc.file_url, doc.file_name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleteDocument.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
