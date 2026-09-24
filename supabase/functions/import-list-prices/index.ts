import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      bucket = 'list-price-imports',
      path,
      tenant_id,
      brand = 'Siemens',
      source_label,
      default_discount_pct = 60,
      uploaded_by = null,
    } = body ?? {};

    if (!path || !tenant_id || !source_label) {
      return new Response(JSON.stringify({ error: 'path, tenant_id, source_label required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: file, error: dlErr } = await admin.storage.from(bucket).download(path);
    if (dlErr || !file) throw new Error(`download failed: ${dlErr?.message}`);
    const rows: Array<{ model_number: string; description: string; hsn_code: string; list_price: number }> = JSON.parse(await file.text());

    /** Mirrors products.match_key: strips separators, folds O/0 and I/L/1. */
    const matchKey = (v: unknown) =>
      String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');

    const minMargin = Number(default_discount_pct);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const rejectedSamples: Array<{ model_number: string; reason: string; description: string }> = [];
    const CHUNK = 500;

    // Truncation guard — reject rows where the description is empty or a fragment.
    const isTruncated = (desc: string, model: string): { bad: boolean; reason: string } => {
      const d = (desc || '').replace(/\s+/g, ' ').trim();
      if (!d) return { bad: true, reason: 'empty' };
      if (/[,;:\-–(]\s*$/.test(d)) return { bad: true, reason: 'trailing punctuation' };
      if (/^[a-z]/.test(d)) return { bad: true, reason: 'starts lowercase (fragment)' };
      if (/^[,;:\-–)]/.test(d)) return { bad: true, reason: 'starts with punctuation' };
      if (d.length < 40 && !d.toUpperCase().includes((model || '').toUpperCase())) {
        return { bad: true, reason: 'too short' };
      }
      if (/^(display|interface|configurable|contains|provided|source|software|million|widescreen|touch|operation|neutral|front|flange)\b/i.test(d)) {
        return { bad: true, reason: 'starts mid-description' };
      }
      return { bad: false, reason: '' };
    };

    for (let i = 0; i < rows.length; i += CHUNK) {
      const raw = rows.slice(i, i + CHUNK).filter(r => r.model_number && r.list_price);
      const slice = raw.filter(r => {
        const check = isTruncated(r.description || '', r.model_number);
        if (check.bad) {
          skipped += 1;
          if (rejectedSamples.length < 25) {
            rejectedSamples.push({ model_number: r.model_number, reason: check.reason, description: (r.description || '').slice(0, 80) });
          }
          return false;
        }
        return true;
      });
      if (!slice.length) continue;

      // Resolve existing rows on the look-alike tolerant key so an O/0 typo in
      // the price file updates the product instead of creating a twin.
      const keys = Array.from(new Set(slice.map(r => matchKey(r.model_number)).filter(Boolean)));
      const { data: existing } = await admin
        .from('products')
        .select('id, model_number, name')
        .eq('tenant_id', tenant_id)
        .in('search_key', keys);
      const byKey = new Map<string, { id: string; model_number: string }>();
      for (const p of existing ?? []) byKey.set(matchKey(p.model_number || p.name), p as any);

      const payload = slice.map(r => {
        const prev = byKey.get(matchKey(r.model_number));
        return {
        ...(prev ? { id: prev.id } : {}),
        tenant_id,
        model_number: prev?.model_number ?? r.model_number.toUpperCase(),
        name: prev?.model_number ?? r.model_number.toUpperCase(),
        description: (r.description || r.model_number).replace(/\s+/g, ' ').trim(),
        hsn_code: r.hsn_code,
        list_price: r.list_price,
        list_price_source: source_label,
        list_price_updated_at: new Date().toISOString(),
        min_margin_pct: minMargin,
        brand,
        is_active: true,
        unit: 'Nos',
        tax_rate: 18,
        };
      });
      const { error, count } = await admin
        .from('products')
        .upsert(payload, { onConflict: 'tenant_id,model_number', ignoreDuplicates: false, count: 'exact' });
      if (error) {
        skipped += slice.length;
        console.error('chunk error', i, error.message);
      } else {
        inserted += count ?? slice.length;
      }
    }

    // Log the upload
    await admin.from('list_price_uploads').insert({
      tenant_id, brand, source_label,
      filename: path,
      storage_path: `${bucket}/${path}`,
      default_discount_pct: minMargin,
      rows_parsed: rows.length,
      rows_inserted: inserted,
      rows_updated: updated,
      rows_skipped: skipped,
      status: 'completed',
      uploaded_by,
    });

    return new Response(JSON.stringify({ ok: true, rows_parsed: rows.length, upserted: inserted, skipped, rejected_samples: rejectedSamples }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
