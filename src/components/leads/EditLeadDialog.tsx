import { useEffect } from 'react';
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
import { useUpdateLead } from '@/hooks/useLeads';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type LeadSource = Database['public']['Enums']['lead_source'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const leadSources: LeadSource[] = ['indiamart', 'justdial', 'tradeindia', 'whatsapp', 'email', 'website', 'referral', 'manual', 'cro_followup'];
const leadStatuses: LeadStatus[] = ['new', 'contacted', 'enquiry', 'no_enquiry', 'engaged', 'qualified', 'proposal', 'quoted', 'negotiation', 'won', 'lost'];

const editLeadSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  source: z.enum(['indiamart', 'justdial', 'tradeindia', 'whatsapp', 'email', 'website', 'referral', 'manual', 'cro_followup'] as const),
  source_reference: z.string().optional(),
  customer_query: z.string().optional(),
  estimated_value: z.number().min(0).optional(),
  assigned_to: z.string().optional(),
  expected_close_date: z.string().optional(),
  status: z.enum(['new', 'contacted', 'enquiry', 'no_enquiry', 'engaged', 'qualified', 'proposal', 'quoted', 'negotiation', 'won', 'lost'] as const),
});

type EditLeadFormData = z.infer<typeof editLeadSchema>;

interface Lead {
  id: string;
  title: string;
  source: LeadSource;
  source_reference: string | null;
  customer_query: string | null;
  estimated_value: number | null;
  assigned_to: string | null;
  expected_close_date: string | null;
  status: LeadStatus;
}

interface EditLeadDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditLeadDialog({ lead, open, onOpenChange }: EditLeadDialogProps) {
  const { user, isManager, isAdmin } = useAuth();
  const updateLead = useUpdateLead();
  const { data: profiles } = useProfiles();

  // Only managers and admins can change assignment
  const canAssignLeads = isManager || isAdmin;

  const form = useForm<EditLeadFormData>({
    resolver: zodResolver(editLeadSchema),
    defaultValues: {
      title: '',
      source: 'manual',
      status: 'new',
    },
  });

  // Populate form when lead changes
  useEffect(() => {
    if (lead) {
      form.reset({
        title: lead.title,
        source: lead.source,
        source_reference: lead.source_reference || '',
        customer_query: lead.customer_query || '',
        estimated_value: lead.estimated_value || undefined,
        assigned_to: lead.assigned_to || '',
        expected_close_date: lead.expected_close_date || '',
        status: lead.status,
      });
    }
  }, [lead, form]);

  const handleSubmit = async (data: EditLeadFormData) => {
    if (!lead) return;

    // Sales users cannot change assignment - preserve original
    const assignedTo = canAssignLeads
      ? (data.assigned_to || null)
      : lead.assigned_to;

    // Normalize source_reference
    const rawRef = data.source_reference?.trim() ?? '';
    const isGenericLabel = rawRef.toLowerCase() === data.source.toLowerCase();
    const normalizedSourceRef = (!rawRef || isGenericLabel) ? null : rawRef;

    // Diff payload: only send fields the user actually changed, so a reassignment
    // never silently overwrites other fields with null.
    const candidate: Record<string, unknown> = {
      title: data.title,
      source: data.source,
      source_reference: normalizedSourceRef,
      customer_query: data.customer_query || null,
      estimated_value: data.estimated_value ?? null,
      assigned_to: assignedTo,
      expected_close_date: data.expected_close_date || null,
      status: data.status,
    };
    const original: Record<string, unknown> = {
      title: lead.title,
      source: lead.source,
      source_reference: lead.source_reference,
      customer_query: lead.customer_query,
      estimated_value: lead.estimated_value,
      assigned_to: lead.assigned_to,
      expected_close_date: lead.expected_close_date,
      status: lead.status,
    };
    const updates: Record<string, unknown> = { id: lead.id };
    for (const k of Object.keys(candidate)) {
      if (candidate[k] !== original[k]) updates[k] = candidate[k];
    }
    if (Object.keys(updates).length === 1) {
      onOpenChange(false);
      return;
    }

    await updateLead.mutateAsync(updates as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Industrial Pump Requirement" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
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

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="source_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External Reference ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., IndiaMART Lead ID, WhatsApp message ID" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Optional. Must be a unique external enquiry/message ID. Leave blank if you don't have one.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estimated_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Value (₹)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
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
            </div>

            {/* Only show Assign To field for managers and admins */}
            {canAssignLeads && (
              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select team member" />
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

            <FormField
              control={form.control}
              name="customer_query"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Query</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter customer requirements, specifications..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateLead.isPending}>
                {updateLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
