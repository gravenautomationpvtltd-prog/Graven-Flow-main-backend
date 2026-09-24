import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { useTranslation } from '@/lib/i18n';

export default function Profile() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">{t('profile.title', 'My Profile')}</h1>
        <p className="text-muted-foreground">
          {t('profile.subtitle', 'Manage your personal information and preferences')}
        </p>
      </div>
      <ProfileSettings />
    </div>
  );
}
