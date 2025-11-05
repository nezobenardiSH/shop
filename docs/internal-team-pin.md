# Internal Team Universal PIN

## Overview

The internal team can use a universal PIN code **`0000`** to log into **any merchant page** without needing to know the merchant's actual phone numbers. This allows the StoreHub team to access merchant portals for support, testing, and monitoring purposes.

## How It Works

### For Internal Team Members

1. Navigate to any merchant page: `/merchant/[merchantId]`
2. Enter PIN: **`0000`**
3. Click "Login"
4. You will be logged in as **"StoreHub Team"**

### What Happens Behind the Scenes

When PIN `0000` is entered:
- ✅ Access is granted to the merchant page (regardless of which merchant)
- ✅ Session is flagged as `isInternalUser: true`
- ✅ User type is set to `internal_team`
- ✅ Display name is set to "StoreHub Team"
- ✅ Login is logged with internal team flag for analytics

### JWT Token Payload

Sessions using the internal team PIN include these fields:

```json
{
  "merchantId": "a0yBE000002SwCnYAK",
  "trainerId": "a0yBE000002SwCnYAK",
  "trainerName": "Nasi Lemak Restaurant",
  "userName": "StoreHub Team",
  "isInternalUser": true,
  "userType": "internal_team",
  "pin": "0000"
}
```

## Configuration

### Environment Variable

The PIN is configured in `.env`:

```env
INTERNAL_TEAM_PIN=0000
```

### Changing the PIN

To change the internal team PIN:

1. Update `.env` file:
   ```env
   INTERNAL_TEAM_PIN=1234  # New PIN
   ```

2. Update production environment variables on Render:
   - Go to Render dashboard
   - Navigate to Environment Variables
   - Update `INTERNAL_TEAM_PIN` value
   - Redeploy the service

3. Notify all internal team members of the new PIN

## Security Considerations

### ⚠️ Important Security Notes

1. **Keep Confidential**: Only share this PIN with authorized StoreHub team members
2. **Works for ALL Merchants**: This PIN grants access to every merchant page
3. **Rotate Periodically**: Consider changing the PIN every 3-6 months
4. **Track Usage**: All internal team logins are logged and can be monitored in analytics
5. **No Rate Limiting Bypass**: Internal team PIN is still subject to rate limiting (5 attempts per 15 minutes)

### Best Practices

- ✅ Only use for legitimate support, testing, or monitoring purposes
- ✅ Log out after completing your task
- ✅ Don't share the PIN in public channels (Slack, email, etc.)
- ✅ Use secure communication methods to share the PIN with new team members
- ❌ Don't use the internal PIN when the merchant is actively using their portal
- ❌ Don't make changes on behalf of merchants without their knowledge

## Analytics Tracking

### How Internal Traffic is Tracked

All page views and actions using the internal team PIN are automatically flagged:

- **Page Views**: Logged with `isInternalUser: true`
- **User Type**: Set to `internal_team`
- **User Name**: Displayed as "StoreHub Team"

### Filtering in Analytics Dashboard

When the analytics dashboard is implemented (Phase 1-4), you'll be able to:

- View **merchant-only traffic** (exclude internal team)
- View **internal team traffic only**
- View **all traffic combined**
- See percentage breakdown: "80% merchant, 20% internal team"

This helps you understand:
- Actual merchant engagement vs internal testing
- Which merchants are actively using the portal
- How often internal team accesses merchant pages

## Testing

### Automated Tests

Run the test script to verify the internal team PIN works:

```bash
node scripts/test-internal-team-pin.js
```

Expected output:
```
✅ Internal team PIN validation works correctly!
✅ Merchant PIN validation works correctly!
✅ Invalid PIN rejection works correctly!
```

### Manual Testing

1. **Test Internal Team Login**:
   - Go to: `/merchant/a0yBE000002SwCnYAK` (or any merchant ID)
   - Enter PIN: `0000`
   - Expected: Login successful, shows "Welcome, StoreHub Team"

2. **Test Merchant Login Still Works**:
   - Go to: `/merchant/a0yBE000002SwCnYAK`
   - Enter PIN: `2454` (actual merchant PIN)
   - Expected: Login successful, shows merchant's actual name

3. **Check Browser Console**:
   - After logging in with `0000`
   - Open browser console (F12)
   - Look for: `🔧 Internal team login detected for merchant: [Merchant Name]`

## Implementation Details

### Files Modified

1. **`.env`** - Added `INTERNAL_TEAM_PIN=0000`
2. **`lib/auth-utils.ts`** - Added `isInternalTeamPIN()` function and updated `validatePINWithUser()`
3. **`app/api/auth/merchant-login/route.ts`** - Added internal team detection and token payload

### Code Flow

```
User enters PIN 0000
    ↓
validatePINWithUser() checks if PIN === INTERNAL_TEAM_PIN
    ↓
Returns { isValid: true, userName: "StoreHub Team", isInternalUser: true }
    ↓
generateToken() includes isInternalUser and userType in JWT
    ↓
Session cookie is set with internal team flag
    ↓
User is logged in as "StoreHub Team"
```

## Troubleshooting

### PIN 0000 Not Working

1. **Check Environment Variable**:
   ```bash
   # In terminal
   echo $INTERNAL_TEAM_PIN
   # Should output: 0000
   ```

2. **Restart Development Server**:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

3. **Check Production Environment**:
   - Verify `INTERNAL_TEAM_PIN` is set on Render
   - Redeploy if needed

4. **Clear Browser Cache**:
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - Or use incognito mode

### Rate Limiting

If you see "Too many attempts":
- Wait 15 minutes
- Or restart the server (development)
- Or restart the service on Render (production)

## Future Enhancements

Potential improvements for the internal team PIN feature:

1. **IP Whitelist**: Only allow PIN 0000 from office IP addresses
2. **Audit Log**: Detailed logging of all internal team actions
3. **Time-Based Codes**: Generate temporary PINs that expire
4. **Multi-Factor Auth**: Require additional verification for internal team
5. **Role-Based Access**: Different PINs for different team roles (support, admin, etc.)

## FAQ

**Q: Can merchants accidentally discover this PIN?**
A: It's unlikely, but possible. The PIN is not documented anywhere public. If a merchant tries `0000`, they would be logged in as "StoreHub Team" which would be confusing but not harmful.

**Q: What if a merchant's actual PIN is 0000?**
A: The internal team PIN check happens first, so it would always log them in as "StoreHub Team" instead of their actual name. This is a rare edge case. If it happens, ask the merchant to update one of their phone numbers.

**Q: Can I use this PIN on the admin page?**
A: No, this PIN only works for merchant pages (`/merchant/[merchantId]`). The admin page (`/admin`) has its own authentication (product@storehub.com).

**Q: Is this PIN logged in Salesforce?**
A: No, the PIN is only used for portal authentication. It's not stored or logged in Salesforce.

**Q: Can I change the PIN to something other than 0000?**
A: Yes, update the `INTERNAL_TEAM_PIN` environment variable to any 4-digit code.

---

**Last Updated**: 2025-11-05
**Status**: ✅ Implemented and Tested

