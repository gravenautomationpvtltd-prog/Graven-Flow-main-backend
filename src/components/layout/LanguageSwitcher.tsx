import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Language {
  code: string;
  name: string;
  native_name: string | null;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();
  const [languages, setLanguages] = useState<Language[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('languages')
        .select('code, name, native_name')
        .eq('is_active', true)
        .order('name');
      if (data) setLanguages(data);
    };
    fetch();
  }, []);

  const current = languages.find(l => l.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Change language">
          <Globe className="h-5 w-5" />
          <span className="sr-only">Change language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 max-h-64 overflow-y-auto">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>
              {lang.native_name || lang.name}
              {lang.native_name && lang.native_name !== lang.name && (
                <span className="text-muted-foreground text-xs ml-1">({lang.name})</span>
              )}
            </span>
            {language === lang.code && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
