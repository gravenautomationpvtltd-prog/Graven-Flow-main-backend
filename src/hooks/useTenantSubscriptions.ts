import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantStatus } from './useTenantStatus';

interface TenantSubscription {
  id: string;
  plan_type: string;
  user_count: number;
  price_per_user: number;
  total_amount: number;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export function useTenantSubscriptions() {
  const { tenant } = useTenantStatus();
  const [subscriptions, setSubscriptions] = useState<TenantSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select('id, plan_type, user_count, price_per_user, total_amount, payment_status, razorpay_order_id, razorpay_payment_id, start_date, end_date, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSubscriptions(data as TenantSubscription[]);
      }
      setLoading(false);
    };

    fetch();
  }, [tenant?.id]);

  return { subscriptions, loading };
}
