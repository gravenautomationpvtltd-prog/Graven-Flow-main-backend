import React, { useCallback, useState } from 'react';
import { Upload, X, FileText, Image, FileSpreadsheet, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EnquiryAttachmentUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.xls,.xlsx,.csv,.doc,.docx';

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />;
  if (file.type === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.type === 'text/csv') {
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EnquiryAttachmentUpload({
  files,
  onFilesChange,
  maxFiles = 10,
  disabled = false,
}: EnquiryAttachmentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      ACCEPTED_TYPES.includes(file.type) || file.name.match(/\.(pdf|jpg|jpeg|png|webp|gif|xls|xlsx|csv|doc|docx)$/i)
    );
    
    const newFiles = [...files, ...droppedFiles].slice(0, maxFiles);
    onFilesChange(newFiles);
  }, [files, maxFiles, onFilesChange, disabled]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && !disabled) {
      const selectedFiles = Array.from(e.target.files);
      const newFiles = [...files, ...selectedFiles].slice(0, maxFiles);
      onFilesChange(newFiles);
    }
    e.target.value = '';
  }, [files, maxFiles, onFilesChange, disabled]);

  const removeFile = useCallback((index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  }, [files, onFilesChange]);

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
          isDragging && !disabled && "border-primary bg-primary/5",
          !isDragging && !disabled && "border-muted-foreground/25 hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="enquiry-attachment-input"
          className="hidden"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          disabled={disabled || files.length >= maxFiles}
        />
        <label
          htmlFor="enquiry-attachment-input"
          className={cn(
            "flex flex-col items-center gap-2 cursor-pointer",
            (disabled || files.length >= maxFiles) && "cursor-not-allowed"
          )}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <span className="text-primary font-medium">Click to upload</span> or drag and drop
          </div>
          <div className="text-xs text-muted-foreground">
            PDF, Images, Excel, CSV (max {maxFiles} files)
          </div>
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
            >
              {getFileIcon(file)}
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatFileSize(file.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeFile(index)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
