import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, isBefore, parseISO, startOfDay } from 'date-fns';
import { AlertTriangle, ExternalLink, History, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  BIEPriority,
  BIEReviewStatus,
  BIEWorkType,
  useBIEHistory,
  useBIETeam,
  useBIEWork,
  useCreateBIEWork,
  useReviewBIEWork,
  useSubmitForReview,
  useUpdateBIEWork,
} from '@/hooks/useBIEWork';
import { ProductAssignmentsTable } from '@/components/bie/ProductAssignmentsTable';
import { TenderDocuments } from '@/components/bie/TenderDocuments';

const definitions = {
  vendor_registrations: {
    label: 'Vendor Registrations',
    statuses: ['not_started', 'in_progress', 'submitted', 'approved', 'rejected'],
    primary: 'Company',
    secondary: 'Portal',
  },
  tenders: {
    label: 'Tenders',
    statuses: ['identified', 'preparing', 'submitted', 'awarded', 'lost'],
    primary: 'Tender no.',
    secondary: 'Authority',
  },
  website_listings: {
    label: 'Website Listings',
    statuses: ['draft', 'active', 'needs_update', 'removed'],
    primary: 'Listing',
    secondary: 'Website',
  },
} as const;

const priorities: BIEPriority[] = ['low', 'normal', 'high', 'urgent'];
const priorityStyle: Record<BIEPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-secondary text-secondary-foreground',
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  urgent: 'bg-destructive/15 text-destructive',
};

const label = (value: string) => value.replace(/_/g, ' ');

const reviewLabels: Record<BIEReviewStatus, string> = {
  not_submitted: 'In progress',
  submitted: 'Awaiting review',
  approved: 'Approved',
  rework: 'Needs rework',
};

type FormState = Record<string, string>;

export default function BIEWork() {
  const { user, isBIEManager } = useAuth();
  const { data, isLoading } = useBIEWork();
  const { data: team = [] } = useBIETeam();
  const createWork = useCreateBIEWork();
  const updateWork = useUpdateBIEWork();
  const submitForReview = useSubmitForReview();
  const reviewWork = useReviewBIEWork();

  const [tab, setTab] = useState<BIEWorkType | 'product_assignments'>('vendor_registrations');
  const isProductsTab = tab === 'product_assignments';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previousStatus, setPreviousStatus] = useState<string | undefined>();
  const [form, setForm] = useState<FormState>({});

  const workTab: BIEWorkType = isProductsTab ? 'vendor_registrations' : tab;
  const definition = definitions[workTab];
  const { data: history = [] } = useBIEHistory(editingId ?? undefined);
  const nameOf = (id: string | null) => team.find((m) => m.id === id)?.full_name ?? (id === user?.id ? 'Me' : '—');

  const rows = useMemo(() => {
    const all = (data?.rows ?? []).filter((row) => row.type === tab);
    const term = search.trim().toLowerCase();
    return all
      .filter((row) => (isBIEManager ? true : row.assigned_to === user?.id))
      .filter((row) => (statusFilter === 'all' ? true : row.status === statusFilter))
      .filter((row) => (assigneeFilter === 'all' ? true : row.assigned_to === assigneeFilter))
      .filter((row) => (term ? JSON.stringify(row.raw).toLowerCase().includes(term) : true))
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'));
  }, [data, tab, search, statusFilter, assigneeFilter, isBIEManager, user?.id]);

  const isOverdue = (row: { due_date: string | null; completed_at: string | null }) =>
    !!row.due_date && !row.completed_at && isBefore(parseISO(row.due_date), startOfDay(new Date()));

  const startCreate = () => {
    setEditingId(null);
    setPreviousStatus(undefined);
    setForm({ status: definition.statuses[0], priority: 'normal', assigned_to: user?.id ?? '' });
    setOpen(true);
  };

  const startEdit = (raw: Record<string, unknown>) => {
    setEditingId(String(raw.id));
    setPreviousStatus(String(raw.status));
    setForm(Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value == null ? '' : String(value)])));
    setOpen(true);
  };

  const field = (key: string, text: string, type = 'text') => (
    <div className="space-y-2">
      <Label htmlFor={key}>{text}</Label>
      <Input
        id={key}
        type={type}
        value={form[key] ?? ''}
        onChange={(event) => setForm((old) => ({ ...old, [key]: event.target.value }))}
      />
    </div>
  );

  const duplicateListing = useMemo(() => {
    if (tab !== 'website_listings' || !form.listing_reference || !form.website_name) return null;
    return (data?.listings ?? []).find(
      (listing) =>
        listing.id !== editingId &&
        (listing.listing_reference ?? '').toLowerCase() === form.listing_reference.toLowerCase() &&
        (listing.website_name ?? '').toLowerCase() === form.website_name.toLowerCase(),
    );
  }, [tab, form.listing_reference, form.website_name, data, editingId]);

  const requiredFields: Record<BIEWorkType, { key: string; label: string }[]> = {
    vendor_registrations: [
      { key: 'company_name', label: 'Company name' },
      { key: 'portal_name', label: 'Portal / website' },
    ],
    tenders: [
      { key: 'tender_number', label: 'Tender number' },
      { key: 'issuing_authority', label: 'Issuing authority' },
      { key: 'description', label: 'Description' },
    ],
    website_listings: [
      { key: 'website_name', label: 'Website' },
      { key: 'listing_title', label: 'Listing title' },
    ],
  };

  const save = async () => {
    const missing = requiredFields[workTab].filter(({ key }) => !(form[key] ?? '').trim());
    if (missing.length) {
      toast.error(`Please fill in: ${missing.map((item) => item.label).join(', ')}`);
      return;
    }
    if (isBIEManager && !editingId && !form.assigned_to) {
      toast.error('Please choose who this work is for');
      return;
    }
    const common = {
      status: form.status,
      priority: form.priority || 'normal',
      due_date: form.due_date || null,
      notes: form.notes || null,
    };
    const values =
      tab === 'vendor_registrations'
        ? {
            ...common,
            company_name: form.company_name,
            portal_name: form.portal_name,
            registration_reference: form.registration_reference || null,
            validity_date: form.validity_date || null,
            credential_reference: form.credential_reference || null,
          }
        : tab === 'tenders'
        ? {
            ...common,
            tender_number: form.tender_number,
            issuing_authority: form.issuing_authority,
            description: form.description,
            estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
            submission_deadline: form.submission_deadline || null,
            awarded_value: form.awarded_value ? Number(form.awarded_value) : null,
            awarded_date: form.awarded_date || null,
            portal_name: form.portal_name || null,
            published_date: form.published_date || null,
            pre_bid_date: form.pre_bid_date || null,
            bid_opening_date: form.bid_opening_date || null,
            tender_fee: form.tender_fee ? Number(form.tender_fee) : null,
            emd_amount: form.emd_amount ? Number(form.emd_amount) : null,
            emd_status: form.emd_status || null,
            awarded_to: form.awarded_to || null,
            award_reference: form.award_reference || null,
          }
        : {
            ...common,
            website_name: form.website_name,
            listing_title: form.listing_title,
            listing_reference: form.listing_reference || null,
            listing_url: form.listing_url || null,
            listed_date: form.listed_date || null,
          };

    if (editingId) {
      await updateWork.mutateAsync({
        table: workTab,
        id: editingId,
        previousStatus,
        values: { ...values, ...(isBIEManager ? { assigned_to: form.assigned_to } : {}) },
      });
    } else {
      await createWork.mutateAsync({
        table: workTab,
        values,
        assignedTo: isBIEManager ? form.assigned_to || user?.id || '' : user?.id ?? '',
      });
    }
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">BIE Work Register</h1>
          <p className="text-muted-foreground">
            {isBIEManager ? 'Assign, track and update every team member’s work.' : 'Track your assigned work and progress.'}
          </p>
        </div>
        {isProductsTab ? (
          <Button asChild variant="outline">
            <Link to="/products">
              <Plus className="mr-2 h-4 w-4" />
              Assign from catalog
            </Link>
          </Button>
        ) : (
          <Button onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {isBIEManager ? 'Assign work' : 'Add work'}
          </Button>
        )}
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as BIEWorkType | 'product_assignments');
          setStatusFilter('all');
        }}
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vendor_registrations">Registrations</TabsTrigger>
          <TabsTrigger value="tenders">Tenders</TabsTrigger>
          <TabsTrigger value="website_listings">Listings</TabsTrigger>
          <TabsTrigger value="product_assignments">Products</TabsTrigger>
        </TabsList>
      </Tabs>

      {isProductsTab && <ProductAssignmentsTable />}
      {!isProductsTab && (
      <>


      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${definition.label.toLowerCase()}`}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {definition.statuses.map((status) => (
              <SelectItem key={status} value={status}>{label(status)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isBIEManager && (
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="sm:w-52"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {team.map((member) => (
                <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{definition.primary}</TableHead>
                <TableHead>{definition.secondary}</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                {isBIEManager ? <TableHead>Assigned to</TableHead> : <TableHead>Given by</TableHead>}
                <TableHead>Review</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => startEdit(row.raw)}
                >
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell className="text-muted-foreground">{row.subtitle}</TableCell>
                  <TableCell>
                    <Badge variant={row.completed_at ? 'default' : 'secondary'}>{label(row.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded px-2 py-1 text-xs font-medium ${priorityStyle[row.priority]}`}>
                      {row.priority}
                    </span>
                  </TableCell>
                  <TableCell className={isOverdue(row) ? 'font-medium text-destructive' : ''}>
                    {row.due_date ? format(parseISO(row.due_date), 'dd MMM yyyy') : '—'}
                    {isOverdue(row) && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}
                  </TableCell>
                  <TableCell>{isBIEManager ? nameOf(row.assigned_to) : nameOf(row.assigned_by)}</TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          row.review_status === 'approved'
                            ? 'default'
                            : row.review_status === 'rework'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {reviewLabels[row.review_status]}
                      </Badge>
                      {!isBIEManager && row.review_status !== 'submitted' && row.review_status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitForReview.isPending}
                          onClick={() => submitForReview.mutate({ table: row.type, id: row.id })}
                        >
                          Mark done
                        </Button>
                      )}
                      {isBIEManager && row.review_status === 'submitted' && (
                        <>
                          <Button
                            size="sm"
                            disabled={reviewWork.isPending}
                            onClick={() => reviewWork.mutate({ table: row.type, id: row.id, decision: 'approved' })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reviewWork.isPending}
                            onClick={() => reviewWork.mutate({ table: row.type, id: row.id, decision: 'rework' })}
                          >
                            Send back
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {tab === 'website_listings' && typeof row.raw.listing_url === 'string' && row.raw.listing_url && (
                      <a
                        href={String(row.raw.listing_url)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        aria-label="Open listing"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={isBIEManager ? 8 : 7} className="py-10 text-center text-muted-foreground">
                    {isLoading ? 'Loading…' : 'No records found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Update' : isBIEManager ? 'Assign' : 'Add'} {definition.label}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {tab === 'vendor_registrations' && (
              <>
                {field('company_name', 'Company name')}
                {field('portal_name', 'Portal / website')}
                {field('registration_reference', 'Registration reference')}
                {field('credential_reference', 'Credential reference')}
                {field('validity_date', 'Validity date', 'date')}
              </>
            )}
            {tab === 'tenders' && (
              <>
                {field('tender_number', 'Tender number')}
                {field('issuing_authority', 'Issuing authority')}
                {field('portal_name', 'Portal / website')}
                {field('description', 'Description')}
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('published_date', 'Published on', 'date')}
                  {field('pre_bid_date', 'Pre-bid meeting', 'date')}
                  {field('submission_deadline', 'Submission deadline', 'datetime-local')}
                  {field('bid_opening_date', 'Bid opening', 'date')}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('estimated_value', 'Estimated value', 'number')}
                  {field('tender_fee', 'Tender fee', 'number')}
                  {field('emd_amount', 'EMD amount', 'number')}
                  <div className="space-y-2">
                    <Label>EMD status</Label>
                    <Select
                      value={form.emd_status || 'not_paid'}
                      onValueChange={(value) => setForm((old) => ({ ...old, emd_status: value }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['not_paid', 'paid', 'refund_pending', 'refunded', 'forfeited'].map((value) => (
                          <SelectItem key={value} value={value}>{label(value)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('awarded_to', 'Awarded to')}
                  {field('award_reference', 'Award reference / LOA no.')}
                  {field('awarded_value', 'Awarded value', 'number')}
                  {field('awarded_date', 'Awarded date', 'date')}
                </div>
                {editingId && <TenderDocuments tenderId={editingId} />}
              </>
            )}
            {tab === 'website_listings' && (
              <>
                {field('website_name', 'Website')}
                {field('listing_title', 'Listing title')}
                {field('listing_reference', 'Listing reference')}
                {field('listing_url', 'Live listing URL', 'url')}
                {field('listed_date', 'Listed date', 'date')}
                {duplicateListing && (
                  <p className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Already listed on this website with the same reference — check before saving.
                  </p>
                )}
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((old) => ({ ...old, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {definition.statuses.map((status) => (
                      <SelectItem key={status} value={status}>{label(status)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                {isBIEManager || !editingId ? (
                  <Select value={form.priority ?? 'normal'} onValueChange={(value) => setForm((old) => ({ ...old, priority: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm capitalize">{form.priority || 'normal'}</p>
                )}
              </div>
            </div>

            {isBIEManager || !editingId ? (
              field('due_date', 'Due date', 'date')
            ) : (
              <div className="space-y-2">
                <Label>Due date</Label>
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {form.due_date ? format(parseISO(form.due_date), 'dd MMM yyyy') : 'No deadline set'}
                </p>
              </div>
            )}

            {!isBIEManager && form.rework_note && (
              <p className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Sent back by your manager: {form.rework_note}
              </p>
            )}

            {isBIEManager && (
              <div className="space-y-2">
                <Label>Assign to</Label>
                <Select value={form.assigned_to} onValueChange={(value) => setForm((old) => ({ ...old, assigned_to: value }))}>
                  <SelectTrigger><SelectValue placeholder="Choose BIE employee" /></SelectTrigger>
                  <SelectContent>
                    {team.map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes ?? ''}
                onChange={(event) => setForm((old) => ({ ...old, notes: event.target.value }))}
              />
            </div>

            {editingId && history.length > 0 && (
              <div className="space-y-2 rounded-md border p-3">
                <p className="flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4" />Progress history</p>
                {history.map((entry) => (
                  <p key={entry.id} className="text-sm text-muted-foreground">
                    {entry.from_status ? `${label(entry.from_status)} → ` : ''}
                    {label(entry.to_status ?? '')} · {format(new Date(entry.created_at), 'dd MMM yyyy, HH:mm')}
                  </p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={createWork.isPending || updateWork.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
