import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface Row {
  brand: string;
  model_no: string;
  description: string;
  list_price: number | null;
  sales_discount_pct: number | null;
  purchase_discount_pct: number | null;
  sales_price: number | null;
  purchase_price: number | null;
  product_status: 'active' | 'discontinued' | 'obsolete';
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
}

const CHUNK = 500;
const same = (a: unknown, b: unknown) =>
  (a === null || a === undefined ? null : Number(a)) === (b === null || b === undefined ? null : Number(b));

/** Folds look-alike characters, mirrors products.match_key in the database. */
const fold = (v: string) => v.replace(/O/g, '0').replace(/[IL]/g, '1');
const normModel = (v: unknown) => fold(String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
const normBrand = (v: unknown) => fold(String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
/** Product identity = Brand + Model No, both look-alike tolerant. */
const identity = (brand: unknown, model: unknown) => `${normBrand(brand)}|${normModel(model)}`;

async function processRun(
  admin: ReturnType<typeof createClient>,
  runId: string,
  tenantId: string,
  rows: Row[],
  sourceLabel: string,
  uploadedBy: string | null,
) {
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let errored = 0;
  let processed = 0;
  const errorRows: Array<{ model_no: string; error: string }> = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const matchKeys = Array.from(new Set(slice.map((r) => normModel(r.model_no)).filter(Boolean)));

    const { data: existing } = await admin
      .from('products')
      .select('id, name, model_number, brand, description, list_price, sales_discount_pct, purchase_discount_pct, sales_price, purchase_price, product_status, hsn_code, unit, tax_rate, weight_kg, length_cm, width_cm, height_cm')
      .eq('tenant_id', tenantId)
      .in('search_key', matchKeys);

    // Identity is Brand + Model No; model-only is a fallback for legacy rows without a brand.
    const byIdentity = new Map<string, any>();
    const byModel = new Map<string, any>();
    for (const p of existing ?? []) {
      byIdentity.set(identity(p.brand, p.model_number || p.name), p);
      byModel.set(normModel(p.model_number || p.name), p);
    }

    const nowIso = new Date().toISOString();
    const payload: any[] = [];
    const versionSeeds: Array<{ model: string; prev: any; row: Row }> = [];

    for (const r of slice) {
      const key = r.model_no.toUpperCase();
      const prev = byIdentity.get(identity(r.brand, r.model_no)) ?? byModel.get(normModel(r.model_no));
      const changed =
        !prev ||
        !same(prev.list_price, r.list_price) ||
        !same(prev.sales_discount_pct, r.sales_discount_pct) ||
        !same(prev.purchase_discount_pct, r.purchase_discount_pct) ||
        !same(prev.sales_price, r.sales_price) ||
        !same(prev.purchase_price, r.purchase_price) ||
        prev.product_status !== r.product_status;

      if (!prev) created += 1;
      else if (changed) updated += 1;
      else unchanged += 1;

      payload.push({
        ...(prev ? { id: prev.id } : {}),
        tenant_id: tenantId,
        name: prev?.name || key,
        // Keep the model number exactly as the catalogue already stores it;
        // only new products take the spelling from the upload file.
        model_number: prev?.model_number ?? key,
        brand: r.brand,
        description: r.description,
        product_status: r.product_status,
        list_price: r.list_price ?? prev?.list_price ?? null,
        sales_discount_pct: r.sales_discount_pct ?? null,
        purchase_discount_pct: r.purchase_discount_pct ?? null,
        sales_price: r.sales_price ?? null,
        purchase_price: r.purchase_price ?? null,
        default_rate: r.sales_price ?? prev?.sales_price ?? prev?.default_rate ?? null,
        list_price_source: sourceLabel,
        list_price_updated_at: nowIso,
        price_updated_at: nowIso,
        price_updated_by: uploadedBy,
        is_active: true,
        unit: prev?.unit ?? 'Nos',
        tax_rate: prev?.tax_rate ?? 18,
        // Logistics — canonical KG / CM, kept when the file omits them.
        weight_kg: r.weight_kg ?? prev?.weight_kg ?? null,
        length_cm: r.length_cm ?? prev?.length_cm ?? null,
        width_cm: r.width_cm ?? prev?.width_cm ?? null,
        height_cm: r.height_cm ?? prev?.height_cm ?? null,
      });

      if (changed) versionSeeds.push({ model: normModel(r.model_no), prev, row: r });
    }

    const { data: upserted, error } = await admin
      .from('products')
      .upsert(payload, { onConflict: 'tenant_id,model_number' })
      .select('id, model_number');

    if (error) {
      errored += slice.length;
      if (errorRows.length < 500) errorRows.push({ model_no: slice[0]?.model_no ?? '', error: error.message });
      console.error('chunk failed', i, error.message);
    } else {
      const idByModel = new Map<string, string>();
      for (const p of upserted ?? []) idByModel.set(normModel(p.model_number), p.id as string);

      const versions = versionSeeds
        .filter((v) => idByModel.has(v.model))
        .map((v) => ({
          tenant_id: tenantId,
          product_id: idByModel.get(v.model)!,
          old_list_price: v.prev?.list_price ?? null,
          new_list_price: v.row.list_price,
          old_sales_discount_pct: v.prev?.sales_discount_pct ?? null,
          new_sales_discount_pct: v.row.sales_discount_pct,
          old_purchase_discount_pct: v.prev?.purchase_discount_pct ?? null,
          new_purchase_discount_pct: v.row.purchase_discount_pct,
          old_sales_price: v.prev?.sales_price ?? null,
          new_sales_price: v.row.sales_price,
          old_purchase_price: v.prev?.purchase_price ?? null,
          new_purchase_price: v.row.purchase_price,
          source_label: sourceLabel,
          import_run_id: runId,
          created_by: uploadedBy,
        }));

      if (versions.length) {
        const { error: vErr } = await admin.from('product_price_versions').insert(versions);
        if (vErr) console.error('price version insert failed', vErr.message);
      }
    }

    processed += slice.length;
    await admin
      .from('product_import_runs')
      .update({ rows_processed: processed, rows_new: created, rows_updated: updated, rows_unchanged: unchanged, rows_errored: errored })
      .eq('id', runId);
  }

  await admin
    .from('product_import_runs')
    .update({
      status: 'completed',
      rows_processed: processed,
      rows_new: created,
      rows_updated: updated,
      rows_unchanged: unchanged,
      rows_errored: errored,
      error_rows: errorRows,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      run_id,
      tenant_id,
      bucket = 'product-imports',
      path,
      source_label = 'CSV import',
      uploaded_by = null,
    } = body ?? {};

    if (!run_id || !tenant_id || !path) {
      return new Response(JSON.stringify({ error: 'run_id, tenant_id and path are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: file, error: dlErr } = await admin.storage.from(bucket).download(path);
    if (dlErr || !file) throw new Error(`download failed: ${dlErr?.message}`);

    const rows: Row[] = JSON.parse(await file.text());

    await admin
      .from('product_import_runs')
      .update({ status: 'processing', rows_parsed: rows.length, rows_processed: 0 })
      .eq('id', run_id);

    const work = processRun(admin, run_id, tenant_id, rows, source_label, uploaded_by).catch(async (e) => {
      console.error(e);
      await admin
        .from('product_import_runs')
        .update({ status: 'failed', error_message: String(e?.message ?? e), completed_at: new Date().toISOString() })
        .eq('id', run_id);
    });

    // Keep processing after the response so very large files don't time out.
    // @ts-ignore EdgeRuntime is available in the Supabase runtime
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work);
    else await work;

    return new Response(JSON.stringify({ ok: true, run_id, rows_parsed: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
