import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Check, X, Clock, ShoppingCart, DollarSign, UserPlus, Calendar } from 'lucide-react';

export function ApprovalsHub() {
  const queryClient = useQueryClient();

  // Fetch pending POs
  const { data: pendingPOs, isLoading: loadingPOs } = useQuery({
    queryKey: ['pending-pos-approval'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(company_name)')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch pending payroll runs
  const { data: pendingPayroll, isLoading: loadingPayroll } = useQuery({
    queryKey: ['pending-payroll-approval'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch pending vendor registrations
  const { data: pendingVendors, isLoading: loadingVendors } = useQuery({
    queryKey: ['pending-vendors-approval'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // Fetch pending leave requests
  const { data: pendingLeaves, isLoading: loadingLeaves } = useQuery({
    queryKey: ['pending-leaves-approval'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*, profile:profiles(full_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  // PO approval mutation
  const approvePOMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: approved ? 'approved' : 'rejected',
          approved_at: approved ? new Date().toISOString() : null
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      toast.success(`PO ${approved ? 'approved' : 'rejected'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['pending-pos-approval'] });
    }
  });

  // Payroll approval mutation
  const approvePayrollMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from('payroll_runs')
        .update({ 
          status: approved ? 'approved' : 'rejected',
          approved_at: approved ? new Date().toISOString() : null
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      toast.success(`Payroll ${approved ? 'approved' : 'rejected'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['pending-payroll-approval'] });
    }
  });

  // Vendor approval mutation
  const approveVendorMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ status: approved ? 'approved' : 'rejected' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      toast.success(`Vendor ${approved ? 'approved' : 'rejected'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['pending-vendors-approval'] });
    }
  });

  // Leave approval mutation
  const approveLeaveMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ 
          status: approved ? 'approved' : 'rejected',
          approved_at: approved ? new Date().toISOString() : null
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { approved }) => {
      toast.success(`Leave request ${approved ? 'approved' : 'rejected'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['pending-leaves-approval'] });
    }
  });

  const getAgingBadge = (createdAt: string) => {
    const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (hours < 24) return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Fresh</Badge>;
    if (hours < 48) return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">24h+</Badge>;
    return <Badge variant="destructive">48h+</Badge>;
  };

  const isLoading = loadingPOs || loadingPayroll || loadingVendors || loadingLeaves;

  const totalPending = (pendingPOs?.length || 0) + (pendingPayroll?.length || 0) + 
                       (pendingVendors?.length || 0) + (pendingLeaves?.length || 0);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {totalPending === 0 ? (
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">All Clear!</h3>
            <p className="text-muted-foreground">No pending approvals at the moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Purchase Orders */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Purchase Orders</CardTitle>
                </div>
                <Badge variant="secondary">{pendingPOs?.length || 0}</Badge>
              </div>
              <CardDescription>Pending PO approvals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {pendingPOs?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending POs</p>
              ) : (
                pendingPOs?.map((po: any) => (
                  <div key={po.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{po.po_number}</span>
                        {getAgingBadge(po.created_at)}
                      </div>
                      <p className="text-sm text-muted-foreground">{po.supplier?.company_name}</p>
                      <p className="text-sm font-semibold">₹{po.total_amount?.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => approvePOMutation.mutate({ id: po.id, approved: false })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => approvePOMutation.mutate({ id: po.id, approved: true })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Payroll Runs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Payroll Runs</CardTitle>
                </div>
                <Badge variant="secondary">{pendingPayroll?.length || 0}</Badge>
              </div>
              <CardDescription>Pending payroll approvals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {pendingPayroll?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending payrolls</p>
              ) : (
                pendingPayroll?.map((payroll: any) => (
                  <div key={payroll.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{new Date(payroll.year, payroll.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
                        {getAgingBadge(payroll.created_at)}
                      </div>
                      <p className="text-sm text-muted-foreground">{payroll.total_employees} employees</p>
                      <p className="text-sm font-semibold">₹{payroll.total_net?.toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => approvePayrollMutation.mutate({ id: payroll.id, approved: false })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => approvePayrollMutation.mutate({ id: payroll.id, approved: true })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Vendor Registrations */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Vendor Registrations</CardTitle>
                </div>
                <Badge variant="secondary">{pendingVendors?.length || 0}</Badge>
              </div>
              <CardDescription>Pending vendor approvals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {pendingVendors?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending vendors</p>
              ) : (
                pendingVendors?.map((vendor: any) => (
                  <div key={vendor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{vendor.company_name}</span>
                        {getAgingBadge(vendor.created_at)}
                      </div>
                      <p className="text-sm text-muted-foreground">{vendor.contact_person}</p>
                      <p className="text-xs text-muted-foreground">{vendor.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => approveVendorMutation.mutate({ id: vendor.id, approved: false })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => approveVendorMutation.mutate({ id: vendor.id, approved: true })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Leave Requests */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Leave Requests</CardTitle>
                </div>
                <Badge variant="secondary">{pendingLeaves?.length || 0}</Badge>
              </div>
              <CardDescription>Pending leave approvals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-80 overflow-y-auto">
              {pendingLeaves?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No pending leaves</p>
              ) : (
                pendingLeaves?.map((leave: any) => (
                  <div key={leave.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{leave.profile?.full_name}</span>
                        {getAgingBadge(leave.created_at)}
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">{leave.leave_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => approveLeaveMutation.mutate({ id: leave.id, approved: false })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => approveLeaveMutation.mutate({ id: leave.id, approved: true })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
