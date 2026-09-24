-- Enable realtime for user_roles table so role changes reflect immediately
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;