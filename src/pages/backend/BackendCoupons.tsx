import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Plus, Ticket, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const emptyForm = { code: "", description: "", discount_type: "percentage", discount_value: "10", max_uses: "" };

export default function BackendCoupons() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["backend-coupons"],
    queryFn: async () => {
      const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.toUpperCase(),
        description: form.description,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
      };
      if (editingCoupon) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editingCoupon.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-coupons"] });
      setOpen(false);
      setEditingCoupon(null);
      setForm(emptyForm);
      toast.success(editingCoupon ? "Coupon updated" : "Coupon created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("coupons").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-coupons"] });
      toast.success("Coupon status toggled");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-coupons"] });
      setDeleteTarget(null);
      toast.success("Coupon deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (coupon: any) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      max_uses: coupon.max_uses ? String(coupon.max_uses) : "",
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditingCoupon(null);
    setForm(emptyForm);
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Coupons</h1>
          <p className="text-zinc-400 text-sm mt-1">{coupons.length} coupons</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />New Coupon
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? <p className="text-zinc-500">Loading...</p> : coupons.length === 0 ? <p className="text-zinc-500">No coupons yet</p> :
          coupons.map((c: any) => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <Ticket className="h-5 w-5 text-emerald-400" />
                <span className="font-mono font-bold text-white">{c.code}</span>
                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: c.id, is_active: checked })}
                  />
                </div>
              </div>
              <p className="text-sm text-zinc-400">{c.description || "No description"}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <div className="flex gap-4">
                  <span>{c.discount_value}{c.discount_type === 'percentage' ? '%' : '₹'} off</span>
                  <span>{c.current_uses}/{c.max_uses || '∞'} used</span>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(c)}>
                    <Pencil className="h-3 w-3 text-zinc-400" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader><DialogTitle>{editingCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-zinc-300">Code</Label><Input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            <div><Label className="text-zinc-300">Description</Label><Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-zinc-300">Type</Label>
                <select value={form.discount_type} onChange={e => setForm(f => ({...f, discount_type: e.target.value}))} className="w-full h-10 rounded-md bg-zinc-800 border border-zinc-700 text-white px-3 text-sm">
                  <option value="percentage">Percentage</option><option value="fixed">Fixed</option>
                </select>
              </div>
              <div><Label className="text-zinc-300">Value</Label><Input type="number" value={form.discount_value} onChange={e => setForm(f => ({...f, discount_value: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            </div>
            <div><Label className="text-zinc-300">Max Uses (optional)</Label><Input type="number" value={form.max_uses} onChange={e => setForm(f => ({...f, max_uses: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.code || saveMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {editingCoupon ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">Delete coupon <strong className="text-white">{deleteTarget?.code}</strong>?</AlertDialogDescription>
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
