
-- 1. Create industries table
CREATE TABLE public.industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  kpi_config jsonb DEFAULT '[]'::jsonb,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.industries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read industries" ON public.industries FOR SELECT TO authenticated USING (true);

-- 2. Create languages table
CREATE TABLE public.languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  native_name text NOT NULL,
  direction text DEFAULT 'ltr',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read languages" ON public.languages FOR SELECT TO authenticated USING (true);

-- 3. Create translations table
CREATE TABLE public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code text NOT NULL REFERENCES public.languages(code),
  translation_key text NOT NULL,
  translation_value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(language_code, translation_key)
);

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read translations" ON public.translations FOR SELECT TO authenticated USING (true);

-- 4. Alter existing countries table: add region, phone_code, tax_system, date_format
ALTER TABLE public.countries 
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS phone_code text,
  ADD COLUMN IF NOT EXISTS tax_system jsonb,
  ADD COLUMN IF NOT EXISTS date_format text DEFAULT 'DD/MM/YYYY';

-- 5. Alter tenants table
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS tax_system jsonb;

-- 6. Alter profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';

-- 7. Expand currencies table with world currencies
INSERT INTO public.currencies (code, name, symbol, is_active) VALUES
  ('GBP', 'British Pound', '£', true),
  ('JPY', 'Japanese Yen', '¥', true),
  ('AED', 'UAE Dirham', 'د.إ', true),
  ('SAR', 'Saudi Riyal', '﷼', true),
  ('BRL', 'Brazilian Real', 'R$', true),
  ('CAD', 'Canadian Dollar', 'C$', true),
  ('AUD', 'Australian Dollar', 'A$', true),
  ('SGD', 'Singapore Dollar', 'S$', true),
  ('CHF', 'Swiss Franc', 'CHF', true),
  ('KRW', 'South Korean Won', '₩', true),
  ('THB', 'Thai Baht', '฿', true),
  ('MXN', 'Mexican Peso', 'Mex$', true),
  ('ZAR', 'South African Rand', 'R', true),
  ('SEK', 'Swedish Krona', 'kr', true),
  ('NOK', 'Norwegian Krone', 'kr', true),
  ('DKK', 'Danish Krone', 'kr', true),
  ('PLN', 'Polish Zloty', 'zł', true),
  ('TRY', 'Turkish Lira', '₺', true),
  ('HKD', 'Hong Kong Dollar', 'HK$', true),
  ('TWD', 'Taiwan Dollar', 'NT$', true),
  ('NZD', 'New Zealand Dollar', 'NZ$', true),
  ('PHP', 'Philippine Peso', '₱', true),
  ('IDR', 'Indonesian Rupiah', 'Rp', true),
  ('MYR', 'Malaysian Ringgit', 'RM', true),
  ('VND', 'Vietnamese Dong', '₫', true),
  ('BDT', 'Bangladeshi Taka', '৳', true),
  ('PKR', 'Pakistani Rupee', '₨', true),
  ('LKR', 'Sri Lankan Rupee', 'Rs', true),
  ('NGN', 'Nigerian Naira', '₦', true),
  ('EGP', 'Egyptian Pound', 'E£', true),
  ('KES', 'Kenyan Shilling', 'KSh', true),
  ('GHS', 'Ghanaian Cedi', 'GH₵', true),
  ('QAR', 'Qatari Riyal', 'QR', true),
  ('KWD', 'Kuwaiti Dinar', 'KD', true),
  ('BHD', 'Bahraini Dinar', 'BD', true),
  ('OMR', 'Omani Rial', 'OMR', true),
  ('JOD', 'Jordanian Dinar', 'JD', true),
  ('ILS', 'Israeli Shekel', '₪', true),
  ('CLP', 'Chilean Peso', 'CLP$', true),
  ('COP', 'Colombian Peso', 'COL$', true),
  ('ARS', 'Argentine Peso', 'AR$', true),
  ('PEN', 'Peruvian Sol', 'S/', true),
  ('INR', 'Indian Rupee', '₹', true),
  ('USD', 'US Dollar', '$', true),
  ('EUR', 'Euro', '€', true),
  ('CNY', 'Chinese Yuan', '¥', true),
  ('RUB', 'Russian Ruble', '₽', true)
ON CONFLICT (code) DO NOTHING;
