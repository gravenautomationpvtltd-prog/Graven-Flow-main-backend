import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText } from 'lucide-react';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];

interface CustomerLeadsSectionProps {
  customerId: string;
}

export function CustomerLeadsSection({ customerId }: CustomerLeadsSectionProps) {
  const navigate = useNavigate();

  const { data: leads, isLoading } = useQuery({
    queryKey: ['customer-leads', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Leads ({leads?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!leads || leads.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No leads from this customer yet
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <div className="space-y-1">
                  <div className="font-medium">{lead.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString()}
                    {lead.estimated_value && (
                      <span className="ml-2">• ₹{lead.estimated_value.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LeadStatusBadge status={lead.status} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
