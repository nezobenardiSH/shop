# How to Get User Access Tokens for Lark Calendar

## Step 1: Get Your User Access Token

### Option A: Using Lark API Explorer (Easiest)

1. **Go to Lark API Explorer**
   - Visit: https://open.larksuite.com/document/server-docs/api-call-guide/debugging-tools/api-explorer
   - Or for Feishu: https://open.feishu.cn/document/server-docs/api-call-guide/debugging-tools/api-explorer

2. **Login with Your Lark Account**
   - Use your work email (e.g., nezo.benardi@storehub.com)
   - This should be the same account that owns the calendar

3. **Find Your Access Token**
   - After logging in, look for "Authorization" or "Access Token" in the explorer
   - It will look like: `u-xxxxxxxxxxxxxxxxx`
   - Copy this token

### Option B: Using OAuth Playground

1. Visit the OAuth playground for your app
2. Authorize with your account
3. Copy the generated access token

## Step 2: Add Token to Environment

Add the token to your `.env.local` file:

```env
# Option 1: Default token for all operations
LARK_USER_ACCESS_TOKEN=u-your-token-here
LARK_DEFAULT_USER_EMAIL=nezo.benardi@storehub.com

# Option 2: Specific tokens for each trainer
# Replace dots with underscores in email
LARK_USER_TOKEN_nezo_benardi@storehub_com=u-token-for-nezo
LARK_USER_TOKEN_jiaen_chai@storehub_com=u-token-for-jiaen

# Keep fallback mode off when using real tokens
MOCK_LARK_BOOKING=false
MOCK_LARK_BUSY=false
```

## Step 3: Test Your Token

Run the test script:
```bash
node scripts/test-user-token.js
```

## Step 4: For Each Trainer

Each trainer needs to:
1. Go to the API Explorer
2. Login with their Lark account
3. Get their access token
4. Send it to the admin

Admin then adds to `.env.local`:
```env
LARK_USER_TOKEN_trainer_email@company_com=u-their-token
```

## Important Notes

### Token Expiration
- User access tokens typically expire after 2 hours
- You'll need to refresh them or get new ones
- Consider implementing OAuth flow for automatic refresh

### Security
- **Never commit tokens to git**
- Keep `.env.local` in `.gitignore`
- In production, use secure secret management

### Testing
After adding tokens, test with:
```bash
# Test specific trainer
node scripts/test-lark-calendar.js

# Test all trainers
node scripts/update-trainer-calendars.js
```

## Troubleshooting

### "Invalid token" Error
- Token may be expired - get a new one
- Token may be for wrong environment (Lark vs Feishu)

### "Permission denied" Error
- User hasn't authorized the app
- Token doesn't have calendar scopes

### "User not found" Error
- Email doesn't match Lark account
- User not in the same organization

## Quick Test in Browser Console

Test your token directly:
```javascript
fetch('https://open.larksuite.com/open-apis/calendar/v4/calendars', {
  headers: {
    'Authorization': 'Bearer u-your-token-here'
  }
}).then(r => r.json()).then(console.log)
```

If this returns calendar data, your token works!

## Next Steps

1. Get tokens for all trainers
2. Add them to `.env.local`
3. Test calendar operations
4. Consider implementing OAuth for production

---

**For production**, implement the OAuth flow so trainers can authorize directly through the app instead of manual token management.