import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@^3.23.8';
import { generateText, Output } from 'npm:ai@^7.0.37';
import pdfParse from 'npm:pdf-parse@1.1.1';
import { createLovableAiGatewayProvider } from '../_shared/ai-gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

const RequestSchema = z.object({
  bucket: z.string().min(1).default('list-price-imports'),
  path: z.string().min(1),
  tenant_id: z.string().uuid(),
  brand: z.string().min(1).default('Siemens'),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { bucket, path, brand } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: file, error: dlErr } = await admin.storage.from(bucket).download(path);
    if (dlErr || !file) {
      throw new Error(`download failed: ${dlErr?.message ?? 'unknown'}`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsedPdf = await pdfParse(bytes);
    const extractedText = parsedPdf.text ?? '';

    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY, undefined, { structuredOutputs: true });

    const schema = z.object({
      items: z.array(
        z.object({
          model_number: z.string(),
          description: z.string().nullable(),
          hsn_code: z.string().nullable(),
          list_price: z.number().nullable(),
        })
      ),
    });

    const { output } = await generateText({
      model: gateway('openai/gpt-5.5'),
      output: Output.object({ schema }),
      messages: [
        {
          role: 'user',
          content: `You extract product data from industrial price list PDFs. Return only the structured JSON requested.

Extract every product row from this ${brand} price list. For each row return: model_number (the article / MLFB / catalog number), description (full product description), hsn_code (HSN/SAC code if shown, otherwise null), and list_price (numeric list price in the currency shown, no currency symbols, commas removed; null if missing). Omit rows where the model number is clearly a section header or page footer. Return items in a JSON object under key "items".

--- PDF TEXT ---
${extractedText.slice(0, 120000)}`,
        },
      ],
    });

    const rows = (output?.items ?? []).filter(
      (r: any) => r.model_number && (r.list_price || r.list_price === 0),
    );

    return new Response(JSON.stringify({ ok: true, rows, count: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
