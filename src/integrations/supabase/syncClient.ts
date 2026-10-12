import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Dedicated Synchronization Backend Client: strictly iukquqmsrqnmuxpgessm
 * Architecture Role: Synchronization Backend ONLY
 * gravenonedesk.in -> Sync Service -> iukquqmsrqnmuxpgessm
 */
export const SYNC_SUPABASE_URL = 'https://iukquqmsrqnmuxpgessm.supabase.co';
export const SYNC_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1a3F1cW1zcnFubXV4cGdlc3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODQyMDAsImV4cCI6MjA4MTE2MDIwMH0.ho8qHS29myxHzx4FSwjoFFH7HFQ4l9XYOch8SzrbVEc';

export const syncSupabase = createClient<Database>(SYNC_SUPABASE_URL, SYNC_SUPABASE_KEY);
