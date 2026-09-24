import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, CheckCircle2, XCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { parseCSV, validateAndTransformCSVRow, generateSampleCSV, downloadCSV } from '@/lib/csv-utils';
import { checkDuplicateCustomers } from '@/hooks/useCheckDuplicateCustomer';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ImportCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportResult {
  row: number;
  companyName: string;
  phone: string;
  status: 'pending' | 'success' | 'error' | 'duplicate';
  errors?: string[];
  duplicateOf?: string;
  duplicateAssignedTo?: string;
}

export function ImportCustomersDialog({ open, onOpenChange }: ImportCustomersDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const createCustomer = useCreateCustomer();
  const { user } = useAuth();
  const { hasTenant, loading: tenantLoading, refresh: refreshTenant } = useTenantStatus();
  const isOrphaned = !tenantLoading && !hasTenant;

  useEffect(() => {
    if (open) refreshTenant();
  }, [open, refreshTenant]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setImportComplete(false);
    setIsChecking(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const rows = parseCSV(content);
      
      // Extract all phone numbers for batch duplicate check
      const phones = rows.map(row => row['phone'] || '').filter(p => p);
      
      // Check for duplicates in one batch query (now includes assigned_sales_name)
      const duplicates = await checkDuplicateCustomers(phones);
      
      // Also check for duplicates within the CSV itself
      const seenPhones = new Map<string, number>();
      
      const results: ImportResult[] = rows.map((row, index) => {
        const validation = validateAndTransformCSVRow(row);
        const phone = row['phone'] || '';
        const companyName = row['company_name'] || 'Unknown';
        const rowNum = index + 2; // +2 because row 1 is header, and we start at 0
        
        // Check if duplicate in database
        if (duplicates.has(phone)) {
          const duplicateCustomer = duplicates.get(phone)!;
          return {
            row: rowNum,
            companyName,
            phone,
            status: 'duplicate' as const,
            duplicateOf: duplicateCustomer.company_name,
            duplicateAssignedTo: duplicateCustomer.assigned_sales_name || undefined,
          };
        }
        
        // Check if duplicate within CSV (earlier row takes precedence)
        const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
        if (normalizedPhone.length >= 10 && seenPhones.has(normalizedPhone)) {
          return {
            row: rowNum,
            companyName,
            phone,
            status: 'duplicate' as const,
            duplicateOf: `Row ${seenPhones.get(normalizedPhone)} in this file`,
          };
        }
        
        // Mark this phone as seen for future rows
        if (normalizedPhone.length >= 10) {
          seenPhones.set(normalizedPhone, rowNum);
        }
        
        return {
          row: rowNum,
          companyName,
          phone,
          status: validation.valid ? 'pending' : 'error',
          errors: validation.errors.length > 0 ? validation.errors : undefined,
        };
      });

      setParsedRows(results);
      setIsChecking(false);
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const rows = parseCSV(content);
      
      const updatedResults = [...parsedRows];
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        // Skip duplicates and errors
        if (updatedResults[i].status === 'error') {
          errorCount++;
          continue;
        }
        
        if (updatedResults[i].status === 'duplicate') {
          skippedCount++;
          continue;
        }

        const validation = validateAndTransformCSVRow(rows[i]);
        if (!validation.valid || !validation.data) {
          updatedResults[i] = { ...updatedResults[i], status: 'error', errors: validation.errors };
          errorCount++;
          continue;
        }

        try {
          await createCustomer.mutateAsync({
            ...validation.data,
            assigned_sales_id: user?.id || null,
          });
          updatedResults[i] = { ...updatedResults[i], status: 'success' };
          successCount++;
        } catch (error) {
          updatedResults[i] = { 
            ...updatedResults[i], 
            status: 'error', 
            errors: [(error as Error).message] 
          };
          errorCount++;
        }

        setParsedRows([...updatedResults]);
      }

      setIsImporting(false);
      setImportComplete(true);
      
      let message = `Import complete: ${successCount} imported`;
      if (skippedCount > 0) message += `, ${skippedCount} duplicates skipped`;
      if (errorCount > 0) message += `, ${errorCount} failed`;
      toast.success(message);
    };

    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const template = generateSampleCSV();
    downloadCSV(template, 'customers_template.csv');
    toast.success('Template downloaded');
  };

  const handleClose = () => {
    setFile(null);
    setParsedRows([]);
    setImportComplete(false);
    onOpenChange(false);
  };

  const pendingCount = parsedRows.filter(r => r.status === 'pending').length;
  const duplicateCount = parsedRows.filter(r => r.status === 'duplicate').length;
  const errorCount = parsedRows.filter(r => r.status === 'error').length;
  const successCount = parsedRows.filter(r => r.status === 'success').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Customers from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import customers. Download the template for the correct format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isOrphaned && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Your account isn't linked to an organization. Please contact your admin to be added before importing customers.
              </AlertDescription>
            </Alert>
          )}

          {/* Download Template */}
          <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Download CSV Template
          </Button>

          {/* File Upload */}
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
              disabled={isImporting || isChecking || isOrphaned}
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {isChecking ? 'Checking for duplicates...' : file ? file.name : 'Click to upload or drag and drop CSV file'}
              </p>
            </label>
          </div>

          {/* Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span>{parsedRows.length} rows</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{importComplete ? successCount : pendingCount} {importComplete ? 'imported' : 'valid'}</span>
                </div>
                {duplicateCount > 0 && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{duplicateCount} duplicates</span>
                  </div>
                )}
                {errorCount > 0 && (
                  <div className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span>{errorCount} errors</span>
                  </div>
                )}
              </div>

              <ScrollArea className="h-48 border rounded-md">
                <div className="p-2 space-y-1">
                  {parsedRows.map((result) => (
                    <div
                      key={result.row}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        result.status === 'error'
                          ? 'bg-destructive/10'
                          : result.status === 'success'
                          ? 'bg-green-500/10'
                          : result.status === 'duplicate'
                          ? 'bg-amber-500/10'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {result.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        {result.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                        {result.status === 'pending' && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                        {result.status === 'duplicate' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                        <span>Row {result.row}: {result.companyName}</span>
                      </div>
                      {result.errors && (
                        <span className="text-xs text-destructive">{result.errors.join(', ')}</span>
                      )}
                      {result.duplicateOf && (
                        <span className="text-xs text-amber-600">
                          Duplicate of: {result.duplicateOf}
                          {result.duplicateAssignedTo && (
                            <span className="font-medium"> (Assigned to {result.duplicateAssignedTo})</span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {importComplete ? 'Close' : 'Cancel'}
            </Button>
            {!importComplete && parsedRows.length > 0 && pendingCount > 0 && (
              <Button onClick={handleImport} disabled={isImporting || isChecking || isOrphaned}>
                {isImporting ? 'Importing...' : `Import ${pendingCount} Customers`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
