# Surftek API Integration Plan

## Overview
Integrate the Surftek Create Ticket API to automate external vendor installation bookings, replacing the manual MSM workflow.

## Device Type Detection System

### Detection Logic (Priority Order)

1. **Check Order Items for POS Devices**
   - Query `OrderItem` with `Product2.Name`
   - Exclude non-POS items (peripherals + marketing):
     - Printer, Receipt Printer, Kitchen Printer
     - Cash Drawer
     - Scanner, Barcode Scanner
     - Kitchen Display, KDS
     - Collateral, Marketing
     - Discount, Voucher, Promo
   - If any remaining items exist → **Android** (ServiceId: 39)

2. **Analyze Onboarding_Summary__c with Keywords First**
   - If no POS device in order, check summary for keywords:
     - Android indicators: `android`, `sunmi`, `v2`, `t2`, `d3`
     - iOS indicators: `ipad`, `ios`, `own device`, `bring own`, `merchant device`
   - If keywords unclear → use Claude API as fallback
   - MSM often notes: "merchant has their own iPad" or "using Sunmi device"

3. **Default Fallback**
   - If still unclear → **iOS** (ServiceId: 1)
   - Rationale: Merchant likely has their own iPad if no POS in order

### ServiceId Mapping
| Condition | ServiceId | Description |
|-----------|-----------|-------------|
| POS device in order | 39 | Android Hardware Installation |
| Summary mentions Android/Sunmi | 39 | Android Hardware Installation |
| Summary mentions iOS/iPad/own device | 1 | iOS Hardware Installation |
| No POS, unclear summary | 1 | iOS Hardware Installation (default) |

---

## Implementation Steps

### Step 1: Create Device Type Detector Module
**File:** `lib/device-type-detector.ts`

```typescript
// NON_POS_KEYWORDS - items to exclude when detecting POS devices
const NON_POS_KEYWORDS = [
  'printer', 'receipt', 'kitchen printer',
  'cash drawer', 'drawer',
  'scanner', 'barcode',
  'kitchen display', 'kds',
  'collateral', 'marketing',
  'discount', 'voucher', 'promo', 'coupon'
]

// Functions:
// - isPosDevice(productName: string): boolean
// - detectDeviceTypeFromOrder(orderItems: Product[]): 'android' | null
// - detectDeviceTypeFromSummary(summary: string): Promise<'android' | 'ios' | null>
// - getDeviceType(orderItems: Product[], summary: string): Promise<'android' | 'ios'>
```

### Step 2: Create Surftek API Client
**File:** `lib/surftek-api.ts`

```typescript
interface SurftekTicketRequest {
  Ticket: {
    Name: string           // Contact name
    Phone: string          // Contact phone
    Issue: string          // "*Onsite Support"
    Priority: number       // 0 = Normal
    IsReceiveSms: boolean
    Email?: string
    Remark: string         // Hardware list, notes
    StoreName: string      // Merchant name
    DealerReseller?: string
  }
  Appointment: {
    Address: string
    State: string
    ServiceId: number      // 1=iOS, 39=Android
    Longitude: number
    Latitude: number
  }
}

// Functions:
// - createTicket(request: SurftekTicketRequest): Promise<SurftekResponse>
// - mapMerchantToTicket(merchantDetails, deviceType): SurftekTicketRequest
```

### Step 3: Add Geocoding for Lat/Long
**File:** `lib/geocoding.ts`

- Use **Google Maps Geocoding API** (most accurate for Malaysia)
- Cost: ~$5 per 1000 requests (low volume = minimal cost)
- Convert merchant address to latitude/longitude
- Cache results in DB to avoid repeated API calls for same address
- Fallback: Use Malaysia state center coordinates if API fails

```typescript
// Google Maps Geocoding API
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

// Function signature
async function geocodeAddress(address: string): Promise<{lat: number, lng: number}>

// Fallback coordinates for Malaysian states (if API fails)
const FALLBACK_COORDS = {
  'selangor': { lat: 3.0738, lng: 101.5183 },
  'kuala lumpur': { lat: 3.1390, lng: 101.6869 },
  'penang': { lat: 5.4164, lng: 100.3327 },
  'johor': { lat: 1.4927, lng: 103.7414 },
  'sabah': { lat: 5.9788, lng: 116.0753 },
  'sarawak': { lat: 1.5533, lng: 110.3592 },
  'default': { lat: 3.1390, lng: 101.6869 } // KL center
}
```

### Step 4: Integrate into External Installation Flow
**File:** `lib/installer-availability.ts`

Modify `submitExternalInstallationRequest()`:
1. Fetch order items and onboarding summary
2. Call device type detector
3. Geocode the address
4. Build Surftek ticket request
5. Call Surftek API
6. Store TicketId/CaseNum in Onboarding_Portal__c
7. Update notification to show ticket confirmation instead of "vendor will contact you"

### Step 5: Add Environment Variables
```env
SURFTEK_API_URL=https://storehub.trackking.biz/api/ticket/create
SURFTEK_API_TOKEN=tk_f6s4TiMhef7c64FU6wbV1Kt2VurFYkP69G7t
GOOGLE_MAPS_API_KEY=<your-google-maps-api-key>
```

### Step 6: Update Salesforce Fields
Add to `Onboarding_Portal__c`:
- `Surftek_Ticket_ID__c` (Text)
- `Surftek_Case_Number__c` (Text)

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `lib/installer-availability.ts` | Integrate Surftek API in `submitExternalInstallationRequest()` |
| `lib/device-type-detector.ts` | NEW - Device type detection logic |
| `lib/surftek-api.ts` | NEW - Surftek API client |
| `lib/geocoding.ts` | NEW - Address to lat/long conversion |
| `lib/lark-notifications.ts` | Update external vendor notification message |
| `.env` | Add Surftek and geocoding API keys |

---

## Error Handling

| Surftek Error | Action |
|---------------|--------|
| -10000 Invalid parameter | Log error, fall back to manual MSM flow |
| -10004 Too many requests | Implement retry with backoff |
| -10007 Invalid authorization | Alert admin, fall back to manual |
| Other errors | Log, notify MSM, continue with manual flow |

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Geocoding | Google Maps API | Most accurate for Malaysia (~$5/1000 requests) |
| Summary analysis | Keywords first, Claude fallback | Faster for common cases, AI for edge cases |
| API failure fallback | Full fallback to manual flow | Keep Lark base + MSM task as backup |

---

## Fallback Strategy

If Surftek API fails at any point:
1. Log the error with full context
2. **Continue with existing manual flow**:
   - Create Lark base record for tracking
   - Create Salesforce Task for MSM
   - Send Lark notification to MSM
3. Store the failure reason in Onboarding_Portal__c for debugging
4. MSM can manually book on vendor website as before
