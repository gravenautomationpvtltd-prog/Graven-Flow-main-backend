-- Create round_robin_tracker table for true sequential assignment
CREATE TABLE public.round_robin_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES offices(id) NOT NULL,
  last_assigned_user_id uuid REFERENCES profiles(id),
  last_assigned_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(office_id)
);

-- Enable Row Level Security
ALTER TABLE public.round_robin_tracker ENABLE ROW LEVEL SECURITY;

-- Allow service role (edge functions) to manage
CREATE POLICY "Service role can manage round_robin_tracker" 
ON public.round_robin_tracker FOR ALL USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_round_robin_tracker_updated_at
BEFORE UPDATE ON public.round_robin_tracker
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment explaining the table purpose
COMMENT ON TABLE public.round_robin_tracker IS 'Tracks last assigned user per office for true round-robin lead assignment with holiday skip';