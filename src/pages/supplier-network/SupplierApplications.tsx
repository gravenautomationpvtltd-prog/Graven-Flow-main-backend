import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, MoreHorizontal, Eye, CheckCircle, XCircle, Clock, AlertTriangle, UserPlus, ExternalLink, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ReviewSupplierApplicationDialog } from '@/components/supplier-network/ReviewSupplierApplicationDialog';
import { ViewSupplierApplicationDialog } from '@/components/supplier-network/ViewSupplierApplicationDialog';

type ApplicationStatus = 'submitted' | 'under_technical_review' | 'under_commercial_review' | 'approved' | 'rejected' | 'on_hold';

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  application_status: ApplicationStatus | null;
  manufacturing_type: string | null;
  years_in_operation: number | null;
  risk_flag: string | null;
  assigned_manager_id: string | null;
  created_at: string;
  nda_accepted_at: string | null;
  gst_number: string | null;
  city: string | null;
  [key: string]: unknown;
}

export default function SupplierApplications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['supplier-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: managers = [] } = useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ApplicationStatus }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ 
          application_status: status,
          ...(status === 'under_technical_review' && { technical_review_at: new Date().toISOString(), technical_reviewed_by: profile?.id }),
          ...(status === 'under_commercial_review' && { commercial_review_at: new Date().toISOString(), commercial_reviewed_by: profile?.id }),
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-applications'] });
      toast.success('Status updated successfully');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const assignManagerMutation = useMutation({
    mutationFn: async ({ id, managerId }: { id: string; managerId: string }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ assigned_manager_id: managerId })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-applications'] });
      toast.success('Manager assigned successfully');
    },
    onError: () => {
      toast.error('Failed to assign manager');
    },
  });

  const updateRiskFlagMutation = useMutation({
    mutationFn: async ({ id, riskFlag }: { id: string; riskFlag: string | null }) => {
      const { error } = await supabase
        .from('suppliers')
        .update({ risk_flag: riskFlag })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-applications'] });
      toast.success('Risk flag updated');
    },
    onError: () => {
      toast.error('Failed to update risk flag');
    },
  });

  const getFilteredSuppliers = () => {
    let filtered = suppliers;
    
    if (activeTab !== 'all') {
      filtered = filtered.filter(s => s.application_status === activeTab);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        s.country?.toLowerCase().includes(query) ||
        s.city?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const getStatusBadge = (status: ApplicationStatus | null) => {
    const config: Record<ApplicationStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      submitted: { label: 'Submitted', variant: 'secondary' },
      under_technical_review: { label: 'Technical Review', variant: 'outline' },
      under_commercial_review: { label: 'Commercial Review', variant: 'outline' },
      approved: { label: 'Approved', variant: 'default' },
      rejected: { label: 'Rejected', variant: 'destructive' },
      on_hold: { label: 'On Hold', variant: 'secondary' },
    };
    
    const statusConfig = config[status || 'submitted'];
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const getRiskBadge = (risk: string | null) => {
    if (!risk) return null;
    const config: Record<string, { label: string; className: string }> = {
      low: { label: 'Low Risk', className: 'bg-green-100 text-green-800' },
      medium: { label: 'Medium Risk', className: 'bg-yellow-100 text-yellow-800' },
      high: { label: 'High Risk', className: 'bg-red-100 text-red-800' },
    };
    const riskConfig = config[risk];
    return <Badge className={riskConfig?.className}>{riskConfig?.label}</Badge>;
  };

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return '-';
    const manager = managers.find(m => m.id === managerId);
    return manager?.full_name || '-';
  };

  const copyRegistrationLink = () => {
    const link = `${window.location.origin}/supplier-register`;
    navigator.clipboard.writeText(link);
    toast.success('Registration link copied to clipboard');
  };

  const filteredSuppliers = getFilteredSuppliers();

  const tabCounts = {
    all: suppliers.length,
    submitted: suppliers.filter(s => s.application_status === 'submitted').length,
    under_technical_review: suppliers.filter(s => s.application_status === 'under_technical_review').length,
    under_commercial_review: suppliers.filter(s => s.application_status === 'under_commercial_review').length,
    approved: suppliers.filter(s => s.application_status === 'approved').length,
    rejected: suppliers.filter(s => s.application_status === 'rejected').length,
    on_hold: suppliers.filter(s => s.application_status === 'on_hold').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Supplier Applications</h1>
          <p className="text-muted-foreground">Review and manage supplier registration applications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyRegistrationLink}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Registration Link
          </Button>
          <Button variant="outline" onClick={() => window.open('/supplier-register', '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View Portal
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Applications</CardTitle>
              <CardDescription>All supplier registration applications and their current status</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, country..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
              <TabsTrigger value="submitted">Submitted ({tabCounts.submitted})</TabsTrigger>
              <TabsTrigger value="under_technical_review">Technical ({tabCounts.under_technical_review})</TabsTrigger>
              <TabsTrigger value="under_commercial_review">Commercial ({tabCounts.under_commercial_review})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({tabCounts.approved})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({tabCounts.rejected})</TabsTrigger>
              <TabsTrigger value="on_hold">On Hold ({tabCounts.on_hold})</TabsTrigger>
            </TabsList>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier ID</TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading applications...
                      </TableCell>
                    </TableRow>
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No applications found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <TableRow 
                        key={supplier.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/supplier-network/suppliers/${supplier.id}`)}
                      >
                        <TableCell className="font-mono text-xs">
                          {supplier.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell>{supplier.country || '-'}</TableCell>
                        <TableCell className="capitalize">{supplier.manufacturing_type || '-'}</TableCell>
                        <TableCell>{getStatusBadge(supplier.application_status)}</TableCell>
                        <TableCell>{format(new Date(supplier.created_at), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>
                          <Select
                            value={supplier.assigned_manager_id || ''}
                            onValueChange={(value) => assignManagerMutation.mutate({ id: supplier.id, managerId: value })}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue placeholder="Assign..." />
                            </SelectTrigger>
                            <SelectContent>
                              {managers.map((manager) => (
                                <SelectItem key={manager.id} value={manager.id}>
                                  {manager.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={supplier.risk_flag || ''}
                            onValueChange={(value) => updateRiskFlagMutation.mutate({ id: supplier.id, riskFlag: value || null })}
                          >
                            <SelectTrigger className="w-[110px] h-8">
                              <SelectValue placeholder="Set risk..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedSupplier(supplier); setViewDialogOpen(true); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedSupplier(supplier); setReviewDialogOpen(true); }}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Review Application
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: supplier.id, status: 'under_technical_review' })}
                                disabled={supplier.application_status !== 'submitted'}
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                Start Technical Review
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: supplier.id, status: 'under_commercial_review' })}
                                disabled={supplier.application_status !== 'under_technical_review'}
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                Start Commercial Review
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => updateStatusMutation.mutate({ id: supplier.id, status: 'on_hold' })}
                              >
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Put On Hold
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {selectedSupplier && (
        <>
          <ReviewSupplierApplicationDialog
            open={reviewDialogOpen}
            onOpenChange={setReviewDialogOpen}
            supplier={selectedSupplier}
          />
          <ViewSupplierApplicationDialog
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            supplier={selectedSupplier}
          />
        </>
      )}
    </div>
  );
}
