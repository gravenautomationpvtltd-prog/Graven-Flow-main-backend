import { useMemo, useState } from 'react';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { AlertTriangle, CheckCircle2, ClipboardCheck, History, RotateCcw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  BIERow,
  BIEWorkType,
  useBIEHistory,
  useBIEScopedWork,
  useBIETeam,
  useSubmitForReview,
  useUpdateBIEWork,
} from '@/hooks/useBIEWork';

const typeLabels: Record<string, string> = {
  vendor_registrations: 'Vendor registration',
  tenders: 'Tender',
  website_listings: 'Website listing',
  product_assignments: 'Product work',
};

const statusOptions: Record<BIEWorkType, string[]> = {
  vendor_registrations: ['not_started', 'in_progress', 'submitted', 'approved', 'rejected'],
  tenders: ['identified', 'preparing', 'submitted', 'awarded', 'lost'],
  website_listings: ['draft', 'active', 'needs_update', 'removed'],
};

const steps = ['Assigned', 'In progress', 'Sent for review', 'Approved'] as const;

const stepIndex = (row: BIERow) => {
  if (row.review_status === 'approved') return 3;
  if (row.review_status === 'submitted') return 2;
  if (row.status && row.status !== 'not_started' && row.status !== 'identified' && row.status !== 'draft') return 1;
  return 0;
};

const overdue = (row: BIERow) =>
  !!row.due_date && !row.completed_at && isBefore(parseISO(row.due_date), startOfDay(new Date()));

const pretty = (value: string) => value.replace(/_/g, ' ');

function StepTracker({ row }: { row: BIERow }) {
  const current = row.review_status === 'rework' ? 1 : stepIndex(row);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => (
        <span
          key={step}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium',
            index < current && 'bg-primary/10 text-primary',
            index === current && 'bg-primary text-primary-foreground',
            index > current && 'bg-muted text-muted-foreground',
          )}
        >
          {step}
        </span>
      ))}
      {row.review_status === 'rework' && <Badge variant="destructive">Sent back</Badge>}
    </div>
  );
}

export default function BIEMyWork() {
  const { rows, isLoading } = useBIEScopedWork();
  const { data: team = [] } = useBIETeam();
  const submit = useSubmitForReview();
  const update = useUpdateBIEWork();

  const [tab, setTab] = useState('open');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [active, setActive] = useState<BIERow | null>(null);
  const [note, setNote] = useState('');
  const { data: history = [] } = useBIEHistory(active?.id);

  const nameOf = (id: string | null) => team.find((member) => member.id === id)?.full_name ?? '—';

  const buckets = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visible = rows
      .filter((row) => (typeFilter === 'all' ? true : row.type === typeFilter))
      .filter((row) => (term ? `${row.title} ${row.subtitle}`.toLowerCase().includes(term) : true))
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
    return {
      open: visible.filter((row) => !row.completed_at && row.review_status !== 'submitted' && row.review_status !== 'rework'),
      rework: visible.filter((row) => row.review_status === 'rework'),
      review: visible.filter((row) => row.review_status === 'submitted'),
      done: visible.filter((row) => row.review_status === 'approved' || row.completed_at),
      all: visible,
    };
  }, [rows, search, typeFilter]);

  const list = buckets[tab as keyof typeof buckets] ?? buckets.all;

  if (isLoading) {
    return <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">My work</h1>
        <p className="text-muted-foreground">Everything assigned to you, with each step from start to approval.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'To do', value: buckets.open.length, icon: ClipboardCheck },
          { label: 'Sent back to me', value: buckets.rework.length, icon: RotateCcw },
          { label: 'Waiting for review', value: buckets.review.length, icon: History },
          { label: 'Approved', value: buckets.done.length, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search my work" className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-52"><SelectValue placeholder="Work type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All work types</SelectItem>
            {Object.entries(typeLabels).map(([value, text]) => (
              <SelectItem key={value} value={value}>{text}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="open">To do ({buckets.open.length})</TabsTrigger>
          <TabsTrigger value="rework">Sent back ({buckets.rework.length})</TabsTrigger>
          <TabsTrigger value="review">In review ({buckets.review.length})</TabsTrigger>
          <TabsTrigger value="done">Approved ({buckets.done.length})</TabsTrigger>
          <TabsTrigger value="all">Everything ({buckets.all.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-3">
        {list.map((row) => (
          <Card key={`${row.type}-${row.id}`} className={cn(row.review_status === 'rework' && 'border-destructive/50')}>
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.title}</p>
                  <Badge variant="secondary">{typeLabels[row.type]}</Badge>
                  <Badge variant="outline" className="capitalize">{pretty(row.status)}</Badge>
                  {overdue(row) && (
                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Overdue</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {row.subtitle || '—'} · given by {nameOf(row.assigned_by)} · due{' '}
                  {row.due_date ? format(parseISO(row.due_date), 'dd MMM yyyy') : 'not set'}
                </p>
                <StepTracker row={row} />
                {row.review_status === 'rework' && row.rework_note && (
                  <p className="text-sm text-destructive">Manager’s note: {row.rework_note}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => { setActive(row); setNote(''); }}>
                  Open
                </Button>
                {row.review_status !== 'submitted' && row.review_status !== 'approved' && (
                  <Button
                    size="sm"
                    disabled={submit.isPending}
                    onClick={() => submit.mutate({ table: row.type, id: row.id })}
                  >
                    Submit for review
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {!list.length && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nothing here right now</CardContent></Card>
        )}
      </div>

      <Sheet open={!!active} onOpenChange={(isOpen) => !isOpen && setActive(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>{active?.title}</SheetTitle></SheetHeader>
          {active && (
            <div className="space-y-5 py-4">
              <StepTracker row={active} />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Type</p><p>{typeLabels[active.type]}</p></div>
                <div><p className="text-muted-foreground">Given by</p><p>{nameOf(active.assigned_by)}</p></div>
                <div><p className="text-muted-foreground">Priority</p><p className="capitalize">{active.priority}</p></div>
                <div>
                  <p className="text-muted-foreground">Due</p>
                  <p className={overdue(active) ? 'font-medium text-destructive' : ''}>
                    {active.due_date ? format(parseISO(active.due_date), 'dd MMM yyyy') : 'Not set'}
                  </p>
                </div>
              </div>

              {active.type !== 'product_assignments' && (
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select
                    value={active.status}
                    onValueChange={async (value) => {
                      await update.mutateAsync({
                        table: active.type as BIEWorkType,
                        id: active.id,
                        previousStatus: active.status,
                        values: { status: value },
                      });
                      setActive({ ...active, status: value });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(statusOptions[active.type as BIEWorkType] ?? []).map((status) => (
                        <SelectItem key={status} value={status} className="capitalize">{pretty(status)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {active.review_status !== 'submitted' && active.review_status !== 'approved' && (
                <div className="space-y-2">
                  <Label htmlFor="submit-note">Note for your manager (optional)</Label>
                  <Textarea id="submit-note" value={note} onChange={(event) => setNote(event.target.value)} />
                  <Button
                    className="w-full"
                    disabled={submit.isPending}
                    onClick={async () => {
                      await submit.mutateAsync({ table: active.type, id: active.id, note: note || undefined });
                      setActive(null);
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />Submit for review
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <p className="flex items-center gap-2 font-medium"><History className="h-4 w-4" />Progress log</p>
                {history.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-3 text-sm">
                    <p className="capitalize">
                      {entry.from_status ? `${pretty(entry.from_status)} → ` : ''}{pretty(entry.to_status ?? '')}
                    </p>
                    {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at as string), 'dd MMM yyyy, HH:mm')}
                    </p>
                  </div>
                ))}
                {!history.length && <p className="text-sm text-muted-foreground">No updates logged yet</p>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
