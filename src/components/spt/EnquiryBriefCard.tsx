import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Paperclip, ArrowRight } from 'lucide-react';
import { PriceValidityBadge } from '@/components/shared/PriceValidityBadge';
import { formatDistanceToNow } from 'date-fns';
import { useEnquiryItems, type EnquiryItem } from '@/hooks/useEnquiryItems';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  leadId: string;
  onCreateQuotation: (items: EnquiryItem[]) => void;
}

export function EnquiryBriefCard({ leadId, onCreateQuotation }: Props) {
  const { data: items = [] } = useEnquiryItems(leadId);

  // Hide brief once a non-draft quotation exists — lead has moved to quotation/negotiation stage
  const { data: hasQuotation } = useQuery({
    queryKey: ['lead-has-quotation', leadId],
    queryFn: async () => {
      const { count } = await supabase
        .from('quotations')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId)
        .neq('status', 'draft')
        .is('deleted_at', null);
      return (count ?? 0) > 0;
    },
    enabled: !!leadId,
  });

  const { data: qualification } = useQuery({
    queryKey: ['lead-qualification-brief', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_qualification' as any)
        .select('qualification_type, routed_to, qualified_at, qualified_by, decision_reason')
        .eq('lead_id', leadId)
        .order('qualified_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const q: any = data;
      let qualifier_name: string | null = null;
      if (q.qualified_by) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', q.qualified_by)
          .maybeSingle();
        qualifier_name = (prof as any)?.full_name || null;
      }
      return { ...q, qualifier_name };
    },
  });

  if (!items.length || hasQuotation) return null;

  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const isTechnical = qualification?.qualification_type === 'technical' || qualification?.routed_to === 'tst';

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Enquiry Brief</CardTitle>
            {isTechnical ? (
              <Badge variant="secondary">Technical · TST</Badge>
            ) : (
              <Badge variant="default">Simple · LQT</Badge>
            )}
          </div>
          <Button size="sm" onClick={() => onCreateQuotation(items)}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Create Quotation
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
        {qualification && (
          <p className="text-xs text-muted-foreground mt-1">
            Qualified by {qualification.qualifier_name || 'team member'} ·{' '}
            {formatDistanceToNow(new Date(qualification.qualified_at), { addSuffix: true })}
            {qualification.decision_reason && ` · "${qualification.decision_reason}"`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Product / Query</th>
                <th className="text-left px-3 py-2 font-medium">HSN</th>
                <th className="text-right px-3 py-2 font-medium">Qty</th>
                <th className="text-right px-3 py-2 font-medium">Target ₹</th>
                <th className="text-right px-3 py-2 font-medium">Proc. ₹</th>
                <th className="text-center px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const proc = it.procurement_price;
                const target = it.target_rate;
                const margin = proc && target ? ((target - proc) / target) * 100 : null;
                return (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {it.matched_product?.name || it.product_query_text}
                      </div>
                      {it.matched_product && it.product_query_text !== it.matched_product.name && (
                        <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                          orig: {it.product_query_text}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {it.matched_product?.hsn_code || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.quantity ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {target ? `₹${Math.round(target).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {proc ? (
                        <div>
                          <div>₹{Math.round(proc).toLocaleString('en-IN')}</div>
                          {margin !== null && (
                            <div className={`text-[10px] ${margin >= 15 ? 'text-emerald-600' : margin >= 5 ? 'text-amber-600' : 'text-destructive'}`}>
                              {margin.toFixed(0)}% margin
                            </div>
                          )}
                          <div className="mt-1 flex justify-end">
                            <PriceValidityBadge validUntil={(it as any).price_valid_until} showEmpty />
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">pending</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {it.notes ? (
                        <span title={it.notes}>
                          <Paperclip className="h-3 w-3 inline text-muted-foreground" />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/20 text-xs">
              <tr className="border-t">
                <td className="px-3 py-2 font-medium" colSpan={2}>
                  {items.length} item{items.length > 1 ? 's' : ''}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">{totalQty}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
