# Lark App Permissions Setup Guide

## Current Status
Your Lark app authentication is working, but it lacks calendar permissions.

## Required Permissions

### 1. Go to Lark Developer Console
Visit: https://open.larksuite.com/app

### 2. Find Your App
- App ID: `cli_a8549d99f97c502f`
- Click on your app to manage it

### 3. Navigate to Permissions & Scopes
In the left sidebar, click on "Permissions & Scopes"

### 4. Add These Required Scopes

#### Calendar Permissions (Required)
- [ ] `calendar:calendar` - View and manage calendars
- [ ] `calendar:calendar:read` - Read calendar information
- [ ] `calendar:event` - Create and modify calendar events
- [ ] `calendar:event:read` - Read calendar events
- [ ] `calendar:freebusy` - Query free/busy information

#### Contact Permissions (Required)
- [ ] `contact:user.email:readonly` - Get user information by email
- [ ] `contact:user.base:readonly` - Get basic user information

#### Optional but Recommended
- [ ] `im:message:send_as_bot` - Send notifications via Lark messenger
- [ ] `calendar:event:delete` - Delete calendar events

### 5. Request Approval (if needed)
Some organizations require admin approval for these permissions:
1. Click "Request Approval" after adding scopes
2. Provide justification: "Required for scheduling training sessions and checking trainer availability"
3. Wait for admin approval

### 6. Verify Permissions
After approval, verify by running:
```bash
node scripts/test-lark-calendar.js
```

## Troubleshooting

### "Access denied" Error
This means the permissions haven't been granted yet. Check:
1. All required scopes are added
2. App is approved (if approval required)
3. Wait 5-10 minutes for changes to propagate

### "User not found" Error
This can happen if:
1. The email doesn't exist in your Lark organization
2. The user hasn't been synced to Lark yet
3. You need the `contact:user.email:readonly` scope

### FreeBusy Returns Empty
Possible causes:
1. `calendar:freebusy` scope not granted
2. User has no calendar events
3. Incorrect date range

## Working in Fallback Mode

While permissions are being fixed, the system will:
1. Use 'primary' as the calendar ID
2. Assume all slots are available (no FreeBusy check)
3. Create mock events if calendar creation fails
4. Skip user lookups and use email as ID

To enable full fallback mode, set in your `.env.local`:
```env
MOCK_LARK_BOOKING=true
MOCK_LARK_BUSY=true
```

## Quick Test Commands

### Test Authentication Only
```javascript
// Quick test in Node REPL
const fetch = require('node-fetch');
fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    app_id: 'cli_a8549d99f97c502f',
    app_secret: 'M7Wzk5ZGORiSJJp7xKjxEdzWEOBVtpNT'
  })
}).then(r => r.json()).then(console.log);
```

### List Your Current Scopes
After getting a token, check what scopes you have:
```javascript
// Use the token from above
fetch('https://open.larksuite.com/open-apis/authen/v1/app_info', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
}).then(r => r.json()).then(d => console.log(d.data?.scopes));
```

## Contact for Help

If you need help with permissions:
1. Contact your Lark workspace admin
2. Check Lark Developer Documentation: https://open.larksuite.com/document
3. Lark Developer Support: https://open.larksuite.com/support

---

Once permissions are granted, all features will work:
- ✅ Real calendar ID retrieval
- ✅ Actual availability checking via FreeBusy
- ✅ Calendar event creation
- ✅ Event modifications and cancellations
- ✅ Multi-trainer scheduling