import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X, Clock, Calendar } from 'lucide-react';
import { useLeaveRequests, useUpdateLeaveRequest } from '@/hooks/useAttendance';
import { useAuth } from '@/hooks/useAuth';

export function LeaveRequestsTable() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { user } = useAuth();
  
  const { data: requests, isLoading } = useLeaveRequests({
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const updateLeave = useUpdateLeaveRequest();

  const handleApprove = (id: string) => {
    if (!user) return;
    updateLeave.mutate({ id, status: 'approved', approved_by: user.id });
  };

  const handleReject = (id: string) => {
    if (!user) return;
    updateLeave.mutate({ 
      id, 
      status: 'rejected', 
      approved_by: user.id,
      rejection_reason: 'Request rejected by admin',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'outline',
      approved: 'default',
      rejected: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
        {status}
      </Badge>
    );
  };

  const getLeaveTypeBadge = (type: string) => {
    return (
      <Badge variant="secondary" className="capitalize">
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  const getDuration = (start: string, end: string) => {
    const days = differenceInDays(new Date(end), new Date(start)) + 1;
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested On</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No leave requests found
                </TableCell>
              </TableRow>
            ) : (
              requests?.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.profiles?.full_name || '—'}
                  </TableCell>
                  <TableCell>{getLeaveTypeBadge(request.leave_type)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {format(new Date(request.start_date), 'MMM dd, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(request.end_date), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    {getDuration(request.start_date, request.end_date)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {request.reason || '—'}
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(request.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    {request.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleApprove(request.id)}
                          disabled={updateLeave.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleReject(request.id)}
                          disabled={updateLeave.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {requests?.length || 0} leave requests
      </div>
    </div>
  );
}
