import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Plus, Megaphone, Pencil, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";

const emptyForm = { name: "", type: "email", subject: "", content: "" };

export default function BackendMarketing() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["backend-campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("marketing_campaigns").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name, type: form.type, subject: form.subject, content: form.content };
      if (editingCampaign) {
        const { error } = await supabase.from("marketing_campaigns").update(payload).eq("id", editingCampaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("marketing_campaigns").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-campaigns"] });
      setOpen(false);
      setEditingCampaign(null);
      setForm(emptyForm);
      toast.success(editingCampaign ? "Campaign updated" : "Campaign created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === 'sent') update.sent_at = new Date().toISOString();
      const { error } = await supabase.from("marketing_campaigns").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-campaigns"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-campaigns"] });
      setDeleteTarget(null);
      toast.success("Campaign deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (c: any) => {
    setEditingCampaign(c);
    setForm({ name: c.name, type: c.type, subject: c.subject || "", content: c.content || "" });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing Campaigns</h1>
          <p className="text-zinc-400 text-sm mt-1">{campaigns.length} campaigns</p>
        </div>
        <Button onClick={() => { setEditingCampaign(null); setForm(emptyForm); setOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />New Campaign
        </Button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Campaign</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Sent</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Created</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No campaigns yet</td></tr>
            ) : (
              campaigns.map((c: any) => (
                <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-4 w-4 text-zinc-400" />
                      <span className="text-white text-sm font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300 capitalize">{c.type}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      c.status === 'sent' || c.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                      c.status === 'scheduled' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-500/10 text-zinc-400'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{c.sent_count}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{format(new Date(c.created_at), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {c.status === 'draft' && (
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => updateStatusMutation.mutate({ id: c.id, status: 'sent' })}>
                          <Send className="h-3 w-3 text-emerald-400" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(c)}>
                        <Pencil className="h-3 w-3 text-zinc-400" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader><DialogTitle>{editingCampaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-zinc-300">Name</Label><Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            <div><Label className="text-zinc-300">Type</Label>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
                <option value="email">Email</option><option value="sms">SMS</option><option value="notification">Notification</option>
              </select>
            </div>
            <div><Label className="text-zinc-300">Subject</Label><Input value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            <div><Label className="text-zinc-300">Content</Label><textarea value={form.content} onChange={e => setForm(f => ({...f, content: e.target.value}))} rows={4} className="w-full rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm" /></div>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {editingCampaign ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">Delete <strong className="text-white">{deleteTarget?.name}</strong>?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
