import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Target,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  AlertTriangle,
  Inbox,
} from 'lucide-react';
import {
  usePriceRequestQueue,
  usePriceRequestKpis,
  useProcurementMembers,
  useAssignPriceRequests,
  type QueueFilters,
  type QueueRow,
} from '@/hooks/usePriceRequestQueue';
import { PriceRequestDetailSheet } from './PriceRequestDetailSheet';
import { PriceResolveSheet } from './PriceResolveSheet';
import { useCanSeeCustomerName, requestRef } from '@/lib/procurement-privacy';

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  in_progress: { label: 'In Progress', icon: AlertCircle, className: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  resolved: { label: 'Resolved', icon: CheckCircle2, className: 'bg-green-500/10 text-green-600 border-green-200' },
  no_price: { label: 'No Price', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const PAGE_SIZE = 50;
const inr = (n?: number | null) =>
  n == null ? '—' : `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

export function PriceRequestsTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;
  const canSeeCustomer = useCanSeeCustomerName();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<QueueFilters['status']>('pending');
  const [assignedTo, setAssignedTo] = useState('all');
  const [priority, setPriority] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [detail, setDetail] = useState<QueueRow | null>(null);
  const [resolveFor, setResolveFor] = useState<QueueRow | null>(null);

  const filters: QueueFilters = useMemo(
    () => ({ status, search, assignedTo, priority, page, pageSize: PAGE_SIZE }),
    [status, search, assignedTo, priority, page]
  );

  const { data, isLoading, refetch } = usePriceRequestQueue(filters, userId);
  const { data: kpis } = usePriceRequestKpis(userId);
  const { data: members = [] } = useProcurementMembers();
  const assign = useAssignPriceRequests();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
    setSelected([]);
  };

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? rows.map((r) => r.id) : []);

  const doAssign = async (userIdToAssign: string | null) => {
    if (!selected.length) return;
    await assign.mutateAsync({
      ids: selected,
      userId: userIdToAssign,
      itemLabels: rows.filter((r) => selected.includes(r.id)).map((r) => r.product_text),
    });
    setSelected([]);
    setBulkAssignee('');
    refetch();
  };


  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <Kpi label="Pending" value={kpis?.pending} icon={Inbox} onClick={() => resetPage(setStatus)('pending')} />
        <Kpi label="My queue" value={kpis?.mine} icon={UserPlus} onClick={() => { setAssignedTo('me'); setStatus('all'); setPage(0); }} />
        <Kpi label="Urgent / High" value={kpis?.urgent} icon={AlertTriangle} tone="destructive" onClick={() => { setPriority('urgent'); setPage(0); }} />
        <Kpi label="Overdue TAT" value={kpis?.overdue} icon={Clock} tone="destructive" />
        <Kpi label="Target matched" value={kpis?.matched} icon={Target} onClick={() => resetPage(setStatus)('matched')} />
        <Kpi label="Resolved" value={kpis?.resolved} icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Price Request Queue</CardTitle>
          <CardDescription>
            {total.toLocaleString('en-IN')} request{total === 1 ? '' : 's'} · page {page + 1} of {pageCount}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search item (min 2 chars)…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <Select value={status} onValueChange={(v) => resetPage(setStatus)(v as QueueFilters['status'])}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="no_price">No price</SelectItem>
                <SelectItem value="matched">Target matched</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignedTo} onValueChange={resetPage(setAssignedTo)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="me">My queue</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="to_distribute">Unassigned / with me</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={resetPage(setPriority)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk assign bar */}
          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
              <span className="text-sm">{selected.length} selected</span>
              <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
                <SelectTrigger className="w-[220px] h-8"><SelectValue placeholder="Assign to…" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!bulkAssignee || assign.isPending} onClick={() => doAssign(bulkAssignee)}>
                Assign
              </Button>
              {userId && (
                <Button size="sm" variant="outline" onClick={() => doAssign(userId)}>
                  Assign to me
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => doAssign(null)}>Unassign</Button>
            </div>
          )}

          {/* Table */}
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No price requests match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.length === rows.length && rows.length > 0}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>{canSeeCustomer ? 'Customer' : 'Ref'}</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const cfg = statusConfig[r.status] || statusConfig.pending;
                    const Icon = cfg.icon;
                    const overdue =
                      r.tat_deadline &&
                      !r.resolved_at &&
                      new Date(r.tat_deadline).getTime() < Date.now();
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.includes(r.id)}
                            onCheckedChange={(c) =>
                              setSelected((s) => (c ? [...s, r.id] : s.filter((x) => x !== r.id)))
                            }
                          />
                        </TableCell>
                        <TableCell className="max-w-[320px]">
                          <p className="font-medium text-sm break-words whitespace-pre-wrap">{r.product_text}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {r.brand && (
                              <Badge variant="secondary" className="text-xs">{r.brand}</Badge>
                            )}
                            {(r.current_round || 1) > 1 && (
                              <Badge variant="outline" className="text-xs">Round {r.current_round}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={canSeeCustomer ? 'text-sm' : 'text-xs font-mono text-muted-foreground'}>
                          {canSeeCustomer ? r.customer_name : requestRef(r.id)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{r.quantity ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{inr(r.target_rate)}</TableCell>
                        <TableCell className="text-right text-sm">{inr(r.resolved_price)}</TableCell>
                        <TableCell className="text-sm">{r.assigned_to_name || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.requested_at || r.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={`${cfg.className} flex w-fit items-center gap-1 text-xs`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                            {r.target_matched_at && (
                              <Badge variant="outline" className="w-fit bg-green-500/10 text-green-600 border-green-200 text-xs">
                                <Target className="h-3 w-3 mr-1" /> Matched
                              </Badge>
                            )}
                            {overdue && (
                              <span className="text-xs text-destructive">
                                Overdue {format(new Date(r.tat_deadline!), 'dd MMM')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                          {r.status !== 'resolved' && (
                            <Button size="sm" className="h-8" onClick={() => setResolveFor(r)}>
                              Fill prices
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8" onClick={() => setDetail(r)}>
                            {r.status === 'resolved' ? 'View' : 'Details'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Showing {rows.length ? page * PAGE_SIZE + 1 : 0}–{page * PAGE_SIZE + rows.length} of {total.toLocaleString('en-IN')}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PriceRequestDetailSheet
        request={detail}
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        onChanged={() => refetch()}
      />

      <PriceResolveSheet
        request={resolveFor}
        open={!!resolveFor}
        onOpenChange={(v) => !v && setResolveFor(null)}
        onChanged={() => refetch()}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value?: number;
  icon: any;
  tone?: 'destructive';
  onClick?: () => void;
}) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:border-primary transition-colors' : ''} onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {value == null ? (
              <Skeleton className="h-6 w-12 mt-1" />
            ) : (
              <p className={`text-xl font-bold ${tone === 'destructive' && value > 0 ? 'text-destructive' : ''}`}>
                {value.toLocaleString('en-IN')}
              </p>
            )}
          </div>
          <Icon className={`h-4 w-4 ${tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  );
}
