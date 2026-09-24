import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { segmentConfig } from '@/lib/segment-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CRONotesDialog from '@/components/cro/CRONotesDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Mail, Building2, MapPin, User, Clock, MessageSquare, Plus, Search, Loader2, CheckCircle, CalendarIcon, RotateCcw, Star, AlarmClock, RefreshCw } from 'lucide-react';
import { useCROAssignments, useUpdateCROAssignment, useUpdateCustomerSegment, type CROAssignment } from '@/hooks/useCROAssignments';
import { useAuth } from '@/hooks/useAuth';
import { useCreateLead } from '@/hooks/useLeads';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

import { format, formatDistanceToNow, isToday, isAfter, subDays, isBefore, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { logActivity } from '@/lib/activity-logger';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  contacted: { label: 'Contacted', variant: 'secondary' },
  enquiry_received: { label: 'Enquiry Received', variant: 'default' },
  no_response: { label: 'No Response', variant: 'destructive' },
};

export default function CRODashboard() {
  const { data: assignments = [], isLoading, isFetching, refetch, lastFetchedAt } = useCROAssignments();
  const updateAssignment = useUpdateCROAssignment();
  const updateSegment = useUpdateCustomerSegment();
  const createLead = useCreateLead();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [notesDialog, setNotesDialog] = useState<CROAssignment | null>(null);
  const [enquiryDialog, setEnquiryDialog] = useState<CROAssignment | null>(null);
  const [scheduleDialog, setScheduleDialog] = useState<CROAssignment | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState('10:00');
  
  const [enquiryTitle, setEnquiryTitle] = useState('');
  const [enquiryQuery, setEnquiryQuery] = useState('');
  const [enquirySource, setEnquirySource] = useState<string>('cro_followup');
  const [enquiryEstimatedValue, setEnquiryEstimatedValue] = useState('');
  const [enquiryExpectedCloseDate, setEnquiryExpectedCloseDate] = useState<Date>();
  const [recentlyActedIds, setRecentlyActedIds] = useState<Set<string>>(new Set());

  const markActed = useCallback((id: string) => {
    setRecentlyActedIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setRecentlyActedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 13000);
  }, []);

  const now = new Date();

  // Helper: is callback overdue
  const isOverdue = (a: CROAssignment) =>
    !!a.scheduled_callback_at && isBefore(new Date(a.scheduled_callback_at), now);

  const isScheduledToday = (a: CROAssignment) =>
    !!a.scheduled_callback_at && isToday(new Date(a.scheduled_callback_at));

  // Compute status counts for filter labels
  const statusCounts = useMemo(() => ({
    pending: assignments.filter(a => a.status === 'pending').length,
    contacted: assignments.filter(a => a.status === 'contacted').length,
    enquiry_received: assignments.filter(a => a.status === 'enquiry_received').length,
    no_response: assignments.filter(a => a.status === 'no_response').length,
  }), [assignments]);

  const overdueCounts = useMemo(() => assignments.filter(isOverdue).length, [assignments]);
  const scheduledTodayCount = useMemo(() => assignments.filter(a => isScheduledToday(a) && !isOverdue(a)).length, [assignments]);

  const filtered = useMemo(() => assignments.filter(a => {
    if (recentlyActedIds.has(a.id)) return true;

    const matchesSearch = !search || 
      a.customer.company_name.toLowerCase().includes(search.toLowerCase()) ||
      a.customer.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
      a.customer.phone.includes(search);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesSegment = segmentFilter === 'all' || a.customer.segment === segmentFilter;
    
    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = !!a.last_contacted_at && isToday(new Date(a.last_contacted_at));
    } else if (dateFilter === '7') {
      matchesDate = !!a.last_contacted_at && isAfter(new Date(a.last_contacted_at), subDays(new Date(), 7));
    } else if (dateFilter === '30') {
      matchesDate = !!a.last_contacted_at && isAfter(new Date(a.last_contacted_at), subDays(new Date(), 30));
    } else if (dateFilter === 'not_contacted') {
      matchesDate = !a.last_contacted_at;
    } else if (dateFilter === 'overdue') {
      matchesDate = isOverdue(a);
    } else if (dateFilter === 'scheduled_today') {
      matchesDate = isScheduledToday(a);
    }
    
    return matchesSearch && matchesStatus && matchesDate && matchesSegment;
  }), [assignments, search, statusFilter, dateFilter, segmentFilter, recentlyActedIds]);

  // Sort: overdue callbacks first, then status priority, then date
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const aOverdue = isOverdue(a);
    const bOverdue = isOverdue(b);
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (aOverdue && bOverdue) {
      return new Date(a.scheduled_callback_at!).getTime() - new Date(b.scheduled_callback_at!).getTime();
    }

    const aScheduledToday = isScheduledToday(a);
    const bScheduledToday = isScheduledToday(b);
    if (aScheduledToday && !bScheduledToday) return -1;
    if (!aScheduledToday && bScheduledToday) return 1;

    const statusPriority: Record<string, number> = {
      enquiry_received: 0,
      contacted: 1,
      no_response: 2,
      pending: 3,
    };
    const pa = statusPriority[a.status] ?? 3;
    const pb = statusPriority[b.status] ?? 3;
    if (pa !== pb) return pa - pb;

    const dateA = a.last_contacted_at || a.assigned_at;
    const dateB = b.last_contacted_at || b.assigned_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  }), [filtered]);

  // Client-side pagination — show 50 at a time
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visibleItems = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [statusFilter, dateFilter, segmentFilter, search]);

  const stats = {
    total: assignments.length,
    pending: statusCounts.pending,
    contacted: statusCounts.contacted,
    enquiries: statusCounts.enquiry_received,
  };

  const handleMarkContacted = (assignment: CROAssignment) => {
    markActed(assignment.id);
    updateAssignment.mutate({
      id: assignment.id,
      status: 'contacted',
      last_contacted_at: new Date().toISOString(),
      contacted_count: (assignment.contacted_count || 0) + 1,
      scheduled_callback_at: null,
    });
  };

  const handleMarkNoResponse = (assignment: CROAssignment) => {
    markActed(assignment.id);
    updateAssignment.mutate({
      id: assignment.id,
      status: 'no_response',
      last_contacted_at: new Date().toISOString(),
      contacted_count: (assignment.contacted_count || 0) + 1,
    });
  };

  const handleReopen = (assignment: CROAssignment) => {
    markActed(assignment.id);
    updateAssignment.mutate({
      id: assignment.id,
      status: 'pending',
    });
  };

  const handleSegmentChange = (customerId: string, segment: string) => {
    updateSegment.mutate({ customerId, segment });
  };


  const handleScheduleCallback = () => {
    if (!scheduleDialog || !scheduledDate) return;
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const callbackDate = new Date(scheduledDate);
    callbackDate.setHours(hours, minutes, 0, 0);

    updateAssignment.mutate({
      id: scheduleDialog.id,
      scheduled_callback_at: callbackDate.toISOString(),
    });
    toast.success(`Callback scheduled for ${format(callbackDate, 'PPP p')}`);
    setScheduleDialog(null);
    setScheduledDate(undefined);
    setScheduledTime('10:00');
  };

  const handleClearCallback = (assignment: CROAssignment) => {
    updateAssignment.mutate({
      id: assignment.id,
      scheduled_callback_at: null,
    });
    toast.success('Callback cleared');
  };

  const handleCreateEnquiry = async () => {
    if (!enquiryDialog || !enquiryTitle.trim()) return;

    try {
      const newLead = await createLead.mutateAsync({
        title: enquiryTitle,
        source: enquirySource as any,
        customer_id: enquiryDialog.customer_id,
        customer_query: enquiryQuery || undefined,
        assigned_to: enquiryDialog.customer.assigned_sales_id || undefined,
        estimated_value: enquiryEstimatedValue ? Number(enquiryEstimatedValue) : 0,
        expected_close_date: enquiryExpectedCloseDate ? format(enquiryExpectedCloseDate, 'yyyy-MM-dd') : undefined,
      });

      logActivity({
        action: 'create',
        entityType: 'lead',
        entityId: newLead?.id,
        entityName: enquiryTitle,
        metadata: { source: 'cro_followup', customer_id: enquiryDialog.customer_id, customer_name: enquiryDialog.customer.company_name },
      });

      updateAssignment.mutate({
        id: enquiryDialog.id,
        status: 'enquiry_received',
        last_contacted_at: new Date().toISOString(),
        contacted_count: (enquiryDialog.contacted_count || 0) + 1,
        scheduled_callback_at: null,
      });

      setEnquiryDialog(null);
      setEnquiryTitle('');
      setEnquiryQuery('');
      setEnquirySource('cro_followup');
      setEnquiryEstimatedValue('');
      setEnquiryExpectedCloseDate(undefined);
    } catch (error) {
      console.error('Failed to create enquiry:', error);
    }
  };

  return (
    <>
      <Helmet>
        <title>CRO Dashboard | Graven</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CRO Dashboard</h1>
            <p className="text-muted-foreground">Follow up with assigned customers and generate enquiries</p>
          </div>
          <div className="flex items-center gap-2">
            {lastFetchedAt && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Synced {formatDistanceToNow(lastFetchedAt, { addSuffix: true })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Assigned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.contacted}</p>
              <p className="text-xs text-muted-foreground">Contacted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.enquiries}</p>
              <p className="text-xs text-muted-foreground">Enquiries</p>
            </CardContent>
          </Card>
          {overdueCounts > 0 && (
            <Card className="border-destructive/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{overdueCounts}</p>
                <p className="text-xs text-muted-foreground">Overdue Callbacks</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({assignments.length})</SelectItem>
              <SelectItem value="pending">Pending ({statusCounts.pending})</SelectItem>
              <SelectItem value="contacted">Contacted ({statusCounts.contacted})</SelectItem>
              <SelectItem value="enquiry_received">Enquiry Received ({statusCounts.enquiry_received})</SelectItem>
              <SelectItem value="no_response">No Response ({statusCounts.no_response})</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Activity Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Contacted Today</SelectItem>
              <SelectItem value="7">This Week</SelectItem>
              <SelectItem value="30">This Month</SelectItem>
              <SelectItem value="not_contacted">Not Contacted</SelectItem>
              {overdueCounts > 0 && (
                <SelectItem value="overdue">⚠️ Overdue Callbacks ({overdueCounts})</SelectItem>
              )}
              {scheduledTodayCount > 0 && (
                <SelectItem value="scheduled_today">📅 Scheduled Today ({scheduledTodayCount})</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="platinum">Platinum</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="bronze">Bronze</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter !== 'all' || dateFilter !== 'all' || segmentFilter !== 'all' || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setDateFilter('all');
                setSegmentFilter('all');
              }}
              className="text-destructive hover:text-destructive"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Active filter summary */}
        {(statusFilter !== 'all' || dateFilter !== 'all' || segmentFilter !== 'all') && sorted.length === 0 && assignments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <span>Active filters:</span>
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setStatusFilter('all')}>
                Status: {statusConfig[statusFilter]?.label || statusFilter} ✕
              </Badge>
            )}
            {dateFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setDateFilter('all')}>
                Period: {dateFilter === 'today' ? 'Today' : dateFilter === 'not_contacted' ? 'Not Contacted' : dateFilter === 'overdue' ? 'Overdue' : dateFilter === 'scheduled_today' ? 'Scheduled Today' : `${dateFilter} days`} ✕
              </Badge>
            )}
            {segmentFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSegmentFilter('all')}>
                Segment: {segmentFilter} ✕
              </Badge>
            )}
            <span className="text-xs">— Try removing some filters to see results</span>
          </div>
        )}

        {/* Customer Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {assignments.length === 0
                ? 'No customers assigned yet. Ask your admin to run customer distribution.'
                : 'No customers match your current filters. Try clearing some filters above.'}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleItems.map((assignment) => {
                const { customer } = assignment;
                const config = statusConfig[assignment.status] || statusConfig.pending;
                const segConf = segmentConfig[customer.segment || 'bronze'];
                const overdue = isOverdue(assignment);
                const scheduledToday = isScheduledToday(assignment) && !overdue;

              return (
                <Card key={assignment.id} className={cn("flex flex-col transition-opacity duration-500", overdue && "border-destructive/60 bg-destructive/5", recentlyActedIds.has(assignment.id) && "opacity-60")}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0 flex-1">
                        <CardTitle className="text-base truncate">{customer.company_name}</CardTitle>
                        {customer.contact_person && (
                          <CardDescription className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {customer.contact_person}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={config.variant}>{config.label}</Badge>
                        {segConf && (
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", segConf.color)}>
                            {segConf.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <a href={`tel:${customer.phone}`} className="hover:text-foreground">{customer.phone}</a>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      {(customer.city || customer.state) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{[customer.city, customer.state].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                      {customer.assigned_sales && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>Sales: {(customer.assigned_sales as any)?.full_name}</span>
                        </div>
                      )}
                      {assignment.last_contacted_at && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Last contacted {formatDistanceToNow(new Date(assignment.last_contacted_at), { addSuffix: true })}
                            {assignment.contacted_count > 0 && ` (${assignment.contacted_count}×)`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Scheduled callback indicator */}
                    {assignment.scheduled_callback_at && (
                      <div className={cn(
                        "flex items-center gap-2 text-xs rounded px-2 py-1.5",
                        overdue
                          ? "bg-destructive/10 text-destructive font-medium"
                          : scheduledToday
                          ? "bg-primary/10 text-primary font-medium"
                          : "bg-muted text-muted-foreground"
                      )}>
                        <AlarmClock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {overdue ? '⚠️ Overdue: ' : scheduledToday ? '📅 Today: ' : 'Callback: '}
                          {format(new Date(assignment.scheduled_callback_at), 'MMM d, h:mm a')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 ml-auto"
                          onClick={() => handleClearCallback(assignment)}
                          title="Clear callback"
                        >
                          ×
                        </Button>
                      </div>
                    )}

                    {assignment.notes && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-2">{assignment.notes}</p>
                    )}

                    {/* Segment selector */}
                    <div className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select
                        value={customer.segment || 'bronze'}
                        onValueChange={(val) => handleSegmentChange(customer.id, val)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="platinum">Platinum</SelectItem>
                          <SelectItem value="gold">Gold</SelectItem>
                          <SelectItem value="silver">Silver</SelectItem>
                          <SelectItem value="bronze">Bronze</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {assignment.status !== 'contacted' && (
                        <Button size="sm" variant="outline" onClick={() => handleMarkContacted(assignment)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Contacted
                        </Button>
                      )}
                      <Button size="sm" onClick={() => {
                        setEnquiryDialog(assignment);
                        setEnquiryTitle(`Enquiry from ${customer.company_name}`);
                        setEnquirySource('cro_followup');
                        setEnquiryEstimatedValue('');
                        setEnquiryExpectedCloseDate(undefined);
                        setEnquiryQuery('');
                      }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Enquiry
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setScheduleDialog(assignment);
                        if (assignment.scheduled_callback_at) {
                          const d = new Date(assignment.scheduled_callback_at);
                          setScheduledDate(d);
                          setScheduledTime(format(d, 'HH:mm'));
                        } else {
                          setScheduledDate(undefined);
                          setScheduledTime('10:00');
                        }
                      }}>
                        <AlarmClock className="h-3.5 w-3.5 mr-1" />
                        Schedule
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setNotesDialog(assignment)}>
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        Notes
                      </Button>
                      {assignment.status !== 'no_response' && assignment.status !== 'pending' && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleMarkNoResponse(assignment)}>
                          No Response
                        </Button>
                      )}
                      {(assignment.status === 'no_response' || assignment.status === 'enquiry_received') && (
                        <Button size="sm" variant="ghost" onClick={() => handleReopen(assignment)}>
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Re-open
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {/* Load More / Showing count */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <span className="text-sm text-muted-foreground">
              Showing {visibleItems.length} of {sorted.length}
            </span>
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              >
                Load More
              </Button>
            )}
          </div>
          </>
        )}
      </div>

      {/* Notes Dialog — isolated component to prevent re-renders */}
      <CRONotesDialog
        assignment={notesDialog}
        onClose={() => setNotesDialog(null)}
      />

      {/* Schedule Callback Dialog */}
      <Dialog open={!!scheduleDialog} onOpenChange={(open) => !open && setScheduleDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Schedule Callback</DialogTitle>
            <DialogDescription>
              Set a reminder to call back {scheduleDialog?.customer.company_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => isBefore(date, startOfDay(new Date()))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Time</label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog(null)}>Cancel</Button>
            <Button onClick={handleScheduleCallback} disabled={!scheduledDate || updateAssignment.isPending}>
              {updateAssignment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Enquiry Dialog */}
      <Dialog open={!!enquiryDialog} onOpenChange={(open) => !open && setEnquiryDialog(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>
              Create a new lead for {enquiryDialog?.customer.company_name}. 
              It will be auto-assigned to the customer's salesperson.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Lead Title *</label>
              <Input
                value={enquiryTitle}
                onChange={(e) => setEnquiryTitle(e.target.value)}
                placeholder="e.g. Requirement for ABB 3BSE..."
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Source</label>
              <Select value={enquirySource} onValueChange={setEnquirySource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cro_followup">CRO Follow-up</SelectItem>
                  <SelectItem value="indiamart">IndiaMart</SelectItem>
                  <SelectItem value="justdial">JustDial</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="tradeindia">TradeIndia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground">Estimated Value (₹)</label>
                <Input
                  type="number"
                  value={enquiryEstimatedValue}
                  onChange={(e) => setEnquiryEstimatedValue(e.target.value)}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Expected Close Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !enquiryExpectedCloseDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {enquiryExpectedCloseDate ? format(enquiryExpectedCloseDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={enquiryExpectedCloseDate}
                      onSelect={setEnquiryExpectedCloseDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Requirement Details (Optional)</label>
              <Textarea
                value={enquiryQuery}
                onChange={(e) => setEnquiryQuery(e.target.value)}
                placeholder="Details about what the customer needs..."
                rows={3}
              />
            </div>
            {enquiryDialog?.customer.assigned_sales && (
              <p className="text-sm text-muted-foreground">
                → Will be assigned to: <strong>{(enquiryDialog.customer.assigned_sales as any)?.full_name}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnquiryDialog(null)}>Cancel</Button>
            <Button onClick={handleCreateEnquiry} disabled={createLead.isPending || !enquiryTitle.trim()}>
              {createLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
