import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCreateNegotiation } from '@/hooks/usePricingIntelligence';
import { ProductSearchCombobox } from '@/components/leads/ProductSearchCombobox';

// Simple leads hook for this component
function useSimpleLeads() {
  return useQuery({
    queryKey: ['simple-leads-for-negotiation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, title, customer:customers(company_name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}

const formSchema = z.object({
  lead_id: z.string().min(1, 'Lead is required'),
  product_id: z.string().min(1, 'Product is required'),
  product_name: z.string().min(1, 'Product name is required'),
  initial_quoted_rate: z.number().min(0, 'Initial rate must be positive'),
  target_rate: z.number().optional(),
  final_rate: z.number().optional(),
  outcome: z.enum(['won', 'lost', 'pending']),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RecordNegotiationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordNegotiationDialog({
  open,
  onOpenChange,
}: RecordNegotiationDialogProps) {
  const [productSearch, setProductSearch] = useState('');
  const { data: leads } = useSimpleLeads();
  const createNegotiation = useCreateNegotiation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lead_id: '',
      product_id: '',
      product_name: '',
      initial_quoted_rate: 0,
      target_rate: undefined,
      final_rate: undefined,
      outcome: 'pending',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset();
      setProductSearch('');
    }
  }, [open, form]);

  const onSubmit = async (values: FormValues) => {
    await createNegotiation.mutateAsync({
      lead_id: values.lead_id,
      product_id: values.product_id,
      product_name: values.product_name,
      initial_quoted_rate: values.initial_quoted_rate,
      target_rate: values.target_rate,
      final_rate: values.final_rate,
      outcome: values.outcome,
      notes: values.notes,
    });
    onOpenChange(false);
  };

  const handleProductSelect = (product: { id: string; name: string }) => {
    form.setValue('product_id', product.id);
    form.setValue('product_name', product.name);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Negotiation</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lead_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select lead" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leads?.map((lead: any) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.title} - {lead.customer?.company_name}
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
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product *</FormLabel>
                  <ProductSearchCombobox
                    onSelect={handleProductSelect}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="initial_quoted_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Rate *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="target_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="final_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Final Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="outcome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outcome</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select outcome" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes about this negotiation..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createNegotiation.isPending}>
                {createNegotiation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
