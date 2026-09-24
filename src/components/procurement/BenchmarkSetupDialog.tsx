import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Trash2 } from 'lucide-react';
import {
  BENCHMARK_METRICS,
  useBenchmarks,
  useDeleteBenchmark,
  useOfficesList,
  useUpsertBenchmark,
  type BenchmarkDirection,
} from '@/hooks/useBenchmarks';
import { toast } from 'sonner';

const DEPARTMENTS = [
  { value: 'procurement', label: 'Procurement' },
  { value: 'sales', label: 'Sales' },
];

const ALL = '__all__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDepartment?: string;
}

export function BenchmarkSetupDialog({ open, onOpenChange, defaultDepartment = 'procurement' }: Props) {
  const [department, setDepartment] = useState(defaultDepartment);
  const [officeId, setOfficeId] = useState<string>(ALL);

  const { data: offices = [] } = useOfficesList();
  const { data: benchmarks = [], isLoading } = useBenchmarks(department);
  const upsert = useUpsertBenchmark();
  const del = useDeleteBenchmark();

  const scopeOffice = officeId === ALL ? null : officeId;

  const current = useMemo(() => {
    const map: Record<string, { value: string; tolerance: string; id?: string; direction: BenchmarkDirection }> = {};
    Object.entries(BENCHMARK_METRICS).forEach(([key, cfg]) => {
      const row = benchmarks.find((b) => b.metric === key && (b.office_id ?? null) === scopeOffice);
      map[key] = {
        value: row ? String(row.target_value) : '',
        tolerance: row ? String(row.warn_tolerance) : '10',
        id: row?.id,
        direction: (row?.direction ?? cfg.direction) as BenchmarkDirection,
      };
    });
    return map;
  }, [benchmarks, scopeOffice]);

  const [edits, setEdits] = useState<Record<string, { value?: string; tolerance?: string }>>({});
  const valOf = (k: string) => edits[k]?.value ?? current[k]?.value ?? '';
  const tolOf = (k: string) => edits[k]?.tolerance ?? current[k]?.tolerance ?? '10';

  const handleSave = async () => {
    const rows = Object.keys(BENCHMARK_METRICS)
      .map((metric) => ({ metric, value: valOf(metric), tolerance: tolOf(metric) }))
      .filter((r) => r.value !== '' && !Number.isNaN(Number(r.value)));

    if (rows.length === 0) {
      toast.error('Enter at least one target value');
      return;
    }

    await Promise.all(
      rows.map((r) =>
        upsert.mutateAsync({
          department,
          office_id: scopeOffice,
          metric: r.metric,
          target_value: Number(r.value),
          direction: BENCHMARK_METRICS[r.metric].direction,
          warn_tolerance: Number(r.tolerance) || 0,
        }),
      ),
    );
    setEdits({});
    toast.success('Benchmarks saved');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Benchmark setup</DialogTitle>
          <DialogDescription>
            Define targets per department and region. A region target overrides the company-wide one; the
            dashboard shows variance against whichever applies.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={department} onValueChange={(v) => { setDepartment(v); setEdits({}); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Region / branch</Label>
            <Select value={officeId} onValueChange={(v) => { setOfficeId(v); setEdits({}); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Company-wide (all regions)</SelectItem>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_110px_110px_36px] gap-2 text-[11px] text-muted-foreground px-1">
              <span>Metric</span>
              <span>Target</span>
              <span>Tolerance %</span>
              <span />
            </div>
            {Object.entries(BENCHMARK_METRICS).map(([key, cfg]) => (
              <div key={key} className="grid grid-cols-[1fr_110px_110px_36px] gap-2 items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{cfg.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {cfg.direction === 'higher_better' ? 'higher is better' : 'lower is better'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{cfg.hint}</p>
                </div>
                <Input
                  type="number"
                  className="h-9"
                  placeholder={cfg.unit === 'percent' ? '%' : cfg.unit === 'hours' ? 'hrs' : 'count'}
                  value={valOf(key)}
                  onChange={(e) => setEdits({ ...edits, [key]: { ...edits[key], value: e.target.value } })}
                />
                <Input
                  type="number"
                  className="h-9"
                  value={tolOf(key)}
                  onChange={(e) => setEdits({ ...edits, [key]: { ...edits[key], tolerance: e.target.value } })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  disabled={!current[key]?.id}
                  onClick={() => current[key]?.id && del.mutate(current[key].id!)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save benchmarks
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
