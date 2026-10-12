import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, CheckCircle2, Clock, Star, ThumbsUp, ThumbsDown,
  TrendingUp, AlertTriangle, MessageSquare, PhoneCall
} from 'lucide-react';

export function TSTManagementDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['tst-management-kpis'],
    queryFn: async () => {
      // 1. Fetch all TST Cases
      const { data: cases = [] } = await (supabase as any)
        .from('tst_cases')
        .select(`
          id, status, priority, created_at, resolved_at, closed_at, assigned_to,
          assignee:profiles!tst_cases_assigned_to_fkey(id, full_name, email)
        `);

      // 2. Fetch all Customer Feedback
      const { data: feedback = [] } = await (supabase as any)
        .from('customer_feedback')
        .select(`
          id, rating, requirement_resolved, team_rating, liked_aspects, improvement_areas, comments,
          low_rating_reasons, employee_id, created_at,
          employee:profiles!customer_feedback_employee_id_fkey(id, full_name)
        `);

      // 3. Fetch all TST Interactions
      const { data: interactions = [] } = await (supabase as any)
        .from('tst_interactions')
        .select('id, employee_id, call_status, resolution_status');

      // Calculate Metrics
      const totalCases = cases.length;
      const completedCases = cases.filter((c: any) => c.status === 'resolved' || c.status === 'closed').length;
      const pendingCases = cases.filter((c: any) => c.status === 'new' || c.status === 'assigned' || c.status === 'in_progress').length;
      const followUpCases = cases.filter((c: any) => c.status === 'follow_up').length;
      const resolvedCases = cases.filter((c: any) => c.status === 'resolved').length;
      const escalatedCases = cases.filter((c: any) => c.status === 'escalated').length;
      const unresolvedCases = totalCases - resolvedCases;

      const resolutionRate = totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0;

      // Feedback stats
      const totalFeedback = feedback.length;
      const totalRatingSum = feedback.reduce((sum: number, f: any) => sum + (Number(f.rating) || 0), 0);
      const avgRating = totalFeedback > 0 ? (totalRatingSum / totalFeedback).toFixed(1) : '0.0';
      const positiveFeedback = feedback.filter((f: any) => f.rating >= 4).length;
      const negativeFeedback = feedback.filter((f: any) => f.rating <= 2).length;
      const positivePct = totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : 0;

      // Group by Employee
      const employeeMap = new Map<string, any>();

      // Populate from cases
      cases.forEach((c: any) => {
        const empId = c.assigned_to || 'unassigned';
        const empName = c.assignee?.full_name || 'Unassigned';

        if (!employeeMap.has(empId)) {
          employeeMap.set(empId, {
            id: empId,
            name: empName,
            assignedCases: 0,
            completedCases: 0,
            resolvedCases: 0,
            pendingCases: 0,
            followUps: 0,
            feedbackCount: 0,
            ratingSum: 0,
            negativeFeedback: 0,
            comments: [] as string[],
          });
        }

        const e = employeeMap.get(empId);
        e.assignedCases++;
        if (c.status === 'resolved' || c.status === 'closed') e.completedCases++;
        if (c.status === 'resolved') e.resolvedCases++;
        if (['new', 'assigned', 'in_progress'].includes(c.status)) e.pendingCases++;
        if (c.status === 'follow_up') e.followUps++;
      });

      // Populate from feedback
      feedback.forEach((f: any) => {
        const empId = f.employee_id || 'unassigned';
        if (employeeMap.has(empId)) {
          const e = employeeMap.get(empId);
          e.feedbackCount++;
          e.ratingSum += Number(f.rating) || 0;
          if (f.rating <= 2) e.negativeFeedback++;
          if (f.comments) e.comments.push(f.comments);
        }
      });

      const employeeMetrics = Array.from(employeeMap.values()).map(e => ({
        ...e,
        avgRating: e.feedbackCount > 0 ? (e.ratingSum / e.feedbackCount).toFixed(1) : '—',
        resolutionRate: e.assignedCases > 0 ? Math.round((e.resolvedCases / e.assignedCases) * 100) : 0,
      }));

      return {
        totalCases,
        completedCases,
        pendingCases,
        followUpCases,
        resolvedCases,
        unresolvedCases,
        escalatedCases,
        resolutionRate,
        totalFeedback,
        avgRating,
        positivePct,
        positiveFeedback,
        negativeFeedback,
        totalInteractions: interactions.length,
        employeeMetrics,
        recentFeedback: feedback.slice(0, 5),
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = data || {
    totalCases: 0,
    completedCases: 0,
    pendingCases: 0,
    followUpCases: 0,
    resolvedCases: 0,
    unresolvedCases: 0,
    escalatedCases: 0,
    resolutionRate: 0,
    totalFeedback: 0,
    avgRating: '0.0',
    positivePct: 0,
    positiveFeedback: 0,
    negativeFeedback: 0,
    totalInteractions: 0,
    employeeMetrics: [],
    recentFeedback: [],
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Total Cases</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold">{kpis.totalCases}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Across all TST queues</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{kpis.resolvedCases}</div>
          <p className="text-[10px] text-emerald-700 font-medium mt-1">{kpis.resolutionRate}% resolution rate</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Pending / Active</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{kpis.pendingCases}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Under engineer review</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Follow-ups</span>
            <PhoneCall className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{kpis.followUpCases}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Scheduled callbacks</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Avg Rating</span>
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
            {kpis.avgRating} <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">From {kpis.totalFeedback} reviews</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Positive %</span>
            <ThumbsUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{kpis.positivePct}%</div>
          <p className="text-[10px] text-muted-foreground mt-1">Rated 4★ or 5★</p>
        </Card>
      </div>

      {/* Employee-wise Performance Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            TST Engineer Performance Metrics
          </CardTitle>
          <CardDescription className="text-xs">
            Real-time resolution rates and customer ratings calculated strictly from system records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="text-xs bg-slate-50/50">
                  <TableHead>TST Engineer</TableHead>
                  <TableHead className="text-center">Assigned</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                  <TableHead className="text-center">Resolved</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Follow-ups</TableHead>
                  <TableHead className="text-center">Resolution Rate</TableHead>
                  <TableHead className="text-center">Avg Rating</TableHead>
                  <TableHead className="text-center">Reviews</TableHead>
                  <TableHead className="text-center">Negative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.employeeMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-sm text-muted-foreground">
                      No engineer cases recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  kpis.employeeMetrics.map((emp: any) => (
                    <TableRow key={emp.id} className="text-sm">
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell className="text-center">{emp.assignedCases}</TableCell>
                      <TableCell className="text-center font-medium text-emerald-700">{emp.completedCases}</TableCell>
                      <TableCell className="text-center">{emp.resolvedCases}</TableCell>
                      <TableCell className="text-center">{emp.pendingCases}</TableCell>
                      <TableCell className="text-center">{emp.followUps}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono text-xs">
                          {emp.resolutionRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold text-amber-600">
                        {emp.avgRating !== '—' ? `${emp.avgRating} ★` : '—'}
                      </TableCell>
                      <TableCell className="text-center">{emp.feedbackCount}</TableCell>
                      <TableCell className="text-center text-destructive font-medium">
                        {emp.negativeFeedback > 0 ? emp.negativeFeedback : '0'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Team Feedback & Recent Customer Reviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Recent Customer Reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {kpis.recentFeedback.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No reviews submitted yet.</p>
            ) : (
              kpis.recentFeedback.map((fb: any) => (
                <div key={fb.id} className="p-3 bg-slate-50 border rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {fb.employee?.full_name ? `Engineer: ${fb.employee.full_name}` : 'TST Team'}
                    </span>
                    <span className="text-amber-500 font-bold">{fb.rating} ★</span>
                  </div>
                  <p className="text-muted-foreground">{fb.comments || fb.liked_aspects || 'No detailed text'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              TST Team Health & SLA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Total Phone / Solution Consultations:</span>
              <span className="font-bold text-foreground">{kpis.totalInteractions}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Overall Team Customer Rating:</span>
              <span className="font-bold text-amber-600">{kpis.avgRating} / 5.0</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Customer Satisfaction Index (Positive %):</span>
              <span className="font-bold text-emerald-600">{kpis.positivePct}%</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b">
              <span className="text-muted-foreground">Total Negative Sentiment Escalations:</span>
              <span className="font-bold text-destructive">{kpis.negativeFeedback}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
