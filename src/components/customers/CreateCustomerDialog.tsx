import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useCreateCustomer } from '@/hooks/useCustomers';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
import { useTenantStatus } from '@/hooks/useTenantStatus';
import { checkDuplicateCustomerMulti, getMatchSeverity, type DuplicateCustomer } from '@/hooks/useCheckDuplicateCustomer';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, MapPin, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DuplicateWarning extends DuplicateCustomer {
  // Extends DuplicateCustomer for full match info
}

export function CreateCustomerDialog({ open, onOpenChange }: CreateCustomerDialogProps) {
  const createCustomer = useCreateCustomer();
  const { data: profiles } = useProfiles();
  const { user, isManager, isAdmin, isReady } = useAuth();
  const { hasTenant, loading: tenantLoading, refresh: refreshTenant } = useTenantStatus();
  const navigate = useNavigate();

  const canAssignCustomers = isManager || isAdmin;
  const isOrphaned = !tenantLoading && !hasTenant;
  const [isChecking, setIsChecking] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [liveMatch, setLiveMatch] = useState<DuplicateWarning | null>(null);

  // Re-fetch tenant status when dialog opens to clear stale state
  useEffect(() => {
    if (open) {
      refreshTenant();
    }
  }, [open, refreshTenant]);

  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    alternate_phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gst_number: '',
    is_b2b: true,
    assigned_sales_id: '',
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      company_name: '',
      contact_person: '',
      phone: '',
      alternate_phone: '',
      email: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      gst_number: '',
      is_b2b: true,
      assigned_sales_id: '',
      notes: '',
    });
    setDuplicateWarning(null);
    setLiveMatch(null);
    setIsChecking(false);
  };

  // Live duplicate check as user types
  useEffect(() => {
    const hasEnoughData = (formData.phone && formData.phone.length >= 10) || 
                          (formData.company_name && formData.company_name.length >= 2);
    
    if (!hasEnoughData) {
      setLiveMatch(null);
      return;
    }

    // Add timeout for duplicate check
    const timeoutId = setTimeout(async () => {
      setIsChecking(true);
      try {
        const matches = await checkDuplicateCustomerMulti({
          phone: formData.phone || '',
          email: formData.email || undefined,
          company_name: formData.company_name || undefined,
          gst_number: formData.gst_number || undefined,
          state: formData.state || undefined,
          city: formData.city || undefined,
        });
        
        if (matches.length > 0) {
          setLiveMatch(matches[0]);
        } else {
          setLiveMatch(null);
        }
      } catch (error) {
        console.error('Error checking duplicate:', error);
        // Don't block form submission if duplicate check fails
        setLiveMatch(null);
      } finally {
        setIsChecking(false);
      }
    }, 600);

    // Timeout after 5 seconds to prevent indefinite loading
    const abortTimeoutId = setTimeout(() => {
      setIsChecking(false);
      console.warn('Duplicate check timed out');
    }, 5000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(abortTimeoutId);
    };
  }, [formData.phone, formData.email, formData.company_name, formData.gst_number, formData.state, formData.city]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady) return;
    // Wait for duplicate check to complete if still running
    if (isChecking) {
      return;
    }
    
    // If definite or likely duplicate found, show warning dialog
    if (liveMatch && getMatchSeverity(liveMatch.match_score) !== 'possible') {
      setDuplicateWarning(liveMatch);
      return;
    }
    
    await createCustomerRecord();
  };

  const createCustomerRecord = async () => {
    // Pre-flight: re-validate tenant eligibility right before submit
    await refreshTenant();
    const { data: tuCheck } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!tuCheck?.tenant_id) {
      toast.error("Your account isn't linked to an organization yet. Please contact your admin to be added before creating customers.");
      return;
    }

    // Auto-assign to current user for Sales role, allow selection for managers
    const assignedSalesId = canAssignCustomers
      ? (formData.assigned_sales_id || null)
      : user?.id || null;

    await createCustomer.mutateAsync({
      ...formData,
      assigned_sales_id: assignedSalesId,
    });

    onOpenChange(false);
    resetForm();
  };

  const handleViewExisting = () => {
    if (duplicateWarning) {
      navigate(`/customers/${duplicateWarning.id}`);
      onOpenChange(false);
      resetForm();
    }
  };

  const handleCloseWarning = () => {
    setDuplicateWarning(null);
  };

  const severity = liveMatch ? getMatchSeverity(liveMatch.match_score) : 'none';

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isOrphaned && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Your account isn't linked to an organization. Please contact your admin to be added before creating customers.
                </AlertDescription>
              </Alert>
            )}
            {/* Live Duplicate Match Alert */}
            {liveMatch && severity === 'definite' && (
              <Alert className="border-red-500 bg-red-500/10">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-700 dark:text-red-400">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">Duplicate Customer Found</span>
                    <Badge variant="destructive" className="text-xs">Score: {liveMatch.match_score}</Badge>
                  </div>
                  <p className="text-sm">
                    <strong>{liveMatch.company_name}</strong>
                    {(liveMatch.city || liveMatch.state) && (
                      <span className="text-muted-foreground ml-1">
                        <MapPin className="inline h-3 w-3" /> {[liveMatch.city, liveMatch.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {liveMatch.match_reasons.map((reason, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs border-red-300">{reason}</Badge>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {liveMatch && severity === 'likely' && (
              <Alert className="border-amber-500 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">Possible Duplicate Found</span>
                    <Badge variant="secondary" className="text-xs bg-amber-200 text-amber-800">Score: {liveMatch.match_score}</Badge>
                  </div>
                  <p className="text-sm">
                    <strong>{liveMatch.company_name}</strong>
                    {(liveMatch.city || liveMatch.state) && (
                      <span className="text-muted-foreground ml-1">
                        <MapPin className="inline h-3 w-3" /> {[liveMatch.city, liveMatch.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {liveMatch.match_reasons.map((reason, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs border-amber-300">{reason}</Badge>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {liveMatch && severity === 'possible' && (
              <Alert className="border-blue-500 bg-blue-500/10">
                <Info className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-blue-700 dark:text-blue-400">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">Similar Company Exists</span>
                    <Badge variant="outline" className="text-xs">Score: {liveMatch.match_score}</Badge>
                  </div>
                  <p className="text-sm">
                    <strong>{liveMatch.company_name}</strong>
                    {(liveMatch.city || liveMatch.state) && (
                      <span className="text-muted-foreground ml-1">
                        <MapPin className="inline h-3 w-3" /> {[liveMatch.city, liveMatch.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-2 text-muted-foreground italic">
                    Different location - this is likely a different company. Proceed with creation.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {isChecking && !liveMatch && (
              <Alert className="border-blue-500 bg-blue-500/10">
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                <AlertDescription className="text-blue-700 dark:text-blue-400">
                  Checking for existing customers...
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  minLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alternate_phone">Alternate Phone</Label>
                <Input
                  id="alternate_phone"
                  type="tel"
                  value={formData.alternate_phone}
                  onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                />
              </div>
            </div>

            <div className={canAssignCustomers ? "grid grid-cols-2 gap-4" : ""}>
              <div className="space-y-2">
                <Label htmlFor="gst_number">GST Number</Label>
                <Input
                  id="gst_number"
                  value={formData.gst_number}
                  onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                  placeholder="e.g., 22AAAAA0000A1Z5"
                />
              </div>
              {canAssignCustomers && (
                <div className="space-y-2">
                  <Label htmlFor="assigned_sales_id">Assigned Sales Rep</Label>
                  <Select 
                    value={formData.assigned_sales_id} 
                    onValueChange={(value) => setFormData({ ...formData, assigned_sales_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sales rep" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_b2b"
                checked={formData.is_b2b}
                onCheckedChange={(checked) => setFormData({ ...formData, is_b2b: checked as boolean })}
              />
              <Label htmlFor="is_b2b">B2B Customer</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Any additional notes about this customer..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCustomer.isPending || isChecking || !isReady || isOrphaned}>
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : createCustomer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : 'Create Customer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <AlertDialog open={!!duplicateWarning} onOpenChange={() => setDuplicateWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Customer Already Exists
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                A matching customer already exists: <strong>"{duplicateWarning?.company_name}"</strong>
              </p>
              {duplicateWarning && (
                <>
                  {(duplicateWarning.city || duplicateWarning.state) && (
                    <p className="flex items-center text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-1" />
                      {[duplicateWarning.city, duplicateWarning.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <span className="text-sm text-muted-foreground">Matched on:</span>
                    {duplicateWarning.match_reasons.map((reason, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{reason}</Badge>
                    ))}
                  </div>
                  {duplicateWarning.assigned_sales_name && (
                    <p className="text-amber-600 font-medium">
                      Assigned to: <strong>{duplicateWarning.assigned_sales_name}</strong>
                    </p>
                  )}
                </>
              )}
              <p className="text-muted-foreground">
                Would you like to view the existing customer instead?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleCloseWarning}>
              Cancel
            </Button>
            <Button onClick={handleViewExisting}>
              View Existing Customer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
