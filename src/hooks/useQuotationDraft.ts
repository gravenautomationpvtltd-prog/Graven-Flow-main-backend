import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

// Helper function to validate UUIDs
function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export interface QuotationDraftItem {
  id: string;
  description: string;
  hsn_code: string;
  quantity: number;
  rate: number;
  unit: string;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  amount: number;
  sort_order: number;
  product_id?: string | null;
}

export interface QuotationDraft {
  subject: string;
  notes: string;
  termsConditions: string;
  validityDays: number;
  currency: string;
  exchangeRate: number;
  items: QuotationDraftItem[];
  savedAt: string;
}

// Sanitize draft items to clear invalid product_ids that could cause FK errors
export function sanitizeDraftItems(items: QuotationDraftItem[]): QuotationDraftItem[] {
  return items.map(item => ({
    ...item,
    // Only keep product_id if it's a valid UUID format
    product_id: isValidUUID(item.product_id) ? item.product_id : null
  }));
}

const DRAFT_KEY_PREFIX = 'quotation_draft_';

export function useQuotationDraft(leadId: string | undefined) {
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const getDraftKey = useCallback(() => {
    return leadId ? `${DRAFT_KEY_PREFIX}${leadId}` : null;
  }, [leadId]);

  // Check for existing draft on mount
  useEffect(() => {
    const key = getDraftKey();
    if (!key) return;

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const draft = JSON.parse(saved) as QuotationDraft;
        setHasDraft(true);
        setLastSaved(new Date(draft.savedAt));
      } else {
        setHasDraft(false);
        setLastSaved(null);
      }
    } catch {
      setHasDraft(false);
      setLastSaved(null);
    }
  }, [getDraftKey]);

  const saveDraft = useCallback((draft: Omit<QuotationDraft, 'savedAt'>) => {
    const key = getDraftKey();
    if (!key) return;

    // Only save if there are items
    if (!draft.items || draft.items.length === 0) {
      return;
    }

    try {
      const draftWithTimestamp: QuotationDraft = {
        ...draft,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(draftWithTimestamp));
      setHasDraft(true);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }, [getDraftKey]);

  const loadDraft = useCallback((): QuotationDraft | null => {
    const key = getDraftKey();
    if (!key) return null;

    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return JSON.parse(saved) as QuotationDraft;
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
    return null;
  }, [getDraftKey]);

  const clearDraft = useCallback(() => {
    const key = getDraftKey();
    if (!key) return;

    try {
      localStorage.removeItem(key);
      setHasDraft(false);
      setLastSaved(null);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [getDraftKey]);

  const restoreDraft = useCallback((): QuotationDraft | null => {
    const draft = loadDraft();
    if (draft) {
      toast.success('Draft restored', {
        description: `Last saved ${new Date(draft.savedAt).toLocaleString()}`
      });
    }
    return draft;
  }, [loadDraft]);

  return {
    hasDraft,
    lastSaved,
    saveDraft,
    loadDraft,
    clearDraft,
    restoreDraft
  };
}
