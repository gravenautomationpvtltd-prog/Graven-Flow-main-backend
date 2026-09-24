import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBackendAuth } from "@/hooks/useBackendAuth";
import { Shield, Save, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export default function BackendSettings() {
  const { user } = useBackendAuth();
  const queryClient = useQueryClient();
  const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["backend-platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*").order("setting_key");
      return data || [];
    },
  });

  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const getVal = (key: string) => {
    if (key in editValues) return editValues[key];
    const setting = settings.find((s) => s.setting_key === key);
    return setting?.setting_value || "";
  };

  const setVal = (key: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [key]: val }));
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(editValues)) {
        const { error } = await supabase
          .from("platform_settings")
          .update({ setting_value: value, updated_by: user?.id })
          .eq("setting_key", key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backend-platform-settings"] });
      setEditValues({});
      toast.success("Settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) throw new Error("Passwords don't match");
      if (passwordForm.newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      toast.success("Password changed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pricingKeys = [
    { key: "price_monthly", label: "Monthly (per user/month)" },
    { key: "price_half_yearly", label: "Half-Yearly (per user/month)" },
    { key: "price_annual", label: "Annual (per user/month)" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Manage platform-level configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admin Profile */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-white font-medium">Platform Admin</p>
              <p className="text-sm text-zinc-400">{user?.email}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
              <span className="text-sm text-zinc-300">Role</span>
              <span className="text-sm text-emerald-400 font-medium">platform_admin</span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Key className="h-4 w-4" /> Change Password</h2>
          <div className="space-y-3">
            <div>
              <Label className="text-zinc-300 text-xs">New Password</Label>
              <Input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm(f => ({...f, newPassword: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <Label className="text-zinc-300 text-xs">Confirm Password</Label>
              <Input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm(f => ({...f, confirmPassword: e.target.value}))} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <Button onClick={() => changePasswordMutation.mutate()} disabled={!passwordForm.newPassword || changePasswordMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 w-full">
              Update Password
            </Button>
          </div>
        </div>

        {/* Pricing Configuration */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-4">Pricing Configuration (₹)</h2>
          {isLoading ? (
            <p className="text-zinc-500 text-sm">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {pricingKeys.map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-zinc-300 text-xs">{label}</Label>
                    <Input type="number" value={getVal(key)} onChange={(e) => setVal(key, e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-zinc-300 text-xs">Trial Duration (days)</Label>
                  <Input type="number" value={getVal("trial_days")} onChange={(e) => setVal("trial_days", e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div>
                  <Label className="text-zinc-300 text-xs">Platform Name</Label>
                  <Input value={getVal("platform_name")} onChange={(e) => setVal("platform_name", e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
              </div>
              <Button
                onClick={() => saveSettingsMutation.mutate()}
                disabled={Object.keys(editValues).length === 0 || saveSettingsMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="h-4 w-4 mr-2" /> Save Settings
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
