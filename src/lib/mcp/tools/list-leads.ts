import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_leads",
  title: "List leads",
  description: "List leads visible to the signed-in user. Respects tenant RLS and ownership scoping.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("Max rows to return (1-100)."),
    status: z.string().optional().describe("Optional status filter (e.g. new, qualified, won, lost)."),
    search: z.string().optional().describe("Optional case-insensitive match against lead name or company."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ limit, status, search }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = sb
      .from("leads")
      .select("id, lead_number, name, company_name, phone, email, status, assigned_to, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (search) q = q.or(`name.ilike.%${search}%,company_name.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { leads: data ?? [], count: data?.length ?? 0 },
    };
  },
});
