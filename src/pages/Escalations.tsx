import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useEscalations, useEscalationStats, useResolveEscalation, type EscalationFilters } from '@/hooks/useEscalations';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { MyEscalationsView } from '@/components/escalations/MyEscalationsView';
import { AlertTriangle, CheckCircle, Clock, Search, ExternalLink, User, Briefcase, TrendingUp } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { DateRangeFilter, type DatePreset, getDateRangeFromPreset } from '@/components/ui/date-range-filter';
import type { Database } from '@/integrations/supabase/types';

type EscalationLevel = Database['public']['Enums']['escalation_level'];

const levelConfig: Record<EscalationLevel, { label: string; color: string; icon: React.ReactNode }> = {
  none: { label: 'None', color: 'bg-muted text-muted-foreground', icon: null },
  alert: { label: 'Alert', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: <Clock className="h-3 w-3" /> },
  manager: { label: 'Manager', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30', icon: <TrendingUp className="h-3 w-3" /> },
  coo: { label: 'COO', color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: <AlertTriangle className="h-3 w-3" /> },
  ceo: { label: 'CEO', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30', icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function Escalations() {
  const { isAdmin, isManager, hasRole } = useAuth();
  const { t } = useTranslation();
  const canManage = isAdmin || isManager || hasRole('coo');

  // Date range state
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const dateRange = getDateRangeFromPreset(datePreset, customFrom, customTo);

  const [filters, setFilters] = useState<EscalationFilters>({ 
    resolved: false,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  
  // Update filters when date range changes
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const newRange = getDateRangeFromPreset(preset, customFrom, customTo);
    setFilters(prev => ({
      ...prev,
      dateFrom: newRange.from,
      dateTo: newRange.to,
    }));
  };

  const { data: escalations, isLoading } = useEscalations(filters);
  const { data: stats } = useEscalationStats();
  const resolveEscalation = useResolveEscalation();

  if (!canManage) {
    return <MyEscalationsView />;
  }

  const filteredEscalations = escalations?.filter((esc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      esc.user?.full_name?.toLowerCase().includes(query) ||
      esc.lead?.title?.toLowerCase().includes(query) ||
      esc.task?.title?.toLowerCase().includes(query) ||
      esc.reason?.toLowerCase().includes(query)
    );
  });

  const handleResolve = async () => {
    if (!selectedEscalation) return;

    try {
      await resolveEscalation.mutateAsync({
        escalationId: selectedEscalation,
        resolutionNotes,
      });
      toast.success('Escalation resolved successfully');
      setResolveDialogOpen(false);
      setSelectedEscalation(null);
      setResolutionNotes('');
    } catch (error) {
      toast.error('Failed to resolve escalation');
    }
  };

  const openResolveDialog = (escalationId: string) => {
    setSelectedEscalation(escalationId);
    setResolveDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">{t('escalations.title', 'Escalations')}</h1>
          <p className="text-muted-foreground">
            {t('escalations.subtitle', 'Monitor and resolve escalated leads and tasks across teams')}
          </p>
        </div>
        <DateRangeFilter
          datePreset={datePreset}
          onDatePresetChange={handleDatePresetChange}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alert</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.byLevel.alert || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manager Level</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.byLevel.manager || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">COO Level</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.byLevel.coo || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CEO Level</CardTitle>
            <AlertTriangle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats?.byLevel.ceo || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <CardTitle>Escalation Queue</CardTitle>
          <CardDescription>
            Review and resolve escalated items requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by user, lead, task, or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.level || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  level: v === 'all' ? undefined : (v as EscalationLevel),
                }))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="alert">Alert</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="coo">COO</SelectItem>
                <SelectItem value="ceo">CEO</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.resolved === undefined ? 'all' : filters.resolved ? 'resolved' : 'pending'}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  resolved: v === 'all' ? undefined : v === 'resolved',
                }))
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Related Item</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Escalated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEscalations?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                        <span className="text-muted-foreground">No escalations found</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEscalations?.map((escalation) => {
                    const config = levelConfig[escalation.escalation_level];
                    return (
                      <TableRow key={escalation.id}>
                        <TableCell>
                          <Badge variant="outline" className={config.color}>
                            <span className="flex items-center gap-1">
                              {config.icon}
                              {config.label}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{escalation.user?.full_name || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {escalation.lead ? (
                            <Link
                              to={`/leads/${escalation.lead.id}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <Briefcase className="h-3 w-3" />
                              {escalation.lead.title}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : escalation.task ? (
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3 text-muted-foreground" />
                              {escalation.task.title}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground line-clamp-1">
                            {escalation.reason || 'No activity'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{formatDistanceToNow(new Date(escalation.created_at), { addSuffix: true })}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(escalation.created_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {escalation.resolved_at ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!escalation.resolved_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openResolveDialog(escalation.id)}
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Resolve
                            </Button>
                          )}
                          {escalation.resolved_at && escalation.resolution_notes && (
                            <span className="text-xs text-muted-foreground">
                              By {escalation.resolved_by_user?.full_name}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredEscalations?.length || 0} escalations
          </div>
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Escalation</DialogTitle>
            <DialogDescription>
              Add resolution notes to close this escalation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Enter resolution notes (optional)..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolveEscalation.isPending}>
              {resolveEscalation.isPending ? 'Resolving...' : 'Resolve Escalation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
