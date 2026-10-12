import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Cog, ArrowRight, Clock, CheckCircle2, Phone, PhoneCall,
  Calendar, User, AlertCircle, BarChart3, CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { TSTManagementDashboard } from '@/components/tst/TSTManagementDashboard';
import { CopyableText, CopyablePhone } from '@/components/shared/CopyableText';

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  assigned: { label: 'Assigned', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  follow_up: { label: 'Follow-up', cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  escalated: { label: 'Escalated', cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  closed: { label: 'Closed', cls: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
};

export default function TSTQueue() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('active');

  // Fetch TST Cases with Customer & Lead & Payment info
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['tst-cases'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tst_cases')
        .select(`
          *,
          customer:customers(*),
          lead:leads(*),
          payment:payment_requests(*),
          assignee:profiles!tst_cases_assigned_to_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const filteredCases = cases.filter((c: any) => {
    if (activeTab === 'active') return ['new', 'assigned', 'in_progress', 'follow_up'].includes(c.status);
    if (activeTab === 'resolved') return ['resolved', 'closed'].includes(c.status);
    if (activeTab === 'follow_up') return c.status === 'follow_up';
    if (activeTab === 'all') return true;
    return true;
  });

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Cog className="h-6 w-6 text-primary" />
            Technical Solutions Team (TST) Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verified paid cases ready for customer consultation, technical troubleshooting, and feedback collection.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 flex-wrap">
          <TabsTrigger value="active">
            Active Cases ({cases.filter((c: any) => ['new', 'assigned', 'in_progress', 'follow_up'].includes(c.status)).length})
          </TabsTrigger>
          <TabsTrigger value="follow_up">
            Follow-ups ({cases.filter((c: any) => c.status === 'follow_up').length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved &amp; Closed ({cases.filter((c: any) => ['resolved', 'closed'].includes(c.status)).length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({cases.length})
          </TabsTrigger>
          <TabsTrigger value="management" className="gap-1.5 text-primary">
            <BarChart3 className="h-4 w-4" /> Management KPIs
          </TabsTrigger>
        </TabsList>

        {activeTab === 'management' ? (
          <TabsContent value="management" className="mt-4">
            <TSTManagementDashboard />
          </TabsContent>
        ) : (
          <TabsContent value={activeTab} className="mt-4 space-y-3">
            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            )}

            {!isLoading && filteredCases.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground space-y-2">
                  <Cog className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="text-sm">No cases in this queue.</p>
                </CardContent>
              </Card>
            )}

            {!isLoading && filteredCases.map((c: any) => {
              const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.new;
              const phone = c.customer?.phone;

              return (
                <Card key={c.id} className="hover:shadow-md transition-shadow border">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                          <CopyableText
                            text={c.customer?.company_name || c.customer?.contact_person || 'Unknown Customer'}
                            label="customer name"
                            textClassName="text-base font-semibold"
                          />
                        </CardTitle>
                        <Badge variant="outline" className={`border-0 text-xs font-medium ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </Badge>
                        <Badge variant={c.priority === 'urgent' ? 'destructive' : 'outline'} className="text-[10px] uppercase">
                          {c.priority}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {c.customer?.contact_person && (
                          <>
                            <CopyableText
                              text={c.customer.contact_person}
                              label="contact person"
                              textClassName="text-xs text-muted-foreground"
                            />
                            <span>·</span>
                          </>
                        )}
                        <span>Created {format(new Date(c.created_at), 'PP p')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {c.payment?.status === 'paid' && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs gap-1">
                          <CreditCard className="h-3 w-3" /> Paid ₹{c.payment.amount}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-2 space-y-3">
                    <CopyableText
                      text={c.title || c.description || c.lead?.customer_query || 'Technical consultation request'}
                      label="case description"
                      textClassName="text-sm text-foreground line-clamp-2"
                      className="w-full"
                    />

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          Assigned: <strong className="text-foreground">{c.assignee?.full_name || 'Unassigned'}</strong>
                        </span>

                        {phone && (
                          <div className="flex items-center gap-1 text-emerald-700">
                            <Phone className="h-3.5 w-3.5" />
                            <CopyablePhone phone={phone} textClassName="text-emerald-700 font-mono" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {phone && (
                          <Button size="sm" variant="outline" asChild className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            <a href={`tel:${phone}`}>
                              <PhoneCall className="h-3.5 w-3.5" /> 📞 Call
                            </a>
                          </Button>
                        )}
                        <Button size="sm" onClick={() => navigate(`/tst/case/${c.id}`)} className="h-8 gap-1 text-xs">
                          Customer 360 &amp; Solution <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
