import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useBackendAuth() {
  const [user, setUser] = useState<any>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkPlatformAdmin = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "platform_admin")
      .maybeSingle();
    console.log("Platform admin check for", userId, ":", data);
    setIsPlatformAdmin(!!data);
  }, []);

  useEffect(() => {
    // Set up listener first (per Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Backend auth state change:", _event, !!session);
      if (session?.user) {
        setUser(session.user);
        // Use setTimeout to avoid deadlock in onAuthStateChange
        setTimeout(() => {
          checkPlatformAdmin(session.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setUser(null);
        setIsPlatformAdmin(false);
        setLoading(false);
      }
    });

    // Then check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        checkPlatformAdmin(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkPlatformAdmin]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, isPlatformAdmin, loading, signIn, signOut };
}
