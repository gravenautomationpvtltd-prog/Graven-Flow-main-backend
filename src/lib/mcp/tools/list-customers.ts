import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_customers",
  title: "List customers",
  description: "List customers visible to the signed-in user. Respects tenant RLS.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20),
    search: z.string().optional().describe("Match against company name, contact name, or phone."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = sb
      .from("customers")
      .select("id, company_name, contact_name, phone, email, city, state, owner_id, owner_locked, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (search) {
      q = q.or(
        `company_name.ilike.%${search}%,contact_name.ilike.%${search}%,phone.ilike.%${search}%`,
      );
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { customers: data ?? [], count: data?.length ?? 0 },
    };
  },
});
