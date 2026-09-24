import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  IndianRupee, 
  Search, 
  Filter, 
  ExternalLink,
  Download,
  Eye,
  FileText,
  AlertCircle,
  CheckCircle,
  CreditCard,
  Building2
} from 'lucide-react';
import { format } from 'date-fns';

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  transaction_reference?: string | null;
  bank_name?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
  po?: { po_number?: string; id?: string } | null;
  paid_by_profile?: { full_name?: string } | null;
}

interface PaymentsDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payments: Payment[];
  supplierName: string;
  focusMode?: 'all' | 'business' | 'pending';
  totalBusinessValue?: number;
  pendingPayment?: number;
}

export function PaymentsDrilldownModal({ 
  open, 
  onOpenChange, 
  payments, 
  supplierName,
  focusMode = 'all',
  totalBusinessValue = 0,
  pendingPayment = 0
}: PaymentsDrilldownModalProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Calculate statistics
  const stats = useMemo(() => {
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paymentCount = payments.length;
    
    const byMode: Record<string, { count: number; amount: number }> = {};
    payments.forEach(p => {
      const mode = p.payment_mode || 'other';
      if (!byMode[mode]) byMode[mode] = { count: 0, amount: 0 };
      byMode[mode].count++;
      byMode[mode].amount += p.amount || 0;
    });

    const avgPayment = paymentCount > 0 ? totalPaid / paymentCount : 0;

    return { totalPaid, paymentCount, byMode, avgPayment };
  }, [payments]);

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      // Search filter
      const matchesSearch = !searchQuery || 
        (payment.po as any)?.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.transaction_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.bank_name?.toLowerCase().includes(searchQuery.toLowerCase());

      // Mode filter
      const matchesMode = modeFilter === 'all' || payment.payment_mode === modeFilter;

      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const paymentDate = new Date(payment.payment_date);
        const now = new Date();
        if (dateFilter === 'today') {
          matchesDate = paymentDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = paymentDate >= weekAgo;
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = paymentDate >= monthAgo;
        } else if (dateFilter === 'quarter') {
          const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          matchesDate = paymentDate >= quarterAgo;
        }
      }

      return matchesSearch && matchesMode && matchesDate;
    });
  }, [payments, searchQuery, modeFilter, dateFilter]);

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const getPaymentModeColor = (mode: string) => {
    switch (mode) {
      case 'bank_transfer':
      case 'neft':
      case 'rtgs':
      case 'imps':
        return 'bg-blue-100 text-blue-800';
      case 'cheque':
        return 'bg-purple-100 text-purple-800';
      case 'cash':
        return 'bg-green-100 text-green-800';
      case 'upi':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentModeLabel = (mode: string) => {
    const labels: Record<string, string> = {
      bank_transfer: 'Bank Transfer',
      neft: 'NEFT',
      rtgs: 'RTGS',
      imps: 'IMPS',
      cheque: 'Cheque',
      cash: 'Cash',
      upi: 'UPI',
    };
    return labels[mode] || mode;
  };

  const handleDownload = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = url;
    link.download = 'receipt';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" />
            {focusMode === 'business' ? 'Business Value Analysis' : focusMode === 'pending' ? 'Pending Payments' : 'Payment History'} - {supplierName}
          </DialogTitle>
        </DialogHeader>

        {/* Stats Summary */}
        {focusMode === 'business' && (
          <div className="py-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Business</p>
                <p className="text-3xl font-bold text-purple-600">{formatCurrency(totalBusinessValue)}</p>
              </div>
              <div className="h-12 w-px bg-purple-200" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
              </div>
              <div className="h-12 w-px bg-purple-200" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Pending</p>
                <p className="text-3xl font-bold text-amber-600">{formatCurrency(pendingPayment)}</p>
              </div>
              <div className="h-12 w-px bg-purple-200" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Payments Made</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.paymentCount}</p>
              </div>
            </div>
          </div>
        )}

        {focusMode === 'pending' && (
          <div className={`py-4 rounded-lg border ${pendingPayment > 0 ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'}`}>
            <div className="flex items-center justify-center gap-6">
              {pendingPayment > 0 ? (
                <>
                  <AlertCircle className="h-10 w-10 text-amber-600" />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Pending Payment</p>
                    <p className="text-4xl font-bold text-amber-600">{formatCurrency(pendingPayment)}</p>
                  </div>
                  <div className="h-12 w-px bg-amber-200" />
                  <div className="text-sm text-amber-700">
                    <p>Total Business: {formatCurrency(totalBusinessValue)}</p>
                    <p>Total Paid: {formatCurrency(stats.totalPaid)}</p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="h-10 w-10 text-green-600" />
                  <div className="text-center">
                    <p className="text-4xl font-bold text-green-600">All Paid!</p>
                    <p className="text-sm text-green-700">No pending payments</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {focusMode === 'all' && (
          <div className="grid grid-cols-4 gap-3 py-4 border-b">
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold">{stats.paymentCount}</p>
              <p className="text-xs text-muted-foreground">Total Payments</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</p>
              <p className="text-xs text-green-700">Total Paid</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-blue-50">
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.avgPayment)}</p>
              <p className="text-xs text-blue-700">Avg Payment</p>
            </div>
            <div className={`text-center p-3 rounded-lg ${pendingPayment > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <p className={`text-2xl font-bold ${pendingPayment > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {formatCurrency(pendingPayment)}
              </p>
              <p className={`text-xs ${pendingPayment > 0 ? 'text-amber-700' : 'text-green-700'}`}>Pending</p>
            </div>
          </div>
        )}

        {/* Payment Mode Breakdown */}
        <div className="flex gap-2 py-3 overflow-x-auto">
          <Badge 
            variant={modeFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer hover:bg-primary/90 whitespace-nowrap"
            onClick={() => setModeFilter('all')}
          >
            All Modes
          </Badge>
          {Object.entries(stats.byMode).map(([mode, data]) => (
            <Badge 
              key={mode}
              variant={modeFilter === mode ? 'default' : 'outline'}
              className={`cursor-pointer whitespace-nowrap ${modeFilter !== mode ? getPaymentModeColor(mode) : ''}`}
              onClick={() => setModeFilter(modeFilter === mode ? 'all' : mode)}
            >
              {getPaymentModeLabel(mode)} ({data.count})
            </Badge>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by PO number, reference, or bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Date</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Paid By</TableHead>
                <TableHead className="text-center">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No payments found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow 
                    key={payment.id}
                    className="cursor-pointer hover:bg-primary/5 transition-colors"
                  >
                    <TableCell className="font-medium">
                      {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      {(payment.po as any)?.po_number ? (
                        <Badge 
                          variant="outline" 
                          className="font-mono cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenChange(false);
                            navigate(`/procurement/purchase-orders/${(payment.po as any).id}`);
                          }}
                        >
                          {(payment.po as any).po_number}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      ₹{payment.amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <Badge className={`capitalize ${getPaymentModeColor(payment.payment_mode)}`}>
                        {payment.payment_mode?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {payment.transaction_reference || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {payment.bank_name || '-'}
                    </TableCell>
                    <TableCell>
                      {(payment.paid_by_profile as any)?.full_name || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {payment.receipt_url ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-primary/10"
                            onClick={(e) => handleDownload(e, payment.receipt_url!)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(payment.receipt_url!, '_blank');
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <FileText className="h-4 w-4 opacity-30 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Showing {filteredPayments.length} of {payments.length} payments • 
            Total: ₹{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-IN')}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
