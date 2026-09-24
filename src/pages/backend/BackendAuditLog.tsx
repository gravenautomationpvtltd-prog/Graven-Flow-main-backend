import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Search, ClipboardList } from "lucide-react";
import { useState } from "react";

export default function BackendAuditLog() {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["backend-audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const filtered = logs.filter((l) =>
    l.description?.toLowerCase().includes(search.toLowerCase()) ||
    l.action_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.entity_type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-zinc-400 text-sm mt-1">Track all admin actions</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
        />
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Action</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Entity</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Description</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <ClipboardList className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No audit logs yet</p>
                  <p className="text-zinc-600 text-xs mt-1">Actions will be recorded here as you manage the platform</p>
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{log.action_type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300 capitalize">{log.entity_type}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400 max-w-xs truncate">{log.description}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{format(new Date(log.created_at), "MMM d, h:mm a")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
