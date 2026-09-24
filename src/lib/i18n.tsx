import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { en } from '@/lib/translations/en';

interface I18nContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, fallback?: string) => string;
  direction: 'ltr' | 'rtl';
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
  direction: 'ltr',
  isLoading: false,
});

export function useTranslation() {
  return useContext(I18nContext);
}

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

// Cache translations per language
const translationCache: Record<string, Record<string, string>> = { en };

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('en');
  const [translations, setTranslations] = useState<Record<string, string>>(en);
  const [isLoading, setIsLoading] = useState(false);

  const direction: 'ltr' | 'rtl' = useMemo(() => RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr', [language]);

  // Load user's preferred language on mount
  useEffect(() => {
    const loadUserLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', user.id)
        .single();
      
      if (profile?.preferred_language && profile.preferred_language !== 'en') {
        setLanguageState(profile.preferred_language);
        loadTranslations(profile.preferred_language);
      }
    };
    loadUserLanguage();
  }, []);

  const loadTranslations = useCallback(async (lang: string) => {
    if (lang === 'en') {
      setTranslations(en);
      return;
    }

    // Check cache first
    if (translationCache[lang]) {
      setTranslations(translationCache[lang]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('translations')
        .select('translation_key, translation_value')
        .eq('language_code', lang);

      if (error) throw error;

      const langTranslations: Record<string, string> = { ...en }; // Start with English as fallback
      data?.forEach(row => {
        langTranslations[row.translation_key] = row.translation_value;
      });

      translationCache[lang] = langTranslations;
      setTranslations(langTranslations);
    } catch (err) {
      console.error('Failed to load translations:', err);
      setTranslations(en); // Fallback to English
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setLanguage = useCallback(async (lang: string) => {
    setLanguageState(lang);
    await loadTranslations(lang);

    // Persist to profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ preferred_language: lang }).eq('id', user.id);
    }
  }, [loadTranslations]);

  const t = useCallback((key: string, fallback?: string): string => {
    return translations[key] || en[key] || fallback || key;
  }, [translations]);

  // Set document direction
  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [direction, language]);

  const value = useMemo(() => ({
    language, setLanguage, t, direction, isLoading,
  }), [language, setLanguage, t, direction, isLoading]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
