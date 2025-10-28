# Migration to Salesforce ID as Primary Identifier

**Date:** October 27, 2025  
**Status:** ✅ Complete

## Overview

The system has been migrated from using the `Onboarding_Trainer__c.Name` field (free-text, mutable) to using the `Onboarding_Trainer__c.Id` field (Salesforce ID, immutable) as the primary identifier for merchants.

## Why This Change?

### Problems with Name-Based Identification:
- ❌ **Mutable** - Names can be changed in Salesforce at any time
- ❌ **Not unique** - Potential for duplicate names
- ❌ **Complex encoding** - Required special handling for spaces, hyphens, special characters
- ❌ **Fragile** - URL encoding/decoding issues with trailing hyphens and special characters
- ❌ **Security risk** - Changing a name could break authentication and access control

### Benefits of Salesforce ID:
- ✅ **Immutable** - Salesforce IDs never change
- ✅ **Unique** - Guaranteed unique across all records
- ✅ **No encoding issues** - Alphanumeric only, no special characters
- ✅ **Faster queries** - Indexed primary key lookups
- ✅ **Secure** - Cannot be changed, preventing access control issues

## Changes Made

### 1. API Routes

#### `app/api/auth/merchant-login/route.ts`
**Before:**
```typescript
WHERE Name = '${escapedMerchantId}'
```

**After:**
```typescript
WHERE Id = '${merchantId}'
```

#### `app/api/salesforce/merchant/[merchantId]/route.ts`
**Before:**
```typescript
const trainerName = resolvedParams.merchantId
// Complex name conversion logic...
WHERE Name = '${escapedTrainerName}'
```

**After:**
```typescript
const trainerId = resolvedParams.merchantId
WHERE Id = '${trainerId}'
```

### 2. Middleware

#### `middleware.ts`
**Before:**
```typescript
const tokenMerchantId = payload.merchantId as string
if (urlMerchantId.toLowerCase() !== tokenMerchantId.toLowerCase())
```

**After:**
```typescript
const tokenTrainerId = payload.trainerId as string
if (urlMerchantId !== tokenTrainerId)  // Exact match, case-sensitive
```

### 3. Frontend Components

#### `components/LoginForm.tsx`
**Before:**
```typescript
const formattedName = merchantId.replace(/-/g, ' ')
setDisplayName(formattedName)
```

**After:**
```typescript
// Fetch merchant name from API
const response = await fetch(`/api/salesforce/merchant/${merchantId}`)
const data = await response.json()
setDisplayName(data.name)
```

#### `components/PageHeader.tsx`
**Before:**
```typescript
interface PageHeaderProps {
  merchantName: string
  // ...
}
const formattedMerchantName = merchantName.replace(/-/g, ' ')
```

**After:**
```typescript
interface PageHeaderProps {
  merchantId: string
  merchantName: string
  // ...
}
// merchantName is now the actual name from Salesforce
```

#### `components/MerchantHeader.tsx`
**Before:**
```typescript
const loginPath = merchantName ? `/login/${merchantName.toLowerCase().replace(/\s+/g, '-')}` : '/login'
```

**After:**
```typescript
const loginPath = merchantId ? `/login/${merchantId}` : '/login'
```

### 4. Merchant Pages

#### `app/merchant/[merchantId]/page.tsx` & `app/merchant/[merchantId]/details/page.tsx`
**Before:**
```typescript
const trainerName = params.merchantId as string
const response = await fetch(`/api/salesforce/merchant/${trainerName}`)
router.push(`/merchant/${trainerName}`)
```

**After:**
```typescript
const merchantId = params.merchantId as string
const response = await fetch(`/api/salesforce/merchant/${merchantId}`)
const merchantName = trainerData?.success && trainerData?.name ? trainerData.name : 'Loading...'
router.push(`/merchant/${merchantId}`)
```

## URL Format Changes

### Old Format (Name-Based):
```
/login/Nasi-Lemak
/merchant/Nasi-Lemak
/merchant/Nasi-Lemak/details
/merchant/Nasi-Lemak?booking=pos-training
```

### New Format (Salesforce ID):
```
/login/a0yBE000002SwCnYAK
/merchant/a0yBE000002SwCnYAK
/merchant/a0yBE000002SwCnYAK/details
/merchant/a0yBE000002SwCnYAK?booking=pos-training
```

## How to Get Merchant URLs

### Option 1: From Salesforce
1. Open the Onboarding Trainer record in Salesforce
2. Copy the record ID from the URL (e.g., `a0yBE000002SwCnYAK`)
3. Use it in the portal URL: `https://your-domain.com/login/a0yBE000002SwCnYAK`

### Option 2: From Salesforce Formula Field
Create a formula field in Salesforce:
```
"https://your-domain.com/login/" & Id
```

### Option 3: From Salesforce Custom Button
```javascript
var merchantId = '{!Onboarding_Trainer__c.Id}';
var url = 'https://your-domain.com/login/' + merchantId;
window.open(url, '_blank');
```

## Testing

### Test with Existing Merchant:
```bash
# Old URL (will no longer work):
http://localhost:3010/login/Nasi-Lemak

# New URL (use Salesforce ID):
http://localhost:3010/login/a0yBE000002SwCnYAK
```

### Get Salesforce ID for Testing:
```javascript
// In Salesforce Developer Console
SELECT Id, Name FROM Onboarding_Trainer__c WHERE Name = 'Nasi Lemak'
```

## Migration Checklist

- [x] Update login API to use Salesforce ID
- [x] Update merchant data API to use Salesforce ID
- [x] Update middleware authentication
- [x] Update LoginForm component
- [x] Update PageHeader component
- [x] Update MerchantHeader component
- [x] Update merchant dashboard page
- [x] Update merchant details page
- [x] Update all router.push() calls
- [x] Test compilation (no errors)
- [ ] Update test files with new URLs
- [ ] Update documentation with new URL format
- [ ] Communicate changes to users
- [ ] Update any external links (emails, SMS, etc.)

## Breaking Changes

⚠️ **All existing URLs using merchant names will stop working**

Users with bookmarked URLs or saved links will need to update them to use the new Salesforce ID format.

## Backward Compatibility

There is **NO backward compatibility** for old URLs. This is intentional for security reasons - we don't want to maintain a mapping that could be exploited if names change.

## Next Steps

1. ✅ Code changes complete
2. ⏳ Update test files to use Salesforce IDs
3. ⏳ Update documentation
4. ⏳ Communicate to users
5. ⏳ Update any automated systems (email templates, SMS, etc.)

## Support

If you need to find a merchant's Salesforce ID:
1. Go to Salesforce
2. Search for the Onboarding Trainer record
3. The ID is in the URL: `https://storehub.lightning.force.com/lightning/r/Onboarding_Trainer__c/a0yBE000002SwCnYAK/view`
4. Copy the 18-character ID: `a0yBE000002SwCnYAK`

