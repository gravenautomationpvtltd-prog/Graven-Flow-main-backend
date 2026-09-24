import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useLead } from '@/hooks/useLeads';
import { useTasks } from '@/hooks/useTasks';
import { useQuotations } from '@/hooks/useQuotations';
import { useEnquiryItems, type EnquiryItem } from '@/hooks/useEnquiryItems';
import { type PrePopulatedItem } from '@/components/quotations/QuotationBuilder';
import { LeadHeader } from '@/components/leads/LeadHeader';
import { LeadCustomerInfo } from '@/components/leads/LeadCustomerInfo';
import { LeadQuerySection } from '@/components/leads/LeadQuerySection';
import { LeadEscalationBanner } from '@/components/leads/LeadEscalationBanner';
import { LeadActions } from '@/components/leads/LeadActions';
import { LeadActivityTimeline } from '@/components/leads/LeadActivityTimeline';
import { LeadTasksSection } from '@/components/leads/LeadTasksSection';
import { LeadQuotationsSection } from '@/components/leads/LeadQuotationsSection';
import { LeadOrderSection } from '@/components/leads/LeadOrderSection';
import { EnquiryItemsSection } from '@/components/leads/EnquiryItemsSection';
import { EnquiryStatusControl } from '@/components/leads/EnquiryStatusControl';
import { LeadQualificationCard } from '@/components/leads/LeadQualificationCard';
import { AccountabilityTimeline } from '@/components/leads/AccountabilityTimeline';
import { AddActivityDialog } from '@/components/leads/AddActivityDialog';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { CreateQuotationDialog } from '@/components/quotations/CreateQuotationDialog';
import { EnquiryBriefCard } from '@/components/spt/EnquiryBriefCard';
import { LeadStatusStrip } from '@/components/leads/LeadStatusStrip';
import { LeadAssignmentHistory } from '@/components/leads/LeadAssignmentHistory';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, FileText, ListTodo, StickyNote, Plus, Package, GitBranch, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get the return URL from query param
  const fromUrl = searchParams.get('from');
  
  const handleBackToLeads = useCallback(() => {
    if (fromUrl && fromUrl.startsWith('/leads')) {
      // Navigate to the exact URL we came from (with filters preserved)
      navigate(fromUrl);
    } else {
      // Fallback: try browser back, then /leads
      navigate('/leads');
    }
  }, [fromUrl, navigate]);
  const { data: lead, isLoading, error } = useLead(id);
  const { data: leadTasks, isLoading: tasksLoading } = useTasks({ leadId: id });
  const { data: quotations } = useQuotations(id);
  const { data: enquiryItems } = useEnquiryItems(id);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createQuotationOpen, setCreateQuotationOpen] = useState(false);
  const [prePopulatedItems, setPrePopulatedItems] = useState<PrePopulatedItem[]>([]);

  // Calculate pending and resolved price counts for enquiry items
  // IMPORTANT: This must be before any early returns to follow React hooks rules
  const { pendingPriceCount, resolvedPriceCount } = useMemo(() => {
    if (!enquiryItems) return { pendingPriceCount: 0, resolvedPriceCount: 0 };
    return {
      pendingPriceCount: enquiryItems.filter(item => 
        item.price_flagged_to_procurement_at && !item.price_resolved_at
      ).length,
      resolvedPriceCount: enquiryItems.filter(item => 
        item.price_resolved_at
      ).length,
    };
  }, [enquiryItems]);

  // Handler for generating quotation from enquiry items
  const handleGenerateQuotation = useCallback((items: EnquiryItem[]) => {
    // Map EnquiryItem to PrePopulatedItem format
    const mapped: PrePopulatedItem[] = items.map(item => ({
      id: item.id, // For linking back to enquiry_item
      product_query_text: item.product_query_text,
      quantity: item.quantity,
      target_rate: item.target_rate,
      matched_product: item.matched_product,
    }));
    setPrePopulatedItems(mapped);
    setCreateQuotationOpen(true);
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-64" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-muted-foreground mb-4">
          {error ? 'Error loading lead' : 'Lead not found'}
        </p>
        <Button onClick={() => navigate('/leads')}>
          Back to Leads
        </Button>
      </div>
    );
  }

  const quotationCount = quotations?.length || 0;
  const taskCount = leadTasks?.length || 0;
  const enquiryItemCount = enquiryItems?.length || 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={handleBackToLeads} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Leads
      </Button>
      
      <LeadHeader lead={lead} />

      <LeadEscalationBanner 
        level={lead.escalation_level}
        escalatedAt={lead.escalated_at}
        lastActivityAt={lead.last_activity_at}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status strip — pricing/procurement/owners at a glance */}
          <LeadStatusStrip leadId={lead.id} />

          {/* Order Section - Always on top when present */}
          <LeadOrderSection leadId={lead.id} />

          {/* Enquiry Brief — shown for SPT when lead has been qualified with items */}
          {lead.has_enquiry && (
            <EnquiryBriefCard
              leadId={lead.id}
              onCreateQuotation={handleGenerateQuotation}
            />
          )}

          {/* Customer Requirement */}
          <LeadQuerySection query={lead.customer_query} />

          {/* Tabbed Content */}
          <Tabs defaultValue="activity" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent flex-wrap">
              <TabsTrigger 
                value="activity"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
              >
                <Activity className="h-4 w-4 mr-2" />
                Activity
              </TabsTrigger>
              <TabsTrigger 
                value="enquiry"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
              >
                <Package className="h-4 w-4 mr-2" />
                Enquiry Items
                {enquiryItemCount > 0 && (
                  <span className="ml-2 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                    {enquiryItemCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="accountability"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
              >
                <GitBranch className="h-4 w-4 mr-2" />
                Timeline
              </TabsTrigger>
              <TabsTrigger 
                value="quotations"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
              >
                <FileText className="h-4 w-4 mr-2" />
                Quotations
                {quotationCount > 0 && (
                  <span className="ml-2 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                    {quotationCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="tasks"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
              >
                <ListTodo className="h-4 w-4 mr-2" />
                Tasks
                {taskCount > 0 && (
                  <span className="ml-2 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                    {taskCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="notes"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
              >
                <StickyNote className="h-4 w-4 mr-2" />
                Notes
              </TabsTrigger>
              <TabsTrigger 
                value="assignment"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Assignment Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="mt-0 border rounded-b-lg rounded-tr-lg">
              <LeadActivityTimeline leadId={lead.id} />
            </TabsContent>

            <TabsContent value="enquiry" className="mt-0 border rounded-b-lg rounded-tr-lg p-4">
              <EnquiryItemsSection 
                leadId={lead.id} 
                customerId={lead.customer_id || undefined}
                customerName={lead.customer?.contact_person || lead.customer?.company_name}
                onGenerateQuotation={handleGenerateQuotation}
              />
            </TabsContent>

            <TabsContent value="accountability" className="mt-0 border rounded-b-lg rounded-tr-lg p-4">
              <AccountabilityTimeline 
                leadId={lead.id}
                leadCreatedAt={lead.created_at}
                firstResponseAt={lead.first_response_at}
              />
            </TabsContent>

            <TabsContent value="quotations" className="mt-0 border rounded-b-lg rounded-tr-lg p-4">
              <LeadQuotationsSection 
                leadId={lead.id}
                customerId={lead.customer_id || undefined}
                customerName={lead.customer?.contact_person || lead.customer?.company_name}
                customerPhone={lead.customer?.phone}
                customerEmail={lead.customer?.email || undefined}
              />
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 border rounded-b-lg rounded-tr-lg p-4">
              <LeadTasksSection 
                tasks={leadTasks || []}
                isLoading={tasksLoading}
                onCreateTask={() => setCreateTaskOpen(true)}
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-0 border rounded-b-lg rounded-tr-lg p-4">
              <div className="flex justify-end mb-4">
                <Button size="sm" onClick={() => setAddActivityOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Note
                </Button>
              </div>
              <LeadActivityTimeline leadId={lead.id} />
            </TabsContent>

            <TabsContent value="assignment" className="mt-0 border rounded-b-lg rounded-tr-lg">
              <LeadAssignmentHistory leadId={lead.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <LeadQualificationCard leadId={lead.id} />
          <EnquiryStatusControl
            leadId={lead.id}
            hasEnquiry={lead.has_enquiry || false}
            currentStatus={lead.enquiry_status as any}
            pendingPriceCount={pendingPriceCount}
            resolvedPriceCount={resolvedPriceCount}
          />
          <LeadActions 
            leadId={lead.id}
            customerId={lead.customer_id || lead.customer?.id}
            customerPhone={lead.customer?.phone}
            customerEmail={lead.customer?.email}
            customerName={lead.customer?.contact_person || lead.customer?.company_name}
            onAddNote={() => setAddActivityOpen(true)}
            onCreateTask={() => setCreateTaskOpen(true)}
          />
          <LeadCustomerInfo customer={lead.customer} />
        </div>
      </div>

      <AddActivityDialog
        open={addActivityOpen}
        onOpenChange={setAddActivityOpen}
        leadId={lead.id}
      />

      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        defaultLeadId={lead.id}
      />

      <CreateQuotationDialog
        open={createQuotationOpen}
        onOpenChange={(open) => {
          setCreateQuotationOpen(open);
          if (!open) setPrePopulatedItems([]);
        }}
        leadId={lead.id}
        customerId={lead.customer_id || undefined}
        customerName={lead.customer?.contact_person || lead.customer?.company_name}
        customerPhone={lead.customer?.phone}
        customerEmail={lead.customer?.email || undefined}
        prePopulatedItems={prePopulatedItems}
      />
    </div>
  );
}
