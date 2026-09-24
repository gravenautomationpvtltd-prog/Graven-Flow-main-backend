import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trophy, 
  Medal, 
  Target, 
  Settings, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Package,
  Clock,
  FileText,
  TrendingUp,
  Eye,
  Users,
  Filter
} from 'lucide-react';
import { useProcurementPerformance, useProcurementTargetAnalysis, ProcurementUserStats } from '@/hooks/useProcurementPerformance';
import { PROCUREMENT_METRICS } from '@/hooks/useProcurementTargets';
import { SetProcurementTargetsDialog } from './SetProcurementTargetsDialog';
import { ProcurementMemberDetailSheet } from './ProcurementMemberDetailSheet';

export function ProcurementPerformanceBoard() {
  const [showSetTargets, setShowSetTargets] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [detailMember, setDetailMember] = useState<{ userId: string; userName: string; stats: ProcurementUserStats } | null>(null);
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();
  const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();

  const { data: performance, isLoading: loadingPerformance } = useProcurementPerformance(startOfMonth, endOfMonth);
  const { data: targetAnalysis, isLoading: loadingTargets } = useProcurementTargetAnalysis(currentYear, currentMonth);

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
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

  const handleRowClick = (user: ProcurementUserStats) => {
    setDetailMember({ userId: user.userId, userName: user.userName, stats: user });
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const isLoading = loadingPerformance || loadingTargets;

  // Filter team stats based on selected member
  const filteredStats = selectedMember === 'all' 
    ? performance?.teamStats 
    : performance?.teamStats.filter(u => u.userId === selectedMember);

  // Calculate filtered totals
  const filteredTotals = filteredStats?.reduce(
    (acc, user) => ({
      totalResolutions: acc.totalResolutions + user.priceResolutions,
      totalProductsUpdated: acc.totalProductsUpdated + user.productsUpdated,
      totalPosCreated: acc.totalPosCreated + user.posCreated,
      totalPoValue: acc.totalPoValue + user.totalPoValue,
      totalGrns: acc.totalGrns + user.grnsProcessed,
      avgResolutionTime: 0,
    }),
    { totalResolutions: 0, totalProductsUpdated: 0, totalPosCreated: 0, totalPoValue: 0, totalGrns: 0, avgResolutionTime: 0 }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Member Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Procurement Team Performance
          </h2>
          <p className="text-sm text-muted-foreground">
            {monthNames[currentMonth - 1]} {currentYear} • {performance?.teamStats.length || 0} team members
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Team Members</SelectItem>
              {performance?.teamStats.map(user => (
                <SelectItem key={user.userId} value={user.userId}>
                  {user.userName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Team Totals Summary - Interactive Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => {
            if (selectedMember !== 'all') {
              const user = performance?.teamStats.find(u => u.userId === selectedMember);
              if (user) handleRowClick(user);
            }
          }}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Prices Resolved</span>
              </div>
              <p className="text-2xl font-bold">{filteredTotals?.totalResolutions || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => {
            if (selectedMember !== 'all') {
              const user = performance?.teamStats.find(u => u.userId === selectedMember);
              if (user) handleRowClick(user);
            }
          }}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Avg Resolution</span>
              </div>
              <p className="text-2xl font-bold">{formatTime(performance?.teamTotals.avgResolutionTime || 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => {
            if (selectedMember !== 'all') {
              const user = performance?.teamStats.find(u => u.userId === selectedMember);
              if (user) handleRowClick(user);
            }
          }}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-sm">Products Updated</span>
              </div>
              <p className="text-2xl font-bold">{filteredTotals?.totalProductsUpdated || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => {
            if (selectedMember !== 'all') {
              const user = performance?.teamStats.find(u => u.userId === selectedMember);
              if (user) handleRowClick(user);
            }
          }}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <FileText className="h-4 w-4" />
                <span className="text-sm">POs Created</span>
              </div>
              <p className="text-2xl font-bold">{filteredTotals?.totalPosCreated || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
          onClick={() => {
            if (selectedMember !== 'all') {
              const user = performance?.teamStats.find(u => u.userId === selectedMember);
              if (user) handleRowClick(user);
            }
          }}
        >
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Total PO Value</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(filteredTotals?.totalPoValue || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Target Progress Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Target Progress - {monthNames[currentMonth - 1]} {currentYear}
            </CardTitle>
            <CardDescription>Individual procurement target tracking</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSetTargets(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Set Targets
          </Button>
        </CardHeader>
        <CardContent>
          {targetAnalysis?.hasTargets ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="w-32">Progress</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targetAnalysis.targets.map((target: any) => (
                  <TableRow key={target.id}>
                    <TableCell className="font-medium">{target.userName}</TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {PROCUREMENT_METRICS[target.metric as keyof typeof PROCUREMENT_METRICS]?.icon}{' '}
                        {PROCUREMENT_METRICS[target.metric as keyof typeof PROCUREMENT_METRICS]?.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {target.metric === 'po_value' 
                        ? formatCurrency(target.target_value)
                        : target.metric === 'resolution_time_hours'
                        ? formatTime(target.target_value)
                        : target.target_value}
                    </TableCell>
                    <TableCell className="text-right">
                      {target.metric === 'po_value' 
                        ? formatCurrency(target.actual)
                        : target.metric === 'resolution_time_hours'
                        ? formatTime(target.actual)
                        : target.actual}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(target.progress, 100)} className="h-2 flex-1" />
                        <span className="text-xs w-10 text-right">{target.progress.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusIcon(target.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="mb-2">No targets set for {monthNames[currentMonth - 1]} {currentYear}</p>
              <Button variant="outline" size="sm" onClick={() => setShowSetTargets(true)}>
                Set Procurement Targets
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performer Highlight */}
      {performance?.topPerformer && selectedMember === 'all' && (
        <Card 
          className="bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent border-yellow-500/30 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => handleRowClick(performance.topPerformer!)}
        >
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-yellow-500/20">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Top Procurement Performer This Month</p>
                  <p className="text-2xl font-bold">{performance.topPerformer.userName}</p>
                  <p className="text-sm text-muted-foreground">
                    {performance.topPerformer.priceResolutions} prices resolved • 
                    {performance.topPerformer.posCreated} POs • 
                    {formatTime(performance.topPerformer.avgResolutionTimeHours)} avg resolution
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
                <Medal className="h-16 w-16 text-yellow-500/30" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Rankings - Clickable Rows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Procurement Team Rankings
          </CardTitle>
          <CardDescription>
            MTD performance by team member • Click any row for detailed breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Prices Resolved</TableHead>
                <TableHead className="text-right">Avg Time</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">POs</TableHead>
                <TableHead className="text-right">PO Value</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStats?.map((user, index) => (
                <TableRow 
                  key={user.userId}
                  className="cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => handleRowClick(user)}
                >
                  <TableCell>{getRankBadge(index)}</TableCell>
                  <TableCell className="font-medium">{user.userName}</TableCell>
                  <TableCell className="text-right">
                    <span className={user.priceResolutions > 0 ? 'font-medium' : 'text-muted-foreground'}>
                      {user.priceResolutions}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={
                      user.priceResolutions === 0 ? 'text-muted-foreground' :
                      user.avgResolutionTimeHours < 24 ? 'text-green-600' : 
                      user.avgResolutionTimeHours < 48 ? 'text-amber-600' : 'text-red-600'
                    }>
                      {user.priceResolutions > 0 ? formatTime(user.avgResolutionTimeHours) : '-'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={user.productsUpdated > 0 ? 'font-medium' : 'text-muted-foreground'}>
                      {user.productsUpdated}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={user.posCreated > 0 ? 'font-medium' : 'text-muted-foreground'}>
                      {user.posCreated}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={user.totalPoValue > 0 ? 'font-medium' : 'text-muted-foreground'}>
                      {user.totalPoValue > 0 ? formatCurrency(user.totalPoValue) : '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(user);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!filteredStats || filteredStats.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No team members found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs/Sheets */}
      <SetProcurementTargetsDialog open={showSetTargets} onOpenChange={setShowSetTargets} />
      
      <ProcurementMemberDetailSheet
        userId={detailMember?.userId || null}
        userName={detailMember?.userName || null}
        stats={detailMember?.stats || null}
        startDate={startOfMonth}
        endDate={endOfMonth}
        open={!!detailMember}
        onOpenChange={(open) => !open && setDetailMember(null)}
      />
    </div>
  );
}
