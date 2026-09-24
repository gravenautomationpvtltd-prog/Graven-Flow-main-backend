import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  office_id: string | null;
  manager_id: string | null;
  is_active: boolean | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isReady: boolean;
  signIn: (
    email: string,
    password: string,
    onRetry?: (attempt: number) => void
  ) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSalesManager: boolean;
  isProcurementManager: boolean;
  isSales: boolean;
  isHR: boolean;
  isProcurement: boolean;
  isAccounts: boolean;
  isWarehouse: boolean;
  isQC: boolean;
  isPureQC: boolean;
  isCRO: boolean;
  isTST: boolean;
  isCST: boolean;
  isCCT: boolean;
  isImportProcurement: boolean;
  isBIE: boolean;
  isBIEManager: boolean;
  isPureBIE: boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_REQUEST_TIMEOUT_MS = 20_000;
const AUTH_SESSION_TIMEOUT_MS = 12_000;
const AUTH_RETRY_DELAYS_MS = [1_000, 2_500];
const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  'Login service is temporarily unavailable. Please try again shortly.';

const toError = (error: unknown, fallback = 'Authentication request failed'): Error => {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return new Error(message);
  }
  if (typeof error === 'string' && error.trim()) return new Error(error);
  return new Error(fallback);
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const getAuthErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown; error?: unknown }).message ?? (error as { error?: unknown }).error;
    if (typeof maybeMessage === 'string') return maybeMessage;
  }
  return typeof error === 'string' ? error : '';
};

const isRefreshTokenError = (error: unknown) => {
  const message = getAuthErrorMessage(error);
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  return code === 'refresh_token_not_found' || /Refresh Token Not Found|Invalid Refresh Token/i.test(message);
};

const isAuthServiceUnavailableError = (error: unknown) => {
  const message = getAuthErrorMessage(error);
  if (!message) return false;
  // Never treat real credential/validation failures as a transient outage.
  if (/Invalid login credentials|Email not confirmed|already registered|Password should be|User already registered|rate limit/i.test(message)) {
    return false;
  }
  if (isRefreshTokenError(error)) return false;
  return /Login service is temporarily unavailable|Failed to fetch|NetworkError|Load failed|request timed out|Processing this request timed out|context deadline|Database error querying schema|error finding user|upstream request timeout|unexpected_failure|\b50[0234]\b/i.test(
    message
  );
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs an auth call and automatically retries when the auth service answers
 * slowly / times out. Real errors (wrong password, etc.) are returned at once.
 */
const retryOnTransient = async <T extends { error?: unknown }>(
  run: () => Promise<T>,
  options: { onRetry?: (attempt: number) => void; beforeFinalAttempt?: () => void } = {}
): Promise<T> => {
  let lastThrown: unknown;

  for (let attempt = 0; attempt <= AUTH_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      options.onRetry?.(attempt);
      if (attempt === AUTH_RETRY_DELAYS_MS.length) options.beforeFinalAttempt?.();
      await sleep(AUTH_RETRY_DELAYS_MS[attempt - 1]);
    }

    try {
      const result = await run();
      if (result?.error && isAuthServiceUnavailableError(result.error) && attempt < AUTH_RETRY_DELAYS_MS.length) {
        lastThrown = undefined;
        continue;
      }
      return result;
    } catch (error) {
      lastThrown = error;
      if (!isAuthServiceUnavailableError(error) || attempt === AUTH_RETRY_DELAYS_MS.length) {
        throw error;
      }
    }
  }

  throw toError(lastThrown, AUTH_SERVICE_UNAVAILABLE_MESSAGE);
};


const clearStoredAuthState = () => {
  try {
    localStorage.removeItem('attendance_check_in_time');
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
      .forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Unable to clear local auth state:', error);
  }
};

const makeFallbackProfile = (activeUser: User): Profile => ({
  id: activeUser.id,
  email: activeUser.email ?? '',
  full_name:
    typeof activeUser.user_metadata?.full_name === 'string'
      ? activeUser.user_metadata.full_name
      : activeUser.email?.split('@')[0] ?? 'User',
  phone: null,
  avatar_url: typeof activeUser.user_metadata?.avatar_url === 'string' ? activeUser.user_metadata.avatar_url : null,
  office_id: null,
  manager_id: null,
  is_active: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Track which user we've already fetched profile/roles for
  const fetchedForUserRef = useRef<string | null>(null);
  // Track if initial session check is done
  const initialCheckDoneRef = useRef(false);

  const fetchProfileAndRoles = useCallback(async (activeUser: User) => {
    // Prevent duplicate fetches for same user
    const userId = activeUser.id;
    if (fetchedForUserRef.current === userId) return;
    fetchedForUserRef.current = userId;
    setLoading(true);
    
    try {
      // Fetch profile and roles in parallel
      const [profileResult, rolesResult] = await withTimeout(
        Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', userId),
        ]),
        AUTH_REQUEST_TIMEOUT_MS,
        'Profile loading timed out. Please try signing in again.'
      );

      if (fetchedForUserRef.current !== userId) return;

      if (profileResult.error) {
        console.error('Error fetching profile:', profileResult.error);
      }

      if (rolesResult.error) {
        console.error('Error fetching roles:', rolesResult.error);
      }

      if (profileResult.data) {
        setProfile(profileResult.data);
      } else {
        setProfile(makeFallbackProfile(activeUser));
      }
      if (rolesResult.data) {
        setRoles(rolesResult.data.map(r => r.role));
      } else {
        setRoles([]);
      }
    } catch (error) {
      console.error('Error fetching profile/roles:', error);
      if (fetchedForUserRef.current === userId) {
        setProfile(makeFallbackProfile(activeUser));
        setRoles([]);
      }
    } finally {
      if (fetchedForUserRef.current === userId) setLoading(false);
    }
  }, []);

  // Handle session expiry
  const handleSessionExpiry = useCallback(async (showToast = true) => {
    console.log('Session expired, clearing state...');
    setSession(null);
    setUser(null);
    setProfile(null);
    setRoles([]);
    setLoading(false);
    fetchedForUserRef.current = null;

    clearStoredAuthState();
    
    if (showToast) {
      toast.error('Your session has expired. Please log in again.');
    }
    
    try {
      await withTimeout(supabase.auth.signOut({ scope: 'local' }), 3_000, 'Local sign-out timed out');
    } catch (e) {
      // Ignore
    }
  }, []);

  useEffect(() => {
    // 1. Set up auth state listener FIRST (no async work inside)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('Auth event:', event, 'Session:', !!newSession);
        
        if (event === 'TOKEN_REFRESHED' && !newSession) {
          // Fire and forget — no async in callback
          setTimeout(() => handleSessionExpiry(), 0);
          return;
        }
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setLoading(false);
          fetchedForUserRef.current = null;
          return;
        }

        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          // Keep this callback synchronous. Profile/role database reads are
          // handled in a separate effect to avoid auth-client deadlocks.
        } else if (initialCheckDoneRef.current) {
          // Only clear if initial check is already done (avoid race)
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setLoading(false);
          fetchedForUserRef.current = null;
        }
      }
    );

    // 2. THEN check for existing session (retrying slow/timed-out responses)
    retryOnTransient(
      () =>
        withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
          AUTH_SERVICE_UNAVAILABLE_MESSAGE
        ),
      {
        onRetry: (attempt) => console.warn(`Session restore is slow, retry ${attempt}...`),
        // A stale token can keep poisoning the refresh — drop it before the last try.
        beforeFinalAttempt: clearStoredAuthState,
      }
    ).then(async ({ data: { session: existingSession }, error }) => {
      initialCheckDoneRef.current = true;
      
      if (error) {
        if (isRefreshTokenError(error)) {
          handleSessionExpiry(true);
          return;
        }
        if (isAuthServiceUnavailableError(error)) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          setLoading(false);
          return;
        }
      }
      
      if (existingSession?.user) {
        setSession(existingSession);
        setUser(existingSession.user);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    }).catch(async (error) => {
      initialCheckDoneRef.current = true;
      console.error('Session check error:', error);
      if (isRefreshTokenError(error)) {
        handleSessionExpiry(true);
      } else {
        if (isAuthServiceUnavailableError(error)) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRoles([]);
          fetchedForUserRef.current = null;
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [handleSessionExpiry]);

  // Load profile/roles outside onAuthStateChange. Supabase auth calls can hang
  // if database/auth requests are made from the auth-state callback itself.
  useEffect(() => {
    if (!user?.id) {
      if (initialCheckDoneRef.current) setLoading(false);
      return;
    }

    fetchProfileAndRoles(user);
  }, [user, fetchProfileAndRoles]);

  // Periodic session validity check
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      if (document.hidden) return;
      try {
        const { data: { session: actualSession } } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
          AUTH_SERVICE_UNAVAILABLE_MESSAGE
        );
        if (!actualSession) {
          console.warn('Stale auth state detected — session expired');
          await handleSessionExpiry(true);
        }
      } catch (error) {
        if (isRefreshTokenError(error)) {
          await handleSessionExpiry(true);
          return;
        }
        console.warn('Session health check skipped:', error);
      }
    }, 5 * 60_000);

    return () => clearInterval(interval);
  }, [session, handleSessionExpiry]);

  // Real-time subscription for role changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-roles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Reset ref so fetchProfileAndRoles will re-run
          fetchedForUserRef.current = null;
          fetchProfileAndRoles(user);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchProfileAndRoles]);

  const signIn = async (email: string, password: string, onRetry?: (attempt: number) => void) => {
    try {
      clearStoredAuthState();
      const { error } = await retryOnTransient(
        () =>
          withTimeout(
            supabase.auth.signInWithPassword({ email, password }),
            AUTH_REQUEST_TIMEOUT_MS,
            AUTH_SERVICE_UNAVAILABLE_MESSAGE
          ),
        {
          onRetry: (attempt) => {
            console.warn(`Sign-in is slow, retry ${attempt}...`);
            onRetry?.(attempt);
          },
          beforeFinalAttempt: clearStoredAuthState,
        }
      );
      return { error: error as Error | null };
    } catch (error) {
      if (isRefreshTokenError(error)) clearStoredAuthState();
      return { error: toError(error, 'Sign-in failed') };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    try {
      const { error } = await retryOnTransient(() =>
        withTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: redirectUrl,
              data: { full_name: fullName }
            }
          }),
          AUTH_REQUEST_TIMEOUT_MS,
          AUTH_SERVICE_UNAVAILABLE_MESSAGE
        )
      );
      return { error: error as Error | null };
    } catch (error) {
      return { error: toError(error, 'Sign-up failed') };
    }
  };

  const signOut = async () => {
    fetchedForUserRef.current = null;
    try {
      await withTimeout(supabase.auth.signOut({ scope: 'local' }), 3_000, 'Local sign-out timed out');
    } finally {
      clearStoredAuthState();
    }
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  
  const isAdmin = roles.some(r => ['super_admin', 'coo'].includes(r));
  const isSalesManager = roles.includes('manager');
  const isProcurementManager = roles.includes('procurement_manager');
  // Generic "manager" flag — true for sales-manager, procurement-manager, and admins
  const isManager = roles.some(r => ['super_admin', 'coo', 'manager', 'procurement_manager'].includes(r));
  const isSales = roles.some(r => ['super_admin', 'coo', 'manager', 'sales'].includes(r));
  const isHR = roles.some(r => ['super_admin', 'coo', 'hr'].includes(r));
  const isProcurement = roles.some(r => ['super_admin', 'coo', 'manager', 'procurement_manager', 'procurement'].includes(r));
  const isAccounts = roles.some(r => ['super_admin', 'coo', 'manager', 'accounts'].includes(r));
  const isWarehouse = roles.some(r => ['super_admin', 'coo', 'manager', 'procurement_manager', 'warehouse'].includes(r));
  const isQC = roles.some(r => ['super_admin', 'coo', 'manager', 'qc'].includes(r));
  const isPureQC = roles.length > 0 && roles.every(r => r === 'qc');
  const isCRO = roles.some(r => ['super_admin', 'coo', 'manager', 'cro'].includes(r));
  const isTST = roles.some(r => ['super_admin', 'coo', 'manager', 'tst'].includes(r));
  const isCST = roles.some(r => ['super_admin', 'coo', 'manager', 'cst'].includes(r));
  const isCCT = roles.some(r => ['super_admin', 'coo', 'cct'].includes(r));
  const isImportProcurement = roles.some(r => ['super_admin', 'coo', 'import_procurement'].includes(r));
  const isBIE = roles.some(r => ['super_admin', 'coo', 'bie', 'bie_manager'].includes(r));
  const isBIEManager = roles.some(r => ['super_admin', 'coo', 'bie_manager'].includes(r));
  // Users whose ONLY roles are BIE roles get a dedicated, BIE-only workspace
  const isPureBIE = roles.length > 0 && roles.every(r => ['bie', 'bie_manager'].includes(r));

  // isReady = auth bootstrap is complete: not loading AND user+profile are loaded
  // Do NOT require roles.length > 0 — valid users might have roles loading or no roles yet
  const isReady = !loading && !!user && !!profile;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      roles,
      loading,
      isReady,
      signIn,
      signUp,
      signOut,
      hasRole,
      isAdmin,
      isManager,
      isSalesManager,
      isProcurementManager,
      isSales,
      isHR,
      isProcurement,
      isAccounts,
      isWarehouse,
      isQC,
      isPureQC,
      isCRO,
      isTST,
      isCST,
      isCCT,
      isImportProcurement,
      isBIE,
      isBIEManager,
      isPureBIE,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return a safe fallback during HMR disruptions instead of crashing
    return {
      user: null,
      session: null,
      profile: null,
      roles: [],
      loading: true,
      isReady: false,
      signIn: async () => ({ error: new Error('Auth not ready') }),
      signUp: async () => ({ error: new Error('Auth not ready') }),
      signOut: async () => {},
      hasRole: () => false,
      isAdmin: false,
      isManager: false,
      isSalesManager: false,
      isProcurementManager: false,
      isSales: false,
      isHR: false,
      isProcurement: false,
      isAccounts: false,
      isWarehouse: false,
      isQC: false,
      isPureQC: false,
      isCRO: false,
      isTST: false,
      isCST: false,
      isBIE: false,
      isBIEManager: false,
      isPureBIE: false,
      isCCT: false,
      isImportProcurement: false,
    };
  }
  return context;
}
