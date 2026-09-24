import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Upload, FileText } from 'lucide-react';
import { useBulkImportProducts, useProductsAdmin } from '@/hooks/useProducts';

interface ParsedProduct {
  name: string;
  hsn_code: string;
  isDuplicate: boolean;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [inputText, setInputText] = useState('');
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isParsed, setIsParsed] = useState(false);

  const { data } = useProductsAdmin(1, 100000, ''); // Fetch all for duplicate checking
  const existingProducts = data?.products ?? [];
  const bulkImport = useBulkImportProducts();

  const parseProducts = () => {
    if (!inputText.trim()) return;

    const lines = inputText.trim().split('\n').filter(line => line.trim());
    const existingNames = existingProducts.map(p => p.name.toLowerCase().trim());

    const parsed: ParsedProduct[] = lines.map(line => {
      let name = '';
      let hsn_code = '';

      // Try different delimiters: tab, pipe, comma
      if (line.includes('\t')) {
        const parts = line.split('\t');
        name = parts[0]?.trim() || '';
        hsn_code = parts[1]?.trim() || '';
      } else if (line.includes('|')) {
        const parts = line.split('|');
        name = parts[0]?.trim() || '';
        hsn_code = parts[1]?.trim() || '';
      } else if (line.includes(',')) {
        const parts = line.split(',');
        name = parts[0]?.trim() || '';
        hsn_code = parts[1]?.trim() || '';
      } else {
        // Just product name, no HSN
        name = line.trim();
      }

      return {
        name,
        hsn_code,
        isDuplicate: existingNames.includes(name.toLowerCase().trim())
      };
    }).filter(p => p.name); // Filter out empty names

    // Also check for duplicates within the parsed list itself
    const seenNames = new Set<string>();
    const deduplicatedParsed = parsed.map(p => {
      const lowerName = p.name.toLowerCase().trim();
      if (seenNames.has(lowerName)) {
        return { ...p, isDuplicate: true };
      }
      seenNames.add(lowerName);
      return p;
    });

    setParsedProducts(deduplicatedParsed);
    setIsParsed(true);
  };

  const handleImport = async () => {
    const productsToImport = parsedProducts
      .filter(p => !p.isDuplicate)
      .map(p => ({ name: p.name, hsn_code: p.hsn_code || undefined }));

    if (productsToImport.length === 0) return;

    await bulkImport.mutateAsync(productsToImport);
    handleClose();
  };

  const handleClose = () => {
    setInputText('');
    setParsedProducts([]);
    setIsParsed(false);
    onOpenChange(false);
  };

  const newProductsCount = parsedProducts.filter(p => !p.isDuplicate).length;
  const duplicatesCount = parsedProducts.filter(p => p.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Products
          </DialogTitle>
          <DialogDescription>
            Paste your product list below. Each line should contain: Product Name, HSN Code
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isParsed ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>Supported formats: comma-separated, pipe-separated, or tab-separated</span>
                </div>
                <Textarea
                  placeholder={`Siemens 3RT20 Contactor, 85365090
ABB Breaker 32A, 85362090
Schneider VFD 5HP | 85044090
Delta Drive 2HP	85044090`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={parseProducts} disabled={!inputText.trim()}>
                  Parse Products
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                {newProductsCount > 0 && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {newProductsCount} new products
                  </Badge>
                )}
                {duplicatesCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {duplicatesCount} duplicates (will be skipped)
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <div className="p-2 space-y-1">
                  {parsedProducts.map((product, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-2 rounded-md text-sm ${
                        product.isDuplicate
                          ? 'bg-muted/50 text-muted-foreground line-through'
                          : 'bg-accent/30'
                      }`}
                    >
                      {product.isDuplicate ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                      <span className="flex-1 truncate">{product.name}</span>
                      {product.hsn_code && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {product.hsn_code}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between items-center gap-2">
                <Button variant="ghost" onClick={() => setIsParsed(false)}>
                  ← Back to Edit
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={newProductsCount === 0 || bulkImport.isPending}
                  >
                    {bulkImport.isPending ? 'Importing...' : `Import ${newProductsCount} Products`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
