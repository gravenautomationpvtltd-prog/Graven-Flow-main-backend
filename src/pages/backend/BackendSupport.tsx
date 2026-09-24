import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, MessageCircle } from "lucide-react";
import { useBackendAuth } from "@/hooks/useBackendAuth";

const STATUS_TABS = ["all", "open", "in_progress", "resolved", "closed"] as const;

export default function BackendSupport() {
  const queryClient = useQueryClient();
  const { user } = useBackendAuth();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["backend-support-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: replies = [] } = useQuery({
    queryKey: ["backend-ticket-replies", selectedTicket?.id],
    enabled: !!selectedTicket,
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_replies")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at");
      return data || [];
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ticket_replies").insert({
        ticket_id: selectedTicket.id,
        reply_by: user?.id,
        message: replyText,
        is_admin_reply: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-ticket-replies", selectedTicket?.id] });
      setReplyText("");
      toast.success("Reply sent");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-support-tickets"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: string }) => {
      const { error } = await supabase.from("support_tickets").update({ priority }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-support-tickets"] });
      toast.success("Priority updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = activeTab === "all" ? tickets : tickets.filter((t: any) => t.status === activeTab);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
        <p className="text-zinc-400 text-sm mt-1">{tickets.length} total · {tickets.filter((t: any) => t.status === "open").length} open</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Subject</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No tickets found</td></tr>
            ) : (
              filtered.map((ticket: any) => (
                <tr key={ticket.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer" onClick={() => setSelectedTicket(ticket)}>
                  <td className="px-4 py-3 text-sm text-white font-medium">{ticket.subject}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={ticket.priority}
                      onChange={(e) => updatePriorityMutation.mutate({ id: ticket.id, priority: e.target.value })}
                      className={`text-xs font-medium rounded px-2 py-0.5 bg-transparent border-0 cursor-pointer ${
                        ticket.priority === 'critical' ? 'text-red-400' :
                        ticket.priority === 'high' ? 'text-orange-400' :
                        ticket.priority === 'medium' ? 'text-amber-400' : 'text-zinc-400'
                      }`}
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </select>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={ticket.status}
                      onChange={(e) => updateStatusMutation.mutate({ id: ticket.id, status: e.target.value })}
                      className={`text-xs font-medium rounded px-2 py-0.5 bg-transparent border-0 cursor-pointer ${
                        ticket.status === 'open' ? 'text-blue-400' :
                        ticket.status === 'in_progress' ? 'text-amber-400' :
                        ticket.status === 'resolved' ? 'text-emerald-400' : 'text-zinc-400'
                      }`}
                    >
                      <option value="open">open</option>
                      <option value="in_progress">in_progress</option>
                      <option value="resolved">resolved</option>
                      <option value="closed">closed</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {format(new Date(ticket.created_at), "MMM d, yyyy")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="bg-zinc-800 rounded-lg p-4">
                <p className="text-sm text-zinc-300">{selectedTicket.description || "No description provided"}</p>
                <p className="text-xs text-zinc-500 mt-2">{format(new Date(selectedTicket.created_at), "MMM d, yyyy h:mm a")}</p>
              </div>

              {/* Replies thread */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Replies ({replies.length})
                </h3>
                {replies.map((reply: any) => (
                  <div key={reply.id} className={`rounded-lg p-3 ${reply.is_admin_reply ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-zinc-800'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-zinc-400">{reply.is_admin_reply ? 'Admin' : 'Tenant'}</span>
                      <span className="text-xs text-zinc-500">{format(new Date(reply.created_at), "MMM d, h:mm a")}</span>
                    </div>
                    <p className="text-sm text-zinc-300">{reply.message}</p>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <div className="flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type a reply..."
                  className="bg-zinc-800 border-zinc-700 text-white"
                  onKeyDown={(e) => e.key === 'Enter' && replyText.trim() && replyMutation.mutate()}
                />
                <Button
                  onClick={() => replyMutation.mutate()}
                  disabled={!replyText.trim() || replyMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
