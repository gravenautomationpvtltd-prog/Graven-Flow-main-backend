import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';
import {
  useLeadRoutingRules,
  useSaveLeadRoutingRule,
  useDeleteLeadRoutingRule,
  useToggleLeadRoutingRule,
  useRoutingCounters,
  type LeadRoutingRule,
  type RoutingSplit,
} from '@/hooks/useLeadRoutingRules';

function RuleEditor({
  rule,
  open,
  onOpenChange,
}: {
  rule: LeadRoutingRule | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: offices = [] } = useOfficesManagement();
  const save = useSaveLeadRoutingRule();

  const [name, setName] = useState('');
  const [appliesTo, setAppliesTo] = useState<'new_customers' | 'all'>('new_customers');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [splits, setSplits] = useState<RoutingSplit[]>([]);

  useEffect(() => {
    if (open) {
      setName(rule?.rule_name ?? '');
      setAppliesTo(rule?.applies_to ?? 'new_customers');
      setNotes(rule?.notes ?? '');
      setIsActive(rule?.is_active ?? true);
      setSplits(
        rule?.splits && rule.splits.length
          ? rule.splits
          : offices.slice(0, 2).map((o, i) => ({ office_id: o.id, percentage: i === 0 ? 50 : 50 })),
      );
    }
  }, [open, rule, offices]);

  const sum = splits.reduce((s, r) => s + Number(r.percentage || 0), 0);

  const addRow = () => {
    const remaining = offices.filter((o) => !splits.find((s) => s.office_id === o.id));
    if (!remaining.length) return;
    setSplits([...splits, { office_id: remaining[0].id, percentage: 0 }]);
  };

  const updateRow = (idx: number, patch: Partial<RoutingSplit>) => {
    setSplits(splits.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeRow = (idx: number) => setSplits(splits.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await save.mutateAsync({
        id: rule?.id,
        rule_name: name.trim(),
        applies_to: appliesTo,
        is_active: isActive,
        splits,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } catch { /* toast handled */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit routing rule' : 'New routing rule'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rule name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. New leads 25% Delhi / 75% Lucknow" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Applies to</Label>
              <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_customers">New customers only</SelectItem>
                  <SelectItem value="all">All incoming leads</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label>Active</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Distribution across branches</Label>
              <Badge variant={Math.round(sum) === 100 ? 'default' : 'destructive'}>
                Total: {sum}%
              </Badge>
            </div>
            <div className="space-y-2">
              {splits.map((s, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Select
                    value={s.office_id}
                    onValueChange={(v) => updateRow(idx, { office_id: v })}
                  >
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {offices.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-24"
                    value={s.percentage}
                    onChange={(e) => updateRow(idx, { percentage: Number(e.target.value) })}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <Button size="icon" variant="ghost" onClick={() => removeRow(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRow} disabled={splits.length >= offices.length}>
                <Plus className="h-4 w-4 mr-1" /> Add branch
              </Button>
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={save.isPending || Math.round(sum) !== 100 || !name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleDistributionRow({ rule }: { rule: LeadRoutingRule }) {
  const { data: offices = [] } = useOfficesManagement();
  const { data: counters = [] } = useRoutingCounters(rule.id);
  const officeName = (id: string) => offices.find((o) => o.id === id)?.name ?? '—';
  const total = counters.reduce((s, c) => s + c.assigned_count, 0);
  return (
    <div className="text-xs text-muted-foreground space-x-2">
      {rule.splits.map((s) => {
        const actual = counters.find((c) => c.office_id === s.office_id)?.assigned_count ?? 0;
        const pct = total ? Math.round((actual * 100) / total) : 0;
        return (
          <span key={s.office_id} className="inline-block">
            {officeName(s.office_id)}: <b>{s.percentage}%</b> target · {pct}% actual ({actual})
          </span>
        );
      })}
    </div>
  );
}

export default function LeadRoutingRules() {
  const navigate = useNavigate();
  const { data: rules = [], isLoading } = useLeadRoutingRules();
  const del = useDeleteLeadRoutingRule();
  const toggle = useToggleLeadRoutingRule();
  const [editing, setEditing] = useState<LeadRoutingRule | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (r: LeadRoutingRule) => { setEditing(r); setOpen(true); };

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Lead Routing Rules</h1>
          <p className="text-sm text-muted-foreground">
            Control what percentage of incoming leads goes to each branch. Rules apply to <b>new customers</b> by default —
            existing customers keep going to their loyal owner.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New rule</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active rules</CardTitle>
          <CardDescription>Only the most recently updated active rule is applied to new leads.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rules yet. Create one to split new-customer leads across branches (e.g. 25% Delhi / 75% Lucknow).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Applies to</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Distribution</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.rule_name}</div>
                      {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {r.applies_to === 'new_customers' ? 'New customers only' : 'All leads'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(v) => toggle.mutate({ id: r.id, is_active: v })}
                      />
                    </TableCell>
                    <TableCell><RuleDistributionRow rule={r} /></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RuleEditor rule={editing} open={open} onOpenChange={setOpen} />
    </div>
  );
}
