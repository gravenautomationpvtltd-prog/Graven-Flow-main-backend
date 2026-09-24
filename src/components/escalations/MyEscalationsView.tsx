import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMyEscalations, useMyEscalationStats } from '@/hooks/useMyEscalations';
import { EscalationTimeline } from './EscalationTimeline';
import { AlertTriangle, Clock, TrendingUp, ExternalLink, Briefcase, CheckCircle, History, CalendarDays } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type EscalationLevel = Database['public']['Enums']['escalation_level'];

const levelConfig: Record<EscalationLevel, { label: string; color: string; icon: React.ReactNode }> = {
  none: { label: 'None', color: 'bg-muted text-muted-foreground', icon: null },
  alert: { label: 'Alert', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30', icon: <Clock className="h-3 w-3" /> },
  manager: { label: 'Manager', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30', icon: <TrendingUp className="h-3 w-3" /> },
  coo: { label: 'COO', color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: <AlertTriangle className="h-3 w-3" /> },
  ceo: { label: 'CEO', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30', icon: <AlertTriangle className="h-3 w-3" /> },
};

export function MyEscalationsView() {
  const [showResolved, setShowResolved] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const { data: escalations, isLoading } = useMyEscalations(showResolved);
  const { data: stats } = useMyEscalationStats();

  // Get escalation history for selected lead
  const leadEscalations = escalations?.filter(e => e.lead?.id === selectedLeadId) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">My Escalations</h1>
        <p className="text-muted-foreground">
          Track and understand your escalated leads and tasks
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={stats?.pending ? 'border-destructive/30' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Escalations</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats?.pending ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats?.pending ? 'text-destructive' : ''}`}>
              {stats?.pending || 0}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting resolution</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.thisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">Escalations created</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total History</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">All time escalations</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-muted/50 border-muted">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">About Escalations & Payroll Impact</p>
              <p className="text-xs text-muted-foreground mt-1">
                Escalations occur when <strong>untouched leads</strong> remain inactive beyond working-hour thresholds (2h→Alert, 4h→Manager, 12h→COO, 24h→CEO).
                <strong className="text-foreground"> 5+ escalations in a month results in 5% salary deduction.</strong>
                {' '}Any activity (call, email, quotation) immediately removes escalation risk.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Escalations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Escalation History</CardTitle>
              <CardDescription>View all your escalated items</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? 'Hide Resolved' : 'Show Resolved'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Related Item</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Escalated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!escalations || escalations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle className="h-8 w-8 text-success" />
                        <span className="text-muted-foreground">
                          {showResolved ? 'No escalations found' : 'No active escalations'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  escalations.map((escalation) => {
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
                            <Badge variant="secondary" className="bg-success/10 text-success">
                              Resolved
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {escalation.lead && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedLeadId(escalation.lead!.id)}
                            >
                              <History className="h-3 w-3 mr-1" />
                              History
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Escalation History Dialog */}
      <Dialog open={!!selectedLeadId} onOpenChange={() => setSelectedLeadId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Escalation History</DialogTitle>
          </DialogHeader>
          <EscalationTimeline escalations={leadEscalations} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
