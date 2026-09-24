import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Clock, Package, Tag, Hash, Ruler, Layers, ListChecks } from 'lucide-react';

interface ParsedData {
  product_name?: string;
  brand?: string;
  model_number?: string;
  specifications?: Record<string, string>;
  quantity?: number;
  unit?: string;
  dimensions?: string;
  material?: string;
  features?: string[];
  price_indication?: string;
  notes?: string;
}

interface ParsedDataDisplayProps {
  status: string | null;
  parsedData: ParsedData | null;
  error: string | null;
}

export function ParsedDataDisplay({ status, parsedData, error }: ParsedDataDisplayProps) {
  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
        <Clock className="h-4 w-4" />
        <span>Awaiting parsing...</span>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="flex items-center gap-2 text-primary text-sm py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Extracting product details...</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm py-2">
        <XCircle className="h-4 w-4" />
        <span>{error || 'Failed to parse file'}</span>
      </div>
    );
  }

  if (status === 'completed' && parsedData) {
    const hasData = Object.keys(parsedData).some(key => {
      const value = parsedData[key as keyof ParsedData];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value || {}).length > 0;
      return value !== undefined && value !== null && value !== '';
    });

    if (!hasData) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
          <CheckCircle className="h-4 w-4" />
          <span>No product details found in file</span>
        </div>
      );
    }

    return (
      <Card className="mt-3">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Extracted Product Details
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4 space-y-3">
          {parsedData.product_name && (
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Product</span>
                <p className="text-sm font-medium">{parsedData.product_name}</p>
              </div>
            </div>
          )}

          {(parsedData.brand || parsedData.model_number) && (
            <div className="flex items-start gap-2">
              <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Brand / Model</span>
                <p className="text-sm">
                  {[parsedData.brand, parsedData.model_number].filter(Boolean).join(' - ')}
                </p>
              </div>
            </div>
          )}

          {(parsedData.quantity || parsedData.unit) && (
            <div className="flex items-start gap-2">
              <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Quantity</span>
                <p className="text-sm">
                  {parsedData.quantity} {parsedData.unit || 'pcs'}
                </p>
              </div>
            </div>
          )}

          {parsedData.dimensions && (
            <div className="flex items-start gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Dimensions</span>
                <p className="text-sm">{parsedData.dimensions}</p>
              </div>
            </div>
          )}

          {parsedData.material && (
            <div className="flex items-start gap-2">
              <Layers className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Material</span>
                <p className="text-sm">{parsedData.material}</p>
              </div>
            </div>
          )}

          {parsedData.specifications && Object.keys(parsedData.specifications).length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Specifications</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(parsedData.specifications).map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {key}: {value}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {parsedData.features && parsedData.features.length > 0 && (
            <div className="flex items-start gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">Features</span>
                <ul className="text-sm list-disc list-inside">
                  {parsedData.features.slice(0, 5).map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {parsedData.price_indication && (
            <div>
              <span className="text-xs text-muted-foreground">Price Indication</span>
              <p className="text-sm font-medium text-green-600">{parsedData.price_indication}</p>
            </div>
          )}

          {parsedData.notes && (
            <div>
              <span className="text-xs text-muted-foreground">Notes</span>
              <p className="text-sm text-muted-foreground">{parsedData.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
