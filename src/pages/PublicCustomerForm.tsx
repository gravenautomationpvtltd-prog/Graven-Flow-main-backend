import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, AlertCircle, Building2, Send, ShieldCheck, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PublicCustomerForm() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    contactPerson: '',
    companyName: '',
    phone: '',
    email: '',
    gstNumber: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    product: '',
    quantity: '1',
    application: '',
    problemDetails: '',
    urgency: 'medium',
    notes: '',
  });

  const [rawForm, setRawForm] = useState<any>(null);

  useEffect(() => {
    async function loadForm() {
      if (!token) {
        setError('No form token provided.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from('customer_forms')
          .select('*')
          .eq('token', token)
          .single();

        if (error || !data) {
          setError('This customer form link is invalid, expired, or has already been completed.');
          setLoading(false);
          return;
        }

        if (data.status === 'submitted') {
          setSubmitted(true);
          setLoading(false);
          return;
        }

        // Check expiration
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setError('This customer form link has expired. Please contact our support team.');
          setLoading(false);
          return;
        }

        setRawForm(data);

        // Mark as opened if first time
        if (data.status === 'sent') {
          await (supabase as any)
            .from('customer_forms')
            .update({ status: 'opened', opened_at: new Date().toISOString() })
            .eq('id', data.id);
        }

        // Prefill known data
        const p = data.prefilled_data || {};
        setFormData({
          contactPerson: p.customerName || p.contactPerson || '',
          companyName: p.companyName || '',
          phone: p.phone || '',
          email: p.email || '',
          gstNumber: '',
          address: '',
          city: p.city || '',
          state: p.state || '',
          pincode: '',
          product: '',
          quantity: '1',
          application: '',
          problemDetails: p.requirement || '',
          urgency: 'medium',
          notes: '',
        });
      } catch (err: any) {
        setError(err.message || 'Failed to load form.');
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !rawForm) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Update customer_forms record
      const { error: formError } = await (supabase as any)
        .from('customer_forms')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_data: formData,
        })
        .eq('token', token);

      if (formError) throw formError;

      // 2. Update customer record if customer_id exists
      if (rawForm.customer_id) {
        await (supabase as any)
          .from('customers')
          .update({
            contact_person: formData.contactPerson || undefined,
            company_name: formData.companyName || undefined,
            email: formData.email || undefined,
            gst_number: formData.gstNumber || undefined,
            address: formData.address || undefined,
            city: formData.city || undefined,
            state: formData.state || undefined,
            pincode: formData.pincode || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rawForm.customer_id);
      }

      // 3. Update lead query if lead_id exists
      if (rawForm.lead_id) {
        await (supabase as any)
          .from('leads')
          .update({
            customer_query: formData.problemDetails || formData.notes || undefined,
            last_activity_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', rawForm.lead_id);
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit form. Please check your network and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-slate-500">Loading your customer form securely...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-red-100">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-xl">Form Unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50/50 to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-xl border-emerald-100 text-center p-6 space-y-4">
          <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Thank You!</CardTitle>
          <CardDescription className="text-base text-slate-600">
            Your requirement and business details have been securely recorded into Graven OneDesk. Our Technical Solutions Team (TST) is reviewing your specifications and will connect with you shortly.
          </CardDescription>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Encrypted & Verified via Graven Automation
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
              G
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Graven Automation</h1>
              <p className="text-xs text-slate-500">Customer Specification & Technical Intake Form</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-medium">
            <ShieldCheck className="h-4 w-4" /> Secure Link
          </div>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Customer & Project Details</CardTitle>
            <CardDescription>
              Please verify your contact details and specify your technical requirement below so our engineers can assist you efficiently.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" /> Contact & Company Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contactPerson">Contact Person *</Label>
                    <Input
                      id="contactPerson"
                      required
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="companyName">Company / Organization *</Label>
                    <Input
                      id="companyName"
                      required
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="e.g. Apex Automation Ltd"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Mobile / Phone Number *</Label>
                    <Input
                      id="phone"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. rahul@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gstNumber">GSTIN (Optional)</Label>
                    <Input
                      id="gstNumber"
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                      placeholder="e.g. 07AAAAA0000A1Z5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Noida"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="e.g. Uttar Pradesh"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="e.g. 201301"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address">Full Delivery / Office Address</Label>
                  <Textarea
                    id="address"
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street, Industrial Area, Landmark..."
                  />
                </div>
              </div>

              {/* Requirement Details */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-semibold text-slate-700">Technical Requirement & Application</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="product">Product / Model Required</Label>
                    <Input
                      id="product"
                      value={formData.product}
                      onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                      placeholder="e.g. Siemens S7-1200 CPU or Schneider ATV320"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="quantity">Quantity Required</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="application">Application / Machine Details</Label>
                  <Input
                    id="application"
                    value={formData.application}
                    onChange={(e) => setFormData({ ...formData, application: e.target.value })}
                    placeholder="e.g. Conveyor Automation / Packaging Machine / Water Treatment"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="problemDetails">Problem Description / Technical Specifications *</Label>
                  <Textarea
                    id="problemDetails"
                    required
                    rows={4}
                    value={formData.problemDetails}
                    onChange={(e) => setFormData({ ...formData, problemDetails: e.target.value })}
                    placeholder="Please specify any technical constraints, KW/HP rating, input/output requirements, or faults you are experiencing..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="urgency">Procurement Urgency</Label>
                  <Select value={formData.urgency} onValueChange={(val) => setFormData({ ...formData, urgency: val })}>
                    <SelectTrigger id="urgency">
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate / Machine Breakdown</SelectItem>
                      <SelectItem value="high">High (Within 1-3 days)</SelectItem>
                      <SelectItem value="medium">Medium (Within 1-2 weeks)</SelectItem>
                      <SelectItem value="planning">Project Planning / Estimation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4">
                <Button type="submit" size="lg" className="w-full gap-2 text-base" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" /> Submit Specification
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
