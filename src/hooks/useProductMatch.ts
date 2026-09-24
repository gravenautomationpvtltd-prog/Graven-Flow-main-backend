import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  normalizeModel,
  extractModelCandidates,
  modelSimilarity,
  confidenceFromScore,
} from '@/lib/model-normalize';

export interface ProductMatch {
  id: string;
  name: string;
  hsn_code: string | null;
  default_rate: number | null;
  unit: string | null;
  tax_rate: number | null;
  model_number?: string | null;
  brand?: string | null;
  description?: string | null;
  product_status?: string | null;
  list_price?: number | null;
  sales_price?: number | null;
  purchase_price?: number | null;
  sales_discount_pct?: number | null;
  purchase_discount_pct?: number | null;
  replacement_model_no?: string | null;
  /** 0-100 match score */
  score: number;
  confidence: 'high' | 'medium' | 'low';
}

const SELECT =
  'id, name, hsn_code, default_rate, unit, tax_rate, model_number, brand, description, product_status, list_price, sales_price, purchase_price, sales_discount_pct, purchase_discount_pct, replacement_model_no';

function scoreProduct(product: any, term: string): number {
  const target = normalizeModel(term);
  const model = normalizeModel(product.model_number);
  const name = normalizeModel(product.name);

  let best = 0;
  if (model) best = Math.max(best, modelSimilarity(target, model));
  if (name) best = Math.max(best, modelSimilarity(target, name));

  // A model number quoted inside a longer enquiry line is still a strong signal.
  for (const candidate of extractModelCandidates(term)) {
    const c = normalizeModel(candidate);
    if (!c) continue;
    if (model && c === model) return 100;
    if (model) best = Math.max(best, modelSimilarity(c, model));
  }

  if (best < 60 && product.description) {
    const desc = String(product.description).toLowerCase();
    if (term.trim().length >= 4 && desc.includes(term.trim().toLowerCase())) best = Math.max(best, 60);
  }
  return best;
}

/**
 * Finds catalogue matches for free-text enquiry lines.
 * Matching is by model number (normalised: case, spaces and dashes ignored),
 * then brand/name, then description, with a confidence band per match.
 */
export function useProductMatches(searchTerms: string[]) {
  const terms = searchTerms.map((t) => (t ?? '').trim()).filter(Boolean);

  return useQuery({
    queryKey: ['product-matches', terms],
    enabled: terms.length > 0,
    staleTime: 30000,
    queryFn: async () => {
      const matchMap: Record<string, ProductMatch[]> = {};
      if (!terms.length) return matchMap;

      for (const term of terms) {
        const candidates = new Map<string, any>();
        const probes = [term, ...extractModelCandidates(term)].slice(0, 4);

        for (const probe of probes) {
          const safe = probe.replace(/[%,()]/g, ' ').trim();
          if (safe.length < 2) continue;
          const like = `%${safe}%`;
          const filters = [
            `model_number.ilike.${like}`,
            `name.ilike.${like}`,
            `description.ilike.${like}`,
            `brand.ilike.${like}`,
          ];
          // Look-alike tolerant key (O/0, I/1, L/1, separators, case)
          const folded = normalizeModel(probe);
          if (folded.length >= 4) filters.push(`search_key.ilike.%${folded}%`);
          const { data, error } = await supabase
            .from('products')
            .select(SELECT)
            .or(filters.join(','))
            .limit(50);
          if (error) throw error;
          for (const p of data ?? []) candidates.set(p.id as string, p);
        }

        matchMap[term] = Array.from(candidates.values())
          .map((p) => {
            const score = scoreProduct(p, term);
            return { ...p, score, confidence: confidenceFromScore(score) } as ProductMatch;
          })
          .filter((m) => m.score >= 45)
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const aActive = a.product_status === 'active' ? 1 : 0;
            const bActive = b.product_status === 'active' ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            return (b.sales_price ?? b.default_rate ?? 0) > 0 ? 1 : -1;
          })
          .slice(0, 10);
      }

      return matchMap;
    },
  });
}

/** Single best match for one enquiry line, used for one-click quoting. */
export function useBestProductMatch(term: string | null | undefined) {
  const { data, ...rest } = useProductMatches(term ? [term] : []);
  const list = term ? data?.[term.trim()] ?? [] : [];
  return { ...rest, data: list[0] ?? null, alternatives: list.slice(1) };
}
