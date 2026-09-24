-- Create holiday_type enum
CREATE TYPE public.holiday_type AS ENUM ('national', 'company', 'regional', 'optional');

-- Create holidays table
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  holiday_type holiday_type NOT NULL DEFAULT 'company',
  is_half_day BOOLEAN DEFAULT false,
  half_day_type TEXT CHECK (half_day_type IN ('first_half', 'second_half') OR half_day_type IS NULL),
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  description TEXT,
  year INTEGER NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_holidays_date ON public.holidays(date);
CREATE INDEX idx_holidays_year ON public.holidays(year);
CREATE INDEX idx_holidays_office ON public.holidays(office_id);

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view holidays
CREATE POLICY "Holidays viewable by authenticated users"
ON public.holidays FOR SELECT
USING (true);

-- Only HR/Admin can create holidays
CREATE POLICY "HR/Admin can create holidays"
ON public.holidays FOR INSERT
WITH CHECK (is_hr_or_admin(auth.uid()));

-- Only HR/Admin can update holidays
CREATE POLICY "HR/Admin can update holidays"
ON public.holidays FOR UPDATE
USING (is_hr_or_admin(auth.uid()));

-- Only HR/Admin can delete holidays
CREATE POLICY "HR/Admin can delete holidays"
ON public.holidays FOR DELETE
USING (is_hr_or_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_holidays_updated_at
BEFORE UPDATE ON public.holidays
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();