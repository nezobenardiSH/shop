'use client'

import { useRouter } from 'next/navigation'
import { locales, localeNames, type Locale } from '@/i18n/config'

interface LanguageSelectorProps {
  currentLocale: Locale
}

export default function LanguageSelector({ currentLocale }: LanguageSelectorProps) {
  const router = useRouter()

  const handleChange = (newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    // Hard reload to ensure the new locale is picked up by the server
    window.location.reload()
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => handleChange(e.target.value as Locale)}
      className="bg-white text-sm text-[#6b6a6a] border border-[#e5e7eb] rounded-full pl-3 pr-6 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#ff630f] focus:ring-opacity-50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b6a6a%22%20d%3D%22M6%208L2%204h8z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.5rem_center]"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeNames[locale]}
        </option>
      ))}
    </select>
  )
}
