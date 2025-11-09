# Trainer Authorization Required - Action Items

## Current Status

✅ **Go-Live Date Detection:** WORKING
❌ **Trainer Availability:** NOT WORKING - No trainers have authorized their Lark calendars

## Root Cause

The system is working correctly, but **none of the configured trainers have completed the Lark OAuth authorization process**. Without authorization:

1. No OAuth tokens are stored in the `LarkAuthToken` database table
2. `larkOAuthService.isUserAuthorized()` returns `false` for all trainers
3. `getSingleTrainerAvailability()` returns an empty array
4. No time slots are displayed to merchants

## Configured Trainers

All trainers are configured in `config/trainers.json`:

| Trainer Name | Email | Location | Languages |
|---|---|---|---|
| John Lai | john.lai@storehub.com | Within Klang Valley | English |
| Vwie Gan | vwie.gan@storehub.com | Within Klang Valley | English, Bahasa Malaysia, Chinese |
| Khairul Uwais Fuad | khairuluwais.fuad@storehub.com | Within Klang Valley | English, Bahasa Malaysia |
| Evelyn Cham | evelyn.cham@storehub.com | Within Klang Valley | English, Bahasa Malaysia, Chinese |
| Suvisa Foo | suvisa.foo@storehub.com | Penang | English, Bahasa Malaysia, Chinese |
| Farhan Nasir | farhan.nasir@storehub.com | Johor Bahru | English, Bahasa Malaysia |

## Required Action: Trainer Authorization

Each trainer must authorize their Lark calendar individually:

### Step 1: Share Authorization Link
Send each trainer this link:
- **Production:** `https://onboarding-portal-5fhi.onrender.com/trainers/authorize`
- **Local Dev:** `http://localhost:3010/trainers/authorize`

### Step 2: Trainer Authorization Process
Each trainer should:
1. Visit the authorization link
2. Find their name in the list
3. Click the "Authorize" button
4. Log in with their Lark account
5. Approve calendar permissions
6. System automatically stores OAuth tokens

### Step 3: Verification
After authorization:
- Trainer will show "Authorized" status on the page
- Their availability will be fetched from their Lark calendar
- Time slots will appear in merchant booking modals

## Technical Details

### Database Table: LarkAuthToken
```sql
CREATE TABLE "LarkAuthToken" (
  "userEmail" TEXT UNIQUE,
  "userName" TEXT,
  "larkUserId" TEXT,
  "userType" TEXT,  -- 'trainer', 'installer', or 'manager'
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "expiresAt" TIMESTAMP,
  "calendarId" TEXT,
  ...
)
```

### Authorization Flow
```
Trainer visits /trainers/authorize
  ↓
Clicks "Authorize" button
  ↓
Redirected to Lark OAuth login
  ↓
Trainer logs in with Lark account
  ↓
Approves calendar permissions
  ↓
OAuth callback stores tokens in database
  ↓
Trainer shows as "Authorized"
  ↓
System can now fetch their calendar availability
```

### Code Flow
```
DatePickerModal.fetchAvailability()
  ↓
GET /api/lark/availability?trainerName=...
  ↓
getSingleTrainerAvailability(trainerName)
  ↓
larkOAuthService.isUserAuthorized(trainer.email)
  ↓
Check if record exists in LarkAuthToken table
  ↓
If YES → Fetch availability from Lark calendar
If NO → Return empty array (no slots shown)
```

## Timeline

- **Immediate:** Share authorization link with all trainers
- **Within 24 hours:** Trainers complete authorization
- **After authorization:** Availability will be visible to merchants

## Support

If trainers encounter issues during authorization:
1. Check that they're using their correct Lark account
2. Verify they have calendar permissions in Lark
3. Check browser console for error messages
4. Ensure they're using the correct authorization link

## Next Steps

1. ✅ Go-Live Date constraint is working
2. ⏳ **ACTION REQUIRED:** Trainers must authorize their Lark calendars
3. ⏳ After authorization: Test availability display
4. ⏳ After authorization: Test booking flow

