import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, RefreshCw, Shield, Users, Zap } from 'lucide-react';
import gravenLogo from '@/assets/graven-logo.png';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { z } from 'zod';
import { lovable } from '@/integrations/lovable/index';
import { useTranslation } from '@/lib/i18n';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const nameSchema = z.string().min(2, 'Name must be at least 2 characters');

const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
  'The login service is busy right now. We retried a few times — please try once more in a moment.';

const isServiceUnavailableMessage = (message: string) =>
  /Login service is temporarily unavailable|Failed to fetch|request timed out|Processing this request timed out|context deadline|Database error querying schema|upstream request timeout|\b50[034]\b/i.test(
    message
  );

const clearLocalAuthTokens = () => {
  try {
    localStorage.removeItem('attendance_check_in_time');
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
      .forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Unable to clear local auth state:', error);
  }
};

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';
  const rawNext = searchParams.get('next');
  const nextPath = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
  const postAuthTarget = nextPath ?? '/dashboard';
  const oauthRedirectUri = nextPath
    ? `${window.location.origin}/auth?next=${encodeURIComponent(nextPath)}`
    : window.location.origin;
  const { user, signIn, signUp, loading: authLoading, isReady } = useAuth();
  const { t } = useTranslation();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showAuthRecovery, setShowAuthRecovery] = useState(false);

  useEffect(() => {
    if (user && isReady) {
      navigate(postAuthTarget, { replace: true });
    }
  }, [user, isReady, navigate, postAuthTarget]);

  useEffect(() => {
    if (!authLoading) {
      setShowAuthRecovery(false);
      return;
    }

    const timer = window.setTimeout(() => setShowAuthRecovery(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [authLoading]);

  const validateField = (field: string, value: string) => {
    try {
      if (field.includes('email')) emailSchema.parse(value);
      else if (field.includes('password')) passwordSchema.parse(value);
      else if (field.includes('name')) nameSchema.parse(value);
      setErrors(prev => ({ ...prev, [field]: '' }));
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, [field]: err.errors[0].message }));
      }
      return false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValid = validateField('loginEmail', loginEmail);
    const passwordValid = validateField('loginPassword', loginPassword);
    if (!emailValid || !passwordValid) return;

    setIsLoading(true);
    setIsRetrying(false);
    setServiceNotice(null);
    try {
      const { error } = await signIn(loginEmail, loginPassword, () => setIsRetrying(true));


      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password');
        } else if (isServiceUnavailableMessage(error.message)) {
          setServiceNotice(AUTH_SERVICE_UNAVAILABLE_MESSAGE);
          toast.error(AUTH_SERVICE_UNAVAILABLE_MESSAGE);
        } else {
          toast.error(error.message || 'Sign-in failed. Please try again.');
        }
      } else {
        toast.success(t('auth.welcome_back', 'Welcome back!'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };


  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameValid = validateField('signupName', signupName);
    const emailValid = validateField('signupEmail', signupEmail);
    const passwordValid = validateField('signupPassword', signupPassword);
    if (!nameValid || !emailValid || !passwordValid) return;

    setIsLoading(true);
    setServiceNotice(null);
    let error: Error | null = null;
    try {
      ({ error } = await signUp(signupEmail, signupPassword, signupName));
    } finally {
      setIsLoading(false);
    }

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Please sign in.');
      } else if (isServiceUnavailableMessage(error.message)) {
        setServiceNotice(AUTH_SERVICE_UNAVAILABLE_MESSAGE);
        toast.error(AUTH_SERVICE_UNAVAILABLE_MESSAGE);
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(t('auth.account_created', 'Account created successfully!'));
      navigate(postAuthTarget, { replace: true });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        {showAuthRecovery ? (
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h1 className="text-xl font-semibold text-foreground">Login service is taking longer than usual</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please retry once. If the service was restarting, this will refresh the login session.
            </p>
            <Button
              type="button"
              className="mt-5 w-full"
              onClick={() => {
                clearLocalAuthTokens();
                window.location.reload();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry login
            </Button>
          </div>
        ) : (
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between bg-card border-r border-border">
        <div>
          <div className="flex items-center gap-3">
            <img src={gravenLogo} alt="Graven OneDesk" className="h-11 w-11 rounded-xl object-contain" />
            <span className="text-2xl font-bold text-foreground">Graven OneDesk</span>
          </div>
        </div>
        
        <div className="space-y-8">
          <h1 className="text-4xl font-bold leading-tight text-foreground">
            {t('auth.branding_title', 'Internal Management')}
            <br />
            <span className="text-primary">{t('auth.branding_highlight', 'System')}</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
            {t('auth.branding_desc', 'Complete enterprise solution for lead management, procurement, inventory, accounts, and payroll - all in one powerful platform.')}
          </p>
          
          <div className="grid grid-cols-1 gap-3 max-w-md">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-medium text-foreground">{t('auth.feature_rbac', 'Role-based Access Control')}</span>
                <p className="text-sm text-muted-foreground">{t('auth.feature_rbac_desc', 'Secure multi-level permissions')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-medium text-foreground">{t('auth.feature_multi_office', 'Multi-office Support')}</span>
                <p className="text-sm text-muted-foreground">{t('auth.feature_multi_office_desc', 'Manage distributed teams')}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border hover:border-primary/30 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-medium text-foreground">{t('auth.feature_analytics', 'Real-time Analytics')}</span>
                <p className="text-sm text-muted-foreground">{t('auth.feature_analytics_desc', 'Live insights & reporting')}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Graven OneDesk. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
              <img src={gravenLogo} alt="Graven OneDesk" className="h-11 w-11 rounded-xl object-contain" />
              <span className="text-2xl font-bold text-foreground">Graven OneDesk</span>
            </div>
            <CardTitle className="text-2xl">{t('auth.welcome', 'Welcome')}</CardTitle>
            <CardDescription>{t('auth.welcome_desc', 'Sign in to your account or create a new one')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted">
                <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  {t('auth.sign_in', 'Sign In')}
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  {t('auth.sign_up', 'Sign Up')}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  {serviceNotice && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div className="space-y-2">
                          <p>{serviceNotice}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              clearLocalAuthTokens();
                              setServiceNotice(null);
                            }}
                          >
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            Try again
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t('auth.email', 'Email')}</Label>
                    <Input id="login-email" type="email" placeholder="name@company.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} onBlur={() => validateField('loginEmail', loginEmail)} className={errors.loginEmail ? 'border-destructive' : ''} />
                    {errors.loginEmail && <p className="text-sm text-destructive">{errors.loginEmail}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password', 'Password')}</Label>
                    <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} onBlur={() => validateField('loginPassword', loginPassword)} className={errors.loginPassword ? 'border-destructive' : ''} />
                    {errors.loginPassword && <p className="text-sm text-destructive">{errors.loginPassword}</p>}
                    <button type="button" className="text-sm text-primary hover:underline" onClick={async () => {
                      if (!loginEmail) { toast.error('Please enter your email address first'); return; }
                      try { emailSchema.parse(loginEmail); } catch { toast.error('Please enter a valid email address'); return; }
                      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, { redirectTo: `${window.location.origin}/reset-password` });
                      if (error) { toast.error(error.message); } else { toast.success('Password reset email sent! Check your inbox.'); }
                    }}>
                      {t('auth.forgot_password', 'Forgot Password?')}
                    </button>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isRetrying ? t('auth.still_connecting', 'Still connecting...') : t('auth.signing_in', 'Signing in...')}</>) : t('auth.sign_in', 'Sign In')}
                  </Button>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t('auth.or_continue_with', 'Or continue with')}</span></div>
                  </div>
                  <Button type="button" variant="outline" className="w-full h-11" disabled={isLoading} onClick={async () => {
                    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: oauthRedirectUri });
                    if (error) toast.error(error.message || "Google sign-in failed");
                  }}>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    {t('auth.sign_in_google', 'Sign in with Google')}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  {serviceNotice && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div className="space-y-2">
                          <p>{serviceNotice}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              clearLocalAuthTokens();
                              setServiceNotice(null);
                            }}
                          >
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            Try again
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t('auth.full_name', 'Full Name')}</Label>
                    <Input id="signup-name" type="text" placeholder="John Doe" value={signupName} onChange={(e) => setSignupName(e.target.value)} onBlur={() => validateField('signupName', signupName)} className={errors.signupName ? 'border-destructive' : ''} />
                    {errors.signupName && <p className="text-sm text-destructive">{errors.signupName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t('auth.email', 'Email')}</Label>
                    <Input id="signup-email" type="email" placeholder="name@company.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} onBlur={() => validateField('signupEmail', signupEmail)} className={errors.signupEmail ? 'border-destructive' : ''} />
                    {errors.signupEmail && <p className="text-sm text-destructive">{errors.signupEmail}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t('auth.password', 'Password')}</Label>
                    <Input id="signup-password" type="password" placeholder="••••••••" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} onBlur={() => validateField('signupPassword', signupPassword)} className={errors.signupPassword ? 'border-destructive' : ''} />
                    {errors.signupPassword && <p className="text-sm text-destructive">{errors.signupPassword}</p>}
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={isLoading}>
                    {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.creating_account', 'Creating account...')}</>) : t('auth.create_account', 'Create Account')}
                  </Button>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t('auth.or_continue_with', 'Or continue with')}</span></div>
                  </div>
                  <Button type="button" variant="outline" className="w-full h-11" disabled={isLoading} onClick={async () => {
                    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: oauthRedirectUri });
                    if (error) toast.error(error.message || "Google sign-in failed");
                  }}>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    {t('auth.sign_up_google', 'Sign up with Google')}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
