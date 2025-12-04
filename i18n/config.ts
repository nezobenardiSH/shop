export const locales = ['en', 'ms', 'zh'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

// Map Salesforce Preferred_Language__c values to locale codes
export const salesforceLocaleMap: Record<string, Locale> = {
  'English': 'en',
  'Malay': 'ms',
  'Chinese': 'zh'
}

export const localeNames: Record<Locale, string> = {
  en: 'ENG',
  ms: 'BM',
  zh: '中文'
}
