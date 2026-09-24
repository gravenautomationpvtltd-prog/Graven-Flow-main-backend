import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface OverridePricingParams {
  customerId: string;
  customerName: string;
  previousDiscount: number;
  newDiscount: number;
  reason?: string;
  notes?: string;
}

interface ChangeCreditTermsParams {
  customerId: string;
  customerName: string;
  previousCreditLimit: number | null;
  previousPaymentDays: number;
  newCreditLimit: number | null;
  newPaymentDays: number;
  reason?: string;
  notes?: string;
}

interface FreezeEntityParams {
  entityType: 'customer' | 'product';
  entityId: string;
  entityName: string;
  freeze: boolean;
  reason?: string;
  notes?: string;
}

interface SetPriorityParams {
  customerId: string;
  customerName: string;
  isPriority: boolean;
  reason?: string;
  notes?: string;
}

export function useOverridePricing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: OverridePricingParams) => {
      // Update customer
      const { error: updateError } = await supabase
        .from('customers')
        .update({ special_discount_pct: params.newDiscount })
        .eq('id', params.customerId);

      if (updateError) throw updateError;

      // Log action
      const { error: logError } = await supabase
        .from('executive_actions_log')
        .insert({
          action_type: 'override_pricing',
          entity_type: 'customer',
          entity_id: params.customerId,
          performed_by: user?.id,
          previous_value: { special_discount_pct: params.previousDiscount },
          new_value: { special_discount_pct: params.newDiscount },
          reason: params.reason,
          notes: params.notes,
        });

      if (logError) throw logError;

      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-intelligence'] });
      toast.success(`Pricing override applied to ${params.customerName}`);
    },
    onError: (error) => {
      console.error('Failed to override pricing:', error);
      toast.error('Failed to apply pricing override');
    },
  });
}

export function useChangeCreditTerms() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: ChangeCreditTermsParams) => {
      // Update customer
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          credit_limit: params.newCreditLimit,
          payment_days: params.newPaymentDays,
        })
        .eq('id', params.customerId);

      if (updateError) throw updateError;

      // Log action
      const { error: logError } = await supabase
        .from('executive_actions_log')
        .insert({
          action_type: 'change_credit_terms',
          entity_type: 'customer',
          entity_id: params.customerId,
          performed_by: user?.id,
          previous_value: {
            credit_limit: params.previousCreditLimit,
            payment_days: params.previousPaymentDays,
          },
          new_value: {
            credit_limit: params.newCreditLimit,
            payment_days: params.newPaymentDays,
          },
          reason: params.reason,
          notes: params.notes,
        });

      if (logError) throw logError;

      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-intelligence'] });
      toast.success(`Credit terms updated for ${params.customerName}`);
    },
    onError: (error) => {
      console.error('Failed to change credit terms:', error);
      toast.error('Failed to update credit terms');
    },
  });
}

export function useFreezeEntity() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: FreezeEntityParams) => {
      const table = params.entityType === 'customer' ? 'customers' : 'products';
      
      // Update entity
      const { error: updateError } = await supabase
        .from(table)
        .update({ is_frozen: params.freeze })
        .eq('id', params.entityId);

      if (updateError) throw updateError;

      // Log action
      const { error: logError } = await supabase
        .from('executive_actions_log')
        .insert({
          action_type: params.freeze 
            ? (params.entityType === 'customer' ? 'freeze_customer' : 'freeze_sku')
            : (params.entityType === 'customer' ? 'unfreeze_customer' : 'unfreeze_sku'),
          entity_type: params.entityType,
          entity_id: params.entityId,
          performed_by: user?.id,
          previous_value: { is_frozen: !params.freeze },
          new_value: { is_frozen: params.freeze },
          reason: params.reason,
          notes: params.notes,
        });

      if (logError) throw logError;

      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({ queryKey: [params.entityType === 'customer' ? 'customers' : 'products'] });
      queryClient.invalidateQueries({ queryKey: ['customer-intelligence'] });
      queryClient.invalidateQueries({ queryKey: ['sku-intelligence'] });
      const action = params.freeze ? 'frozen' : 'unfrozen';
      toast.success(`${params.entityName} has been ${action}`);
    },
    onError: (error) => {
      console.error('Failed to freeze/unfreeze entity:', error);
      toast.error('Failed to update freeze status');
    },
  });
}

export function useSetPriority() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: SetPriorityParams) => {
      // Update customer
      const { error: updateError } = await supabase
        .from('customers')
        .update({ is_priority: params.isPriority })
        .eq('id', params.customerId);

      if (updateError) throw updateError;

      // Log action
      const { error: logError } = await supabase
        .from('executive_actions_log')
        .insert({
          action_type: params.isPriority ? 'set_priority' : 'remove_priority',
          entity_type: 'customer',
          entity_id: params.customerId,
          performed_by: user?.id,
          previous_value: { is_priority: !params.isPriority },
          new_value: { is_priority: params.isPriority },
          reason: params.reason,
          notes: params.notes,
        });

      if (logError) throw logError;

      return params;
    },
    onSuccess: (params) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-intelligence'] });
      const action = params.isPriority ? 'marked as priority' : 'removed from priority';
      toast.success(`${params.customerName} has been ${action}`);
    },
    onError: (error) => {
      console.error('Failed to set priority:', error);
      toast.error('Failed to update priority status');
    },
  });
}
