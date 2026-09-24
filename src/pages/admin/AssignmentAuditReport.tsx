import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getUserTenantId } from "@/utils/tenantUtils";
import {
  useUnloggedLeads,
  useAuditSettings,
  useSaveAuditSettings,
  useAuditRuns,
} from "@/hooks/useAssignmentAudit";
import { formatDistanceToNow } from "date-fns";

export default function AssignmentAuditReport() {
  const { isAdmin, loading } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(5);
  const [emails, setEmails] = useState("");
  const [throttle, setThrottle] = useState(6);

  useEffect(() => {
    getUserTenantId().then((id) => setTenantId(id ?? null));
  }, []);

  const { data: leads, isLoading: leadsLoading, refetch } = useUnloggedLeads();
  const { data: settings } = useAuditSettings(tenantId);
  const { data: runs } = useAuditRuns(tenantId);
  const save = useSaveAuditSettings();

  useEffect(() => {
    if (settings) {
      setThreshold(settings.alert_threshold);
      setEmails((settings.alert_emails ?? []).join(", "));
      setThrottle(settings.alert_throttle_hours);
    }
  }, [settings]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const count = leads?.length ?? 0;
  const over = count > threshold;

  return (
    <div className="space-y-6">
      <Helmet><title>Assignment Audit | Graven</title></Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" />
            Assignment Audit
          </h1>
          <p className="text-muted-foreground">Leads in the last 24 hours missing an assignment-log entry.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={leadsLoading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className={over ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {over && <AlertTriangle className="h-4 w-4 text-destructive" />}
              Unlogged leads (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{count}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Threshold: {threshold} {over && <Badge variant="destructive" className="ml-2">Over threshold</Badge>}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alert settings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Threshold</Label>
                <Input type="number" min={0} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
              </div>
              <div>
                <Label>Throttle (hours)</Label>
                <Input type="number" min={1} value={throttle} onChange={(e) => setThrottle(Number(e.target.value))} />
              </div>
              <div className="col-span-3">
                <Label>Alert emails (comma-separated)</Label>
                <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ops@company.com, cto@company.com" />
              </div>
            </div>
            <Button
              disabled={!tenantId || save.isPending}
              onClick={() =>
                tenantId && save.mutate({
                  tenant_id: tenantId,
                  alert_threshold: threshold,
                  alert_throttle_hours: throttle,
                  alert_emails: emails.split(",").map((e) => e.trim()).filter(Boolean),
                })
              }
            >
              Save settings
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Unlogged leads</CardTitle></CardHeader>
        <CardContent>
          {leadsLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : count === 0 ? (
            <p className="text-muted-foreground text-sm">All caught up — every lead in the last 24h has an audit row.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads!.map((l) => (
                  <TableRow key={l.lead_id}>
                    <TableCell>
                      <Link to={`/leads/${l.lead_id}`} className="text-primary hover:underline">
                        {l.title ?? l.lead_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell>{l.company_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{l.source ?? "—"}</Badge></TableCell>
                    <TableCell>{l.assignee_name ?? "Unassigned"}</TableCell>
                    <TableCell>{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent audit runs</CardTitle></CardHeader>
        <CardContent>
          {!runs || runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scheduled runs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ran at</TableHead>
                  <TableHead>Unlogged</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Alert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.ran_at).toLocaleString()}</TableCell>
                    <TableCell>{r.unlogged_count}</TableCell>
                    <TableCell>{r.threshold}</TableCell>
                    <TableCell>
                      {r.alert_sent ? (
                        <Badge variant="destructive">Sent</Badge>
                      ) : r.alert_error ? (
                        <Badge variant="outline" title={r.alert_error}>Error</Badge>
                      ) : (
                        <Badge variant="secondary">No alert</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
