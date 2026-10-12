import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, KeyRound, ShieldAlert, Check, Eye, EyeOff, LogOut } from 'lucide-react';

export default function SetNewPassword() {
  const navigate = useNavigate();
  const { user, profile, mustChangePassword, refreshProfile, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password rules validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isFormValid) {
      setErrorMsg('Please ensure all password requirements are satisfied.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Update password securely via Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false }
      });

      if (authError) {
        throw authError;
      }

      // 2. Clear must_change_password flag on public profile
      if (user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false } as any)
          .eq('id', user.id);

        if (profileError) {
          console.warn('Note: Profile flag update status:', profileError.message);
        }
      }

      // 3. Refresh user state
      if (refreshProfile) {
        await refreshProfile();
      }

      toast.success('Your new password has been set successfully! Entering dashboard...');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);

    } catch (err: any) {
      console.error('Password update failure:', err);
      setErrorMsg(err?.message || 'Failed to update password. Please try again.');
      toast.error(err?.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const employeeName = profile?.full_name || user?.user_metadata?.full_name || 'Employee';
  const employeeEmail = user?.email || profile?.email || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-900/90 backdrop-blur-md shadow-2xl text-slate-100">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-inner">
            <KeyRound className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">
            Set Your New Password
          </CardTitle>
          <CardDescription className="text-slate-400 mt-1">
            Welcome to Graven OneDesk. Because this is your first sign-in with a temporary password, you must create a new private password before accessing your workspace.
          </CardDescription>

          <div className="mt-4 rounded-xl bg-slate-800/60 border border-slate-700/60 p-3 text-left">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Signed in account
            </div>
            <div className="text-sm font-medium text-slate-200 mt-0.5">
              {employeeName}
            </div>
            <div className="text-xs text-slate-400 truncate">
              {employeeEmail}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium text-slate-300">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter secure new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950/80 border-slate-700 text-slate-100 pr-10 focus-visible:ring-amber-500"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs font-medium text-slate-300">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-slate-950/80 border-slate-700 text-slate-100 pr-10 focus-visible:ring-amber-500"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements Checklist */}
            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3 space-y-1.5 text-xs">
              <div className="font-semibold text-slate-400 mb-1">Password Requirements:</div>
              <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className={`h-3.5 w-3.5 ${hasMinLength ? 'opacity-100' : 'opacity-30'}`} />
                <span>At least 8 characters</span>
              </div>
              <div className={`flex items-center gap-2 ${hasUppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className={`h-3.5 w-3.5 ${hasUppercase ? 'opacity-100' : 'opacity-30'}`} />
                <span>At least one uppercase letter (A-Z)</span>
              </div>
              <div className={`flex items-center gap-2 ${hasLowercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className={`h-3.5 w-3.5 ${hasLowercase ? 'opacity-100' : 'opacity-30'}`} />
                <span>At least one lowercase letter (a-z)</span>
              </div>
              <div className={`flex items-center gap-2 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className={`h-3.5 w-3.5 ${hasNumber ? 'opacity-100' : 'opacity-30'}`} />
                <span>At least one number (0-9)</span>
              </div>
              <div className={`flex items-center gap-2 ${hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className={`h-3.5 w-3.5 ${hasSpecial ? 'opacity-100' : 'opacity-30'}`} />
                <span>At least one special character (!@#$%^&*)</span>
              </div>
              <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-400' : 'text-slate-500'}`}>
                <Check className={`h-3.5 w-3.5 ${passwordsMatch ? 'opacity-100' : 'opacity-30'}`} />
                <span>Passwords match</span>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-lg shadow-amber-500/10 transition-all mt-2"
              disabled={isLoading || !isFormValid}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Securing Account...
                </>
              ) : (
                'Save New Password & Enter Workspace'
              )}
            </Button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  navigate('/auth');
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out of this session
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
