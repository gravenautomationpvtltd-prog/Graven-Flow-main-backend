import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TENDER_DOC_TYPES,
  openTenderDocument,
  useDeleteTenderDocument,
  useTenderDocuments,
  useUploadTenderDocument,
} from '@/hooks/useTenderDocuments';

const label = (value: string) => value.replace(/_/g, ' ');

export function TenderDocuments({ tenderId }: { tenderId: string }) {
  const { data: documents = [] } = useTenderDocuments(tenderId);
  const upload = useUploadTenderDocument();
  const remove = useDeleteTenderDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<string>('tender_notice');

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" />Tender documents</p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label>Document type</Label>
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TENDER_DOC_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">{label(type)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />{upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate({ tenderId, file, documentType });
            event.target.value = '';
          }}
        />
      </div>

      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{doc.file_name}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {label(doc.document_type)} · {format(new Date(doc.created_at), 'dd MMM yyyy')}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" size="icon" variant="ghost" onClick={() => openTenderDocument(doc.file_path)} aria-label="Open document">
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => remove.mutate({ id: doc.id, filePath: doc.file_path, tenderId })}
                aria-label="Delete document"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {!documents.length && <p className="py-4 text-center text-sm text-muted-foreground">No documents yet</p>}
      </div>
    </div>
  );
}
