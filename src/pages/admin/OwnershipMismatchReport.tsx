import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { UserCheck, RefreshCw, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOwnershipMismatches, useBulkReassignLeads, type OwnershipMismatchRow } from "@/hooks/useOwnershipMismatch";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function OwnershipMismatchReport() {
  const { isAdmin, isSalesManager, loading } = useAuth();
  const [days, setDays] = useState(90);
  const [minWorkerActions, setMinWorkerActions] = useState(3);
  const [requireOwnerZero, setRequireOwnerZero] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useOwnershipMismatches({ days, minWorkerActions, requireOwnerZero });
  const bulkReassign = useBulkReassignLeads();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter(
      (r) =>
        r.lead_title?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.owner_name?.toLowerCase().includes(q) ||
        r.worker_name?.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading) return null;
  if (!isAdmin && !isSalesManager) return <Navigate to="/dashboard" replace />;

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.lead_id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleBulkReassign = async () => {
    const items = filtered
      .filter((r) => selected.has(r.lead_id))
      .map((r) => ({ leadId: r.lead_id, newOwnerId: r.worker_id }));
    if (!items.length) return;
    if (!confirm(`Reassign ${items.length} lead(s) to their actual worker?`)) return;
    const res = await bulkReassign.mutateAsync(items);
    toast.success(`Reassigned ${res.succeeded}${res.failed ? ` (${res.failed} failed)` : ""}`);
    setSelected(new Set());
  };

  const handleReassignOne = async (row: OwnershipMismatchRow) => {
    const res = await bulkReassign.mutateAsync([{ leadId: row.lead_id, newOwnerId: row.worker_id }]);
    if (res.succeeded) toast.success(`Reassigned to ${row.worker_name}`);
    else toast.error("Reassignment failed");
  };

  const totalLeads = data?.length ?? 0;
  const uniqueCustomers = new Set((data ?? []).map((r) => r.customer_id).filter(Boolean)).size;
  const uniqueOwners = new Set((data ?? []).map((r) => r.owner_id)).size;

  return (
    <div className="space-y-6">
      <Helmet><title>Ownership Mismatch | Graven OneDesk</title></Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCheck className="h-7 w-7" />
            Ownership Mismatch
          </h1>
          <p className="text-muted-foreground">
            Leads where someone other than the assigned owner is doing all the work.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mismatched leads</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalLeads}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Unique customers</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{uniqueCustomers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Owners affected</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{uniqueOwners}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label>Lookback (days)</Label>
              <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value) || 90)} />
            </div>
            <div>
              <Label>Min worker actions</Label>
              <Input type="number" min={1} value={minWorkerActions} onChange={(e) => setMinWorkerActions(Number(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Owner has zero activity</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={requireOwnerZero} onCheckedChange={setRequireOwnerZero} />
                <span className="text-sm text-muted-foreground">Strictest mode</span>
              </div>
            </div>
            <div>
              <Label>Search</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Lead, customer, owner..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Results <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button
              size="sm"
              onClick={handleBulkReassign}
              disabled={!selected.size || bulkReassign.isPending}
            >
              {bulkReassign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reassign selected to actual worker
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No mismatches found with current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Lead / Customer</TableHead>
                    <TableHead>Current owner</TableHead>
                    <TableHead>Actual worker</TableHead>
                    <TableHead className="text-right">Owner acts</TableHead>
                    <TableHead className="text-right">Worker acts</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map((r) => (
                    <TableRow key={r.lead_id}>
                      <TableCell>
                        <Checkbox checked={selected.has(r.lead_id)} onCheckedChange={() => toggleOne(r.lead_id)} />
                      </TableCell>
                      <TableCell>
                        <Link to={`/leads/${r.lead_id}`} className="font-medium hover:underline">
                          {r.lead_title || "(untitled)"}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.customer_name || "—"} · {r.lead_status}</div>
                      </TableCell>
                      <TableCell>{r.owner_name || "—"}</TableCell>
                      <TableCell><span className="font-medium">{r.worker_name || "—"}</span></TableCell>
                      <TableCell className="text-right">{r.owner_activity_count}</TableCell>
                      <TableCell className="text-right font-medium">{r.worker_activity_count}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.last_activity_at ? formatDistanceToNow(new Date(r.last_activity_at), { addSuffix: true }) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleReassignOne(r)} disabled={bulkReassign.isPending}>
                          <ArrowRight className="h-3 w-3 mr-1" /> Reassign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <div className="py-3 text-center text-xs text-muted-foreground">
                  Showing first 500 of {filtered.length}. Narrow filters to see more.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
