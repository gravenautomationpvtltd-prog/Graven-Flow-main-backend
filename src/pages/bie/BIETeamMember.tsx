import { Link, useParams } from 'react-router-dom';
import { differenceInCalendarDays, format, isBefore, parseISO, startOfDay } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReviewQueue } from '@/components/bie/ReviewQueue';
import { BIERow, useBIETeam, useBIEWork } from '@/hooks/useBIEWork';

const typeLabels: Record<string, string> = {
  vendor_registrations: 'Vendor registration',
  tenders: 'Tender',
  website_listings: 'Website listing',
  product_assignments: 'Product work',
};

const isOverdue = (row: BIERow) =>
  !!row.due_date && !row.completed_at && isBefore(parseISO(row.due_date), startOfDay(new Date()));

export default function BIETeamMember() {
  const { userId } = useParams<{ userId: string }>();
  const { data } = useBIEWork();
  const { data: team = [] } = useBIETeam();

  const member = team.find((person) => person.id === userId);
  const rows = (data?.rows ?? []).filter((row) => row.assigned_to === userId);
  const done = rows.filter((row) => row.completed_at);
  const avg = done.length
    ? `${(
        done.reduce(
          (sum, row) =>
            sum + Math.max(0, differenceInCalendarDays(new Date(row.completed_at as string), new Date(row.created_at))),
          0,
        ) / done.length
      ).toFixed(1)} d`
    : '—';

  const nameOf = () => member?.full_name ?? '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/bie/dashboard" aria-label="Back to team dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold">{member?.full_name ?? 'Team member'}</h1>
          <p className="text-muted-foreground">{member?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Assigned', value: rows.length },
          { label: 'Open', value: rows.filter((row) => !row.completed_at).length },
          { label: 'Overdue', value: rows.filter(isOverdue).length },
          { label: 'Avg. turnaround', value: avg },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{card.label}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{card.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <ReviewQueue rows={rows} nameOf={nameOf} />

      <Card>
        <CardHeader><CardTitle>All work</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.type}-${row.id}`}>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell className="text-muted-foreground">{typeLabels[row.type]}</TableCell>
                  <TableCell><Badge variant={row.completed_at ? 'default' : 'secondary'}>{row.status.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="capitalize">{row.priority}</TableCell>
                  <TableCell className={isOverdue(row) ? 'font-medium text-destructive' : ''}>
                    {row.due_date ? format(parseISO(row.due_date), 'dd MMM yyyy') : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No work assigned</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
