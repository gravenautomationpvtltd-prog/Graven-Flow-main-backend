import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users2, Phone, TrendingUp, ShoppingCart, IndianRupee, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useCRODetail } from '@/hooks/useCRODetail';
import { formatDistanceToNow, format } from 'date-fns';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  contacted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  enquiry_received: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  no_response: 'bg-destructive/10 text-destructive',
};

const leadStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  lost: 'bg-destructive/10 text-destructive',
  'follow-up': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  quoted: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function CROPerformanceDetail() {
  const { croId } = useParams<{ croId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useCRODetail(croId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">CRO not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/cro-performance')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const { profile, assignments, leads, orders, kpis } = data;
  const funnelSteps = [
    { label: 'Assigned', value: kpis.total_assigned, color: 'bg-muted' },
    { label: 'Contacted', value: kpis.contacted + kpis.enquiries, color: 'bg-blue-500' },
    { label: 'Enquiries', value: kpis.enquiries, color: 'bg-green-500' },
    { label: 'Won Orders', value: kpis.orders_converted, color: 'bg-primary' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/cro-performance')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{profile.full_name}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Assigned', value: kpis.total_assigned, icon: Users2, iconClass: 'text-primary' },
          { label: 'Contact Rate', value: `${kpis.contact_rate}%`, icon: Phone, iconClass: 'text-blue-600' },
          { label: 'Enquiries', value: kpis.enquiries, icon: TrendingUp, iconClass: 'text-green-600' },
          { label: 'No Response', value: kpis.no_response, icon: AlertCircle, iconClass: 'text-destructive' },
          { label: 'Orders Won', value: kpis.orders_converted, icon: ShoppingCart, iconClass: 'text-purple-600' },
          { label: 'Revenue', value: formatCurrencyWithSymbol(kpis.revenue, 'INR'), icon: IndianRupee, iconClass: 'text-emerald-600' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`h-4 w-4 ${kpi.iconClass}`} />
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Conversion Funnel</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 h-32">
            {funnelSteps.map((step, i) => {
              const maxVal = Math.max(...funnelSteps.map(s => s.value), 1);
              const height = Math.max((step.value / maxVal) * 100, 8);
              const prevVal = i > 0 ? funnelSteps[i - 1].value : 0;
              const convRate = i > 0 && prevVal > 0 ? Math.round((step.value / prevVal) * 100) : null;
              return (
                <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-sm font-bold text-foreground">{step.value}</span>
                  <div className={`w-full rounded-t-md ${step.color}`} style={{ height: `${height}%` }} />
                  <span className="text-xs text-muted-foreground">{step.label}</span>
                  {convRate !== null && (
                    <span className="text-[10px] text-muted-foreground">{convRate}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Customer Assignments ({assignments.length})</TabsTrigger>
          <TabsTrigger value="enquiries">Enquiries ({leads.length})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead className="hidden md:table-cell">City/State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Contacted</TableHead>
                    <TableHead className="hidden lg:table-cell">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No assignments</TableCell></TableRow>
                  ) : assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-medium text-foreground">{a.customer.company_name}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{a.customer.contact_person}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm">{a.customer.contact_person || '—'}</p>
                        <p className="text-xs text-muted-foreground">{a.customer.phone}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {[a.customer.city, a.customer.state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${statusColors[a.status] || ''}`} variant="outline">
                          {a.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {a.last_contacted_at ? (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(a.last_contacted_at), { addSuffix: true })}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {a.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enquiries">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Title</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Salesperson</TableHead>
                    <TableHead className="hidden md:table-cell">Value</TableHead>
                    <TableHead className="hidden lg:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No enquiries generated</TableCell></TableRow>
                  ) : leads.map((l) => (
                    <TableRow key={l.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.open(`/leads/${l.id}`, '_blank')}>
                      <TableCell className="font-medium text-foreground">{l.title}</TableCell>
                      <TableCell className="text-sm">{l.customer_name}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${leadStatusColors[l.status] || ''}`} variant="outline">
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{l.assigned_to_name || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{l.estimated_value ? formatCurrencyWithSymbol(l.estimated_value, 'INR') : '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{format(new Date(l.created_at), 'dd MMM yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No converted orders</TableCell></TableRow>
                  ) : orders.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.open(`/orders/${o.id}`, '_blank')}>
                      <TableCell className="font-medium text-foreground">{o.order_number}</TableCell>
                      <TableCell className="text-sm">{o.customer_name || '—'}</TableCell>
                      <TableCell className="text-sm font-medium">{o.order_value ? formatCurrencyWithSymbol(o.order_value, 'INR') : '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{o.status}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{format(new Date(o.created_at), 'dd MMM yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
