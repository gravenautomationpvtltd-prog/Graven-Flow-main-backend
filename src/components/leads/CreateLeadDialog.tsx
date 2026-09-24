import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CustomerCombobox } from '@/components/tasks/CustomerCombobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCreateLead } from '@/hooks/useLeads';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { supabase } from '@/integrations/supabase/client';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
import { useOfficesManagement } from '@/hooks/useOfficeManagement';
import { checkDuplicateCustomerMulti, getMatchSeverity, MATCH_THRESHOLDS, type DuplicateCustomer } from '@/hooks/useCheckDuplicateCustomer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertTriangle, Info, CheckCircle2, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type LeadSource = Database['public']['Enums']['lead_source'];
const leadSources: LeadSource[] = ['indiamart', 'justdial', 'tradeindia', 'whatsapp', 'email', 'website', 'referral', 'manual'];

const leadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  source: z.enum(['indiamart', 'justdial', 'tradeindia', 'whatsapp', 'email', 'website', 'referral', 'manual'] as const),
  source_reference: z.string().optional(),
  customer_id: z.string().optional(),
  customer_query: z.string().optional(),
  estimated_value: z.number().min(0).optional(),
  assigned_to: z.string().optional(),
  expected_close_date: z.string().optional(),
});

const customerSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  contact_person: z.string().optional(),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  gst_number: z.string().optional(),
  is_b2b: z.boolean().default(true),
});

type LeadFormData = z.infer<typeof leadSchema>;
type CustomerFormData = z.infer<typeof customerSchema>;

interface DuplicateCustomerInfo extends DuplicateCustomer {
  // Extends DuplicateCustomer which includes match_score and match_reasons
}

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Component for displaying smart duplicate match alerts
function DuplicateMatchAlert({ match }: { match: DuplicateCustomerInfo }) {
  const severity = getMatchSeverity(match.match_score);
  
  // Definite duplicate (score >= 50)
  if (severity === 'definite') {
    return (
      <Alert className="border-red-500 bg-red-500/10">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <AlertDescription className="text-red-700 dark:text-red-400">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">Duplicate Customer Found</span>
            <Badge variant="destructive" className="text-xs">
              Match Score: {match.match_score}
            </Badge>
          </div>
          <p className="text-sm">
            <strong>{match.company_name}</strong>
            {(match.city || match.state) && (
              <span className="text-muted-foreground ml-1">
                <MapPin className="inline h-3 w-3" /> {[match.city, match.state].filter(Boolean).join(', ')}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {match.match_reasons.map((reason, idx) => (
              <Badge key={idx} variant="outline" className="text-xs border-red-300">
                {reason}
              </Badge>
            ))}
          </div>
          {match.assigned_sales_name && (
            <p className="text-xs mt-2 text-muted-foreground">
              Assigned to: <strong>{match.assigned_sales_name}</strong>
            </p>
          )}
          <p className="text-xs mt-2 text-muted-foreground italic">
            This is the SAME customer. The lead will be linked to them.
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Likely duplicate (score 30-49)
  if (severity === 'likely') {
    return (
      <Alert className="border-amber-500 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium">Possible Duplicate Found</span>
            <Badge variant="secondary" className="text-xs bg-amber-200 text-amber-800">
              Match Score: {match.match_score}
            </Badge>
          </div>
          <p className="text-sm">
            <strong>{match.company_name}</strong>
            {(match.city || match.state) && (
              <span className="text-muted-foreground ml-1">
                <MapPin className="inline h-3 w-3" /> {[match.city, match.state].filter(Boolean).join(', ')}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {match.match_reasons.map((reason, idx) => (
              <Badge key={idx} variant="outline" className="text-xs border-amber-300">
                {reason}
              </Badge>
            ))}
          </div>
          {match.assigned_sales_name && (
            <p className="text-xs mt-2 text-muted-foreground">
              Assigned to: <strong>{match.assigned_sales_name}</strong>
            </p>
          )}
          <p className="text-xs mt-2 text-muted-foreground italic">
            This is likely the same customer. The lead will be linked to them.
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Possible match (score 10-29) - just informational
  return (
    <Alert className="border-blue-500 bg-blue-500/10">
      <Info className="h-4 w-4 text-blue-500" />
      <AlertDescription className="text-blue-700 dark:text-blue-400">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium">Similar Company Found</span>
          <Badge variant="outline" className="text-xs">
            Match Score: {match.match_score}
          </Badge>
        </div>
        <p className="text-sm">
          <strong>{match.company_name}</strong>
          {(match.city || match.state) && (
            <span className="text-muted-foreground ml-1">
              <MapPin className="inline h-3 w-3" /> {[match.city, match.state].filter(Boolean).join(', ')}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1 mt-2">
          {match.match_reasons.map((reason, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              {reason}
            </Badge>
          ))}
        </div>
        <p className="text-xs mt-2 text-muted-foreground italic">
          <CheckCircle2 className="inline h-3 w-3 mr-1" />
          Different location - likely a DIFFERENT company. A new customer will be created.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function CreateLeadDialog({ open, onOpenChange }: CreateLeadDialogProps) {
  const [customerTab, setCustomerTab] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [duplicateCustomer, setDuplicateCustomer] = useState<DuplicateCustomerInfo | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  
  const { user, isManager, isAdmin, isCRO, isSales, profile, hasRole, isReady } = useAuth();
  const { hasTenant, loading: tenantLoading, refresh: refreshTenant } = useTenantStatus();
  const createLead = useCreateLead();
  const createCustomer = useCreateCustomer();
  const { data: profiles } = useProfiles();
  const { data: offices } = useOfficesManagement();

  // Only managers and admins can manually assign leads
  const canAssignLeads = isManager || isAdmin;
  const isOrphaned = !tenantLoading && !hasTenant;

  // Re-fetch tenant status when dialog opens to clear stale state
  // (e.g., for users whose tenant_users membership was just reactivated)
  useEffect(() => {
    if (open) {
      refreshTenant();
    }
  }, [open, refreshTenant]);

  const leadForm = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      source: 'manual',
    },
  });

  const customerForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      is_b2b: true,
    },
  });

  // Watch all relevant fields for multi-parameter duplicate checking
  const phoneValue = customerForm.watch('phone');
  const emailValue = customerForm.watch('email');
  const companyNameValue = customerForm.watch('company_name');
  const stateValue = customerForm.watch('state');
  const cityValue = customerForm.watch('city');
  const gstValue = customerForm.watch('gst_number');

  // Check for duplicate customer when relevant fields change (with debounce)
  useEffect(() => {
    if (customerTab !== 'new') {
      setDuplicateCustomer(null);
      return;
    }

    // Need at least phone or company name to check
    const hasEnoughData = (phoneValue && phoneValue.length >= 10) || 
                          (companyNameValue && companyNameValue.length >= 2);
    
    if (!hasEnoughData) {
      setDuplicateCustomer(null);
      return;
    }

    // Add timeout for duplicate check
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsCheckingDuplicate(true);
      try {
        const matches = await checkDuplicateCustomerMulti({
          phone: phoneValue || '',
          email: emailValue || undefined,
          company_name: companyNameValue || undefined,
          gst_number: gstValue || undefined,
          state: stateValue || undefined,
          city: cityValue || undefined,
        });
        
        if (matches.length > 0) {
          // Get the best match (highest score)
          const bestMatch = matches[0];
          setDuplicateCustomer(bestMatch);
        } else {
          setDuplicateCustomer(null);
        }
      } catch (error) {
        console.error('Error checking duplicate:', error);
        // Don't block form submission if duplicate check fails
        setDuplicateCustomer(null);
      } finally {
        setIsCheckingDuplicate(false);
      }
    }, 600);

    // Timeout after 5 seconds to prevent indefinite loading
    const abortTimeoutId = setTimeout(() => {
      controller.abort();
      setIsCheckingDuplicate(false);
      console.warn('Duplicate check timed out');
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(abortTimeoutId);
    };
  }, [phoneValue, emailValue, companyNameValue, stateValue, cityValue, gstValue, customerTab]);

  // Reset duplicate state when switching tabs
  useEffect(() => {
    if (customerTab === 'existing') {
      setDuplicateCustomer(null);
    }
  }, [customerTab]);

  const handleSubmit = async (data: LeadFormData) => {
    if (!isReady) return;

    // Pre-flight: re-validate tenant eligibility right before submit so that
    // a recently-fixed user doesn't hit a confusing RLS failure from cached state.
    await refreshTenant();
    const { data: tuCheck } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!tuCheck?.tenant_id) {
      toast.error("Your account isn't linked to an organization yet. Please contact your admin to be added before creating leads.");
      return;
    }

    let customerId = selectedCustomerId;
    let assignedTo = data.assigned_to;

    // LQT/CRO creators always retain ownership of leads they create manually,
    // regardless of customer loyalty. Loyalty is still preserved as a hint via
    // suggested_assignee_id (handled by the DB trigger from customer.assigned_sales_id).
    const isCROOnly = isCRO && !isSales && !isManager && !isAdmin;
    const lqtCreatorKeepsLead = isCROOnly;

    // Determine if we should link to existing customer based on match score
    const shouldLinkToExisting = duplicateCustomer && 
      getMatchSeverity(duplicateCustomer.match_score) !== 'possible';

    // If definite or likely duplicate found in new customer tab, use existing customer
    if (customerTab === 'new' && shouldLinkToExisting && duplicateCustomer) {
      customerId = duplicateCustomer.id;
      if (!lqtCreatorKeepsLead) {
        // Auto-assign to the existing customer's salesperson (customer loyalty)
        assignedTo = duplicateCustomer.assigned_sales_id || assignedTo;
      }
    } else if (customerTab === 'new') {
      // Create new customer (either no match or just a "possible" match with different location)
      const customerData = customerForm.getValues();
      const isValid = await customerForm.trigger();
      if (!isValid) return;

      try {
        const assignedSalesIdForNewCustomer = canAssignLeads
          ? (data.assigned_to || null)
          : (isCROOnly ? null : (user?.id || null));

        const newCustomer = await createCustomer.mutateAsync({
          company_name: customerData.company_name,
          phone: customerData.phone,
          contact_person: customerData.contact_person || null,
          email: customerData.email || null,
          address: customerData.address || null,
          city: customerData.city || null,
          state: customerData.state || null,
          gst_number: customerData.gst_number || null,
          is_b2b: customerData.is_b2b,
          assigned_sales_id: assignedSalesIdForNewCustomer,
          office_id: profile?.office_id || null,
        });
        customerId = newCustomer.id;
        // For new customers, assign to the user creating it (or selected user for managers)
        assignedTo = assignedSalesIdForNewCustomer || undefined;
      } catch (error) {
        // Error is already shown by the mutation's onError handler
        console.error('Customer creation failed:', error);
        return;
      }
    }

    // LQT/CRO creator always owns the lead they manually create here
    if (lqtCreatorKeepsLead && user?.id) {
      assignedTo = user.id;
    }

    // Determine lead assignment if not already set
    if (!assignedTo) {
      // If user cannot assign leads (Sales role), auto-assign
      if (!canAssignLeads) {
        // Check if existing customer has an assigned salesperson
        if (customerId) {
          // Fetch customer directly to get assigned_sales_id
          const { data: customer } = await supabase
            .from('customers')
            .select('assigned_sales_id')
            .eq('id', customerId)
            .single();
          
          if (customer?.assigned_sales_id) {
            // Assign to customer's existing salesperson for relationship continuity
            assignedTo = customer.assigned_sales_id;
          } else if (isCROOnly) {
            // CRO-only user — leave null so DB trigger handles round-robin
            assignedTo = undefined;
          } else {
            // New customer or no assigned sales - assign to current user
            assignedTo = user?.id;
          }
        } else if (isCROOnly) {
          // CRO-only with no customer — leave null for round-robin
          assignedTo = undefined;
        } else {
          // No customer selected - assign to current user
          assignedTo = user?.id;
        }
      } else {
        // Manager/Admin didn't select anyone - check customer's assigned sales
        if (customerId) {
          const { data: customer } = await supabase
            .from('customers')
            .select('assigned_sales_id')
            .eq('id', customerId)
            .single();
          
          if (customer?.assigned_sales_id) {
            assignedTo = customer.assigned_sales_id;
          }
        }
      }
    }

    // Determine office_id - use creator's office for manual leads
    const creatorOfficeId = profile?.office_id || null;

    // Normalize source_reference: strip whitespace, treat empty/generic-label values as null
    const rawRef = data.source_reference?.trim() ?? '';
    const isGenericLabel = rawRef.toLowerCase() === data.source.toLowerCase();
    const normalizedSourceRef = (data.source === 'manual' || !rawRef || isGenericLabel)
      ? null
      : rawRef;

    await createLead.mutateAsync({
      title: data.title,
      source: data.source,
      source_reference: normalizedSourceRef,
      customer_id: customerId || null,
      customer_query: data.customer_query || null,
      estimated_value: data.estimated_value || null,
      assigned_to: assignedTo || null,
      expected_close_date: data.expected_close_date || null,
      office_id: creatorOfficeId, // Set to creator's office for manual leads
    });

    onOpenChange(false);
    leadForm.reset();
    customerForm.reset();
    setSelectedCustomerId('');
    setCustomerTab('existing');
    setDuplicateCustomer(null);
  };

  const isSubmitting = createLead.isPending || createCustomer.isPending || !isReady;

  // Reset form on dialog close
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      leadForm.reset();
      customerForm.reset();
      setSelectedCustomerId('');
      setCustomerTab('existing');
      setDuplicateCustomer(null);
      setIsCheckingDuplicate(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
        </DialogHeader>

        <Form {...leadForm}>
          <form onSubmit={leadForm.handleSubmit(handleSubmit)} className="space-y-6">
            {isOrphaned && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Your account isn't linked to an organization. Please contact your admin to be added before creating leads.
                </AlertDescription>
              </Alert>
            )}
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm">
                This lead will land in the <strong>LQT Inbox</strong> for qualification before being routed to Sales or Technical. Customer loyalty (existing salesperson) is preserved as a hint to the qualifier.
              </AlertDescription>
            </Alert>
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Lead Information
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leadForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Lead Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Industrial Pump Requirement" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={leadForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leadSources.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {leadForm.watch('source') !== 'manual' && (
                  <FormField
                    control={leadForm.control}
                    name="source_reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>External Reference ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., IndiaMART Lead ID, WhatsApp message ID" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Optional. Must be a unique external enquiry/message ID. Leave blank if you don't have one — do not enter generic labels like "whatsapp" or "email".
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={leadForm.control}
                  name="estimated_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Value (₹)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={leadForm.control}
                  name="expected_close_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Close Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Only show Assign To field for managers and admins */}
                {canAssignLeads && (
                  <FormField
                    control={leadForm.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Assign To</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select team member (optional - auto-assigns if empty)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {profiles?.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Customer Query
              </h3>
              <FormField
                control={leadForm.control}
                name="customer_query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Requirement Details</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter customer requirements, model numbers, specifications..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Customer
              </h3>
              
              <Tabs value={customerTab} onValueChange={(v) => setCustomerTab(v as 'existing' | 'new')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Existing Customer</TabsTrigger>
                  <TabsTrigger value="new">New Customer</TabsTrigger>
                </TabsList>
                
                <TabsContent value="existing" className="space-y-4">
                  <CustomerCombobox
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                    placeholder="Search and select customer..."
                    assignedSalesId={canAssignLeads ? undefined : user?.id}
                  />
                </TabsContent>

                <TabsContent value="new" className="space-y-4">
                  {/* Smart Duplicate Customer Warning */}
                  {duplicateCustomer && (
                    <DuplicateMatchAlert match={duplicateCustomer} />
                  )}

                  {isCheckingDuplicate && (
                    <Alert className="border-blue-500 bg-blue-500/10">
                      <Info className="h-4 w-4 text-blue-500 animate-pulse" />
                      <AlertDescription className="text-blue-700 dark:text-blue-400">
                        Checking for existing customer...
                      </AlertDescription>
                    </Alert>
                  )}

                  <Form {...customerForm}>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={customerForm.control}
                        name="company_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name *</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!!duplicateCustomer} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={customerForm.control}
                        name="contact_person"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Person</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!!duplicateCustomer} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={customerForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone *</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={customerForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} disabled={!!duplicateCustomer} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={customerForm.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!!duplicateCustomer} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={customerForm.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input {...field} disabled={!!duplicateCustomer} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Form>
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isCheckingDuplicate || isOrphaned}>
                {isCheckingDuplicate ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : duplicateCustomer && getMatchSeverity(duplicateCustomer.match_score) !== 'possible' ? (
                  'Create Lead (Link to Existing Customer)'
                ) : (
                  'Create Lead'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
