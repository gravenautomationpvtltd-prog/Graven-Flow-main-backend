import { useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  History, 
  Download, 
  User, 
  Clock,
  FileText,
  ArrowRight,
  GitCompare
} from 'lucide-react';
import { useQuotationVersions, QuotationVersion } from '@/hooks/useQuotationVersions';
import { QuotationWithDetails } from '@/hooks/useQuotations';
import { downloadVersionPDF } from '@/lib/version-pdf';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { toast } from 'sonner';
import { QuotationVersionCompare } from './QuotationVersionCompare';

interface QuotationVersionHistoryProps {
  quotationId: string;
  currentQuotation: QuotationWithDetails;
  companyDefaults?: {
    defaultPhone?: string;
    defaultEmail?: string;
  };
}

export function QuotationVersionHistory({ 
  quotationId, 
  currentQuotation,
  companyDefaults 
}: QuotationVersionHistoryProps) {
  const { data: versions, isLoading } = useQuotationVersions(quotationId);
  const { branding } = useTenantBranding();
  const [selectedVersion, setSelectedVersion] = useState<QuotationVersion | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleDownloadVersion = (version: QuotationVersion) => {
    try {
      downloadVersionPDF(version, currentQuotation, companyDefaults, branding);
      toast.success(`Downloaded Version ${version.version_number}`);
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  };

  const handleViewDetails = (version: QuotationVersion) => {
    setSelectedVersion(version);
    setDetailsOpen(true);
  };

  const toggleCompareSelection = (versionId: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      }
      if (prev.length >= 2) {
        // Replace the first selected with new one
        return [prev[1], versionId];
      }
      return [...prev, versionId];
    });
  };

  const getCompareVersions = () => {
    if (!versions || selectedForCompare.length !== 2) return { versionA: null, versionB: null };
    const versionA = versions.find(v => v.id === selectedForCompare[0]) || null;
    const versionB = versions.find(v => v.id === selectedForCompare[1]) || null;
    return { versionA, versionB };
  };

  const { versionA, versionB } = getCompareVersions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
          <History className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-medium mb-1">No version history</h3>
        <p className="text-sm text-muted-foreground">
          Previous versions will appear here when the quotation is edited
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Compare Action Bar */}
      {versions && versions.length >= 2 && (
        <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2 text-sm">
            <GitCompare className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {selectedForCompare.length === 0 && "Select 2 versions to compare"}
              {selectedForCompare.length === 1 && "Select 1 more version"}
              {selectedForCompare.length === 2 && "2 versions selected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedForCompare.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedForCompare([])}
              >
                Clear
              </Button>
            )}
            <Button 
              size="sm"
              disabled={selectedForCompare.length !== 2}
              onClick={() => setCompareOpen(true)}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Compare
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {/* Current version indicator */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Current Version</span>
                    <Badge className="bg-primary">Rev. {versions.length + 1}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(currentQuotation.grand_total)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Previous versions */}
          {versions.map((version, index) => {
            const nextVersion = versions[index - 1];
            const amountChange = nextVersion 
              ? (nextVersion.grand_total || 0) - (version.grand_total || 0)
              : (currentQuotation.grand_total || 0) - (version.grand_total || 0);

            const isSelected = selectedForCompare.includes(version.id);

            return (
              <div 
                key={version.id} 
                className={`rounded-lg border p-4 hover:bg-muted/50 transition-colors ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {versions.length >= 2 && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleCompareSelection(version.id)}
                        className="mt-1"
                      />
                    )}
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <History className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Version {version.version_number}</span>
                        {amountChange !== 0 && (
                          <Badge variant={amountChange > 0 ? 'default' : 'secondary'} className="text-xs">
                            {amountChange > 0 ? '+' : ''}{formatCurrency(amountChange)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(version.created_at), 'dd MMM yyyy, hh:mm a')}
                        </span>
                        {version.created_by_profile && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.created_by_profile.full_name || version.created_by_profile.email}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1">
                        {formatCurrency(version.grand_total)} • {version.items_snapshot.length} items
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleViewDetails(version)}
                    >
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadVersion(version)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Version Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version {selectedVersion?.version_number} Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedVersion && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
                {/* Meta info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {format(new Date(selectedVersion.created_at), 'dd MMM yyyy, hh:mm a')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">By</p>
                    <p className="font-medium">
                      {selectedVersion.created_by_profile?.full_name || 'Unknown'}
                    </p>
                  </div>
                  {selectedVersion.subject && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Subject</p>
                      <p className="font-medium">{selectedVersion.subject}</p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div>
                  <h4 className="font-medium mb-2">Items ({selectedVersion.items_snapshot.length})</h4>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">#</th>
                          <th className="text-left p-2 font-medium">Description</th>
                          <th className="text-right p-2 font-medium">Qty</th>
                          <th className="text-right p-2 font-medium">Rate</th>
                          <th className="text-right p-2 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedVersion.items_snapshot.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2">{item.description}</td>
                            <td className="p-2 text-right">{item.quantity}</td>
                            <td className="p-2 text-right">{formatCurrency(item.rate)}</td>
                            <td className="p-2 text-right">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(selectedVersion.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-600">-{formatCurrency(selectedVersion.total_discount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(selectedVersion.total_tax)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t">
                      <span>Grand Total</span>
                      <span>{formatCurrency(selectedVersion.grand_total)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={() => handleDownloadVersion(selectedVersion)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download This Version
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Version Compare Dialog */}
      <QuotationVersionCompare
        open={compareOpen}
        onOpenChange={setCompareOpen}
        versionA={versionA}
        versionB={versionB}
        versionALabel={versionA ? `Version ${versionA.version_number}` : 'Version A'}
        versionBLabel={versionB ? `Version ${versionB.version_number}` : 'Version B'}
      />
    </>
  );
}
