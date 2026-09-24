import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useProfiles } from '@/hooks/useProfiles';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { History, Search, User, FileText, Package, Users, ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { AccessDenied } from '@/components/ui/access-denied';
import { useAuth } from '@/hooks/useAuth';

const getActionBadge = (action: string) => {
  switch (action) {
    case 'create': return <Badge className="bg-green-500">Create</Badge>;
    case 'update': return <Badge className="bg-blue-500">Update</Badge>;
    case 'delete': return <Badge variant="destructive">Delete</Badge>;
    case 'export': return <Badge variant="secondary">Export</Badge>;
    default: return <Badge variant="outline">{action}</Badge>;
  }
};

const getEntityIcon = (entityType: string) => {
  switch (entityType) {
    case 'lead': return <FileText className="h-4 w-4" />;
    case 'customer': return <Users className="h-4 w-4" />;
    case 'order': return <ShoppingCart className="h-4 w-4" />;
    case 'product': return <Package className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

export default function ActivityLog() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'all_time' | 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'last_year' | 'custom'>('last_30_days');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  
  const dateRange = datePreset === 'custom' 
    ? { from: customFrom, to: customTo }
    : datePreset === 'all_time'
    ? {}
    : (() => {
        const today = new Date();
        switch (datePreset) {
          case 'this_month': return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
          case 'last_month': return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 0) };
          case 'last_30_days': return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: today };
          case 'last_90_days': return { from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), to: today };
          case 'this_year': return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear(), 11, 31) };
          case 'last_year': return { from: new Date(today.getFullYear() - 1, 0, 1), to: new Date(today.getFullYear() - 1, 11, 31) };
          default: return {};
        }
      })();

  const { data: profiles = [] } = useProfiles();
  const { data: logs = [], isLoading } = useActivityLog({
    action: actionFilter !== 'all' ? actionFilter : undefined,
    entityType: entityFilter !== 'all' ? entityFilter : undefined,
    userId: userFilter !== 'all' ? userFilter : undefined,
    startDate: dateRange.from,
    endDate: dateRange.to,
    limit: 200,
  });

  if (!isAdmin) {
    return <AccessDenied message="Only administrators can view the activity log." />;
  }

  const filteredLogs = logs.filter(log => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.entity_name?.toLowerCase().includes(searchLower) ||
      log.user?.full_name?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      <Helmet><title>Activity Log | Graven</title></Helmet>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-8 w-8" />
            Activity Log
          </h1>
          <p className="text-muted-foreground">Audit trail of all system actions</p>
        </div>
        <DateRangeFilter
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="export">Export</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="lead">Leads</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="task">Tasks</SelectItem>
                <SelectItem value="quotation">Quotations</SelectItem>
                <SelectItem value="cro_assignment">CRO Assignments</SelectItem>
                <SelectItem value="product">Products</SelectItem>
                <SelectItem value="supplier">Suppliers</SelectItem>
                <SelectItem value="purchase_order">Purchase Orders</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="User" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No activity logs found</TableCell></TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">{format(new Date(log.created_at), 'PPp')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={log.user?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{log.user?.full_name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{log.user?.full_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEntityIcon(log.entity_type)}
                        <span className="capitalize">{log.entity_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {log.entity_name || log.entity_id?.slice(0, 8) || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
