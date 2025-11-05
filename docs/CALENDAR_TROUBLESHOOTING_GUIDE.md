# Calendar Availability Troubleshooting Guide

## Quick Diagnosis Flowchart

```
Calendar showing as available when it shouldn't?
│
├─> 1. Check Event Status
│   └─> Is event marked as "Busy" in Lark?
│       ├─> No → Change to "Busy" ✓
│       └─> Yes → Continue to step 2
│
├─> 2. Check OAuth Status
│   └─> Run: /api/installers/authorization-status
│       ├─> Not authorized → User needs to authorize
│       └─> Authorized → Continue to step 3
│
├─> 3. Run Debug Endpoint
│   └─> /api/debug/installer-availability?date=YYYY-MM-DD&email=xxx
│       ├─> No busy times found → Check Lark User ID
│       ├─> Wrong format → Check FreeBusy response parsing
│       └─> Events marked "Free" → Change to "Busy" in Lark
│
└─> 4. Check Calendar Configuration
    └─> Verify PRIMARY calendar is being checked
        └─> Not group calendar or external sync
```

## Common Issues and Solutions

### Issue 1: Events Not Blocking Availability

**Symptoms:**
- Calendar shows events in Lark
- Portal shows time slots as available
- Events are confirmed and not cancelled

**Solutions:**
1. **Check Event "Show as" Status**
   ```
   In Lark Calendar:
   - Open the event
   - Check "Show as" field
   - Must be set to "Busy" (not "Free")
   ```

2. **Verify FreeBusy API Response**
   ```bash
   # Use debug endpoint
   curl "http://localhost:3000/api/debug/installer-availability?date=2025-11-06&email=user@storehub.com"
   
   # Check response for:
   - freeBusyFormat: "nested (user_id with busy_time array)"
   - freeBusyData: Should contain busy periods
   - freeEvents: Events marked as "Free" (won't block)
   ```

### Issue 2: User Not Found / No Availability Data

**Symptoms:**
- No busy times returned
- User appears always available
- FreeBusy returns empty

**Solutions:**
1. **Check OAuth Authorization**
   ```bash
   # Check authorization status
   curl "http://localhost:3000/api/installers/authorization-status"
   ```

2. **Verify Lark User ID**
   ```sql
   -- Check in database
   SELECT userEmail, larkUserId, calendarId 
   FROM LarkAuthToken 
   WHERE userEmail = 'user@storehub.com';
   
   -- Should have format: ou_xxxxx
   ```

3. **Re-authorize if needed**
   - Send user to `/installers/authorize` or `/trainers/authorize`
   - Complete OAuth flow
   - Verify token is saved

### Issue 3: Recurring Events Not Detected

**Symptoms:**
- One-time events work
- Recurring events don't block
- Weekly/monthly meetings not detected

**Solutions:**
1. **Check Event Instances API**
   - Recurring events need `/instances` endpoint
   - Verify in `lib/lark.ts` lines 599-607

2. **Debug Specific Date**
   ```bash
   # Check if recurring instances are expanded
   curl "http://localhost:3000/api/debug/installer-availability?date=2025-11-13&email=user@storehub.com"
   ```

### Issue 4: Wrong Calendar Being Checked

**Symptoms:**
- Personal events not blocking
- Only group events blocking (or vice versa)
- External calendar events missing

**Solutions:**
1. **Verify PRIMARY Calendar**
   - Code uses `'primary'` calendar ID
   - Check `lib/lark.ts` line 567

2. **Check Calendar List**
   - User might have multiple calendars
   - FreeBusy checks all calendars if configured correctly

## Debug Endpoints Reference

### 1. Installer Availability Debug
```bash
GET /api/debug/installer-availability?date=YYYY-MM-DD&email=user@storehub.com
```

**Response includes:**
- OAuth token status
- Lark user ID
- FreeBusy raw response
- Calendar events with free/busy status
- Computed availability
- Mismatches between expected and actual

### 2. Faizul Calendar Debug (Specific Installer)
```bash
GET /api/debug/faizul-calendar
```

**Checks:**
- Specific installer's calendar
- Time slots availability
- Event free/busy status

### 3. Authorization Status
```bash
GET /api/installers/authorization-status
GET /api/trainers/authorization-status
```

**Returns:**
- List of authorized users
- OAuth token status
- Last authorization date

## Database Queries for Troubleshooting

### Check User Authorization
```sql
-- View all authorized users
SELECT 
  userEmail,
  larkUserId,
  calendarId,
  createdAt,
  updatedAt
FROM LarkAuthToken
ORDER BY updatedAt DESC;

-- Check specific user
SELECT * FROM LarkAuthToken 
WHERE userEmail = 'user@storehub.com';
```

### Check Calendar IDs
```sql
-- View stored calendar IDs
SELECT 
  email,
  calendarId,
  resolvedCalendarId,
  lastUpdated
FROM CalendarId;
```

## Environment Variables Check

Ensure these are set correctly:
```bash
LARK_APP_ID=cli_xxxxx
LARK_APP_SECRET=xxxxx
LARK_DOMAIN=https://open.larksuite.com
```

## Logs to Monitor

### Key Log Messages
```
✅ FreeBusy API returned X busy periods
⚠️ FreeBusy API returned unexpected format
❌ No Lark user ID found for user@example.com
📅 Using PRIMARY calendar for availability checking
🔁 RECURRING EVENT DEFINITION: "Meeting Name"
```

### Error Patterns
- "No OAuth token found" → User needs to authorize
- "FreeBusy API returned unexpected format" → Response parsing issue
- "No Lark user ID found" → Database issue or user not synced
- "Events marked as FREE" → Calendar configuration issue

## Preventive Measures

1. **Regular Health Checks**
   - Schedule daily test of availability endpoints
   - Monitor for OAuth token expiration
   - Alert on FreeBusy API failures

2. **User Training**
   - Document how to mark events as "Busy"
   - Provide authorization instructions
   - Create user guide for calendar setup

3. **Code Robustness**
   - Handle both nested and flat API responses
   - Add comprehensive error logging
   - Implement retry logic for API calls

## Support Escalation

If issue persists after following this guide:

1. **Collect Debug Data**
   - Run all debug endpoints
   - Save responses
   - Note event IDs and times

2. **Check API Documentation**
   - Verify Lark API hasn't changed
   - Check for service announcements

3. **Review Recent Changes**
   - Check git log for calendar-related changes
   - Review deployment logs

4. **Contact Points**
   - Technical Lead: Review debug endpoint responses
   - Lark Support: API-specific issues
   - Database Admin: OAuth token or data issues