import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateProfile, useUploadAvatar } from '@/hooks/useProfileUpdate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, Save, User } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/lib/i18n';

export function ProfileSettings() {
  const { user, profile } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setLanguage } = useTranslation();

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [preferredLanguage, setPreferredLanguage] = useState<string>((profile as any)?.preferred_language || 'en');
  const [preferredCurrency, setPreferredCurrency] = useState<string>((profile as any)?.preferred_currency || '');

  useEffect(() => {
    setPreferredLanguage((profile as any)?.preferred_language || 'en');
    setPreferredCurrency((profile as any)?.preferred_currency || '');
  }, [profile]);

  const { data: languages } = useQuery({
    queryKey: ['languages-active'],
    queryFn: async () => {
      const { data } = await supabase.from('languages').select('code, name, native_name').eq('is_active', true).order('name');
      return data || [];
    },
  });
  const { data: currencies } = useQuery({
    queryKey: ['currencies-active'],
    queryFn: async () => {
      const { data } = await supabase.from('currencies').select('code, name, symbol').eq('is_active', true).order('code');
      return data || [];
    },
  });

  const handleSave = () => {
    if (!user) return;
    updateProfile.mutate({
      userId: user.id,
      data: {
        full_name: fullName,
        phone: phone || undefined,
        preferred_language: preferredLanguage,
        preferred_currency: preferredCurrency || null,
      } as any,
    });
    setLanguage(preferredLanguage);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    uploadAvatar.mutate({ userId: user.id, file });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isLoading = updateProfile.isPending || uploadAvatar.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Manage your personal information and avatar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name} />
              <AvatarFallback className="text-lg">
                {profile?.full_name ? getInitials(profile.full_name) : <User className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            <Button
              size="icon"
              variant="secondary"
              className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
              onClick={handleAvatarClick}
              disabled={uploadAvatar.isPending}
            >
              {uploadAvatar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Profile Picture</p>
            <p className="text-xs text-muted-foreground">
              Click the camera icon to upload a new avatar
            </p>
            <p className="text-xs text-muted-foreground">
              Max file size: 2MB. Supported formats: JPG, PNG, GIF
            </p>
          </div>
        </div>

        {/* Profile Form */}
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={profile?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Preferred language</Label>
              <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(languages || []).map((l: any) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.native_name || l.name} {l.native_name && l.native_name !== l.name ? `(${l.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Applies only to your account.</p>
            </div>

            <div className="space-y-2">
              <Label>Display currency</Label>
              <Select value={preferredCurrency || '__default__'} onValueChange={v => setPreferredCurrency(v === '__default__' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">Use organization default</SelectItem>
                  {(currencies || []).map((c: any) => (
                    <SelectItem key={c.code} value={c.code}>{c.symbol} — {c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">How amounts appear to you across the app.</p>
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isLoading}>
          {updateProfile.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
