import { useState } from 'react';
import { useCustomerIntelligence } from '@/hooks/useCustomerIntelligence';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Search, Users, TrendingUp, TrendingDown, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';

type SortField = 'buyingIntentScore' | 'conversionRate' | 'totalQuoteValue' | 'priceLossRate' | 'paymentRiskScore' | 'quotationFatigueIndex' | 'priceSensitivityScore';
type SortDirection = 'asc' | 'desc';

export function CustomerIntelligencePanel() {
  const { data: customers, isLoading } = useCustomerIntelligence();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('buyingIntentScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const navigate = useNavigate();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredCustomers = customers
    ?.filter(c => c.companyName.toLowerCase().includes(search.toLowerCase()))
    ?.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }) || [];

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    return `₹${value.toLocaleString()}`;
  };

  const getIntentBadge = (classification: string) => {
    switch (classification) {
      case 'buy_likely': return <Badge className="bg-green-500 hover:bg-green-600">High Intent</Badge>;
      case 'nurture': return <Badge className="bg-blue-500 hover:bg-blue-600">Nurture</Badge>;
      case 'negotiation_zone': return <Badge className="bg-amber-500 hover:bg-amber-600">Negotiating</Badge>;
      case 'drop_risk': return <Badge variant="destructive">Drop Risk</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getRiskIndicator = (score: number) => {
    if (score >= 70) return <AlertTriangle className="h-4 w-4 text-destructive" />;
    if (score >= 40) return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return null;
  };

  const getFatigueBadge = (index: number) => {
    if (index <= 2) return <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Healthy</Badge>;
    if (index <= 5) return <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">Watch</Badge>;
    return <Badge variant="outline" className="text-destructive border-destructive text-xs">Exploitative</Badge>;
  };

  const getPriceSensitivityBadge = (classification: string) => {
    switch (classification) {
      case 'value_buyer': return <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Value Buyer</Badge>;
      case 'price_aware': return <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">Price Aware</Badge>;
      case 'price_driven': return <Badge variant="outline" className="text-destructive border-destructive text-xs">Price Driven</Badge>;
      default: return null;
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          sortDirection === 'desc' ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  const highIntent = customers?.filter(c => c.intentClassification === 'buy_likely').length || 0;
  const dropRisk = customers?.filter(c => c.intentClassification === 'drop_risk').length || 0;
  const highPaymentRisk = customers?.filter(c => c.paymentRiskScore >= 70).length || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total Analyzed</span>
            </div>
            <p className="text-2xl font-bold">{customers?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">High Intent</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{highIntent}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm">Drop Risk</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{dropRisk}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Payment Risk</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{highPaymentRisk}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Customer Intelligence Matrix
              </CardTitle>
              <CardDescription>Quote vs conversion analysis with predictive scoring</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Customer</TableHead>
                  <TableHead className="text-center">Quotes</TableHead>
                  <TableHead className="text-center">Orders</TableHead>
                  <SortHeader field="conversionRate" label="Conv %" />
                  <SortHeader field="buyingIntentScore" label="Intent" />
                  <SortHeader field="quotationFatigueIndex" label="Fatigue" />
                  <SortHeader field="priceSensitivityScore" label="Price Sens." />
                  <SortHeader field="priceLossRate" label="Price-Loss %" />
                  <SortHeader field="paymentRiskScore" label="Payment Risk" />
                  <TableHead>Classification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.slice(0, 50).map((customer) => (
                  <TableRow 
                    key={customer.customerId}
                    className={`cursor-pointer hover:bg-muted/50 ${
                      customer.intentClassification === 'buy_likely' ? 'bg-green-500/5' :
                      customer.intentClassification === 'drop_risk' ? 'bg-destructive/5' : ''
                    }`}
                    onClick={() => navigate(`/customers/${customer.customerId}`)}
                  >
                    <TableCell className="font-medium max-w-48 truncate sticky left-0 bg-background">
                      {customer.companyName}
                    </TableCell>
                    <TableCell className="text-center">{customer.quotesIssued90Days}</TableCell>
                    <TableCell className="text-center">{customer.ordersWon90Days}</TableCell>
                    <TableCell className="text-center">
                      <span className={
                        customer.conversionRate >= 30 ? 'text-green-600 font-medium' :
                        customer.conversionRate >= 15 ? 'text-amber-600' : 'text-muted-foreground'
                      }>
                        {customer.conversionRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={
                        customer.buyingIntentScore >= 70 ? 'text-green-600 font-bold' :
                        customer.buyingIntentScore >= 40 ? 'text-amber-600 font-medium' : 'text-muted-foreground'
                      }>
                        {customer.buyingIntentScore.toFixed(0)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={
                          customer.quotationFatigueIndex <= 2 ? 'text-green-600' :
                          customer.quotationFatigueIndex <= 5 ? 'text-amber-600' : 'text-destructive font-medium'
                        }>
                          {customer.quotationFatigueIndex.toFixed(1)}
                        </span>
                        {getFatigueBadge(customer.quotationFatigueIndex)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={
                          customer.priceSensitivityScore >= 70 ? 'text-destructive' :
                          customer.priceSensitivityScore >= 40 ? 'text-amber-600' : 'text-green-600'
                        }>
                          {customer.priceSensitivityScore.toFixed(0)}
                        </span>
                        {getPriceSensitivityBadge(customer.priceSensitivityClassification)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {customer.priceLossRate > 0 ? (
                        <span className="text-destructive font-medium">{customer.priceLossRate.toFixed(1)}%</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRiskIndicator(customer.paymentRiskScore)}
                        <span className={
                          customer.paymentRiskScore >= 70 ? 'text-destructive' :
                          customer.paymentRiskScore >= 40 ? 'text-amber-600' : ''
                        }>
                          {customer.paymentRiskScore.toFixed(0)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getIntentBadge(customer.intentClassification)}</TableCell>
                  </TableRow>
                ))}
                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No customers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredCustomers.length > 50 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing top 50 of {filteredCustomers.length} customers
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
