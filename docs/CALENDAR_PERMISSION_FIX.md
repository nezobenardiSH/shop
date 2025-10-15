# Calendar Event Creation Permission Fix

## Issue
Bookings show "success" but no calendar events are created. Error: **"no calendar access_role"**

## Root Cause
The trainers' OAuth tokens don't have **write permission** to create calendar events. They only have read permission.

## Solution
All trainers need to **re-authorize** the Lark app to grant calendar write permissions.

---

## Steps to Fix

### For Each Trainer (Nezo, Jia En, Izzudin):

1. **Visit the authorization page**:
   ```
   https://your-portal-url.com/trainers/authorize
   ```

2. **Revoke existing authorization**:
   - Find your name in the list
   - Click the **"Revoke"** button next to your name
   - Confirm the revocation

3. **Re-authorize with correct permissions**:
   - Click the **"Authorize"** button next to your name
   - You'll be redirected to Lark
   - **IMPORTANT**: Review the permissions requested:
     - ✅ Read calendar information
     - ✅ **Create calendar events** ← This is the key permission!
     - ✅ Update calendar events
     - ✅ Delete calendar events
     - ✅ View free/busy information
   - Click **"Allow"** or **"Authorize"** to grant all permissions
   - You'll be redirected back to the portal

4. **Verify authorization**:
   - Your status should show **"Authorized"** with a green checkmark
   - The "Authorize" button should change to "Revoke"

---

## Testing After Re-Authorization

1. Go to a merchant page (e.g., `/merchant/nasi-lemak`)
2. Click "Schedule POS Training" or "Schedule BackOffice Training"
3. Select a date and time slot
4. Select language(s)
5. Click "Confirm Booking"
6. **Expected result**: 
   - ✅ "Booking confirmed successfully!" message
   - ✅ Calendar event created in your Lark calendar
   - ✅ Salesforce updated with training date

---

## Why This Happened

When trainers first authorized the app, the OAuth scopes might not have included calendar write permissions, or the permissions were not properly granted. The app can:
- ✅ Read your calendar (to check availability)
- ❌ Create events in your calendar (missing permission)

After re-authorization with the correct scopes, the app will be able to:
- ✅ Read your calendar
- ✅ **Create events in your calendar**
- ✅ Update events
- ✅ Delete events

---

## Technical Details

### Required OAuth Scopes
```
calendar:calendar
calendar:calendar.event:create  ← This is the missing permission
calendar:calendar.event:read
calendar:calendar.event:update
calendar:calendar.event:delete
calendar:calendar.free_busy:read
```

### Error Message
```
Lark API error: no calendar access_role
```

This error means the user's access token doesn't have the `access_role` needed to create events in the calendar.

---

## Verification

After all trainers have re-authorized, verify by:

1. **Check authorization status**:
   - Visit `/trainers/authorize`
   - All trainers should show "Authorized" status

2. **Test booking**:
   - Create a test booking
   - Check the trainer's Lark calendar
   - Event should appear with merchant details

3. **Check logs**:
   - Look for: `✅ Event created successfully with ID: [event-id]`
   - Should NOT see: `❌ Lark booking failed with error`

---

## If Issues Persist

1. **Check Lark App Permissions**:
   - Go to Lark Developer Console: https://open.larksuite.com/app
   - Select your app
   - Go to "Permissions & Scopes"
   - Verify these scopes are enabled:
     - `calendar:calendar`
     - `calendar:calendar.event:create`
     - `calendar:calendar.event:read`
     - `calendar:calendar.event:update`
     - `calendar:calendar.event:delete`
     - `calendar:calendar.free_busy:read`

2. **Check App Availability**:
   - In Lark Developer Console
   - Go to "Version Management & Release"
   - Ensure the app is published and available to all trainers

3. **Contact Support**:
   - If re-authorization doesn't work, there may be an issue with the Lark app configuration
   - Check with your Lark workspace administrator

