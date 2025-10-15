# Trainer Information

## Overview
This document explains how trainer information is managed in the Onboarding Portal system.

**⚠️ IMPORTANT: Source of Truth**
All trainer information is stored in **`config/trainers.json`**. This is the single source of truth for:
- Trainer names and emails
- Language capabilities
- Location coverage (states/regions)
- Lark User IDs and Calendar IDs
- Salesforce IDs

**Do NOT duplicate trainer data in this document.** Always refer to and update `config/trainers.json` directly.

---

## How to Add a New Trainer

### Step 1: Update `config/trainers.json`

Add a new trainer object to the `trainers` array:

```json
{
  "name": "Trainer Name",
  "email": "trainer.email@storehub.com",
  "larkUserId": "",
  "calendarId": "primary",
  "salesforceId": "",
  "languages": ["English", "Bahasa Malaysia", "Chinese"],
  "location": ["Kuala Lumpur", "Selangor"]
}
```

**Field Descriptions:**
- `name`: Display name (first name or nickname)
- `email`: StoreHub email address (used for Lark OAuth)
- `larkUserId`: Leave empty initially (fetched after OAuth)
- `calendarId`: Use `"primary"` for main calendar
- `salesforceId`: Leave empty unless linking to Salesforce
- `languages`: Array of languages the trainer can conduct training in
  - Options: `"English"`, `"Bahasa Malaysia"`, `"Chinese"`
- `location`: Array of states/regions the trainer covers
  - Examples: `"Kuala Lumpur"`, `"Selangor"`, `"Penang"`, `"Johor"`, etc.
  - Leave empty or omit if trainer can cover all locations

### Step 2: Authorize Trainer's Lark Calendar

1. Commit and push the changes to `config/trainers.json`
2. Wait for deployment to complete (~2 minutes)
3. Visit: `https://onboarding-portal-b0ay.onrender.com/trainers/authorize`
4. Click "Authorize" next to the new trainer's name
5. Complete the Lark OAuth flow
6. The system will automatically fetch and store the Lark User ID and Calendar ID

### Step 3: Verify

1. Check that the trainer appears in the authorization page
2. After authorization, verify the trainer shows in merchant booking flow
3. Test booking a session with the new trainer

---

## Current Trainers

**To view current trainers, check:** `config/trainers.json`

The system automatically loads trainers from this file. No code changes needed.

---

## Language Capabilities

Trainers can conduct training in the following languages:

| Language | Code | Trainers |
|----------|------|----------|
| English | `"English"` | Check `config/trainers.json` |
| Bahasa Malaysia | `"Bahasa Malaysia"` | Check `config/trainers.json` |
| Chinese (Mandarin) | `"Chinese"` | Check `config/trainers.json` |

**Note:** The system automatically matches trainers to merchants based on language preferences.

---

## Trainer Availability

Trainer availability is determined by:
1. **Lark Calendar**: Real-time calendar integration via OAuth
2. **Busy Times**: Events marked as "busy" in their calendar
3. **Free Times**: Events marked as "free" do NOT block availability
4. **Recurring Events**: Automatically expanded to show all instances

**See:** `docs/training-calendar.md` for detailed calendar integration documentation.

---

## Troubleshooting

### Trainer Not Showing on Authorization Page
- Check that trainer is added to `config/trainers.json`
- Verify JSON syntax is valid (no trailing commas, proper quotes)
- Check deployment logs for errors
- Restart the application if needed

### Trainer Not Showing in Booking Flow
- Ensure trainer has completed Lark OAuth authorization
- Check that `larkUserId` and `calendarId` are populated
- Verify trainer has at least one language in common with merchant
- Check trainer's calendar for availability

### Calendar Not Syncing
- Re-authorize the trainer's Lark calendar
- Check OAuth token expiration
- Verify calendar permissions in Lark
- See `docs/training-calendar.md` for calendar debugging

---

## System Architecture

### Configuration File
**Location:** `config/trainers.json`

**Structure:**
```json
{
  "trainers": [
    { /* trainer 1 */ },
    { /* trainer 2 */ },
    { /* trainer 3 */ }
  ],
  "defaultCalendarId": "primary",
  "timezone": "Asia/Singapore",
  "defaultTrainer": { /* fallback trainer */ }
}
```

### How Trainers Are Loaded

1. **Server Startup**: `config/trainers.json` is loaded into memory
2. **Authorization Page**: Displays all trainers from config
3. **Booking Flow**: Filters trainers by language, location, and availability
4. **Calendar Sync**: Uses trainer email to fetch Lark calendar data

### Location-Based Assignment

The system automatically matches trainers to merchants based on location:

**Current Trainer Coverage:**
- **Nezo**: Kuala Lumpur, Selangor
- **Jia En**: Penang
- **Izzudin**: Johor

**How It Works:**
1. System extracts state from merchant's address
2. Filters trainers who cover that state
3. Only shows availability for matching trainers
4. Falls back to all trainers if location cannot be determined

**Example:**
- Merchant address: "123 Jalan Ampang, Kuala Lumpur"
- Extracted location: "Kuala Lumpur"
- Matched trainer: Nezo
- Result: Only Nezo's availability is shown

See [Location-Based Trainer Assignment](./LOCATION-BASED-TRAINER-ASSIGNMENT.md) for detailed documentation.

### Related Files

- `config/trainers.json` - Trainer configuration (SOURCE OF TRUTH)
- `lib/lark.ts` - Lark Calendar API integration
- `lib/trainer-availability.ts` - Availability calculation logic
- `lib/location-matcher.ts` - Location extraction and matching logic
- `app/trainers/authorize/page.tsx` - OAuth authorization UI
- `docs/training-calendar.md` - Calendar integration documentation
- `docs/LOCATION-BASED-TRAINER-ASSIGNMENT.md` - Location-based assignment documentation

---

## Best Practices

1. **Always update `config/trainers.json` directly** - Don't duplicate data elsewhere
2. **Use consistent language names** - Exactly: `"English"`, `"Bahasa Malaysia"`, `"Chinese"`
3. **Use consistent location names** - Use full state names: `"Kuala Lumpur"`, `"Selangor"`, `"Penang"`, `"Johor"`
4. **Test after adding trainers** - Complete OAuth flow and verify booking works
5. **Keep emails accurate** - Email is used for Lark OAuth and calendar access
6. **Document changes** - Use clear commit messages when updating trainers
7. **Verify location coverage** - Ensure all Malaysian states are covered by at least one trainer

---

*Last Updated: October 2025*
*Document Owner: Engineering Team*
*For updates, modify `config/trainers.json` directly*