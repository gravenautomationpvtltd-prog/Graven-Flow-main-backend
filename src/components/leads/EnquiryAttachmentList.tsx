import React from 'react';
import { Download, Trash2, FileText, Image, FileSpreadsheet, File, Loader2, Sparkles, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEnquiryItemAttachments, useDeleteEnquiryAttachment, EnquiryAttachment } from '@/hooks/useEnquiryAttachments';
import { useParseAttachment } from '@/hooks/useParseAttachment';
import { ParsedDataDisplay } from './ParsedDataDisplay';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface EnquiryAttachmentListProps {
  enquiryItemId: string;
  showDelete?: boolean;
}

function getFileIcon(fileType: string | null) {
  if (fileType?.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
  if (fileType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (fileType?.includes('spreadsheet') || fileType?.includes('excel') || fileType === 'text/csv') {
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isParsableFile(fileName: string, fileType: string | null): boolean {
  const lowerName = fileName.toLowerCase();
  return (
    lowerName.endsWith('.pdf') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    fileType?.startsWith('image/') ||
    fileType?.includes('pdf') ||
    fileType?.includes('spreadsheet') ||
    fileType?.includes('csv') ||
    false
  );
}

export function EnquiryAttachmentList({ enquiryItemId, showDelete = true }: EnquiryAttachmentListProps) {
  const { data: attachments, isLoading } = useEnquiryItemAttachments(enquiryItemId);
  const deleteAttachment = useDeleteEnquiryAttachment();
  const parseAttachment = useParseAttachment();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const handleDownload = (attachment: EnquiryAttachment) => {
    window.open(attachment.file_url, '_blank');
  };

  const handleParse = (attachment: EnquiryAttachment) => {
    parseAttachment.mutate({
      attachmentId: attachment.id,
      fileUrl: attachment.file_url,
      fileName: attachment.file_name,
      fileType: attachment.file_type,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!attachments || attachments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No attachments
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attachments.map((attachment) => {
        const canParse = isParsableFile(attachment.file_name, attachment.file_type);
        const isProcessing = attachment.parsing_status === 'processing' || 
                             (parseAttachment.isPending && parseAttachment.variables?.attachmentId === attachment.id);
        const hasParsedData = attachment.parsing_status === 'completed' && attachment.parsed_data;
        const isExpanded = expandedId === attachment.id;

        return (
          <Collapsible
            key={attachment.id}
            open={isExpanded}
            onOpenChange={(open) => setExpandedId(open ? attachment.id : null)}
          >
            <div className="rounded-md bg-muted/50">
              <div className="flex items-center gap-2 p-2 text-sm">
                {getFileIcon(attachment.file_type)}
                <CollapsibleTrigger asChild>
                  <button className="flex-1 text-left truncate hover:underline">
                    {attachment.file_name}
                  </button>
                </CollapsibleTrigger>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatFileSize(attachment.file_size)}
                </span>
                
                {canParse && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleParse(attachment)}
                    disabled={isProcessing}
                    title={hasParsedData ? "Re-parse file" : "Parse file with AI"}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : hasParsedData ? (
                      <RotateCw className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    )}
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => handleDownload(attachment)}
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                
                {showDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{attachment.file_name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAttachment.mutate(attachment)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
              
              <CollapsibleContent>
                <div className="px-2 pb-2">
                  <ParsedDataDisplay
                    status={attachment.parsing_status}
                    parsedData={attachment.parsed_data as Record<string, unknown> | null}
                    error={attachment.parsing_error}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
