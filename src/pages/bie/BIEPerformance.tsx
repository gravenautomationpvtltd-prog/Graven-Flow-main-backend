import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VersusTeam } from '@/components/bie/PerformanceComparison';
import { fmtNumber, memberStats, teamAverages } from '@/lib/bie-performance';
import { useBIEScopedWork, useBIETeam } from '@/hooks/useBIEWork';

const periods = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

const typeLabels: Record<string, string> = {
  vendor_registrations: 'Vendor registrations',
  tenders: 'Tenders',
  website_listings: 'Website listings',
  product_assignments: 'Product work',
};

export default function BIEPerformance() {
  const { rows, isLoading } = useBIEScopedWork();
  const { data: team = [] } = useBIETeam();
  const [period, setPeriod] = useState('90');

  const scoped = useMemo(() => {
    if (period === 'all') return rows;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(period));
    return rows.filter((row) => new Date(row.updated_at ?? row.created_at) >= cutoff);
  }, [rows, period]);

  const stats = useMemo(
    () => team.map((member) => memberStats(member, scoped)).sort((a, b) => b.completed - a.completed),
    [team, scoped],
  );
  const averages = useMemo(() => teamAverages(stats), [stats]);
  const topCompleted = Math.max(1, ...stats.map((row) => row.completed));

  if (isLoading) {
    return <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-28" />)}</div>;
  }

  const headline = [
    { label: 'Completed (team)', value: String(scoped.filter((row) => row.completed_at).length) },
    { label: 'Avg. completed per person', value: fmtNumber(averages.completed) },
    { label: 'Avg. turnaround', value: fmtNumber(averages.avgTurnaround, ' days') },
    { label: 'Avg. on-time', value: fmtNumber(averages.onTimeRate, '%') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/bie/dashboard" aria-label="Back to team dashboard"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Team performance</h1>
            <p className="text-muted-foreground">Completed work, turnaround and how each person compares with the team.</p>
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {headline.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{card.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Completed work per person</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {stats.map((person) => (
            <div key={person.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{person.name}</span>
                <span className="flex items-center gap-2">
                  <span>{person.completed} completed</span>
                  <VersusTeam value={person.completed} average={averages.completed} />
                </span>
              </div>
              <Progress value={(person.completed / topCompleted) * 100} />
            </div>
          ))}
          {!stats.length && <p className="py-8 text-center text-muted-foreground">No BIE employees yet</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detailed scorecard</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Completion rate</TableHead>
                <TableHead>Avg. turnaround</TableHead>
                <TableHead>On time</TableHead>
                <TableHead>Rework</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <Link to={`/bie/team/${person.id}`} className="block hover:underline">
                      <p className="font-medium">{person.name}</p>
                      <p className="text-sm text-muted-foreground">{person.email}</p>
                    </Link>
                  </TableCell>
                  <TableCell>{person.assigned}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{person.completed}</span>
                      <VersusTeam value={person.completed} average={averages.completed} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{fmtNumber(person.completionRate, '%')}</span>
                      <VersusTeam value={person.completionRate} average={averages.completionRate} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{fmtNumber(person.avgTurnaround, ' d')}</span>
                      <VersusTeam value={person.avgTurnaround} average={averages.avgTurnaround} higherIsBetter={false} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{fmtNumber(person.onTimeRate, '%')}</span>
                      <VersusTeam value={person.onTimeRate} average={averages.onTimeRate} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{fmtNumber(person.reworkRate, '%')}</span>
                      <VersusTeam value={person.reworkRate} average={averages.reworkRate} higherIsBetter={false} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link to={`/bie/team/${person.id}`} aria-label={`Open ${person.name}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {!stats.length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No BIE employees yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Completed work by type</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                {Object.values(typeLabels).map((typeLabel) => (
                  <TableHead key={typeLabel}>{typeLabel}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  {Object.keys(typeLabels).map((type) => {
                    const count = scoped.filter(
                      (row) => row.assigned_to === person.id && row.type === type && row.completed_at,
                    ).length;
                    return (
                      <TableCell key={type}>
                        {count ? <Badge variant="secondary">{count}</Badge> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
