import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, locales, type Locale } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get('NEXT_LOCALE')?.value

  let locale: Locale = defaultLocale
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale
  }

  return {
    locale,
    timeZone: 'Asia/Kuala_Lumpur',
    messages: (await import(`../messages/${locale}.json`)).default
  }
})
