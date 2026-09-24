import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Download, FileText, Truck, CheckCircle, XCircle, Send, AlertCircle, RotateCcw, ClipboardCheck, Shield, UserCheck, Mail, ClipboardList, Star, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { SendPOEmailDialog } from './SendPOEmailDialog';
import { RecordGRNDialog } from './RecordGRNDialog';
import { RateSupplierDialog } from './RateSupplierDialog';
import { RecordPOPaymentDialog } from './RecordPOPaymentDialog';
import { usePOPayments } from '@/hooks/usePOPayments';
import { 
  usePurchaseOrder, 
  useUpdatePurchaseOrder, 
  useApprovePurchaseOrder, 
  useRejectPurchaseOrder, 
  useSubmitForApproval,
  useVerifyPurchaseOrder,
  useAuthorizePurchaseOrder,
  useSendForReview,
  useResubmitAfterReview
} from '@/hooks/usePurchaseOrders';
import { generatePOPdf } from '@/lib/po-pdf';
import { useTenantBranding } from '@/hooks/useTenantBranding';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ViewPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string | null;
  onEdit?: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending_verification: 'bg-amber-100 text-amber-800',
  pending_authorization: 'bg-orange-100 text-orange-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  sent: 'bg-blue-100 text-blue-800',
  acknowledged: 'bg-purple-100 text-purple-800',
  partial: 'bg-yellow-100 text-yellow-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_verification: 'Pending Verification',
  pending_authorization: 'Pending Authorization',
  pending_approval: 'Pending Approval',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  partial: 'Partial',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function ViewPODialog({ open, onOpenChange, poId, onEdit }: ViewPODialogProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewSuggestions, setReviewSuggestions] = useState('');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [grnDialogOpen, setGrnDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentsExpanded, setPaymentsExpanded] = useState(false);

  const { data: po, isLoading } = usePurchaseOrder(poId ?? undefined);
  const { data: paymentSummary } = usePOPayments(poId ?? undefined, po?.grand_total ?? 0);
  const updatePO = useUpdatePurchaseOrder();
  const approvePO = useApprovePurchaseOrder();
  const rejectPO = useRejectPurchaseOrder();
  const submitForApproval = useSubmitForApproval();
  const verifyPO = useVerifyPurchaseOrder();
  const authorizePO = useAuthorizePurchaseOrder();
  const sendForReview = useSendForReview();
  const resubmitAfterReview = useResubmitAfterReview();
  const { isAdmin, isManager } = useAuth();
  const { branding } = useTenantBranding();

  const canApprove = isAdmin || isManager;

  const handleDownloadPdf = () => {
    if (po) {
      generatePOPdf(po, branding);
    }
  };

  const handleMarkDelivered = async () => {
    if (po) {
      await updatePO.mutateAsync({ id: po.id, status: 'delivered' });
    }
  };

  const handleSubmitForApproval = async () => {
    if (po) {
      await submitForApproval.mutateAsync(po.id);
    }
  };

  const handleVerify = async () => {
    if (po) {
      await verifyPO.mutateAsync(po.id);
    }
  };

  const handleAuthorize = async () => {
    if (po) {
      await authorizePO.mutateAsync(po.id);
    }
  };

  const handleApprove = async () => {
    if (po) {
      await approvePO.mutateAsync(po.id);
    }
  };

  const handleReject = async () => {
    if (po && rejectReason.trim()) {
      await rejectPO.mutateAsync({ id: po.id, reason: rejectReason });
      setRejectDialogOpen(false);
      setRejectReason('');
    }
  };

  const handleSendForReview = async () => {
    if (po && reviewSuggestions.trim()) {
      await sendForReview.mutateAsync({ id: po.id, suggestions: reviewSuggestions });
      setReviewDialogOpen(false);
      setReviewSuggestions('');
    }
  };

  const handleResubmit = async () => {
    if (po) {
      await resubmitAfterReview.mutateAsync(po.id);
    }
  };

  if (!poId || isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            Loading...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!po) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="text-center py-8 text-muted-foreground">
            Purchase order not found
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isPendingVerification = po.status === 'pending_verification';
  const isPendingAuthorization = po.status === 'pending_authorization';
  const isPendingApproval = po.status === 'pending_approval';
  const isUnderReview = po.status === 'under_review';
  const canTakeAction = canApprove && (isPendingVerification || isPendingAuthorization || isPendingApproval);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {po.po_number}
            </DialogTitle>
            <Badge className={statusColors[po.status] || 'bg-muted'}>
              {statusLabels[po.status] || po.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Review Suggestions Alert */}
          {isUnderReview && po.review_suggestions && (
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-purple-800">Review Required</h4>
                    <p className="text-sm text-purple-700 mt-1">{po.review_suggestions}</p>
                    {po.review_requester && (
                      <p className="text-xs text-purple-600 mt-2">
                        Requested by {po.review_requester.full_name} on {po.review_requested_at ? format(new Date(po.review_requested_at), 'PPP') : ''}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejection Info */}
          {po.status === 'rejected' && po.notes && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Rejection Reason</h4>
                    <p className="text-sm text-red-700 mt-1">{po.notes}</p>
                    {po.rejector && (
                      <p className="text-xs text-red-600 mt-2">
                        Rejected by {po.rejector.full_name} on {po.rejected_at ? format(new Date(po.rejected_at), 'PPP') : ''}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accountability Section */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Accountability Trail
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Prepared By</p>
                  {po.creator ? (
                    <>
                      <p className="font-medium">{po.creator.full_name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(po.created_at), 'PPP')}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">-</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Verified By</p>
                  {po.verifier ? (
                    <>
                      <p className="font-medium">{po.verifier.full_name}</p>
                      <p className="text-xs text-muted-foreground">{po.verified_at ? format(new Date(po.verified_at), 'PPP') : ''}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Pending</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Authorized By</p>
                  {po.authorizer ? (
                    <>
                      <p className="font-medium">{po.authorizer.full_name}</p>
                      <p className="text-xs text-muted-foreground">{po.authorized_at ? format(new Date(po.authorized_at), 'PPP') : ''}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Pending</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Approved By</p>
                  {po.approver ? (
                    <>
                      <p className="font-medium">{po.approver.full_name}</p>
                      <p className="text-xs text-muted-foreground">{po.approved_at ? format(new Date(po.approved_at), 'PPP') : ''}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Pending</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Header Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Supplier</h4>
              {po.supplier ? (
                <div>
                  <div className="font-medium">{po.supplier.name}</div>
                  {po.supplier.contact_person && (
                    <div className="text-sm text-muted-foreground">{po.supplier.contact_person}</div>
                  )}
                  {po.supplier.phone && (
                    <div className="text-sm text-muted-foreground">{po.supplier.phone}</div>
                  )}
                  {po.supplier.email && (
                    <div className="text-sm text-muted-foreground">{po.supplier.email}</div>
                  )}
                  {po.supplier.gst_number && (
                    <div className="text-sm text-muted-foreground">GST: {po.supplier.gst_number}</div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground">No supplier</div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Details</h4>
              <div className="space-y-1">
                <div className="text-sm">
                  <span className="text-muted-foreground">Order Date:</span>{' '}
                  {po.order_date ? format(new Date(po.order_date), 'PPP') : '-'}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Expected Delivery:</span>{' '}
                  {po.expected_delivery ? format(new Date(po.expected_delivery), 'PPP') : '-'}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Created:</span>{' '}
                  {format(new Date(po.created_at), 'PPP')}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h4 className="text-sm font-medium mb-3">Line Items</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items?.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.hsn_code || '-'}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">₹{item.rate.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{item.tax_percent}%</TableCell>
                      <TableCell className="text-right">₹{item.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals & Payment Summary */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>₹{po.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax:</span>
                <span>₹{po.total_tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base border-t pt-2">
                <span>Grand Total:</span>
                <span>₹{po.grand_total.toFixed(2)}</span>
              </div>
              
              {/* Payment Summary - Only show for approved/sent/delivered POs with valid grand_total */}
              {['approved', 'sent', 'acknowledged', 'partial', 'delivered'].includes(po.status) && paymentSummary && po.grand_total > 0 && (
                <div className="border-t pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-green-600">
                    <span>Paid:</span>
                    <span>₹{Math.round(paymentSummary.totalPaid).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className={paymentSummary.isFullyPaid ? 'text-green-600' : 'text-orange-600'}>
                      {paymentSummary.isFullyPaid ? 'Fully Paid' : 'Balance Due:'}
                    </span>
                    <span className={paymentSummary.isFullyPaid ? 'text-green-600' : 'text-orange-600'}>
                      {paymentSummary.isFullyPaid ? '✓' : `₹${Math.round(paymentSummary.balance).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment History - Collapsible */}
          {['approved', 'sent', 'acknowledged', 'partial', 'delivered'].includes(po.status) && 
           paymentSummary && paymentSummary.payments.length > 0 && (
            <Collapsible open={paymentsExpanded} onOpenChange={setPaymentsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment History ({paymentSummary.payments.length})
                  </span>
                  {paymentsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border rounded-lg overflow-hidden mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Paid By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentSummary.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{format(new Date(payment.payment_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell className="font-medium">₹{payment.amount.toLocaleString()}</TableCell>
                          <TableCell className="uppercase text-xs">{payment.payment_mode}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {payment.transaction_reference || '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {payment.paid_by_profile?.full_name || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Notes */}
          {po.terms_conditions && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Terms & Conditions</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{po.terms_conditions}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {/* Draft actions */}
          {po.status === 'draft' && (
            <Button variant="outline" onClick={handleSubmitForApproval} disabled={submitForApproval.isPending}>
              <Send className="mr-2 h-4 w-4" />
              Submit for Verification
            </Button>
          )}

          {/* Under review - resubmit */}
          {isUnderReview && (
            <Button variant="outline" onClick={handleResubmit} disabled={resubmitAfterReview.isPending}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Resubmit for Verification
            </Button>
          )}

          {/* Pending Verification actions */}
          {isPendingVerification && canApprove && (
            <>
              <Button 
                variant="outline" 
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setRejectDialogOpen(true)} 
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button 
                variant="outline" 
                className="text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white"
                onClick={() => setReviewDialogOpen(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Send for Review
              </Button>
              <Button 
                variant="outline" 
                className="text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white"
                onClick={handleVerify}
                disabled={verifyPO.isPending}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Verify
              </Button>
            </>
          )}

          {/* Pending Authorization actions */}
          {isPendingAuthorization && canApprove && (
            <>
              <Button 
                variant="outline" 
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setRejectDialogOpen(true)} 
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button 
                variant="outline" 
                className="text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white"
                onClick={() => setReviewDialogOpen(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Send for Review
              </Button>
              <Button 
                variant="outline" 
                className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                onClick={handleAuthorize}
                disabled={authorizePO.isPending}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Authorize
              </Button>
            </>
          )}

          {/* Pending Approval actions */}
          {isPendingApproval && canApprove && (
            <>
              <Button 
                variant="outline" 
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setRejectDialogOpen(true)} 
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button 
                variant="outline" 
                className="text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white"
                onClick={() => setReviewDialogOpen(true)}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Send for Review
              </Button>
              <Button 
                variant="outline" 
                className="text-green-600 border-green-600 hover:bg-green-600 hover:text-white"
                onClick={handleApprove}
                disabled={approvePO.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          )}

          {/* Pending indicator for non-approvers */}
          {(isPendingVerification || isPendingAuthorization || isPendingApproval) && !canApprove && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{statusLabels[po.status]}</span>
            </div>
          )}

          {/* Approved PO actions - Email, Record GRN, Rate Supplier, Record Payment */}
          {po.status === 'approved' && (
            <>
              <Button variant="outline" onClick={() => setEmailDialogOpen(true)}>
                <Mail className="mr-2 h-4 w-4" />
                Email to Supplier
              </Button>
              <Button variant="outline" onClick={() => setGrnDialogOpen(true)}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Record Receipt
              </Button>
              {po.supplier && (
                <>
                  <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Record Payment
                  </Button>
                  <Button variant="outline" onClick={() => setRateDialogOpen(true)}>
                    <Star className="mr-2 h-4 w-4" />
                    Rate Supplier
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={handleMarkDelivered} disabled={updatePO.isPending}>
                <Truck className="mr-2 h-4 w-4" />
                Mark Delivered
              </Button>
            </>
          )}
          
          {/* Sent/Acknowledged/Partial PO - Record Payment */}
          {['sent', 'acknowledged', 'partial'].includes(po.status) && po.supplier && (
            <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
          
          {/* Delivered PO - Rate Supplier and Record Payment */}
          {po.status === 'delivered' && po.supplier && (
            <>
              <Button variant="outline" onClick={() => setPaymentDialogOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
              <Button variant="outline" onClick={() => setRateDialogOpen(true)}>
                <Star className="mr-2 h-4 w-4" />
                Rate Supplier
              </Button>
            </>
          )}

          {onEdit && ['draft', 'rejected', 'under_review'].includes(po.status) && (
            <Button variant="outline" onClick={onEdit}>
              Edit
            </Button>
          )}
          <Button onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </DialogFooter>

        {/* Reject Dialog */}
        <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Purchase Order</AlertDialogTitle>
              <AlertDialogDescription>
                Please provide a reason for rejecting this purchase order. This is required.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="reject-reason">Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Reject PO
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Review Dialog */}
        <AlertDialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send for Review</AlertDialogTitle>
              <AlertDialogDescription>
                Provide suggestions or feedback for the PO creator to address before resubmission.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="review-suggestions">Suggestions <span className="text-destructive">*</span></Label>
              <Textarea
                id="review-suggestions"
                value={reviewSuggestions}
                onChange={(e) => setReviewSuggestions(e.target.value)}
                placeholder="Enter your suggestions or feedback..."
                rows={4}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleSendForReview}
                disabled={!reviewSuggestions.trim()}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                Send for Review
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Email Dialog */}
        <SendPOEmailDialog 
          open={emailDialogOpen} 
          onOpenChange={setEmailDialogOpen} 
          poId={poId} 
        />

        {/* GRN Dialog */}
        <RecordGRNDialog 
          open={grnDialogOpen} 
          onOpenChange={setGrnDialogOpen} 
          poId={poId} 
        />

        {/* Rate Supplier Dialog */}
        {po.supplier && (
          <RateSupplierDialog
            open={rateDialogOpen}
            onOpenChange={setRateDialogOpen}
            supplierId={po.supplier.id}
            supplierName={po.supplier.name}
            poId={po.id}
          />
        )}

        {/* Record Payment Dialog */}
        {po.supplier && (
          <RecordPOPaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            poId={po.id}
            supplierId={po.supplier.id}
            poNumber={po.po_number}
            supplierName={po.supplier.name}
            grandTotal={po.grand_total}
            totalPaid={paymentSummary?.totalPaid ?? 0}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
