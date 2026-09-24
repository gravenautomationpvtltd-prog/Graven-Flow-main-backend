import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function FinancialSnapshot() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();

  // Fetch MTD revenue from invoices
  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['financial-invoices-mtd'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('grand_total, amount_paid, created_at, due_date, status')
        .gte('created_at', startOfMonth);
      if (error) throw error;
      return data;
    }
  });

  // Fetch YTD revenue
  const { data: ytdInvoices, isLoading: loadingYTD } = useQuery({
    queryKey: ['financial-invoices-ytd'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('grand_total, amount_paid')
        .gte('created_at', startOfYear);
      if (error) throw error;
      return data;
    }
  });

  // Fetch payments received MTD
  const { data: paymentsData, isLoading: loadingPayments } = useQuery({
    queryKey: ['financial-payments-mtd'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('amount, payment_date')
        .gte('payment_date', startOfMonth);
      if (error) throw error;
      return data;
    }
  });

  // Fetch pending payables (approved POs)
  const { data: payablesData, isLoading: loadingPayables } = useQuery({
    queryKey: ['financial-payables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, status, subtotal, total_tax')
        .in('status', ['approved', 'completed']);
      if (error) throw error;
      return data;
    }
  });

  // Fetch receivables for aging
  const { data: receivablesData, isLoading: loadingReceivables } = useQuery({
    queryKey: ['financial-receivables-aging'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('grand_total, amount_paid, due_date, created_at')
        .neq('status', 'paid');
      if (error) throw error;
      return data;
    }
  });

  const isLoading = loadingInvoices || loadingYTD || loadingPayments || loadingPayables || loadingReceivables;

  // Calculate metrics
  const mtdRevenue = invoicesData?.reduce((sum, inv) => sum + (inv.grand_total || 0), 0) || 0;
  const mtdCollected = paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const ytdRevenue = ytdInvoices?.reduce((sum, inv) => sum + (inv.grand_total || 0), 0) || 0;
  const totalPayables = payablesData?.reduce((sum, po) => sum + ((po.subtotal || 0) + (po.total_tax || 0)), 0) || 0;
  const totalReceivables = receivablesData?.reduce((sum, inv) => sum + ((inv.grand_total || 0) - (inv.amount_paid || 0)), 0) || 0;

  // Calculate receivables aging
  const calculateAging = () => {
    const now = new Date();
    const aging = { '0-15': 0, '16-30': 0, '31-60': 0, '60+': 0 };
    
    receivablesData?.forEach((inv) => {
      const outstanding = (inv.grand_total || 0) - (inv.amount_paid || 0);
      if (outstanding <= 0) return;
      
      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.created_at);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue <= 15) aging['0-15'] += outstanding;
      else if (daysOverdue <= 30) aging['16-30'] += outstanding;
      else if (daysOverdue <= 60) aging['31-60'] += outstanding;
      else aging['60+'] += outstanding;
    });

    return [
      { name: '0-15 days', value: aging['0-15'], color: 'hsl(var(--chart-1))' },
      { name: '16-30 days', value: aging['16-30'], color: 'hsl(var(--chart-2))' },
      { name: '31-60 days', value: aging['31-60'], color: 'hsl(var(--chart-3))' },
      { name: '60+ days', value: aging['60+'], color: 'hsl(var(--destructive))' },
    ];
  };

  const agingData = calculateAging();

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    return `₹${value.toLocaleString()}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-6 w-20 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">MTD Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(mtdRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">MTD Collected</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(mtdCollected)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm">Total Receivables</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalReceivables)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm">Total Payables</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPayables)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Receivables Aging Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receivables Aging</CardTitle>
            <CardDescription>Outstanding amounts by age bucket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData} layout="vertical">
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* YTD Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">YTD Summary</CardTitle>
            <CardDescription>Year-to-date financial overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-lg bg-green-500/10">
                <div>
                  <p className="text-sm text-muted-foreground">YTD Revenue</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(ytdRevenue)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>

              <div className="flex justify-between items-center p-4 rounded-lg bg-amber-500/10">
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Receivables</p>
                  <p className="text-xl font-bold text-amber-600">{formatCurrency(totalReceivables)}</p>
                </div>
                <CreditCard className="h-8 w-8 text-amber-500" />
              </div>

              <div className="flex justify-between items-center p-4 rounded-lg bg-red-500/10">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payables</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(totalPayables)}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500" />
              </div>

              <div className="flex justify-between items-center p-4 rounded-lg bg-primary/10">
                <div>
                  <p className="text-sm text-muted-foreground">Net Position</p>
                  <p className="text-xl font-bold">{formatCurrency(totalReceivables - totalPayables)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
