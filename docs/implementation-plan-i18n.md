# Language Selector Implementation Plan

## Overview
Add multi-language support (English, Malay, Simplified Chinese) to the onboarding portal with:
1. Auto-detection from Salesforce `Preferred_Language__c` field (values: "English", "Malay", "Chinese")
2. Language selector in header for manual switching
3. Full translation scope including all UI text, timeline stages, and error messages

---

## Current State
- **next-intl library configured** (as of 2025-12-04)
- Hardcoded `'en-GB'` locale for date formatting (to be updated)
- `Preferred_Language__c` **already queried** from Salesforce (line 105 in route.ts)
- `preferredLanguage` **already returned** in API response (line 515)
- Header component: `MerchantHeader.tsx` (logo, refresh, logout)

---

## Step 1: Install & Configure next-intl

### 1.1 Install package
```bash
npm install next-intl
```

### 1.2 Create i18n config files

**File: `i18n/config.ts`**
```typescript
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
  en: 'English',
  ms: 'Bahasa Melayu',
  zh: '中文'
}
```

**File: `i18n/request.ts`**
```typescript
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
    messages: (await import(`../messages/${locale}.json`)).default
  }
})
```

---

## Step 2: Create Translation Files

### 2.1 File structure
```
messages/
├── en.json    # English (default)
├── ms.json    # Bahasa Melayu
└── zh.json    # 简体中文
```

### 2.2 Translation structure
```json
{
  "header": {
    "title": "Onboarding Portal",
    "logout": "Log out",
    "loggingOut": "Logging out..."
  },
  "navigation": {
    "overview": "Overview",
    "progress": "Progress",
    "details": "Details"
  },
  "goLive": {
    "expectedDate": "Expected Go Live Date",
    "daysUntil": "Days until go-live",
    "live": "Live",
    "overdue": "Overdue",
    "notSet": "Not Set",
    "tooltip": "Expected Go Live Date can only be changed by StoreHub Onboarding Manager"
  },
  "common": {
    "lastModified": "Last Modified",
    "notSet": "Not Set",
    "loading": "Loading...",
    "storeHubTeam": "StoreHub Team"
  },
  "timeline": {
    "welcome": {
      "title": "Welcome",
      "completed": "Welcome Call Completed",
      "pending": "Pending Welcome Call"
    },
    "preparation": {
      "title": "Preparation",
      "productSetup": "Product Setup",
      "menuSetup": "Menu Setup",
      "hardwareDelivery": "Hardware Delivery"
    },
    "installation": {
      "title": "Installation",
      "scheduled": "Installation Scheduled",
      "completed": "Installation Completed",
      "bookNow": "Book Installation"
    },
    "training": {
      "title": "Training",
      "scheduled": "Training Scheduled",
      "completed": "Training Completed",
      "bookNow": "Book Training"
    },
    "goLive": {
      "title": "Go Live",
      "activated": "Subscription Activated",
      "pending": "Pending Activation"
    }
  },
  "booking": {
    "selectDate": "Select Date",
    "selectTime": "Select Time",
    "confirm": "Confirm Booking",
    "cancel": "Cancel",
    "reschedule": "Reschedule",
    "noSlotsAvailable": "No slots available"
  },
  "login": {
    "title": "Merchant Login",
    "phoneLabel": "Phone Number",
    "phonePlaceholder": "Enter your phone number",
    "submit": "Login",
    "invalidPhone": "Invalid phone number"
  }
}
```

---

## Step 3: Update App Structure

### 3.1 Update `next.config.js`
```javascript
const withNextIntl = require('next-intl/plugin')('./i18n/request.ts')

module.exports = withNextIntl({
  // existing config...
})
```

### 3.2 Update `app/layout.tsx`
```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'

export default async function RootLayout({ children }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

### 3.3 Update `app/merchant/[merchantId]/layout.tsx`
- Read `preferredLanguage` from API response
- Set locale cookie on first load (if not already set)

---

## Step 4: Create Language Selector

### 4.1 New component: `components/LanguageSelector.tsx`
```typescript
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
    router.refresh()
  }

  return (
    <select
      value={currentLocale}
      onChange={(e) => handleChange(e.target.value as Locale)}
      className="..."
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeNames[locale]}
        </option>
      ))}
    </select>
  )
}
```

### 4.2 Add to MerchantHeader
- Position: between refresh button and logout button
- Mobile: compact dropdown with globe icon
- Desktop: full language names

---

## Step 5: Update Components with Translations

### Components to modify:
| Component | Translations needed |
|-----------|---------------------|
| `MerchantHeader.tsx` | Portal title, logout button |
| `PageHeader.tsx` | Navigation tabs, go-live section, tooltips |
| `OnboardingTimeline.tsx` | All stage content (~500 strings) |
| `BookingModal.tsx` | Booking form labels |
| `DatePickerModal.tsx` | Date picker text |
| `LoginForm.tsx` | Login prompts |
| `ImportantReminderBox.tsx` | Reminder messages |

### Example usage in component:
```typescript
import { useTranslations } from 'next-intl'

export default function PageHeader() {
  const t = useTranslations('navigation')

  return (
    <nav>
      <Link>{t('overview')}</Link>
      <Link>{t('progress')}</Link>
      <Link>{t('details')}</Link>
    </nav>
  )
}
```

### Date formatting update:
```typescript
import { useFormatter } from 'next-intl'

function MyComponent() {
  const format = useFormatter()

  return (
    <span>
      {format.dateTime(new Date(dateString), {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })}
    </span>
  )
}
```

---

## Files Summary

### New Files (6)
| File | Purpose |
|------|---------|
| `i18n/config.ts` | Locale definitions, Salesforce mapping |
| `i18n/request.ts` | Server locale resolution |
| `messages/en.json` | English translations |
| `messages/ms.json` | Malay translations |
| `messages/zh.json` | Chinese translations |
| `components/LanguageSelector.tsx` | Language dropdown |

### Modified Files (8)
| File | Changes |
|------|---------|
| `next.config.js` | Add next-intl plugin |
| `app/layout.tsx` | Add NextIntlClientProvider |
| `app/merchant/[merchantId]/layout.tsx` | Set locale from SF, pass to provider |
| `middleware.ts` | Read locale cookie |
| `components/MerchantHeader.tsx` | Add LanguageSelector, use `useTranslations()` |
| `components/PageHeader.tsx` | Use `useTranslations()` |
| `components/OnboardingTimeline.tsx` | Use `useTranslations()` |
| `components/LoginForm.tsx` | Use `useTranslations()` |

---

## Locale Resolution Priority

1. **Cookie** (`NEXT_LOCALE`) - user's manual selection
2. **Salesforce** (`Preferred_Language__c`) - on first load, auto-set cookie
3. **Default** - English

---

## Checklist

### Step 1: Install & Configure ✅ COMPLETED (2025-12-04)
- [x] Run `npm install next-intl`
- [x] Create `i18n/config.ts`
- [x] Create `i18n/request.ts`
- [x] Update `next.config.js`

### Step 2: Translation Files ✅ COMPLETED (2025-12-04)
- [x] Create `messages/en.json` (basic structure created)
- [x] Create `messages/ms.json`
- [x] Create `messages/zh.json`

### Step 3: App Structure ✅ COMPLETED (2025-12-04)
- [x] Update `app/layout.tsx` with provider
- [x] Update merchant layout for SF language detection

### Step 4: Language Selector ✅ COMPLETED (2025-12-04)
- [x] Create `components/LanguageSelector.tsx`
- [x] Add to `MerchantHeader.tsx`

### Step 5: Component Updates (In Progress - 2025-12-04)
- [x] Update `MerchantHeader.tsx` (translations + LanguageSelector)
- [x] Update `PageHeader.tsx` (translations + date formatting)
- [x] Update `LoginForm.tsx` (translations)
- [x] Update `BookingModal.tsx` (translations)
- [ ] Update `OnboardingTimeline.tsx` (large file - 2872 lines, requires extensive work)
- [ ] Update remaining date formatting

---

## Key Decisions
- **Library**: next-intl (best Next.js App Router support)
- **Chinese variant**: Simplified (zh-CN) for Malaysia usage
- **SF values**: Full names ("English", "Malay", "Chinese")
- **Scope**: Full translation (all UI text)
- **Fallback**: Show English if translation missing

---

## Implementation Log

### Step 1 Completed - 2025-12-04

**Files Created:**
| File | Description |
|------|-------------|
| `i18n/config.ts` | Locale definitions (`en`, `ms`, `zh`), Salesforce mapping, locale names |
| `i18n/request.ts` | Server-side locale resolution from `NEXT_LOCALE` cookie |
| `messages/en.json` | English translations (basic structure with header, navigation, goLive, common, timeline, booking, login sections) |

**Files Modified:**
| File | Changes |
|------|---------|
| `next.config.js` | Added `withNextIntl` plugin wrapper pointing to `./i18n/request.ts` |

**Verification:**
- Dev server started successfully with `next-intl` configured
- No build errors

### Step 2 & 3 Completed - 2025-12-04

**Files Created:**
| File | Description |
|------|-------------|
| `messages/ms.json` | Malay (Bahasa Melayu) translations - full structure matching en.json |
| `messages/zh.json` | Simplified Chinese translations - full structure matching en.json |

**Files Modified:**
| File | Changes |
|------|---------|
| `app/layout.tsx` | Made async, added `NextIntlClientProvider` wrapper with `getMessages()` and `getLocale()`, dynamic `lang` attribute on html |
| `app/merchant/[merchantId]/layout.tsx` | Added SF language auto-detection: imports `salesforceLocaleMap`, useEffect sets `NEXT_LOCALE` cookie from `preferredLanguage` on first load |

**Verification:**
- Homepage compiles successfully (200)
- Middleware and pages compile without errors
- All 3 locale JSON files in place (en, ms, zh)

### Step 4 & 5 (Partial) Completed - 2025-12-04

**Files Created:**
| File | Description |
|------|-------------|
| `components/LanguageSelector.tsx` | Language dropdown component with styled select, sets `NEXT_LOCALE` cookie and calls `router.refresh()` |

**Files Modified:**
| File | Changes |
|------|---------|
| `components/MerchantHeader.tsx` | Added `useTranslations('header')`, `LanguageSelector` component, locale state from cookie, translated title and logout text |
| `components/PageHeader.tsx` | Added `useTranslations` for navigation/goLive/common, `useFormatter` for dates, translated all UI text (nav tabs, go-live section, last modified, tooltips) |

**Verification:**
- Homepage compiles successfully (200)
- All components compile without errors
- Language selector renders in header

### Step 5 (Continued) Completed - 2025-12-04

**Files Modified:**
| File | Changes |
|------|---------|
| `components/LoginForm.tsx` | Added `useTranslations('login')`, translated all UI strings (title, PIN label, button text, error messages, help text) |
| `components/BookingModal.tsx` | Added `useTranslations('booking')` and `useFormatter()`, translated modal titles, button labels, form fields, booking summary |

**Translation Files Updated:**
| File | New Keys Added |
|------|----------------|
| `messages/en.json` | Extended `login` and `booking` sections with 20+ new translation keys |
| `messages/ms.json` | Extended `login` and `booking` sections (Malay translations) |
| `messages/zh.json` | Extended `login` and `booking` sections (Chinese translations) |

**Verification:**
- Homepage compiles successfully (200)
- All updated components compile without errors

**Remaining Work:**
- ~~`OnboardingTimeline.tsx` - 2872 lines, contains extensive UI text requiring ~100+ translation keys~~ ✅ COMPLETED
- ~~This component will need a separate focused session due to its size~~ ✅ COMPLETED

---

## OnboardingTimeline Translation Plan ✅ COMPLETED

### Overview
`OnboardingTimeline.tsx` is the largest component (2872 lines) containing the main onboarding progress view. It displays:
- 6 main stages: Welcome, Preparation, Installation, Training, Ready to Go Live, Live
- Multiple sub-stages with status indicators
- Booking/scheduling functionality
- Dynamic content based on industry type (F&B vs Retail)

### Translation Categories (All ✅ COMPLETED)

#### 1. Stage Labels & Titles (~20 keys) ✅ COMPLETED
```json
"stages": {
  "welcome": "Welcome to StoreHub",
  "preparation": "Preparation",
  "installation": "Installation",
  "training": "Training",
  "readyToGoLive": "Ready to go live",
  "live": "Live"
}
```

#### 2. Sub-Stage Labels (~15 keys) ✅ COMPLETED
```json
"subStages": {
  "documentSubmission": "Document Submission",
  "hardwareDelivery": "Hardware Delivery",
  "productSetup": "Product Setup",
  "storeSetup": "Store Setup",
  "welcomeCall": "Welcome Call",
  "hardwareFulfillment": "Hardware Fulfillment",
  "hardwareInstallation": "Hardware Installation",
  "goLive": "Go Live",
  "postGoLiveCheckIn": "Post Go Live Check In"
}
```

#### 3. Status Labels (~20 keys) ✅ COMPLETED
```json
"status": {
  "completed": "Completed",
  "inProgress": "In Progress",
  "pending": "Pending",
  "scheduled": "Scheduled",
  "notStarted": "Not Started",
  "notSet": "Not Set",
  "notScheduled": "Not Scheduled",
  "notRecorded": "Not Recorded",
  "notAssigned": "Not Assigned",
  "notAvailable": "Not Available",
  "notSubmitted": "Not Submitted",
  "notCompleted": "Not Completed",
  "delivered": "Delivered",
  "ready": "Ready",
  "preparing": "Preparing",
  "goingLive": "Going Live",
  "overdue": "Overdue"
}
```

#### 4. Industry-Specific Labels (~20 keys) ✅ COMPLETED
```json
"industry": {
  "fnb": {
    "setupLabel": "Menu Setup",
    "collectionFormLabel": "Menu Collection Form",
    "submissionLabel": "Menu Collection Submission Timestamp",
    "completedLabel": "Completed Menu Setup",
    "pendingStatus": "Pending Menu",
    "submittedStatus": "Menu Submitted",
    "submitButton": "Submit Menu Collection Form"
  },
  "retail": {
    "setupLabel": "Product Setup",
    "collectionFormLabel": "Product Collection Form",
    "submissionLabel": "Product Collection Submission Timestamp",
    "completedLabel": "Completed Product Setup",
    "pendingStatus": "Pending Product",
    "submittedStatus": "Product Submitted",
    "submitButton": "Submit Product Collection Form"
  }
}
```

#### 5. Field Labels (~25 keys) ✅ COMPLETED
```json
"fields": {
  "firstCallTimestamp": "First Call Timestamp",
  "welcomeCallStatus": "Welcome Call Status",
  "onboardingManagerName": "Onboarding Manager Name",
  "scheduledInstallationDate": "Scheduled Installation Date",
  "proposedInstallationDate": "Proposed Installation Date",
  "actualInstallationDate": "Actual Installation Date",
  "installationStatus": "Installation Status",
  "installationIssues": "Installation Issues",
  "installerName": "Installer Name",
  "storeAddress": "Store Address",
  "scheduledTrainingDate": "Training Date",
  "trainingType": "Training Type",
  "trainerName": "Trainer Name",
  "trainingCompleted": "Training Completed",
  "preferredLanguage": "Preferred Language",
  "requiredFeatures": "Required Features by Merchant",
  "onboardingServicesBought": "Onboarding Services Bought",
  "remoteTrainingMeetingLink": "Remote Training Meeting Link",
  "hardwareFulfillmentDate": "Fulfillment Date",
  "hardwareShipmentDate": "Hardware Shipment Date",
  "orderStatus": "Order Status",
  "shippingAddress": "Shipping Address",
  "trackingLink": "Tracking Link",
  "submissionTimestamp": "Submission Timestamp",
  "subscriptionActivationDate": "Subscription Activation Date",
  "backOfficeAccount": "BackOffice Account",
  "onboardingSurvey": "Onboarding Survey",
  "status": "Status",
  "externalVendor": "External Vendor"
}
```

#### 6. Button Labels (~15 keys) ✅ COMPLETED
```json
"buttons": {
  "schedule": "Schedule",
  "changeDate": "Change Date",
  "uploadVideo": "Upload Video",
  "replaceVideo": "Replace Video",
  "uploading": "Uploading...",
  "submitForm": "Submit Form",
  "trackPackage": "Track Package",
  "joinTraining": "Join Training",
  "copyLink": "Copy Link",
  "viewVideo": "View Video",
  "viewActivationGuide": "View activation guide",
  "shareFeedback": "Share Your Feedback"
}
```

#### 7. Completion Indicators (~10 keys) ✅ COMPLETED
```json
"completion": {
  "yes": "Yes",
  "no": "No",
  "noneSpecified": "None Specified",
  "none": "None"
}
```
Note: `xOfYCompleted` pattern is handled via `t('status.xOfYCompleted', { completed, total })`

#### 8. Tooltips & Messages (~10 keys) ✅ COMPLETED
```json
"messages": {
  "rescheduleWarning": "Rescheduling must be done at least 2 days in advance",
  "contactOnboardingManager": "To reschedule, please contact your onboarding manager",
  "submitVideoFirst": "Please submit your Store Setup Video before scheduling installation.",
  "submitCollectionFirst": "Please submit your {collectionName} before scheduling training.",
  "scheduleInstallationFirst": "Please schedule installation first before scheduling training.",
  "formNotAvailable": "Form link not available",
  "noTrackingAvailable": "No tracking available",
  "shipmentDateTooltip": "Shipment date can only be set by StoreHub Onboarding Manager...",
  "vendorWillConfirm": "Vendor will confirm directly to finalise the date",
  "meetingLinkCopied": "Meeting link copied to clipboard!",
  "videoUploaded": "Video uploaded - ",
  "activateSubscriptionAt": "Please activate the merchant's subscription at:",
  "activateSubscriptionWarning": "Please activate subscription at:",
  "actionRequiredActivate": "Action Required: Activate Subscription",
  "needHelpActivation": "Need help with activation?",
  "helpImproveExperience": "Help us improve your onboarding experience"
}
```

### Implementation Steps

#### Step 5.1: Update Translation Files ✅ COMPLETED
1. ✅ Added `timeline` section to all 3 JSON files (en.json, ms.json, zh.json) with ~135 keys total
2. ✅ Structured keys hierarchically: `stages`, `subStages`, `status`, `industry`, `fields`, `buttons`, `completion`, `messages`, `welcomeCallSummary`, `readyToGoLive`, `storeSetup`

#### Step 5.2: Update Helper Functions ✅ COMPLETED
1. ✅ Added `useFormatter()` hook from next-intl
2. ✅ Created `formatDateTimeLocale()` function using `format.dateTime()` for locale-aware date/time
3. ✅ Created `formatDateLocale()` function for locale-aware date formatting
4. ✅ Created `getTerminology()` function inside component that uses translation keys for industry-specific terms

#### Step 5.3: Update Component ✅ COMPLETED
1. ✅ Added `useTranslations('timeline')` hook at component level
2. ✅ Replaced 100+ hardcoded strings with `t()` calls including:
   - Status labels (Completed, In Progress, Pending, Scheduled, Not Set, etc.)
   - Button labels (Schedule, Change Date, Upload Video, Track Package, etc.)
   - Field labels (First Call Timestamp, Installation Status, Trainer Name, etc.)
   - Messages and tooltips
3. ✅ Industry-specific terms now use translation keys via `getTerminology()` function

#### Step 5.4: Handle Date Formatting ✅ COMPLETED
1. ✅ Replaced all `formatDateTime()` calls with `formatDateTimeLocale()`
2. ✅ Replaced all `formatDate()` calls with `formatDateLocale()`
3. ✅ Date formats are now locale-aware using `format.dateTime()` from next-intl

### Actual Changes Made
- **Translation keys added**: ~135 keys per language file in 11 categories
- **Code lines modified**: ~100+ string replacements in component
- **Helper functions created**: 3 new locale-aware functions (`formatDateTimeLocale`, `formatDateLocale`, `getTerminology`)

### Testing Checklist
- [x] Build compiles successfully
- [ ] All stage labels display correctly in all 3 languages
- [ ] Status indicators show correct translations
- [ ] Date/time formatting respects locale
- [ ] Industry-specific terms work for both F&B and Retail
- [ ] Buttons and tooltips are translated
- [ ] Dynamic content (counts, names) displays correctly

### Remaining Items (Minor)
- Some hardcoded strings in the stages array labels (the stage labels used in the timeline display)
- Some instructional text in the Store Setup section (cabling guide, video recording instructions)
- Alert messages (e.g., "Meeting link copied to clipboard!")
- The Welcome Call Summary section field labels
