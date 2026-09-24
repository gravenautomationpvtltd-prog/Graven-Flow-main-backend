import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VendorFormData {
  name: string;
  category: string;
  gst_number: string;
  pan_number: string;
  website?: string | undefined;
  is_authorized_dealer?: boolean | undefined;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  preferred_currency?: string | undefined;
  bank_name?: string | undefined;
  bank_account_number?: string | undefined;
  bank_ifsc?: string | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseVendorFormData = Record<string, any>;

interface VendorDocuments {
  gst_certificate?: File;
  pan_card?: File;
  cancelled_cheque?: File;
  coi?: File;
  msme_certificate?: File;
  brand_authorization?: File;
}

export function useVendorRegistration() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadDocument = async (file: File, folder: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('vendor-documents')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('vendor-documents')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const submitRegistration = async (
    formData: LooseVendorFormData,
    documents: VendorDocuments
  ): Promise<boolean> => {
    setIsSubmitting(true);

    try {
      // Upload all documents
      const documentUrls: Record<string, string | null> = {};

      if (documents.gst_certificate) {
        documentUrls.gst_certificate_url = await uploadDocument(documents.gst_certificate, 'gst-certificates');
      }
      if (documents.pan_card) {
        documentUrls.pan_card_url = await uploadDocument(documents.pan_card, 'pan-cards');
      }
      if (documents.cancelled_cheque) {
        documentUrls.cancelled_cheque_url = await uploadDocument(documents.cancelled_cheque, 'cancelled-cheques');
      }
      if (documents.coi) {
        documentUrls.coi_url = await uploadDocument(documents.coi, 'coi');
      }
      if (documents.msme_certificate) {
        documentUrls.msme_certificate_url = await uploadDocument(documents.msme_certificate, 'msme-certificates');
      }
      if (documents.brand_authorization) {
        documentUrls.brand_authorization_url = await uploadDocument(documents.brand_authorization, 'brand-authorizations');
      }

      // Check for upload failures on required documents
      if (!documentUrls.gst_certificate_url || !documentUrls.pan_card_url || !documentUrls.cancelled_cheque_url) {
        toast.error('Failed to upload required documents. Please try again.');
        return false;
      }

      // Insert supplier record with status = 'pending'
      const { error } = await supabase.from('suppliers').insert({
        name: formData.name,
        category: formData.category,
        gst_number: formData.gst_number,
        pan_number: formData.pan_number,
        website: formData.website || null,
        is_authorized_dealer: formData.is_authorized_dealer,
        contact_person: formData.contact_person,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        preferred_currency: formData.preferred_currency,
        bank_name: formData.bank_name || null,
        bank_account_number: formData.bank_account_number || null,
        bank_ifsc: formData.bank_ifsc || null,
        status: 'pending',
        is_active: false,
        gst_certificate_url: documentUrls.gst_certificate_url,
        pan_card_url: documentUrls.pan_card_url,
        cancelled_cheque_url: documentUrls.cancelled_cheque_url,
        coi_url: documentUrls.coi_url || null,
        msme_certificate_url: documentUrls.msme_certificate_url || null,
        brand_authorization_url: documentUrls.brand_authorization_url || null,
        country: formData.country || null,
        registration_source: formData.registration_source || 'manual',
      });

      if (error) {
        console.error('Insert error:', error);
        toast.error('Failed to submit registration. Please try again.');
        return false;
      }

      toast.success('Registration submitted successfully!');
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('An error occurred. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submitRegistration, isSubmitting };
}
