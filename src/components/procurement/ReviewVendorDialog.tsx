import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Building2, User, Phone, Mail, MapPin, Globe, CreditCard, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Supplier, useApproveVendor, useRejectVendor } from '@/hooks/useSuppliers';

interface ReviewVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: Supplier | null;
}

export function ReviewVendorDialog({ open, onOpenChange, vendor }: ReviewVendorDialogProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const approveVendor = useApproveVendor();
  const rejectVendor = useRejectVendor();

  if (!vendor) return null;

  const handleApprove = async () => {
    await approveVendor.mutateAsync(vendor.id);
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    await rejectVendor.mutateAsync({ id: vendor.id, reason: rejectionReason });
    setRejectionReason('');
    setShowRejectForm(false);
    onOpenChange(false);
  };

  const categoryLabels: Record<string, string> = {
    manufacturer: 'Manufacturer',
    dealer: 'Dealer',
    distributor: 'Distributor',
    service_provider: 'Service Provider',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
  };

  const DocumentLink = ({ url, label }: { url: string | null; label: string }) => {
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted transition-colors text-sm"
      >
        <FileText className="h-4 w-4" />
        <span>{label}</span>
        <ExternalLink className="h-3 w-3 ml-auto" />
      </a>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Review Vendor Application</DialogTitle>
            <Badge className={statusColors[vendor.status || 'pending']}>
              {(vendor.status || 'pending').toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Company Information */}
          <div>
            <h3 className="font-medium flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4" />
              Company Information
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Company Name:</span>
                <p className="font-medium">{vendor.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Category:</span>
                <p className="font-medium">{categoryLabels[vendor.category || ''] || vendor.category || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">GST Number:</span>
                <p className="font-medium">{vendor.gst_number || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">PAN Number:</span>
                <p className="font-medium">{vendor.pan_number || '-'}</p>
              </div>
              {vendor.website && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Website:</span>
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {vendor.website}
                  </a>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-muted-foreground">Authorized Dealer:</span>
                <p className="font-medium">{vendor.is_authorized_dealer ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h3 className="font-medium flex items-center gap-2 mb-3">
              <User className="h-4 w-4" />
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Contact Person:</span>
                <p className="font-medium">{vendor.contact_person || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone:</span>
                <p className="font-medium">{vendor.phone || '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email:</span>
                <p className="font-medium">{vendor.email || '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Address:</span>
                <p className="font-medium">
                  {[vendor.address, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ') || '-'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Bank Details */}
          <div>
            <h3 className="font-medium flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4" />
              Bank Details
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Preferred Currency:</span>
                <p className="font-medium">{vendor.preferred_currency || 'INR'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Bank Name:</span>
                <p className="font-medium">{vendor.bank_name || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Account Number:</span>
                <p className="font-medium">{vendor.bank_account_number || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">IFSC Code:</span>
                <p className="font-medium">{vendor.bank_ifsc || '-'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Documents */}
          <div>
            <h3 className="font-medium flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4" />
              Uploaded Documents
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <DocumentLink url={vendor.gst_certificate_url} label="GST Certificate" />
              <DocumentLink url={vendor.pan_card_url} label="PAN Card" />
              <DocumentLink url={vendor.cancelled_cheque_url} label="Cancelled Cheque" />
              <DocumentLink url={vendor.coi_url} label="Certificate of Incorporation" />
              <DocumentLink url={vendor.msme_certificate_url} label="MSME Certificate" />
              <DocumentLink url={vendor.brand_authorization_url} label="Brand Authorization" />
            </div>
          </div>

          {/* Rejection Form */}
          {showRejectForm && (
            <>
              <Separator />
              <div>
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </>
          )}

          {/* Rejection Reason Display */}
          {vendor.status === 'rejected' && vendor.rejection_reason && (
            <>
              <Separator />
              <div className="p-3 bg-destructive/10 rounded-lg">
                <h4 className="font-medium text-destructive mb-1">Rejection Reason:</h4>
                <p className="text-sm">{vendor.rejection_reason}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {vendor.status === 'pending' && (
            <>
              {showRejectForm ? (
                <>
                  <Button variant="outline" onClick={() => setShowRejectForm(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectionReason.trim() || rejectVendor.isPending}
                  >
                    {rejectVendor.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Close
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setShowRejectForm(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={handleApprove} disabled={approveVendor.isPending}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {approveVendor.isPending ? 'Approving...' : 'Approve Vendor'}
                  </Button>
                </>
              )}
            </>
          )}
          {vendor.status !== 'pending' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
