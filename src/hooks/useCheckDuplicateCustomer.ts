import { supabase } from '@/integrations/supabase/client';
import { normalizePhone } from '@/lib/phone-utils';

export interface DuplicateCheckParams {
  phone: string;
  email?: string;
  company_name?: string;
  gst_number?: string;
  state?: string;
  city?: string;
  exclude_id?: string;
}

export interface DuplicateCustomer {
  id: string;
  company_name: string;
  phone: string;
  email: string | null;
  state: string | null;
  city: string | null;
  gst_number: string | null;
  assigned_sales_id: string | null;
  assigned_sales_name: string | null;
  match_score: number;
  match_reasons: string[];
}

// Score thresholds
export const MATCH_THRESHOLDS = {
  DEFINITE_DUPLICATE: 50,  // Score >= 50: Definite duplicate
  LIKELY_DUPLICATE: 30,    // Score 30-49: Likely duplicate
  POSSIBLE_MATCH: 10,      // Score 10-29: Possible match (warning only)
};

export function getMatchSeverity(score: number): 'definite' | 'likely' | 'possible' | 'none' {
  if (score >= MATCH_THRESHOLDS.DEFINITE_DUPLICATE) return 'definite';
  if (score >= MATCH_THRESHOLDS.LIKELY_DUPLICATE) return 'likely';
  if (score >= MATCH_THRESHOLDS.POSSIBLE_MATCH) return 'possible';
  return 'none';
}

// Legacy function for backward compatibility - returns single best match
export async function checkDuplicateCustomer(phone: string): Promise<DuplicateCustomer | null> {
  const matches = await checkDuplicateCustomerMulti({ phone });
  return matches.length > 0 ? matches[0] : null;
}

// New multi-parameter duplicate check function
export async function checkDuplicateCustomerMulti(
  params: DuplicateCheckParams
): Promise<DuplicateCustomer[]> {
  const normalizedPhone = normalizePhone(params.phone);
  
  // Call the database function for intelligent matching
  const { data, error } = await supabase.rpc('find_potential_duplicate_customer', {
    p_phone: normalizedPhone,
    p_email: params.email || null,
    p_company_name: params.company_name || null,
    p_gst_number: params.gst_number || null,
    p_state: params.state || null,
    p_city: params.city || null,
    p_exclude_id: params.exclude_id || null,
  });

  if (error) {
    console.error('Error checking duplicate customer:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((match: any) => ({
    id: match.customer_id,
    company_name: match.company_name,
    phone: match.phone,
    email: match.email,
    state: match.state,
    city: match.city,
    gst_number: match.gst_number,
    assigned_sales_id: match.assigned_sales_id,
    assigned_sales_name: match.assigned_sales_name,
    match_score: match.match_score,
    match_reasons: match.match_reasons || [],
  }));
}

// Batch check for multiple phones (used in imports)
export async function checkDuplicateCustomers(phones: string[]): Promise<Map<string, DuplicateCustomer>> {
  const duplicates = new Map<string, DuplicateCustomer>();
  
  // Fetch all existing customers in one query with sales person name
  const { data: existingCustomers, error } = await supabase
    .from('customers')
    .select(`
      id, 
      company_name, 
      phone, 
      email,
      state,
      city,
      gst_number,
      assigned_sales_id,
      assigned_sales:profiles!customers_assigned_sales_id_fkey(full_name)
    `);
    
  if (error || !existingCustomers) {
    console.error('Error fetching customers for duplicate check:', error);
    return duplicates;
  }
  
  // Create a map of normalized phones to customers
  const existingByPhone = new Map<string, DuplicateCustomer>();
  for (const customer of existingCustomers) {
    const normalized = normalizePhone(customer.phone);
    if (normalized.length >= 10) {
      const assignedSalesName = customer.assigned_sales && typeof customer.assigned_sales === 'object' && 'full_name' in customer.assigned_sales
        ? (customer.assigned_sales as { full_name: string }).full_name
        : null;
      
      existingByPhone.set(normalized, {
        id: customer.id,
        company_name: customer.company_name,
        phone: customer.phone,
        email: customer.email,
        state: customer.state,
        city: customer.city,
        gst_number: customer.gst_number,
        assigned_sales_id: customer.assigned_sales_id,
        assigned_sales_name: assignedSalesName,
        match_score: 50, // Phone match = 50 points
        match_reasons: ['Phone'],
      });
    }
  }
  
  // Check each provided phone against existing customers
  for (const phone of phones) {
    const normalized = normalizePhone(phone);
    if (normalized.length >= 10 && existingByPhone.has(normalized)) {
      duplicates.set(phone, existingByPhone.get(normalized)!);
    }
  }
  
  return duplicates;
}
