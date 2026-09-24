CREATE OR REPLACE FUNCTION public.stamp_bie_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE terminal boolean;
BEGIN
  terminal := NEW.status IN ('approved','rejected','awarded','lost','active','removed')
              OR COALESCE(NEW.review_status, '') = 'approved';
  IF terminal AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NOT terminal THEN
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;