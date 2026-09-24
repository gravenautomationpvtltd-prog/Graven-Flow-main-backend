import { forwardRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useVendorRegistration } from '@/hooks/useVendorRegistration';
import type { CountryContent } from '@/lib/supplier-landing-content';
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Landmark, 
  FileText, 
  Upload,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';

const vendorSchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  category: z.string().min(1, 'Category is required'),
  gst_number: z.string().min(1, 'Tax/GST number is required'),
  pan_number: z.string().min(1, 'PAN/Tax ID is required'),
  website: z.string().url().optional().or(z.literal('')),
  is_authorized_dealer: z.boolean().optional(),
  contact_person: z.string().min(2, 'Contact person name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(6, 'Valid phone number is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State/Province is required'),
  pincode: z.string().min(4, 'Postal code is required'),
  preferred_currency: z.string().optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_ifsc: z.string().optional(),
  country: z.string().optional(),
  registration_source: z.string().optional(),
});

type VendorFormData = z.infer<typeof vendorSchema>;

interface VendorDocuments {
  gst_certificate?: File;
  pan_card?: File;
  cancelled_cheque?: File;
  coi?: File;
  msme_certificate?: File;
  brand_authorization?: File;
}

interface RegistrationSectionProps {
  content: CountryContent;
  countrySlug?: string;
}

export const RegistrationSection = forwardRef<HTMLDivElement, RegistrationSectionProps>(
  ({ content, countrySlug }, ref) => {
    const [documents, setDocuments] = useState<VendorDocuments>({});
    const [isSubmitted, setIsSubmitted] = useState(false);
    const { submitRegistration, isSubmitting } = useVendorRegistration();

    const form = useForm<VendorFormData>({
      resolver: zodResolver(vendorSchema),
      defaultValues: {
        name: '',
        category: '',
        gst_number: '',
        pan_number: '',
        website: '',
        is_authorized_dealer: false,
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        preferred_currency: content.currency,
        bank_name: '',
        bank_account_number: '',
        bank_ifsc: '',
        country: content.name,
        registration_source: 'landing_page',
      },
    });

    const handleFileChange = (
      e: React.ChangeEvent<HTMLInputElement>,
      field: keyof VendorDocuments
    ) => {
      if (e.target.files?.[0]) {
        setDocuments((prev) => ({ ...prev, [field]: e.target.files![0] }));
      }
    };

    const onSubmit = async (data: VendorFormData) => {
      if (!documents.gst_certificate || !documents.pan_card || !documents.cancelled_cheque) {
        return;
      }

      const success = await submitRegistration(
        { ...data, country: content.name, registration_source: `landing_page_${countrySlug || 'default'}` },
        documents
      );

      if (success) {
        setIsSubmitted(true);
      }
    };

    const categories = [
      'PLCs & Controllers',
      'HMIs & Displays',
      'Variable Frequency Drives',
      'Sensors & Encoders',
      'Motors & Actuators',
      'Industrial Networking',
      'Safety Systems',
      'Power Supplies',
      'Cables & Connectors',
      'General Automation',
      'Other',
    ];

    if (isSubmitted) {
      return (
        <section ref={ref} className="py-16 md:py-24 bg-[#010409]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
              <Card className="border-[#3fb950]/50 bg-[#3fb950]/5 border-[#30363d]">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-[#3fb950]/10 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10 text-[#3fb950]" />
                  </div>
                  <h2 className="text-2xl font-bold text-[#e6edf3] mb-4">
                    Registration Submitted Successfully!
                  </h2>
                  <p className="text-[#8b949e] mb-6">
                    Thank you for registering as a supplier. Our procurement team will review your 
                    application and contact you within 2-3 business days.
                  </p>
                  <div className="bg-[#1c2128] border border-[#30363d] rounded-lg p-4 text-sm text-[#8b949e]">
                    <p className="text-[#e6edf3] font-medium">What happens next?</p>
                    <ul className="mt-2 space-y-1 text-left list-disc list-inside">
                      <li>Our team reviews your documents</li>
                      <li>We verify your business details</li>
                      <li>You receive approval notification via email</li>
                      <li>Start receiving purchase order opportunities</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section ref={ref} className="py-16 md:py-24 bg-[#010409]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Section header */}
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-[#00d2ff]/10 text-[#00d2ff] border-[#00d2ff]/30">Registration</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-[#e6edf3] mb-4">
                Supplier Registration Form
              </h2>
              <p className="text-xl text-[#8b949e]">
                Complete the form below to register as a Graven Automation supplier
              </p>
            </div>

            <Card className="bg-[#0d1117] border-[#30363d]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#e6edf3]">
                  <span className="text-xl">{content.flag}</span>
                  Registering from {content.name}
                </CardTitle>
                <CardDescription className="text-[#8b949e]">
                  Fields marked with <span className="text-[#f85149]">*</span> are required
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {/* Company Information */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-lg font-semibold text-[#e6edf3]">
                        <Building2 className="w-5 h-5 text-[#00d2ff]" />
                        Company Information
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Your company name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Category *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="gst_number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{content.documentHints.gst} *</FormLabel>
                              <FormControl>
                                <Input placeholder="Tax/GST registration number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="pan_number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{content.documentHints.pan} *</FormLabel>
                              <FormControl>
                                <Input placeholder="PAN/Tax ID number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Website</FormLabel>
                              <FormControl>
                                <Input placeholder="https://www.example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="is_authorized_dealer"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Authorized Dealer</FormLabel>
                                <FormDescription>
                                  Check if you are an authorized dealer/distributor
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator className="bg-[#30363d]" />

                    {/* Contact Information */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-lg font-semibold text-[#e6edf3]">
                        <User className="w-5 h-5 text-[#00d2ff]" />
                        Contact Information
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="contact_person"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Person *</FormLabel>
                              <FormControl>
                                <Input placeholder="Full name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address *</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="email@company.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number *</FormLabel>
                              <FormControl>
                                <Input placeholder="+91 XXXXX XXXXX" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator className="bg-[#30363d]" />

                    {/* Address */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-lg font-semibold text-[#e6edf3]">
                        <MapPin className="w-5 h-5 text-[#00d2ff]" />
                        Business Address
                      </div>
                      <div className="grid grid-cols-1 gap-4">
                        <FormField
                          control={form.control}
                          name="address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Street Address *</FormLabel>
                              <FormControl>
                                <Input placeholder="Complete address" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City *</FormLabel>
                                <FormControl>
                                  <Input placeholder="City" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State/Province *</FormLabel>
                                <FormControl>
                                  <Input placeholder="State" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="pincode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Postal Code *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Postal/ZIP code" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator className="bg-[#30363d]" />

                    {/* Bank Details */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-lg font-semibold text-[#e6edf3]">
                        <Landmark className="w-5 h-5 text-[#00d2ff]" />
                        Bank Details (Optional)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="bank_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bank Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Bank name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bank_account_number"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Account number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="bank_ifsc"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IFSC/SWIFT Code</FormLabel>
                              <FormControl>
                                <Input placeholder="Bank code" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator className="bg-[#30363d]" />

                    {/* Document Upload */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-lg font-semibold text-[#e6edf3]">
                        <FileText className="w-5 h-5 text-[#00d2ff]" />
                        Document Upload
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-1">
                            {content.documentHints.gst} *
                            {documents.gst_certificate && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </FormLabel>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => handleFileChange(e, 'gst_certificate')}
                              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-1">
                            {content.documentHints.pan} *
                            {documents.pan_card && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </FormLabel>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileChange(e, 'pan_card')}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-1">
                            Cancelled Cheque / Bank Proof *
                            {documents.cancelled_cheque && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </FormLabel>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileChange(e, 'cancelled_cheque')}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-1">
                            Certificate of Incorporation (Optional)
                            {documents.coi && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </FormLabel>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileChange(e, 'coi')}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-1">
                            MSME Certificate (Optional)
                            {documents.msme_certificate && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </FormLabel>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileChange(e, 'msme_certificate')}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-1">
                            Brand Authorization Letter (Optional)
                            {documents.brand_authorization && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </FormLabel>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileChange(e, 'brand_authorization')}
                            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Validation message */}
                    {(!documents.gst_certificate || !documents.pan_card || !documents.cancelled_cheque) && (
                      <div className="flex items-center gap-2 p-4 bg-[#d29922]/10 border border-[#d29922]/30 rounded-lg text-[#d29922]">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">
                          Please upload all required documents (GST Certificate, PAN Card, and Cancelled Cheque) to submit.
                        </span>
                      </div>
                    )}

                    {/* Submit button */}
                    <div className="flex justify-center pt-4">
                      <Button
                        type="submit"
                        size="lg"
                        disabled={isSubmitting || !documents.gst_certificate || !documents.pan_card || !documents.cancelled_cheque}
                        className="px-12 bg-[#00d2ff] text-[#010409] hover:bg-[#00d2ff]/90 font-bold"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Submit Registration
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    );
  }
);

RegistrationSection.displayName = 'RegistrationSection';
