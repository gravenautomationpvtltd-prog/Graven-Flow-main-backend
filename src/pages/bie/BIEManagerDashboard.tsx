import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format, isBefore, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, ClipboardList, ListTodo } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewQueue } from '@/components/bie/ReviewQueue';
import { TeamScorecard } from '@/components/bie/TeamScorecard';
import { BIERow, useBIEScopedWork, useBIETeam } from '@/hooks/useBIEWork';

const typeLabels: Record<string, string> = {
  vendor_registrations: 'Vendor registration',
  tenders: 'Tender',
  website_listings: 'Website listing',
  product_assignments: 'Product work',
};

const isOverdue = (row: BIERow) =>
  !!row.due_date && !row.completed_at && isBefore(parseISO(row.due_date), startOfDay(new Date()));

export default function BIEManagerDashboard() {
  const { rows, isLoading } = useBIEScopedWork();
  const { data: team = [] } = useBIETeam();

  const nameOf = (id: string | null) => team.find((member) => member.id === id)?.full_name ?? 'Unassigned';

  const monthStart = startOfMonth(new Date());
  const open = rows.filter((row) => !row.completed_at);
  const overdue = rows.filter(isOverdue);
  const dueSoon = rows.filter(
    (row) =>
      !row.completed_at &&
      row.due_date &&
      differenceInCalendarDays(parseISO(row.due_date), new Date()) <= 7 &&
      !isOverdue(row),
  );
  const completedThisMonth = rows.filter((row) => row.completed_at && new Date(row.completed_at) >= monthStart);
  const inReview = rows.filter((row) => row.review_status === 'submitted');

  const cards = [
    { label: 'Team open work', value: open.length, icon: ListTodo },
    { label: 'Due in 7 days', value: dueSoon.length, icon: CalendarClock },
    { label: 'Overdue', value: overdue.length, icon: AlertTriangle },
    { label: 'Waiting for my review', value: inReview.length, icon: ClipboardList },
    { label: 'Completed this month', value: completedThisMonth.length, icon: CheckCircle2 },
  ];

  if (isLoading) {
    return <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-28" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">BIE Team Dashboard</h1>
          <p className="text-muted-foreground">Workload, deadlines, reviews and performance across your team.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/bie/performance"><BarChart3 className="mr-2 h-4 w-4" />Performance</Link>
          </Button>
          <Button asChild>
            <Link to="/bie/work"><ClipboardList className="mr-2 h-4 w-4" />Assign work</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReviewQueue rows={rows} nameOf={nameOf} />

        <Card>
          <CardHeader><CardTitle>Next deadlines</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[...overdue, ...dueSoon].slice(0, 8).map((row) => (
              <div key={`${row.type}-${row.id}`} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-sm text-muted-foreground">{typeLabels[row.type]} · {nameOf(row.assigned_to)}</p>
                </div>
                <Badge variant={isOverdue(row) ? 'destructive' : 'secondary'}>
                  {row.due_date ? format(parseISO(row.due_date), 'dd MMM') : '—'}
                </Badge>
              </div>
            ))}
            {![...overdue, ...dueSoon].length && (
              <p className="py-8 text-center text-muted-foreground">Nothing due in the next 7 days</p>
            )}
          </CardContent>
        </Card>
      </div>

      <TeamScorecard team={team} rows={rows} />
    </div>
  );
}
