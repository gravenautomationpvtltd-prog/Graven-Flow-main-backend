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
  FileText, 
  Search, 
  Filter, 
  ExternalLink,
  TrendingUp,
  Clock,
  Award,
  Target
} from 'lucide-react';
import { format } from 'date-fns';

interface SupplierQuotation {
  id: string;
  quotation_number: string;
  rfq_id: string;
  total_original: number | null;
  quoted_currency: string | null;
  lead_time_days: number | null;
  validity_days: number | null;
  status: string | null;
  submitted_at: string;
  notes: string | null;
  rfq: {
    rfq_number: string;
    title: string;
  } | null;
}

interface QuotationsDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotations: SupplierQuotation[];
  supplierName: string;
  focusMode?: 'all' | 'win-rate' | 'lead-time';
}

export function QuotationsDrilldownModal({ 
  open, 
  onOpenChange, 
  quotations, 
  supplierName,
  focusMode = 'all'
}: QuotationsDrilldownModalProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [leadTimeFilter, setLeadTimeFilter] = useState<string>('all');

  // Calculate statistics
  const stats = useMemo(() => {
    const total = quotations.length;
    const accepted = quotations.filter(q => q.status === 'accepted').length;
    const shortlisted = quotations.filter(q => q.status === 'shortlisted').length;
    const rejected = quotations.filter(q => q.status === 'rejected').length;
    const pending = quotations.filter(q => q.status === 'pending' || !q.status).length;
    const won = accepted + shortlisted;
    const winRate = total > 0 ? (won / total) * 100 : 0;
    
    const quotesWithLeadTime = quotations.filter(q => q.lead_time_days);
    const avgLeadTime = quotesWithLeadTime.length > 0 
      ? quotesWithLeadTime.reduce((sum, q) => sum + (q.lead_time_days || 0), 0) / quotesWithLeadTime.length
      : 0;

    const totalValue = quotations.reduce((sum, q) => sum + (q.total_original || 0), 0);
    const wonValue = quotations
      .filter(q => q.status === 'accepted' || q.status === 'shortlisted')
      .reduce((sum, q) => sum + (q.total_original || 0), 0);

    return { total, accepted, shortlisted, rejected, pending, won, winRate, avgLeadTime, totalValue, wonValue };
  }, [quotations]);

  // Filter quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter(quote => {
      // Search filter
      const matchesSearch = !searchQuery || 
        quote.quotation_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.rfq?.rfq_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.rfq?.title?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        if (statusFilter === 'won') {
          matchesStatus = quote.status === 'accepted' || quote.status === 'shortlisted';
        } else {
          matchesStatus = quote.status === statusFilter;
        }
      }

      // Lead time filter
      let matchesLeadTime = true;
      if (leadTimeFilter !== 'all' && quote.lead_time_days) {
        if (leadTimeFilter === 'fast') matchesLeadTime = quote.lead_time_days <= 7;
        else if (leadTimeFilter === 'medium') matchesLeadTime = quote.lead_time_days > 7 && quote.lead_time_days <= 21;
        else if (leadTimeFilter === 'slow') matchesLeadTime = quote.lead_time_days > 21;
      }

      return matchesSearch && matchesStatus && matchesLeadTime;
    });
  }, [quotations, searchQuery, statusFilter, leadTimeFilter]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'shortlisted':
        return <Badge className="bg-green-100 text-green-800">Shortlisted</Badge>;
      case 'accepted':
        return <Badge className="bg-emerald-100 text-emerald-800">Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status || 'Submitted'}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {focusMode === 'win-rate' ? 'Quote Win Rate Analysis' : focusMode === 'lead-time' ? 'Lead Time Analysis' : 'Quotations Submitted'} - {supplierName}
          </DialogTitle>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-5 gap-3 py-4 border-b">
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${statusFilter === 'all' ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}
            onClick={() => setStatusFilter('all')}
          >
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Quotes</p>
          </div>
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${statusFilter === 'won' ? 'bg-green-100 ring-2 ring-green-500' : 'bg-green-50 hover:bg-green-100'}`}
            onClick={() => setStatusFilter(statusFilter === 'won' ? 'all' : 'won')}
          >
            <p className="text-2xl font-bold text-green-600">{stats.won}</p>
            <p className="text-xs text-green-700">Won</p>
          </div>
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${statusFilter === 'rejected' ? 'bg-red-100 ring-2 ring-red-500' : 'bg-red-50 hover:bg-red-100'}`}
            onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
          >
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-xs text-red-700">Rejected</p>
          </div>
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${statusFilter === 'pending' ? 'bg-amber-100 ring-2 ring-amber-500' : 'bg-amber-50 hover:bg-amber-100'}`}
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          >
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-amber-700">Pending</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-purple-50">
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalValue)}</p>
            <p className="text-xs text-purple-700">Total Value</p>
          </div>
        </div>

        {/* Focus Mode Highlights */}
        {focusMode === 'win-rate' && (
          <div className="flex items-center justify-center gap-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-3">
              <Award className="h-10 w-10 text-green-600" />
              <div className="text-center">
                <p className="text-4xl font-bold text-green-600">{stats.winRate.toFixed(1)}%</p>
                <p className="text-sm text-green-700">Win Rate</p>
              </div>
            </div>
            <div className="h-12 w-px bg-green-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.wonValue)}</p>
              <p className="text-sm text-emerald-700">Won Value</p>
            </div>
            <div className="h-12 w-px bg-green-200" />
            <div className="text-sm text-muted-foreground">
              {stats.won} of {stats.total} quotes won
            </div>
          </div>
        )}

        {focusMode === 'lead-time' && (
          <div className="flex items-center justify-center gap-6 py-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-3">
              <Clock className="h-10 w-10 text-orange-600" />
              <div className="text-center">
                <p className="text-4xl font-bold text-orange-600">{stats.avgLeadTime.toFixed(0)}</p>
                <p className="text-sm text-orange-700">Avg Days</p>
              </div>
            </div>
            <div className="h-12 w-px bg-orange-200" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div 
                className={`p-2 rounded cursor-pointer transition-colors ${leadTimeFilter === 'fast' ? 'bg-green-100 ring-2 ring-green-500' : 'hover:bg-green-50'}`}
                onClick={() => setLeadTimeFilter(leadTimeFilter === 'fast' ? 'all' : 'fast')}
              >
                <p className="text-lg font-bold text-green-600">
                  {quotations.filter(q => q.lead_time_days && q.lead_time_days <= 7).length}
                </p>
                <p className="text-xs text-green-700">≤7 days</p>
              </div>
              <div 
                className={`p-2 rounded cursor-pointer transition-colors ${leadTimeFilter === 'medium' ? 'bg-amber-100 ring-2 ring-amber-500' : 'hover:bg-amber-50'}`}
                onClick={() => setLeadTimeFilter(leadTimeFilter === 'medium' ? 'all' : 'medium')}
              >
                <p className="text-lg font-bold text-amber-600">
                  {quotations.filter(q => q.lead_time_days && q.lead_time_days > 7 && q.lead_time_days <= 21).length}
                </p>
                <p className="text-xs text-amber-700">8-21 days</p>
              </div>
              <div 
                className={`p-2 rounded cursor-pointer transition-colors ${leadTimeFilter === 'slow' ? 'bg-red-100 ring-2 ring-red-500' : 'hover:bg-red-50'}`}
                onClick={() => setLeadTimeFilter(leadTimeFilter === 'slow' ? 'all' : 'slow')}
              >
                <p className="text-lg font-bold text-red-600">
                  {quotations.filter(q => q.lead_time_days && q.lead_time_days > 21).length}
                </p>
                <p className="text-xs text-red-700">&gt;21 days</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by quote number, RFQ, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {focusMode !== 'lead-time' && (
            <Select value={leadTimeFilter} onValueChange={setLeadTimeFilter}>
              <SelectTrigger className="w-[150px]">
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Lead Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lead Times</SelectItem>
                <SelectItem value="fast">Fast (≤7 days)</SelectItem>
                <SelectItem value="medium">Medium (8-21 days)</SelectItem>
                <SelectItem value="slow">Slow (&gt;21 days)</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Quote #</TableHead>
                <TableHead>RFQ</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No quotations found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotations.map((quote) => (
                  <TableRow 
                    key={quote.id}
                    className="cursor-pointer hover:bg-primary/5 transition-colors"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/procurement/quotations/${quote.id}`);
                    }}
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {quote.quotation_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{quote.rfq?.rfq_number}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {quote.rfq?.title}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {quote.total_original 
                        ? `${quote.quoted_currency || 'INR'} ${quote.total_original.toLocaleString()}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {quote.lead_time_days ? (
                        <Badge variant="outline" className={
                          quote.lead_time_days <= 7 ? 'bg-green-50 text-green-700 border-green-200' :
                          quote.lead_time_days <= 21 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }>
                          {quote.lead_time_days} days
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(quote.status)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(quote.submitted_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
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
            Showing {filteredQuotations.length} of {quotations.length} quotations
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
