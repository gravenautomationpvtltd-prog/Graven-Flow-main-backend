import { Link } from 'react-router-dom';
import { differenceInCalendarDays, isBefore, parseISO, startOfDay } from 'date-fns';
import { ChevronRight, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { BIERow } from '@/hooks/useBIEWork';

type Member = { id: string; full_name: string | null; email: string | null };

const overdue = (row: BIERow) =>
  !!row.due_date && !row.completed_at && isBefore(parseISO(row.due_date), startOfDay(new Date()));

const avgDays = (rows: BIERow[]) => {
  const done = rows.filter((row) => row.completed_at);
  if (!done.length) return '—';
  const total = done.reduce(
    (sum, row) => sum + Math.max(0, differenceInCalendarDays(new Date(row.completed_at as string), new Date(row.created_at))),
    0,
  );
  return `${(total / done.length).toFixed(1)} d`;
};

export function TeamScorecard({ team, rows }: { team: Member[]; rows: BIERow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Team performance</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Open</TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead>In review</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead>Avg. turnaround</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.map((member) => {
              const mine = rows.filter((row) => row.assigned_to === member.id);
              return (
                <TableRow key={member.id} className="cursor-pointer">
                  <TableCell>
                    <Link to={`/bie/team/${member.id}`} className="block hover:underline">
                      <p className="font-medium">{member.full_name || member.email}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </Link>
                  </TableCell>
                  <TableCell>{mine.length}</TableCell>
                  <TableCell>{mine.filter((row) => !row.completed_at).length}</TableCell>
                  <TableCell className={mine.filter(overdue).length ? 'font-medium text-destructive' : ''}>
                    {mine.filter(overdue).length}
                  </TableCell>
                  <TableCell>{mine.filter((row) => row.review_status === 'submitted').length}</TableCell>
                  <TableCell>{mine.filter((row) => row.completed_at).length}</TableCell>
                  <TableCell>{avgDays(mine)}</TableCell>
                  <TableCell>
                    <Link to={`/bie/team/${member.id}`} aria-label={`Open ${member.full_name ?? 'employee'}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {!team.length && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No BIE employees yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
