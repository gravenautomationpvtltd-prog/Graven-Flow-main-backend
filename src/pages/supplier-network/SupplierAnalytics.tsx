import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { FileText, Users, Clock, DollarSign, TrendingUp, Globe, Star, Percent } from 'lucide-react';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function SupplierAnalytics() {
  const { data: rfqStats } = useQuery({
    queryKey: ['rfq-analytics'],
    queryFn: async () => {
      const { data: rfqs } = await supabase
        .from('rfqs')
        .select('id, status, created_at, deadline_date');
      
      const { data: distributions } = await supabase
        .from('rfq_distributions')
        .select('rfq_id, response_status, sent_at');

      const { data: quotations } = await supabase
        .from('supplier_quotations')
        .select('rfq_id, status, total_converted, quoted_currency, submitted_at');

      const totalRfqs = rfqs?.length || 0;
      const issuedRfqs = rfqs?.filter(r => r.status !== 'draft').length || 0;
      const totalDistributions = distributions?.length || 0;
      const totalResponses = distributions?.filter(d => d.response_status === 'quoted').length || 0;
      const responseRate = totalDistributions > 0 ? (totalResponses / totalDistributions) * 100 : 0;

      // Response time analysis (mock - would need more data)
      const avgResponseTime = 3.5; // days

      return {
        totalRfqs,
        issuedRfqs,
        totalDistributions,
        totalResponses,
        responseRate,
        avgResponseTime,
        totalQuotations: quotations?.length || 0,
      };
    },
  });

  const { data: supplierStats } = useQuery({
    queryKey: ['supplier-analytics'],
    queryFn: async () => {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, country, internal_rating, preferred_flag, application_status');

      const approved = suppliers?.filter(s => s.application_status === 'approved') || [];
      const preferred = approved.filter(s => s.preferred_flag);
      
      // Country distribution
      const countryDistribution = approved.reduce((acc: Record<string, number>, s) => {
        const country = s.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});

      const countryData = Object.entries(countryDistribution)
        .map(([country, count]) => ({ name: country, value: count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      // Rating distribution
      const ratingDistribution = [1, 2, 3, 4, 5].map(rating => ({
        rating: `${rating} Star`,
        count: approved.filter(s => Math.floor(s.internal_rating || 0) === rating).length,
      }));

      return {
        totalApproved: approved.length,
        totalPreferred: preferred.length,
        countryData,
        ratingDistribution,
      };
    },
  });

  const { data: currencyExposure } = useQuery({
    queryKey: ['currency-exposure'],
    queryFn: async () => {
      const { data: quotations } = await supabase
        .from('supplier_quotations')
        .select('quoted_currency, total_original');

      const exposure = quotations?.reduce((acc: Record<string, number>, q) => {
        acc[q.quoted_currency] = (acc[q.quoted_currency] || 0) + Number(q.total_original);
        return acc;
      }, {}) || {};

      return Object.entries(exposure)
        .map(([currency, value]) => ({ name: currency, value: Number(value) }))
        .sort((a, b) => b.value - a.value);
    },
  });

  const { data: monthlyTrends } = useQuery({
    queryKey: ['monthly-trends'],
    queryFn: async () => {
      const { data: rfqs } = await supabase
        .from('rfqs')
        .select('created_at, status')
        .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

      const { data: quotations } = await supabase
        .from('supplier_quotations')
        .select('submitted_at')
        .gte('submitted_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

      // Group by month
      const months: Record<string, { rfqs: number; quotations: number }> = {};
      
      rfqs?.forEach(r => {
        const month = r.created_at.substring(0, 7);
        if (!months[month]) months[month] = { rfqs: 0, quotations: 0 };
        months[month].rfqs++;
      });

      quotations?.forEach(q => {
        const month = q.submitted_at.substring(0, 7);
        if (!months[month]) months[month] = { rfqs: 0, quotations: 0 };
        months[month].quotations++;
      });

      return Object.entries(months)
        .map(([month, data]) => ({
          month,
          rfqs: data.rfqs,
          quotations: data.quotations,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
    },
  });

  const { data: categoryPerformance } = useQuery({
    queryKey: ['category-performance'],
    queryFn: async () => {
      const { data: categories } = await supabase
        .from('supplier_categories')
        .select('id, name');

      const { data: rfqs } = await supabase
        .from('rfqs')
        .select('category_id');

      const categoryRfqs = categories?.map(c => ({
        name: c.name,
        rfqs: rfqs?.filter(r => r.category_id === c.id).length || 0,
      })) || [];

      return categoryRfqs.sort((a, b) => b.rfqs - a.rfqs).slice(0, 8);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground">Supplier network performance metrics and insights</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{rfqStats?.totalRfqs || 0}</div>
                <p className="text-sm text-muted-foreground">Total RFQs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Users className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{supplierStats?.totalApproved || 0}</div>
                <p className="text-sm text-muted-foreground">Approved Suppliers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Percent className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{rfqStats?.responseRate.toFixed(1) || 0}%</div>
                <p className="text-sm text-muted-foreground">Response Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{rfqStats?.avgResponseTime || 0} days</div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="currency">Currency Exposure</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>RFQs vs Quotations Trend</CardTitle>
                <CardDescription>Monthly comparison of RFQs issued and quotations received</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="rfqs" name="RFQs" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="quotations" name="Quotations" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
                <CardDescription>RFQs by product category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip />
                      <Bar dataKey="rfqs" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Supplier Distribution by Country</CardTitle>
                <CardDescription>Geographic distribution of approved suppliers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={supplierStats?.countryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {supplierStats?.countryData?.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Supplier Rating Distribution</CardTitle>
                <CardDescription>Internal ratings of approved suppliers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={supplierStats?.ratingDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="rating" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="currency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Currency Exposure</CardTitle>
              <CardDescription>Total quotation values by currency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currencyExposure}
                      cx="50%"
                      cy="50%"
                      outerRadius={150}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${(value / 1000).toFixed(0)}K`}
                    >
                      {currencyExposure?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${(value / 1000).toFixed(2)}K`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category-wise Sourcing Depth</CardTitle>
              <CardDescription>Number of RFQs created per product category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="rfqs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
