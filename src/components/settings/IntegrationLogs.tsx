import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useIntegrationLogs, IntegrationType } from "@/hooks/useIntegrations";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

const statusIcons = {
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
};

const statusVariants = {
  success: 'default' as const,
  error: 'destructive' as const,
  pending: 'secondary' as const,
};

export function IntegrationLogs() {
  const [filter, setFilter] = useState<IntegrationType | 'all'>('all');
  const { data: logs, isLoading } = useIntegrationLogs(
    filter === 'all' ? undefined : filter
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sync Logs</CardTitle>
            <CardDescription>Recent integration sync activity</CardDescription>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as IntegrationType | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Integrations</SelectItem>
              <SelectItem value="indiamart">IndiaMART</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="justdial">JustDial</SelectItem>
              <SelectItem value="tradeindia">TradeIndia</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Integration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads Synced</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.integration_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcons[log.status]}
                        <Badge variant={statusVariants[log.status]} className="capitalize">
                          {log.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.leads_synced > 0 ? (
                        <span className="font-medium text-green-600">
                          +{log.leads_synced}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.error_message ? (
                        <span className="text-destructive text-sm">
                          {log.error_message}
                        </span>
                      ) : log.metadata?.total_leads_fetched ? (
                        <span className="text-muted-foreground text-sm">
                          Fetched {log.metadata.total_leads_fetched} leads
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No sync logs yet. Enable an integration to start syncing leads.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
