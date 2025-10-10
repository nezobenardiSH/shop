# Production Deployment Guide for Lark Calendar Integration

## Overview
This guide covers the complete production setup for Lark Calendar integration with OAuth 2.0 authentication.

## Prerequisites

- [ ] Lark app with user-level calendar permissions
- [ ] PostgreSQL database for token storage
- [ ] Production domain with HTTPS

## Step 1: Database Setup

### Run Prisma Migrations
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Or create tables manually using:
psql $DATABASE_URL < prisma/migrations/add_lark_auth_tokens.sql
```

### Verify Database
```bash
npx prisma studio
# Check that LarkAuthToken table exists
```

## Step 2: Lark App Configuration

### 1. Update Redirect URI in Lark Console
Go to your Lark app settings and add the production redirect URI:
```
https://yourdomain.com/api/lark/auth/callback
```

### 2. Verify Permissions
Ensure these scopes are enabled:
- ✅ calendar:calendar
- ✅ calendar:calendar.event:create
- ✅ calendar:calendar.event:read
- ✅ calendar:calendar.event:update
- ✅ calendar:calendar.event:delete
- ✅ calendar:calendar.free_busy:read

## Step 3: Environment Configuration

### Production Environment Variables
```env
# Database
DATABASE_URL=your-production-database-url

# Lark OAuth
LARK_APP_ID=cli_a8549d99f97c502f
LARK_APP_SECRET=your-app-secret
LARK_DOMAIN=https://open.larksuite.com
LARK_REDIRECT_URI=https://yourdomain.com/api/lark/auth/callback

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Disable mock mode
MOCK_LARK_BOOKING=false
MOCK_LARK_BUSY=false
```

## Step 4: Deploy Application

### Build and Deploy
```bash
# Build the application
npm run build

# Test locally
npm run start

# Deploy to your platform
# Examples:
# - Vercel: vercel deploy --prod
# - Railway: railway up
# - Custom: pm2 start npm --name "onboarding-portal" -- start
```

## Step 5: Trainer Authorization Flow

### 1. Share Authorization URL
Send this URL to each trainer:
```
https://yourdomain.com/trainers/authorize
```

### 2. Trainer Authorization Steps
Each trainer must:
1. Visit the authorization page
2. Click "Authorize with Lark"
3. Log in with their Lark account
4. Approve calendar permissions
5. System stores their tokens automatically

### 3. Monitor Authorization Status
Admin can check status at:
```
https://yourdomain.com/trainers/authorize
```

## Step 6: Testing Production Setup

### 1. Test OAuth Flow
```bash
# Test trainer authorization
curl https://yourdomain.com/api/lark/auth/authorize

# Should redirect to Lark OAuth page
```

### 2. Test Calendar Operations
```javascript
// Test script for production
const response = await fetch('https://yourdomain.com/api/lark/availability?trainerName=TestTrainer');
const data = await response.json();
console.log('Availability:', data);
```

### 3. Test Booking
```javascript
// Test booking creation
const booking = await fetch('https://yourdomain.com/api/lark/book-training', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    merchantId: 'test-merchant',
    merchantName: 'Test Merchant',
    trainerName: 'Trainer Name',
    date: '2024-10-15',
    startTime: '10:00',
    endTime: '12:00',
    bookingType: 'training'
  })
});
```

## Step 7: Monitoring & Maintenance

### Token Management
Tokens are automatically refreshed when:
- Request is made with expired token
- Token expires within 5 minutes

### Manual Token Refresh
```sql
-- Check token expiry
SELECT user_email, expires_at, updated_at 
FROM lark_auth_tokens 
WHERE expires_at < NOW() + INTERVAL '1 hour';
```

### Revoke Trainer Authorization
```sql
-- Remove a trainer's authorization
DELETE FROM lark_auth_tokens WHERE user_email = 'trainer@company.com';
```

## Security Considerations

### 1. HTTPS Required
- OAuth callbacks must use HTTPS in production
- All API endpoints should be HTTPS only

### 2. Token Storage
- Tokens are encrypted at rest in database
- Access tokens expire every 2 hours
- Refresh tokens should be rotated periodically

### 3. Rate Limiting
Implement rate limiting for:
- OAuth authorization attempts
- Calendar API calls
- Booking creation

### Example with express-rate-limit:
```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 requests per windowMs
});

app.use('/api/lark/auth', authLimiter);
```

## Troubleshooting

### Common Issues

#### 1. "Invalid redirect URI"
- Ensure redirect URI in Lark app matches exactly
- Include protocol (https://)
- No trailing slash

#### 2. "Token expired"
- Check if refresh mechanism is working
- Verify database write permissions
- Check token expiry logic

#### 3. "Calendar not found"
- Trainer needs to re-authorize
- Check if calendar ID is stored correctly
- Verify user has calendar access

### Debug Mode
Enable debug logging:
```env
DEBUG=lark:*
```

### Health Check Endpoint
```typescript
// app/api/health/lark/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    larkAuth: await checkLarkAuth(),
    tokenRefresh: await checkTokenRefresh()
  };
  
  return NextResponse.json(checks);
}
```

## Rollback Plan

If issues occur:

1. **Immediate Rollback**
```env
# Enable fallback mode
MOCK_LARK_BOOKING=true
MOCK_LARK_BUSY=true
```

2. **Restore Manual Tokens** (temporary)
```env
LARK_USER_ACCESS_TOKEN=manual-token-here
```

3. **Database Rollback**
```sql
-- Backup tokens before changes
CREATE TABLE lark_auth_tokens_backup AS SELECT * FROM lark_auth_tokens;

-- Restore if needed
INSERT INTO lark_auth_tokens SELECT * FROM lark_auth_tokens_backup;
```

## Production Checklist

- [ ] Database migrations completed
- [ ] Environment variables set
- [ ] HTTPS configured
- [ ] Redirect URI updated in Lark
- [ ] Rate limiting implemented
- [ ] Error logging configured
- [ ] Backup plan ready
- [ ] First trainer authorized successfully
- [ ] Calendar operations tested
- [ ] Monitoring alerts set up

## Support Contacts

- **Lark API Issues**: https://open.larksuite.com/support
- **Database Issues**: Your DB provider support
- **Application Issues**: Internal dev team

---

**Important**: Always test in staging environment first before deploying to production.