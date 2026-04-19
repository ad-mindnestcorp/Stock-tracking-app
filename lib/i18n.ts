/**
 * Internationalisation — expo-localization + i18next
 *
 * Usage:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   t('home.title')  // → "Stockvest"
 *
 * To add a new language:
 *   1. Create locales/<lang>.json (copy en.json as a template)
 *   2. Import it here and add it to `resources`
 *   3. Add the locale code to the `supportedLngs` array
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '@/locales/en.json';

const resources = {
  en: { translation: en },
} as const;

export type SupportedLocale = keyof typeof resources;
export type TranslationKeys = typeof en;

export function initI18n(): void {
  if (i18n.isInitialized) return;

  // expo-localization returns an array sorted by user preference
  const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: deviceLocale,
      fallbackLng: 'en',
      supportedLngs: ['en'],
      interpolation: {
        // React already escapes values — no need for i18next to double-escape
        escapeValue: false,
      },
      compatibilityJSON: 'v4',
    })
    .catch(console.error);
}

export default i18n;
