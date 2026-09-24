import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { useDataQualityStatus } from '@/hooks/useActionablePricing';
import { Skeleton } from '@/components/ui/skeleton';

export function DataQualityWidget() {
  const { data: quality, isLoading } = useDataQualityStatus();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  const dataScore = Math.min(100, Math.round(
    ((quality?.leads_with_outcomes || 0) / 50 * 25) +
    ((quality?.negotiation_records || 0) / 100 * 25) +
    ((quality?.quotations_count || 0) / 100 * 25) +
    ((quality?.leads_with_lost_reasons || 0) / 20 * 25)
  ));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4" />
          Data Quality
          {quality?.has_sufficient_data ? (
            <Badge variant="default" className="bg-green-600 ml-auto">Good</Badge>
          ) : (
            <Badge variant="destructive" className="ml-auto">Needs Data</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Analytics Readiness</span>
            <span>{dataScore}%</span>
          </div>
          <Progress value={dataScore} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Leads w/ outcomes:</span>
            <span className="font-medium">{quality?.leads_with_outcomes}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Negotiations:</span>
            <span className="font-medium">{quality?.negotiation_records}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Quotations:</span>
            <span className="font-medium">{quality?.quotations_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Products quoted:</span>
            <span className="font-medium">{quality?.products_quoted}</span>
          </div>
        </div>

        {quality?.data_issues && quality.data_issues.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium mb-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              Suggestions
            </p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {quality.data_issues.slice(0, 2).map((issue, i) => (
                <li key={i}>• {issue}</li>
              ))}
            </ul>
          </div>
        )}

        {quality?.has_sufficient_data && (
          <div className="flex items-center gap-1 text-xs text-green-600 pt-1">
            <CheckCircle2 className="h-3 w-3" />
            Ready for analytics
          </div>
        )}
      </CardContent>
    </Card>
  );
}
