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
  Eye, 
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

interface RFQDistribution {
  id: string;
  sent_at: string;
  viewed_at: string | null;
  response_status: string | null;
  rfq: {
    id: string;
    rfq_number: string;
    title: string;
    category_id: string | null;
    deadline_date: string | null;
    status: string | null;
    created_at: string;
  } | null;
}

interface RFQsDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfqs: RFQDistribution[];
  supplierName: string;
  focusMode?: 'all' | 'response-rate';
}

export function RFQsDrilldownModal({ 
  open, 
  onOpenChange, 
  rfqs, 
  supplierName,
  focusMode = 'all'
}: RFQsDrilldownModalProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [responseFilter, setResponseFilter] = useState<string>('all');

  // Calculate statistics
  const stats = useMemo(() => {
    const total = rfqs.length;
    const quoted = rfqs.filter(r => r.response_status === 'quoted').length;
    const declined = rfqs.filter(r => r.response_status === 'declined').length;
    const viewed = rfqs.filter(r => r.viewed_at && !r.response_status).length;
    const pending = rfqs.filter(r => !r.viewed_at && !r.response_status).length;
    const responseRate = total > 0 ? ((quoted + declined) / total) * 100 : 0;

    return { total, quoted, declined, viewed, pending, responseRate };
  }, [rfqs]);

  // Filter RFQs
  const filteredRFQs = useMemo(() => {
    return rfqs.filter(rfq => {
      // Search filter
      const matchesSearch = !searchQuery || 
        rfq.rfq?.rfq_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rfq.rfq?.title?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || rfq.rfq?.status === statusFilter;

      // Response filter
      let matchesResponse = true;
      if (responseFilter !== 'all') {
        if (responseFilter === 'quoted') matchesResponse = rfq.response_status === 'quoted';
        else if (responseFilter === 'declined') matchesResponse = rfq.response_status === 'declined';
        else if (responseFilter === 'viewed') matchesResponse = !!rfq.viewed_at && !rfq.response_status;
        else if (responseFilter === 'pending') matchesResponse = !rfq.viewed_at && !rfq.response_status;
      }

      return matchesSearch && matchesStatus && matchesResponse;
    });
  }, [rfqs, searchQuery, statusFilter, responseFilter]);

  const getResponseBadge = (status: string | null, viewedAt: string | null) => {
    if (status === 'quoted') {
      return <Badge className="bg-green-100 text-green-800">Quoted</Badge>;
    }
    if (status === 'declined') {
      return <Badge variant="destructive">Declined</Badge>;
    }
    if (viewedAt) {
      return <Badge variant="secondary">Viewed</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {focusMode === 'response-rate' ? 'RFQ Response Analysis' : 'RFQs Received'} - {supplierName}
          </DialogTitle>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-5 gap-3 py-4 border-b">
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${responseFilter === 'all' ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}
            onClick={() => setResponseFilter('all')}
          >
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total RFQs</p>
          </div>
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${responseFilter === 'quoted' ? 'bg-green-100 ring-2 ring-green-500' : 'bg-green-50 hover:bg-green-100'}`}
            onClick={() => setResponseFilter(responseFilter === 'quoted' ? 'all' : 'quoted')}
          >
            <p className="text-2xl font-bold text-green-600">{stats.quoted}</p>
            <p className="text-xs text-green-700">Quoted</p>
          </div>
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${responseFilter === 'declined' ? 'bg-red-100 ring-2 ring-red-500' : 'bg-red-50 hover:bg-red-100'}`}
            onClick={() => setResponseFilter(responseFilter === 'declined' ? 'all' : 'declined')}
          >
            <p className="text-2xl font-bold text-red-600">{stats.declined}</p>
            <p className="text-xs text-red-700">Declined</p>
          </div>
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${responseFilter === 'viewed' ? 'bg-blue-100 ring-2 ring-blue-500' : 'bg-blue-50 hover:bg-blue-100'}`}
            onClick={() => setResponseFilter(responseFilter === 'viewed' ? 'all' : 'viewed')}
          >
            <p className="text-2xl font-bold text-blue-600">{stats.viewed}</p>
            <p className="text-xs text-blue-700">Viewed Only</p>
          </div>
          <div 
            className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${responseFilter === 'pending' ? 'bg-amber-100 ring-2 ring-amber-500' : 'bg-amber-50 hover:bg-amber-100'}`}
            onClick={() => setResponseFilter(responseFilter === 'pending' ? 'all' : 'pending')}
          >
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-amber-700">Pending</p>
          </div>
        </div>

        {/* Response Rate Highlight */}
        {focusMode === 'response-rate' && (
          <div className="flex items-center justify-center gap-4 py-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{stats.responseRate.toFixed(1)}%</p>
              <p className="text-sm text-green-700">Response Rate</p>
            </div>
            <div className="text-sm text-muted-foreground">
              {stats.quoted + stats.declined} of {stats.total} RFQs responded
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by RFQ number or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="RFQ Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="awarded">Awarded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>RFQ Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Sent Date</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Response</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRFQs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No RFQs found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredRFQs.map((rfq) => (
                  <TableRow 
                    key={rfq.id}
                    className="cursor-pointer hover:bg-primary/5 transition-colors"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/procurement/rfqs/${rfq.rfq?.id}`);
                    }}
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {rfq.rfq?.rfq_number || '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {rfq.rfq?.title || '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(rfq.sent_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      {rfq.rfq?.deadline_date 
                        ? format(new Date(rfq.rfq.deadline_date), 'MMM dd, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getResponseBadge(rfq.response_status, rfq.viewed_at)}
                        {rfq.viewed_at && (
                          <span className="text-xs text-muted-foreground">
                            <Eye className="h-3 w-3 inline mr-1" />
                            {format(new Date(rfq.viewed_at), 'MMM dd')}
                          </span>
                        )}
                      </div>
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
            Showing {filteredRFQs.length} of {rfqs.length} RFQs
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
