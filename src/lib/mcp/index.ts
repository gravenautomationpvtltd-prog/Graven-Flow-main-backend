import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listLeadsTool from "./tools/list-leads";
import listCustomersTool from "./tools/list-customers";
import listOrdersTool from "./tools/list-orders";

// Direct Supabase issuer — never the .lovable.cloud proxy URL.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "graven-onedesk-mcp",
  title: "Graven OneDesk",
  version: "0.1.0",
  instructions:
    "Tools for Graven OneDesk (CRM + Procurement). Use `whoami` to verify connectivity, then `list_leads`, `list_customers`, and `list_sales_orders` for read access. All calls act as the signed-in user and respect tenant RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listLeadsTool, listCustomersTool, listOrdersTool],
});
