import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Phone, Mail, MapPin, Building2, FileText, ArrowLeft, User, Star } from 'lucide-react';
import { useCustomer } from '@/hooks/useCustomers';
import { CustomerLeadsSection } from '@/components/customers/CustomerLeadsSection';
import { EditCustomerDialog } from '@/components/customers/EditCustomerDialog';
import { CustomerPerformanceCard } from '@/components/customers/CustomerPerformanceCard';
import { CustomerOrdersSection } from '@/components/customers/CustomerOrdersSection';
import { CustomerQuotationsSection } from '@/components/customers/CustomerQuotationsSection';
import { CustomerPaymentsSection } from '@/components/customers/CustomerPaymentsSection';
import { CustomerLedgerSection } from '@/components/customers/CustomerLedgerSection';
import { CustomerPOLedgerSection } from '@/components/customers/CustomerPOLedgerSection';
import { CustomerOutreachSection } from '@/components/customers/CustomerOutreachSection';
import { CustomerAssignmentHistory } from '@/components/customers/CustomerAssignmentHistory';
import { useState } from 'react';
import { getSegmentConfig, SEGMENT_OPTIONS } from '@/lib/segment-config';
import { useUpdateCustomerSegment } from '@/hooks/useCROAssignments';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const updateSegment = useUpdateCustomerSegment();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold">Customer not found</h2>
        <p className="text-muted-foreground mt-1">The customer you're looking for doesn't exist.</p>
        <Button className="mt-4" onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/customers')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Customers
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{customer.company_name}</h1>
            <Badge variant={customer.is_b2b ? 'default' : 'secondary'}>
              {customer.is_b2b ? 'B2B' : 'B2C'}
            </Badge>
            {(() => {
              const seg = getSegmentConfig(customer.segment);
              return (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${seg.badgeClass}`}>
                  {seg.label}
                </span>
              );
            })()}
          </div>
          {customer.contact_person && (
            <p className="text-muted-foreground">{customer.contact_person}</p>
          )}
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <User className="h-3.5 w-3.5" />
            Assigned to: <span className="font-medium text-foreground">{(customer as any).assigned_sales?.full_name || 'Unassigned'}</span>
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <Select
              value={customer.segment || 'bronze'}
              onValueChange={(value) => updateSegment.mutate({ customerId: customer.id, segment: value })}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_OPTIONS.map((seg) => {
                  const conf = getSegmentConfig(seg);
                  return (
                    <SelectItem key={seg} value={seg}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${conf.color.split(' ')[0]}`} />
                        {conf.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => setEditDialogOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Performance Metrics */}
      <CustomerPerformanceCard customerId={customer.id} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${customer.phone}`} className="hover:underline">
                {customer.phone}
              </a>
            </div>
            {customer.alternate_phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${customer.alternate_phone}`} className="hover:underline">
                  {customer.alternate_phone} (Alt)
                </a>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${customer.email}`} className="hover:underline">
                  {customer.email}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customer.address || customer.city || customer.state || customer.pincode ? (
              <div className="space-y-1">
                {customer.address && <p>{customer.address}</p>}
                <p>
                  {[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No address provided</p>
            )}
          </CardContent>
        </Card>

        {/* Business Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.gst_number && (
              <div>
                <span className="text-sm text-muted-foreground">GST Number</span>
                <p className="font-mono">{customer.gst_number}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-muted-foreground">Customer Since</span>
              <p>{new Date(customer.created_at).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customer.notes ? (
              <p className="whitespace-pre-wrap">{customer.notes}</p>
            ) : (
              <p className="text-muted-foreground">No notes added</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orders Section */}
      <CustomerOrdersSection customerId={customer.id} />

      {/* Quotations Section */}
      <CustomerQuotationsSection customerId={customer.id} />

      {/* Payments Section */}
      <CustomerPaymentsSection customerId={customer.id} customerName={customer.company_name} />

      {/* PO-wise Ledger */}
      <CustomerPOLedgerSection customerId={customer.id} />

      {/* Account Ledger (Debit/Credit) */}
      <CustomerLedgerSection customerId={customer.id} />

      {/* Assignment History */}
      <CustomerAssignmentHistory customerId={customer.id} />

      {/* Leads Section */}
      <CustomerLeadsSection customerId={customer.id} />

      {/* Outreach History Section */}
      <CustomerOutreachSection customerId={customer.id} />

      <EditCustomerDialog
        customer={customer} 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />
    </div>
  );
}
