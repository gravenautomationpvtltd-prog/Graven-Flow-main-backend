import { useState } from 'react';
import { useExecutiveAlerts } from '@/hooks/useDecisionDeckStats';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Users, 
  Box, 
  DollarSign, 
  TrendingUp,
  Filter,
  ChevronRight
} from 'lucide-react';

type AlertCategory = 'all' | 'customer' | 'sku' | 'financial' | 'performance';

export function StrategicAlerts() {
  const { data: alerts, isLoading } = useExecutiveAlerts();
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory>('all');
  const navigate = useNavigate();

  const filteredAlerts = alerts?.filter(alert => 
    categoryFilter === 'all' || alert.category === categoryFilter
  ) || [];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-amber-500" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'warning': return <Badge className="bg-amber-500 hover:bg-amber-600">Warning</Badge>;
      default: return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'customer': return <Users className="h-4 w-4" />;
      case 'sku': return <Box className="h-4 w-4" />;
      case 'financial': return <DollarSign className="h-4 w-4" />;
      case 'performance': return <TrendingUp className="h-4 w-4" />;
      default: return null;
    }
  };

  const handleAlertClick = (alert: any) => {
    if (alert.entityType === 'customer' && alert.entityId) {
      navigate(`/customers/${alert.entityId}`);
    } else if (alert.entityType === 'product' && alert.entityId) {
      navigate(`/products`);
    }
  };

  const categories: { key: AlertCategory; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: <Filter className="h-4 w-4" /> },
    { key: 'customer', label: 'Customer', icon: <Users className="h-4 w-4" /> },
    { key: 'sku', label: 'SKU', icon: <Box className="h-4 w-4" /> },
    { key: 'financial', label: 'Financial', icon: <DollarSign className="h-4 w-4" /> },
    { key: 'performance', label: 'Performance', icon: <TrendingUp className="h-4 w-4" /> },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const criticalCount = alerts?.filter(a => a.type === 'critical').length || 0;
  const warningCount = alerts?.filter(a => a.type === 'warning').length || 0;

  return (
    <div className="space-y-6">
      {/* Alert Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="font-semibold text-destructive">{criticalCount} Critical</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-amber-600">{warningCount} Warnings</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <Button
            key={cat.key}
            variant={categoryFilter === cat.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter(cat.key)}
            className="gap-2"
          >
            {cat.icon}
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Strategic Alerts
          </CardTitle>
          <CardDescription>
            Actionable insights requiring executive attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No alerts in this category</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert, index) => (
                <div
                  key={index}
                  onClick={() => handleAlertClick(alert)}
                  className={`
                    p-4 rounded-lg border transition-all cursor-pointer hover:shadow-md
                    ${alert.type === 'critical' ? 'bg-destructive/5 border-destructive/30 hover:bg-destructive/10' :
                      alert.type === 'warning' ? 'bg-amber-500/5 border-amber-500/30 hover:bg-amber-500/10' :
                      'bg-muted/50 border-border hover:bg-muted'}
                  `}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(alert.type)}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{alert.title}</span>
                          {getSeverityBadge(alert.type)}
                          <Badge variant="outline" className="gap-1">
                            {getCategoryIcon(alert.category)}
                            <span className="capitalize">{alert.category}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        {alert.metric && (
                          <p className="text-sm font-medium mt-2">
                            <span className="text-muted-foreground">Impact: </span>
                            {alert.metric}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
