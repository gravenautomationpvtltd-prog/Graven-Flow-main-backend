-- Add geolocation fields to offices table
ALTER TABLE offices ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE offices ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 200;

-- Add geolocation and selfie fields to attendance_records
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_in_latitude NUMERIC;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_in_longitude NUMERIC;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_out_latitude NUMERIC;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS check_out_longitude NUMERIC;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS attendance_type TEXT DEFAULT 'office';
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS selfie_url TEXT;

-- Create storage bucket for attendance selfies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attendance-selfies', 'attendance-selfies', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attendance selfies
CREATE POLICY "Users can upload their own selfies"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'attendance-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Selfies are viewable by authenticated users"
ON storage.objects FOR SELECT
USING (bucket_id = 'attendance-selfies');

CREATE POLICY "Users can update their own selfies"
ON storage.objects FOR UPDATE
USING (bucket_id = 'attendance-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own selfies"
ON storage.objects FOR DELETE
USING (bucket_id = 'attendance-selfies' AND auth.uid()::text = (storage.foldername(name))[1]);