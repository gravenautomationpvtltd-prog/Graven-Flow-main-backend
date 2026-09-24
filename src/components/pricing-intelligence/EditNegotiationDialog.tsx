import { useEffect } from 'react';
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
import { useUpdateNegotiation, type ProductNegotiation } from '@/hooks/usePricingIntelligence';

const formSchema = z.object({
  initial_quoted_rate: z.number().min(0, 'Initial rate must be positive'),
  target_rate: z.number().nullable(),
  final_rate: z.number().nullable(),
  outcome: z.enum(['won', 'lost', 'pending']),
  notes: z.string().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditNegotiationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  negotiation: ProductNegotiation | null;
}

export function EditNegotiationDialog({
  open,
  onOpenChange,
  negotiation,
}: EditNegotiationDialogProps) {
  const updateNegotiation = useUpdateNegotiation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      initial_quoted_rate: 0,
      target_rate: null,
      final_rate: null,
      outcome: 'pending',
      notes: null,
    },
  });

  useEffect(() => {
    if (negotiation) {
      form.reset({
        initial_quoted_rate: negotiation.initial_quoted_rate,
        target_rate: negotiation.target_rate,
        final_rate: negotiation.final_rate,
        outcome: negotiation.outcome,
        notes: negotiation.notes,
      });
    }
  }, [negotiation, form]);

  const onSubmit = async (values: FormValues) => {
    if (!negotiation) return;

    await updateNegotiation.mutateAsync({
      id: negotiation.id,
      initial_quoted_rate: values.initial_quoted_rate,
      target_rate: values.target_rate,
      final_rate: values.final_rate,
      outcome: values.outcome,
      notes: values.notes,
    });
    onOpenChange(false);
  };

  if (!negotiation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Negotiation</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
          <p><strong>Lead:</strong> {negotiation.lead_title}</p>
          <p><strong>Customer:</strong> {negotiation.customer_name}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
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
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
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
                      value={field.value ?? ''}
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
              <Button type="submit" disabled={updateNegotiation.isPending}>
                {updateNegotiation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
