import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Trophy, Medal, TrendingUp, TrendingDown, Target, Settings, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useTargetAnalysis } from '@/hooks/useSalesTargets';
import { SetTargetsDialog } from './SetTargetsDialog';
import { SetSalespersonTargetsDialog } from './SetSalespersonTargetsDialog';

export function PerformanceScoreboard() {
  const [showSetTargets, setShowSetTargets] = useState(false);
  const [showSetSalespersonTargets, setShowSetSalespersonTargets] = useState(false);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();

  const { data: targetAnalysis, isLoading: loadingTargets } = useTargetAnalysis(currentYear, currentMonth);

  const { data: salesPerformance, isLoading: loadingSales } = useQuery({
    queryKey: ['performance-sales-users'],
    queryFn: async () => {
      const { data: orders, error: ordersError } = await supabase
        .from('sales_orders')
        .select(`order_value, created_by, created_at, profile:profiles!sales_orders_created_by_fkey(full_name)`)
        .gte('created_at', startOfMonth);
      if (ordersError) throw ordersError;

      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, assigned_to, status, created_at')
        .gte('created_at', startOfMonth);
      if (leadsError) throw leadsError;

      const userStats: Record<string, any> = {};
      orders?.forEach((order: any) => {
        const userId = order.created_by;
        if (!userId) return;
        if (!userStats[userId]) {
          userStats[userId] = { id: userId, name: order.profile?.full_name || 'Unknown', revenue: 0, orderCount: 0, leadsAssigned: 0, leadsWon: 0 };
        }
        userStats[userId].revenue += order.order_value || 0;
        userStats[userId].orderCount += 1;
      });
      leads?.forEach((lead: any) => {
        const userId = lead.assigned_to;
        if (!userId) return;
        if (!userStats[userId]) {
          userStats[userId] = { id: userId, name: 'Unknown', revenue: 0, orderCount: 0, leadsAssigned: 0, leadsWon: 0 };
        }
        userStats[userId].leadsAssigned += 1;
        if (lead.status === 'won') userStats[userId].leadsWon += 1;
      });
      return Object.values(userStats)
        .map((user: any) => ({
          ...user,
          conversionRate: user.leadsAssigned > 0 ? ((user.leadsWon / user.leadsAssigned) * 100).toFixed(1) : '0.0',
          avgDealSize: user.orderCount > 0 ? user.revenue / user.orderCount : 0,
        }))
        .sort((a: any, b: any) => b.revenue - a.revenue);
    }
  });

  const { data: officePerformance, isLoading: loadingOffices } = useQuery({
    queryKey: ['performance-offices'],
    queryFn: async () => {
      const { data: offices, error: officesError } = await supabase.from('offices').select('id, name, location');
      if (officesError) throw officesError;
      const { data: orders, error: ordersError } = await supabase.from('sales_orders').select('order_value, lead_id, leads(office_id), created_at').gte('created_at', startOfMonth);
      if (ordersError) throw ordersError;
      const { data: leads, error: leadsError } = await supabase.from('leads').select('id, office_id, status, created_at').gte('created_at', startOfMonth);
      if (leadsError) throw leadsError;
      return offices?.map((office) => {
        const officeOrders = orders?.filter((o: any) => (o.leads as any)?.office_id === office.id) || [];
        const officeLeads = leads?.filter((l: any) => l.office_id === office.id) || [];
        const wonLeads = officeLeads.filter((l: any) => l.status === 'won');
        const revenue = officeOrders.reduce((sum: number, o: any) => sum + (o.order_value || 0), 0);
        const conversionRate = officeLeads.length > 0 ? ((wonLeads.length / officeLeads.length) * 100).toFixed(1) : '0.0';
        return { id: office.id, name: office.name, location: office.location, revenue, orderCount: officeOrders.length, leadCount: officeLeads.length, conversionRate };
      }).sort((a, b) => b.revenue - a.revenue);
    }
  });

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const getRankBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500 text-yellow-950">🥇 Top</Badge>;
    if (index === 1) return <Badge className="bg-gray-400 text-gray-950">🥈 2nd</Badge>;
    if (index === 2) return <Badge className="bg-amber-600 text-amber-950">🥉 3rd</Badge>;
    return <Badge variant="outline">#{index + 1}</Badge>;
  };

  const getStatusIcon = (status: 'ahead' | 'on-track' | 'behind') => {
    if (status === 'ahead') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === 'on-track') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const isLoading = loadingSales || loadingOffices || loadingTargets;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><div className="grid md:grid-cols-3 gap-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div></CardContent></Card>
        <div className="grid md:grid-cols-2 gap-6">{[1, 2].map(i => <Card key={i}><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Target vs Actual Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Target vs Actual - {monthNames[currentMonth - 1]} {currentYear}</CardTitle>
            <CardDescription>Monthly sales target progress and projections</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSetSalespersonTargets(true)}><Settings className="h-4 w-4 mr-2" />Individual Targets</Button>
            <Button variant="outline" size="sm" onClick={() => setShowSetTargets(true)}><Settings className="h-4 w-4 mr-2" />Office Targets</Button>
          </div>
        </CardHeader>
        <CardContent>
          {targetAnalysis && targetAnalysis.totalTarget > 0 ? (
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-muted/50"><CardContent className="pt-6"><div className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">🎯 Monthly Target</span><span className="text-xs text-muted-foreground">{targetAnalysis.progressPercent.toFixed(0)}%</span></div><p className="text-2xl font-bold">{formatCurrency(targetAnalysis.totalTarget)}</p><Progress value={Math.min(targetAnalysis.progressPercent, 100)} className="h-2" /><span className="text-xs text-muted-foreground">Achieved: {formatCurrency(targetAnalysis.totalActual)}</span></div></CardContent></Card>
                <Card className="bg-muted/50"><CardContent className="pt-6"><div className="space-y-3"><span className="text-sm text-muted-foreground">📊 Gap Analysis</span><p className={`text-2xl font-bold ${targetAnalysis.gap > 0 ? 'text-amber-600' : 'text-green-600'}`}>{targetAnalysis.gap > 0 ? formatCurrency(targetAnalysis.gap) : 'Target Met!'}</p><p className="text-sm text-muted-foreground">{targetAnalysis.daysRemaining} days remaining</p>{targetAnalysis.daysRemaining > 0 && targetAnalysis.gap > 0 && <p className="text-sm font-medium">{formatCurrency(targetAnalysis.requiredDailyRate)}/day needed</p>}</div></CardContent></Card>
                <Card className={targetAnalysis.isOnTrack ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}><CardContent className="pt-6"><div className="space-y-3"><span className="text-sm text-muted-foreground">📈 Run-Rate Projection</span><p className="text-2xl font-bold">{formatCurrency(targetAnalysis.projectedTotal)}</p><div className="flex items-center gap-2">{targetAnalysis.isOnTrack ? <><Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />On Track</Badge><span className="text-xs text-green-600">+{formatCurrency(targetAnalysis.projectedTotal - targetAnalysis.totalTarget)}</span></> : <><Badge variant="destructive"><TrendingDown className="h-3 w-3 mr-1" />Off Track</Badge><span className="text-xs text-red-600">{formatCurrency(targetAnalysis.projectedTotal - targetAnalysis.totalTarget)}</span></>}</div></div></CardContent></Card>
              </div>
              {targetAnalysis.officeBreakdown.length > 0 && (
                <div><h4 className="text-sm font-medium mb-3">Office-wise Target Breakdown</h4><Table><TableHeader><TableRow><TableHead>Office</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Actual</TableHead><TableHead className="text-right">Gap</TableHead><TableHead className="w-32">Progress</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader><TableBody>{targetAnalysis.officeBreakdown.map((office) => (<TableRow key={office.officeId}><TableCell className="font-medium">{office.officeName}</TableCell><TableCell className="text-right">{formatCurrency(office.target)}</TableCell><TableCell className="text-right">{formatCurrency(office.actual)}</TableCell><TableCell className={`text-right ${office.gap > 0 ? 'text-amber-600' : 'text-green-600'}`}>{office.gap > 0 ? formatCurrency(office.gap) : '—'}</TableCell><TableCell><div className="flex items-center gap-2"><Progress value={Math.min(office.progressPercent, 100)} className="h-2 flex-1" /><span className="text-xs w-10 text-right">{office.progressPercent.toFixed(0)}%</span></div></TableCell><TableCell className="text-center">{getStatusIcon(office.status)}</TableCell></TableRow>))}</TableBody></Table></div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground"><Target className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="mb-2">No targets set for {monthNames[currentMonth - 1]} {currentYear}</p><Button variant="outline" size="sm" onClick={() => setShowSetTargets(true)}>Set Monthly Targets</Button></div>
          )}
        </CardContent>
      </Card>

      {/* Top Performer Highlight */}
      {salesPerformance && salesPerformance.length > 0 && (
        <Card className="bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent border-yellow-500/30"><CardContent className="py-6"><div className="flex items-center justify-between"><div className="flex items-center gap-4"><div className="p-3 rounded-full bg-yellow-500/20"><Trophy className="h-8 w-8 text-yellow-500" /></div><div><p className="text-sm text-muted-foreground">Top Performer This Month</p><p className="text-2xl font-bold">{salesPerformance[0].name}</p><p className="text-sm text-muted-foreground">{formatCurrency(salesPerformance[0].revenue)} revenue • {salesPerformance[0].conversionRate}% conversion</p></div></div><Medal className="h-16 w-16 text-yellow-500/30" /></div></CardContent></Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" />Sales Team Rankings</CardTitle><CardDescription>MTD performance by team member</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead className="w-16">Rank</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Conv %</TableHead></TableRow></TableHeader><TableBody>{salesPerformance?.slice(0, 10).map((user: any, index: number) => (<TableRow key={user.id}><TableCell>{getRankBadge(index)}</TableCell><TableCell className="font-medium">{user.name}</TableCell><TableCell className="text-right">{formatCurrency(user.revenue)}</TableCell><TableCell className="text-right"><span className={parseFloat(user.conversionRate) >= 30 ? 'text-green-600' : parseFloat(user.conversionRate) >= 15 ? 'text-amber-600' : 'text-red-600'}>{user.conversionRate}%</span></TableCell></TableRow>))}{(!salesPerformance || salesPerformance.length === 0) && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No performance data for this month</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Office Performance</CardTitle><CardDescription>MTD performance by office</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Office</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Conv %</TableHead></TableRow></TableHeader><TableBody>{officePerformance?.map((office: any, index: number) => (<TableRow key={office.id}><TableCell><div className="flex items-center gap-2">{index === 0 && <TrendingUp className="h-4 w-4 text-green-500" />}<span className="font-medium">{office.name}</span></div></TableCell><TableCell className="text-right">{formatCurrency(office.revenue)}</TableCell><TableCell className="text-right">{office.orderCount}</TableCell><TableCell className="text-right"><span className={parseFloat(office.conversionRate) >= 30 ? 'text-green-600' : parseFloat(office.conversionRate) >= 15 ? 'text-amber-600' : 'text-red-600'}>{office.conversionRate}%</span></TableCell></TableRow>))}{(!officePerformance || officePerformance.length === 0) && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No office data available</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-center"><p className="text-sm text-muted-foreground mb-1">Total Revenue MTD</p><p className="text-2xl font-bold">{formatCurrency(salesPerformance?.reduce((sum: number, u: any) => sum + u.revenue, 0) || 0)}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-center"><p className="text-sm text-muted-foreground mb-1">Total Orders MTD</p><p className="text-2xl font-bold">{salesPerformance?.reduce((sum: number, u: any) => sum + u.orderCount, 0) || 0}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-center"><p className="text-sm text-muted-foreground mb-1">Avg Deal Size</p><p className="text-2xl font-bold">{formatCurrency(salesPerformance?.length > 0 ? salesPerformance.reduce((sum: number, u: any) => sum + u.avgDealSize, 0) / salesPerformance.length : 0)}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-center"><p className="text-sm text-muted-foreground mb-1">Active Sales Reps</p><p className="text-2xl font-bold">{salesPerformance?.filter((u: any) => u.orderCount > 0).length || 0}</p></div></CardContent></Card>
      </div>

      <SetTargetsDialog open={showSetTargets} onOpenChange={setShowSetTargets} />
      <SetSalespersonTargetsDialog open={showSetSalespersonTargets} onOpenChange={setShowSetSalespersonTargets} />
    </div>
  );
}
