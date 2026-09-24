import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin,
  Star,
  Edit,
  MessageSquare,
  Ban,
  RefreshCw,
  FileText,
  ExternalLink,
  Calendar,
  Shield,
  Banknote
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useSupplierNetworkProfile,
  useSupplierRFQs,
  useSupplierQuotations,
  useSupplierCategories,
  useSupplierDocuments,
  useSupplierCommunications,
  useSupplierKPIs,
  useSupplierJourneyTimeline,
} from '@/hooks/useSupplierNetworkDetail';
import { useSupplierPayments } from '@/hooks/useSupplierDetail';
import { SupplierNetworkStatsCards } from '@/components/supplier-network/SupplierNetworkStatsCards';
import { SupplierJourneyTimeline } from '@/components/supplier-network/SupplierJourneyTimeline';
import { SupplierRFQsTable } from '@/components/supplier-network/SupplierRFQsTable';
import { SupplierQuotationsTable } from '@/components/supplier-network/SupplierQuotationsTable';
import { SupplierPaymentsTab } from '@/components/supplier-network/SupplierPaymentsTab';
import { RFQsDrilldownModal } from '@/components/supplier-network/RFQsDrilldownModal';
import { QuotationsDrilldownModal } from '@/components/supplier-network/QuotationsDrilldownModal';
import { PaymentsDrilldownModal } from '@/components/supplier-network/PaymentsDrilldownModal';

export default function SupplierNetworkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Drill-down modal states
  const [rfqsModalOpen, setRfqsModalOpen] = useState(false);
  const [rfqsModalMode, setRfqsModalMode] = useState<'all' | 'response-rate'>('all');
  const [quotationsModalOpen, setQuotationsModalOpen] = useState(false);
  const [quotationsModalMode, setQuotationsModalMode] = useState<'all' | 'win-rate' | 'lead-time'>('all');
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [paymentsModalMode, setPaymentsModalMode] = useState<'all' | 'business' | 'pending'>('all');

  const { data: profile, isLoading: profileLoading } = useSupplierNetworkProfile(id);
  const { data: rfqs = [], isLoading: rfqsLoading } = useSupplierRFQs(id);
  const { data: quotations = [], isLoading: quotationsLoading } = useSupplierQuotations(id);
  const { data: payments = [] } = useSupplierPayments(id);
  const { data: categories = [] } = useSupplierCategories(id);
  const { data: documents = [] } = useSupplierDocuments(id);
  const { data: communications = [] } = useSupplierCommunications(id);
  const { kpis, isLoading: kpisLoading } = useSupplierKPIs(id);
  const { timeline, isLoading: timelineLoading } = useSupplierJourneyTimeline(id);

  const handleCardClick = (cardKey: string) => {
    switch (cardKey) {
      case 'rfqs':
        setRfqsModalMode('all');
        setRfqsModalOpen(true);
        break;
      case 'response-rate':
        setRfqsModalMode('response-rate');
        setRfqsModalOpen(true);
        break;
      case 'win-rate':
        setQuotationsModalMode('win-rate');
        setQuotationsModalOpen(true);
        break;
      case 'lead-time':
        setQuotationsModalMode('lead-time');
        setQuotationsModalOpen(true);
        break;
      case 'business':
        setPaymentsModalMode('business');
        setPaymentsModalOpen(true);
        break;
      case 'payments':
        setPaymentsModalMode('all');
        setPaymentsModalOpen(true);
        break;
      case 'pending':
        setPaymentsModalMode('pending');
        setPaymentsModalOpen(true);
        break;
      default:
        // For non-modal cards, switch to relevant tab
        const tabMap: Record<string, string> = {
          'rating': 'overview',
          'since': 'overview',
        };
        if (tabMap[cardKey]) {
          setActiveTab(tabMap[cardKey]);
        }
    }
  };

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4" />
          <div className="h-24 bg-muted rounded mb-6" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Supplier not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (profile.suspended_at) {
      return <Badge variant="destructive">Suspended</Badge>;
    }
    switch (profile.application_status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'under_technical_review':
        return <Badge variant="secondary">Technical Review</Badge>;
      case 'under_commercial_review':
        return <Badge variant="secondary">Commercial Review</Badge>;
      case 'on_hold':
        return <Badge variant="outline">On Hold</Badge>;
      default:
        return <Badge variant="secondary">Submitted</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Suppliers
        </Button>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{profile.name}</h1>
                  {getStatusBadge()}
                  {profile.preferred_flag && (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Preferred
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {profile.contact_person && (
                    <span>{profile.contact_person}</span>
                  )}
                  {profile.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {profile.email}
                    </span>
                  )}
                  {profile.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {profile.phone}
                    </span>
                  )}
                  {profile.country && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {profile.city ? `${profile.city}, ` : ''}{profile.country}
                    </span>
                  )}
                </div>
                {profile.internal_rating && profile.internal_rating > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= profile.internal_rating! 
                            ? 'fill-yellow-400 text-yellow-400' 
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-sm text-muted-foreground">
                      ({profile.internal_rating.toFixed(1)})
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Message
              </Button>
              {profile.suspended_at ? (
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reactivate
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="text-destructive">
                  <Ban className="h-4 w-4 mr-2" />
                  Suspend
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <SupplierNetworkStatsCards 
        kpis={kpis} 
        isLoading={kpisLoading} 
        onCardClick={handleCardClick}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="journey">Journey</TabsTrigger>
          <TabsTrigger value="rfqs">RFQs ({rfqs.length})</TabsTrigger>
          <TabsTrigger value="quotations">Quotations ({quotations.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="communications">Communications ({communications.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Contact Person</p>
                    <p className="font-medium">{profile.contact_person || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{profile.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{profile.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Website</p>
                    {profile.website ? (
                      <a 
                        href={profile.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        Visit <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="font-medium">-</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Full Address</p>
                    <p className="font-medium">{profile.address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p className="font-medium">{profile.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pincode</p>
                    <p className="font-medium">{profile.pincode || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Country</p>
                    <p className="font-medium">{profile.country || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Business Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Manufacturing Type</p>
                    <p className="font-medium capitalize">{profile.manufacturing_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Years in Operation</p>
                    <p className="font-medium">{profile.years_in_operation || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Preferred Supplier</p>
                    <p className="font-medium">{profile.preferred_flag ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GST Number</p>
                    <p className="font-medium font-mono text-xs">{profile.gst_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">PAN Number</p>
                    <p className="font-medium font-mono text-xs">{profile.pan_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NDA Accepted</p>
                    <p className="font-medium">
                      {profile.nda_accepted_at 
                        ? format(new Date(profile.nda_accepted_at), 'MMM dd, yyyy')
                        : 'Not Accepted'
                      }
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Bank Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Bank Name</p>
                    <p className="font-medium">{profile.bank_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Account Number</p>
                    <p className="font-medium font-mono text-xs">{profile.bank_account_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">IFSC Code</p>
                    <p className="font-medium font-mono text-xs">{profile.bank_ifsc || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assigned Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Assigned Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No categories assigned</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat: { id: string; category: { name: string } | null }) => (
                      <Badge key={cat.id} variant="secondary">
                        {cat.category?.name || 'Unknown'}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Application Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Application Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Applied On</p>
                    <p className="font-medium">
                      {format(new Date(profile.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Technical Review</p>
                    <p className="font-medium">
                      {profile.technical_review_at 
                        ? format(new Date(profile.technical_review_at), 'MMM dd, yyyy')
                        : '-'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Commercial Review</p>
                    <p className="font-medium">
                      {profile.commercial_review_at 
                        ? format(new Date(profile.commercial_review_at), 'MMM dd, yyyy')
                        : '-'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Risk Flag</p>
                    {profile.risk_flag ? (
                      <Badge 
                        className={
                          profile.risk_flag === 'high' 
                            ? 'bg-red-100 text-red-800'
                            : profile.risk_flag === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }
                      >
                        {profile.risk_flag} Risk
                      </Badge>
                    ) : (
                      <p className="font-medium">-</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Journey Tab */}
        <TabsContent value="journey">
          <SupplierJourneyTimeline timeline={timeline} isLoading={timelineLoading} />
        </TabsContent>

        {/* RFQs Tab */}
        <TabsContent value="rfqs">
          <SupplierRFQsTable rfqs={rfqs} isLoading={rfqsLoading} />
        </TabsContent>

        {/* Quotations Tab */}
        <TabsContent value="quotations">
          <SupplierQuotationsTable quotations={quotations} isLoading={quotationsLoading} />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <SupplierPaymentsTab supplierId={id!} />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents uploaded
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map((doc) => (
                    <Card key={doc.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.document_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {doc.folder_type?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(doc.created_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications">
          <Card>
            <CardHeader>
              <CardTitle>Communications</CardTitle>
            </CardHeader>
            <CardContent>
              {communications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No communications yet
                </div>
              ) : (
                <div className="space-y-4">
                  {communications.map((comm) => (
                    <Card key={comm.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{comm.subject}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {comm.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Sent by {comm.profiles?.full_name || 'Unknown'} on {format(new Date(comm.created_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </div>
                        <Badge variant={comm.read_at ? 'secondary' : 'outline'}>
                          {comm.read_at ? 'Read' : 'Unread'}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Drill-down Modals */}
      <RFQsDrilldownModal
        open={rfqsModalOpen}
        onOpenChange={setRfqsModalOpen}
        rfqs={rfqs}
        supplierName={profile?.name || 'Supplier'}
        focusMode={rfqsModalMode}
      />

      <QuotationsDrilldownModal
        open={quotationsModalOpen}
        onOpenChange={setQuotationsModalOpen}
        quotations={quotations}
        supplierName={profile?.name || 'Supplier'}
        focusMode={quotationsModalMode}
      />

      <PaymentsDrilldownModal
        open={paymentsModalOpen}
        onOpenChange={setPaymentsModalOpen}
        payments={payments}
        supplierName={profile?.name || 'Supplier'}
        focusMode={paymentsModalMode}
        totalBusinessValue={kpis.totalBusinessValue}
        pendingPayment={kpis.pendingPayment}
      />
    </div>
  );
}
