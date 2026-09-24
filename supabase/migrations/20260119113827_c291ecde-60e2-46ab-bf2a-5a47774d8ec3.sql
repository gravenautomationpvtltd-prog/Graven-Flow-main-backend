-- Add 'enquiry' and 'no_enquiry' to lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'enquiry';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'no_enquiry';