import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cog, Star, Phone, CheckCircle2, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface CustomerTSTSectionProps {
  customerId: string;
}

export function CustomerTSTSection({ customerId }: CustomerTSTSectionProps) {
  const navigate = useNavigate();

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['customer-tst-cases', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await (supabase as any)
        .from('tst_cases')
        .select(`
          *,
          interactions:tst_interactions(*),
          followups:tst_followups(*),
          feedback:customer_feedback(*),
          assignee:profiles!tst_cases_assigned_to_fkey(id, full_name)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cog className="h-5 w-5 text-primary" /> Technical Solutions & TST History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Loading technical history...</p>
        </CardContent>
      </Card>
    );
  }

  if (cases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cog className="h-5 w-5 text-primary" /> Technical Solutions & TST History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            No technical consultation or TST cases recorded for this customer yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Cog className="h-5 w-5 text-primary" /> Technical Solutions & TST 360 History
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {cases.length} Case{cases.length > 1 ? 's' : ''}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {cases.map((c: any) => {
          const interactions = c.interactions || [];
          const feedback = c.feedback || [];

          return (
            <div key={c.id} className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{c.title || 'Technical Case'}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {c.status}
                  </Badge>
                  <Badge variant={c.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                    {c.priority}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), 'dd MMM yyyy')}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={() => navigate(`/tst/case/${c.id}`)}
                  >
                    View Case <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {c.description && (
                <p className="text-xs text-muted-foreground">{c.description}</p>
              )}

              {/* Interactions Summary */}
              {interactions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t text-xs">
                  <span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider block">
                    Recorded Solutions ({interactions.length}):
                  </span>
                  {interactions.map((it: any) => (
                    <div key={it.id} className="p-2 bg-white dark:bg-slate-800 rounded border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          {it.solution_provided || 'Consultation Completed'}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {it.resolution_status}
                        </Badge>
                      </div>
                      {it.product_solution_suggested && (
                        <p className="text-[11px] text-muted-foreground">
                          <strong>Product Suggested:</strong> {it.product_solution_suggested}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Feedback Summary */}
              {feedback.length > 0 && (
                <div className="pt-2 border-t flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Customer Feedback:</span>
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= feedback[0].rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-muted-foreground">
                      ({feedback[0].rating}/5 · {feedback[0].team_rating})
                    </span>
                  </div>
                  {feedback[0].comments && (
                    <span className="text-muted-foreground italic truncate max-w-xs">
                      &quot;{feedback[0].comments}&quot;
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
