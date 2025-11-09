# Training Scheduling Issues - Root Cause Analysis

## Issue #1: Go-Live Date Not Detected

### Symptoms
- Debug output shows: `DEBUG: Go-Live Date = NOT SET (null)`
- Calendar allows booking beyond the go-live date
- No date constraint is applied to the booking modal

### Root Cause
The `Planned_Go_Live_Date__c` field is **NULL on the Onboarding_Trainer__c record** in Salesforce.

The system queries in this priority order:
1. **`Onboarding_Trainer__c.Planned_Go_Live_Date__c`** (primary) ← **THIS IS NULL**
2. `Account.Planned_Go_Live_Date__c` (fallback)
3. `Onboarding_Trainer__c.First_Revised_EGLD__c` (fallback)

Since the primary field is NULL, the system checks the fallbacks, but they're also empty.

### Code Flow
```
app/merchant/[merchantId]/page.tsx (line 453-456)
  ↓
const goLiveDate = trainer.plannedGoLiveDate || 
                   trainerData?.account?.plannedGoLiveDate || 
                   trainer.firstRevisedEGLD || 
                   null
  ↓
Passed to DatePickerModal as goLiveDate prop (line 1053)
  ↓
DatePickerModal.isDateAvailable() checks constraint (line 599-630)
  ↓
If goLiveDate is null, no constraint is applied
```

### Solution
**Populate the `Planned_Go_Live_Date__c` field on the Onboarding_Trainer__c record** in Salesforce.

Steps:
1. Open the Onboarding_Trainer__c record for this merchant in Salesforce
2. Set the `Planned_Go_Live_Date__c` field to the desired go-live date
3. Save the record
4. Refresh the merchant portal page

The system will automatically:
1. Query the field from Salesforce
2. Pass it to the booking modal
3. Enforce the constraint (training must be before go-live date)

---

## Issue #2: Trainers Availability Not Detected

### Symptoms
- Calendar shows dates but no available time slots
- No trainer availability is displayed
- "Select a date to view available slots" message appears

### Root Cause
The trainer assigned to this merchant **does not have an OAuth token** in the `LarkAuthToken` database.

The availability system requires:
1. Trainer must be in `config/trainers.json`
2. Trainer must have authorized their Lark calendar (OAuth token stored in DB)
3. System fetches availability from trainer's Lark calendar

### Code Flow
```
DatePickerModal.fetchAvailability() (line 172)
  ↓
GET /api/lark/availability?trainerName=...
  ↓
getSingleTrainerAvailability() (lib/trainer-availability.ts:498)
  ↓
larkOAuthService.isUserAuthorized(trainer.email) (line 524)
  ↓
Checks if record exists in LarkAuthToken table
  ↓
If NO token found → returns empty array [] (line 528)
  ↓
No availability slots shown to user
```

### Solution
**Trainer must authorize their Lark calendar:**

1. Visit: `http://localhost:3010/trainers/authorize` (or production URL)
2. Find the trainer's name in the list
3. Click "Authorize" button
4. Complete Lark OAuth flow (login with Lark account)
5. System stores OAuth tokens in database
6. Availability will now be fetched from trainer's Lark calendar

### Verification
After authorization:
- Trainer should show "Authorized" status on `/trainers/authorize` page
- Calendar will display available time slots
- Bookings can be created

---

## Technical Details

### Database Schema
```sql
-- LarkAuthToken table stores OAuth tokens
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

### Configuration
Trainers are configured in `config/trainers.json`:
```json
{
  "trainers": [
    {
      "name": "Trainer Name",
      "email": "trainer@example.com",
      "languages": ["English", "Chinese"],
      "location": "Within Klang Valley"
    }
  ]
}
```

### API Endpoints
- `GET /api/lark/availability` - Fetches trainer availability
- `GET /trainers/authorize` - Trainer authorization page
- `GET /api/trainers/authorization-status` - Check authorization status

---

## Summary

| Issue | Root Cause | Solution |
|-------|-----------|----------|
| Go-Live Date NULL | Field not set in Salesforce | Populate `Planned_Go_Live_Date__c` in Salesforce |
| No Trainer Availability | Trainer not authorized | Visit `/trainers/authorize` and complete OAuth |

Both issues are **data/configuration issues**, not code bugs. The system is working correctly.

