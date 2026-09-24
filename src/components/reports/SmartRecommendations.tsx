import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useSmartRecommendations } from '@/hooks/useActionableReports';
import { formatCurrencyWithSymbol } from '@/lib/currency-utils';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Info, Zap, ChevronRight, Lightbulb } from 'lucide-react';

const fmt = (n: number) => formatCurrencyWithSymbol(n, 'INR');

interface Props {
  dateFrom?: Date;
  dateTo?: Date;
}

export function SmartRecommendations({ dateFrom, dateTo }: Props) {
  const { data, isLoading } = useSmartRecommendations(dateFrom, dateTo);
  const navigate = useNavigate();

  if (isLoading) {
    return <Card><CardHeader><Skeleton className="h-6 w-48" /></CardHeader><CardContent><Skeleton className="h-32" /></CardContent></Card>;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Smart Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No action items right now — everything looks good! 🎉
          </p>
        </CardContent>
      </Card>
    );
  }

  const iconMap = {
    warning: AlertTriangle,
    info: Info,
    action: Zap,
  };

  const colorMap = {
    warning: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
    info: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
    action: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
  };

  const iconColorMap = {
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
    action: 'text-red-600 dark:text-red-400',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Smart Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((rec) => {
          const Icon = iconMap[rec.type];
          return (
            <div
              key={rec.id}
              className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${colorMap[rec.type]}`}
            >
              <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColorMap[rec.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{rec.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                {rec.value !== undefined && (
                  <p className="text-xs font-medium mt-1">
                    Value: {fmt(rec.value)}
                    {rec.count !== undefined && <span className="ml-2">({rec.count} deals)</span>}
                  </p>
                )}
              </div>
              {rec.linkTo && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => navigate(rec.linkTo!)}
                >
                  View <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
