import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupplierPriceAnalytics } from '@/components/procurement/SupplierPriceAnalytics';
import { PriceGapTrends } from '@/components/procurement/PriceGapTrends';
import { 
  ArrowLeft, 
  Pencil, 
  Phone, 
  Mail, 
  MapPin, 
  Building2, 
  Globe, 
  CreditCard,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Star
} from 'lucide-react';
import { useSupplierDetail } from '@/hooks/useSupplierDetail';
import { SupplierStatsCards } from '@/components/suppliers/SupplierStatsCards';
import { SupplierPOsTable } from '@/components/suppliers/SupplierPOsTable';
import { SupplierGRNsTable } from '@/components/suppliers/SupplierGRNsTable';
import { SupplierPaymentsTable } from '@/components/suppliers/SupplierPaymentsTable';
import { SupplierRatingsSection } from '@/components/suppliers/SupplierRatingsSection';
import { SupplierDialog } from '@/components/procurement/SupplierDialog';
import { RateSupplierDialog } from '@/components/procurement/RateSupplierDialog';
import { useState } from 'react';

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: supplier, isLoading } = useSupplierDetail(id);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <h2 className="text-xl font-semibold">Supplier not found</h2>
        <p className="text-muted-foreground mt-1">The supplier you're looking for doesn't exist.</p>
        <Button className="mt-4" onClick={() => navigate('/procurement?tab=suppliers')}>
          Back to Suppliers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/procurement?tab=suppliers')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Suppliers
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
            {getStatusBadge(supplier.status)}
            {supplier.is_authorized_dealer && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                Authorized Dealer
              </Badge>
            )}
          </div>
          {supplier.contact_person && (
            <p className="text-muted-foreground">{supplier.contact_person}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRateDialogOpen(true)}>
            <Star className="mr-2 h-4 w-4" />
            Rate
          </Button>
          <Button onClick={() => setEditDialogOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <SupplierStatsCards supplierId={supplier.id} />

      {/* Tabs for different sections */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
          <TabsTrigger value="grns">GRNs</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="quotes">Quotes &amp; pricing</TabsTrigger>
          <TabsTrigger value="ratings">Ratings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
                {supplier.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${supplier.phone}`} className="hover:underline">
                      {supplier.phone}
                    </a>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${supplier.email}`} className="hover:underline">
                      {supplier.email}
                    </a>
                  </div>
                )}
                {supplier.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {supplier.website}
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
                {supplier.address || supplier.city || supplier.state || supplier.pincode ? (
                  <div className="space-y-1">
                    {supplier.address && <p>{supplier.address}</p>}
                    <p>
                      {[supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(', ')}
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
                {supplier.category && (
                  <div>
                    <span className="text-sm text-muted-foreground">Category</span>
                    <p className="capitalize">{supplier.category.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {supplier.gst_number && (
                  <div>
                    <span className="text-sm text-muted-foreground">GST Number</span>
                    <p className="font-mono">{supplier.gst_number}</p>
                  </div>
                )}
                {supplier.pan_number && (
                  <div>
                    <span className="text-sm text-muted-foreground">PAN Number</span>
                    <p className="font-mono">{supplier.pan_number}</p>
                  </div>
                )}
                {supplier.payment_terms && (
                  <div>
                    <span className="text-sm text-muted-foreground">Payment Terms</span>
                    <p>{supplier.payment_terms}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm text-muted-foreground">Supplier Since</span>
                  <p>{new Date(supplier.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Bank Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplier.bank_name ? (
                  <>
                    <div>
                      <span className="text-sm text-muted-foreground">Bank Name</span>
                      <p>{supplier.bank_name}</p>
                    </div>
                    {supplier.bank_account_number && (
                      <div>
                        <span className="text-sm text-muted-foreground">Account Number</span>
                        <p className="font-mono">
                          {'•'.repeat(Math.max(0, supplier.bank_account_number.length - 4))}
                          {supplier.bank_account_number.slice(-4)}
                        </p>
                      </div>
                    )}
                    {supplier.bank_ifsc && (
                      <div>
                        <span className="text-sm text-muted-foreground">IFSC Code</span>
                        <p className="font-mono">{supplier.bank_ifsc}</p>
                      </div>
                    )}
                    {supplier.preferred_currency && (
                      <div>
                        <span className="text-sm text-muted-foreground">Preferred Currency</span>
                        <p>{supplier.preferred_currency}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">No bank details provided</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pos">
          <SupplierPOsTable supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="grns">
          <SupplierGRNsTable supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="payments">
          <SupplierPaymentsTable supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="quotes">
          <SupplierPriceAnalytics supplierId={supplier.id} />
          <PriceGapTrends supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="ratings">
          <SupplierRatingsSection supplierId={supplier.id} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <SupplierDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        supplier={supplier as any}
      />

      <RateSupplierDialog
        open={rateDialogOpen}
        onOpenChange={setRateDialogOpen}
        supplierId={supplier.id}
        supplierName={supplier.name}
      />
    </div>
  );
}
