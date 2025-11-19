# Trainer-Based OAuth Implementation Plan
## Lark VC Meeting Creation with Trainer Authorization

**Created**: 2025-11-17
**Status**: Planning Phase
**Estimated Total Time**: 6-8 hours

---

## 📋 Overview

### Goal
Enable automatic Lark VC meeting link generation for remote training by having each trainer authorize their own Lark account. When a merchant books remote training, the system creates a VC meeting using the trainer's token, making the trainer the meeting host.

### Why Trainer-Based OAuth?
✅ Each trainer owns and controls their meetings
✅ No single point of failure (distributed tokens)
✅ Scales naturally (new trainer = add their auth)
✅ Clear responsibility (trainer manages their integration)
✅ Better debugging (know which trainer's token was used)

### Current Status
- ✅ Salesforce field `Remote_Training_Meeting_Link__c` created
- ✅ Portal UI ready (training type badge, meeting link display)
- ✅ Service type detection working
- ✅ Booking flow logic complete
- ❌ Authentication: Using tenant token (doesn't work for VC API)
- 🎯 Need: Trainer user token OAuth flow

---

## 🏗️ Technical Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TRAINER AUTHORIZATION (One-time per trainer)             │
├─────────────────────────────────────────────────────────────┤
│ Trainer Dashboard                                           │
│   ↓ Click "Connect Lark Account"                            │
│ /api/lark/trainer/oauth/authorize                           │
│   ↓ Generate OAuth URL with state (CSRF protection)         │
│ Redirect to Lark OAuth                                      │
│   ↓ Trainer logs in with their Lark credentials             │
│   ↓ Approves: "Allow VC meeting creation?"                  │
│ Lark redirects to /api/lark/trainer/oauth/callback?code=... │
│   ↓ Exchange code for tokens                                │
│   ↓ Get user_access_token + refresh_token                   │
│ Save to Salesforce (Onboarding_Trainer__c)                  │
│   ✅ Trainer connected!                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. BOOKING FLOW (Every remote training booking)             │
├─────────────────────────────────────────────────────────────┤
│ Merchant books remote training with Trainer A               │
│   ↓                                                          │
│ Check: Is Trainer A's Lark connected?                       │
│   ├─ YES ─→ Get Trainer A's user_access_token              │
│   │         Check if token expired                          │
│   │         ├─ Expired → Refresh token first                │
│   │         └─ Valid → Proceed                              │
│   │         Create VC meeting using trainer's token         │
│   │         Host = Trainer A ✓                              │
│   │         Save meeting link to Salesforce ✓               │
│   │         Include in calendar event ✓                     │
│   │                                                          │
│   └─ NO ──→ Continue booking without VC link                │
│             Log warning                                      │
│             Send email to trainer to connect Lark           │
│             Portal shows: "Meeting link pending"            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. TOKEN REFRESH (Automatic, every hour or on-demand)       │
├─────────────────────────────────────────────────────────────┤
│ Cron job runs every hour                                    │
│   ↓ Get all trainers with tokens expiring in <24 hours      │
│   ↓ For each trainer:                                       │
│     POST /open-apis/auth/v3/tenant_access_token/refresh    │
│     With: refresh_token                                     │
│     Get: new user_access_token + new refresh_token          │
│     Update Salesforce with new tokens                       │
│   ✅ All tokens refreshed                                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Storage

**Salesforce Object**: `Onboarding_Trainer__c` (extend existing)

**New Fields**:
```
Lark_User_ID__c                 (Text, 50)  - Lark's internal user ID
Lark_Access_Token__c            (Text, 500) - Encrypted user access token
Lark_Refresh_Token__c           (Text, 500) - Encrypted refresh token
Lark_Token_Expires_At__c        (DateTime)  - Token expiration timestamp
Lark_Connected__c               (Checkbox)  - Quick status check
Lark_Connected_At__c            (DateTime)  - When trainer authorized
Lark_Last_Token_Refresh__c      (DateTime)  - Last successful refresh
Lark_Connection_Error__c        (Text, 255) - Last error message (if any)
```

### Security Considerations

1. **Token Encryption**: Encrypt tokens before storing in Salesforce
2. **CSRF Protection**: Use state parameter in OAuth flow
3. **Token Rotation**: Regular refresh, never store permanently
4. **Scope Limitation**: Only request VC permissions needed
5. **Error Logging**: Track failed authentications without exposing tokens

---

## 📝 Phase-by-Phase Implementation

### **PHASE 1: Salesforce Fields Setup** ⏱️ 30 minutes

**Goal**: Add Lark OAuth fields to trainer object

#### Tasks:
- [ ] 1.1: Create Salesforce fields on `Onboarding_Trainer__c`
  - Fields listed in "Data Storage" section above
  - Set field-level security (only admins can see tokens)

- [ ] 1.2: Update Salesforce query in API
  - File: `app/api/salesforce/merchant/[merchantId]/route.ts`
  - Add new fields to trainer query (around line 60-80)

- [ ] 1.3: Update TypeScript types
  - File: `types/salesforce.ts` or inline types
  - Add Lark fields to `OnboardingTrainer` interface

#### Verification:
```bash
# Run app and check API response includes new fields
npm run dev
# Visit: http://localhost:3000/api/salesforce/merchant/a0yQ900000Bxg89
# Check trainer object has larkConnected, larkUserId, etc. (all null initially)
```

#### Success Criteria:
✅ New fields visible in Salesforce
✅ API response includes Lark fields
✅ No TypeScript errors

---

### **PHASE 2: OAuth Configuration** ⏱️ 1 hour

**Goal**: Set up Lark app OAuth settings and create authorization URL generator

#### Tasks:
- [ ] 2.1: Configure Lark app OAuth
  - Go to Lark Developer Console → Your App → Security Settings
  - Add redirect URL: `https://your-domain.com/api/lark/trainer/oauth/callback`
  - For local dev: `http://localhost:3000/api/lark/trainer/oauth/callback`
  - Note: Both URLs may be needed

- [ ] 2.2: Add environment variables
  - File: `.env.local`
  - Add: `LARK_OAUTH_REDIRECT_URI=http://localhost:3000/api/lark/trainer/oauth/callback`
  - Add: `LARK_OAUTH_STATE_SECRET=<random-secret-key>` (for CSRF protection)

- [ ] 2.3: Create OAuth utility functions
  - File: `lib/lark-oauth.ts` (NEW FILE)
  - Function: `generateAuthorizationUrl(trainerEmail: string)`
  - Function: `generateStateToken(trainerEmail: string)` (CSRF protection)
  - Function: `validateStateToken(state: string, trainerEmail: string)`

- [ ] 2.4: Create authorization endpoint
  - File: `app/api/lark/trainer/oauth/authorize/route.ts` (NEW FILE)
  - GET handler: Generates Lark OAuth URL and redirects trainer

#### Code Structure:

**`lib/lark-oauth.ts`**:
```typescript
import crypto from 'crypto';

export function generateStateToken(trainerEmail: string): string {
  // Create CSRF token: hash(email + timestamp + secret)
  const payload = `${trainerEmail}:${Date.now()}`;
  const secret = process.env.LARK_OAUTH_STATE_SECRET!;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function validateStateToken(state: string, trainerEmail: string): boolean {
  // Validate state token (check age < 10 minutes, valid signature)
  // Implementation details...
}

export function generateAuthorizationUrl(
  trainerEmail: string,
  state: string
): string {
  const appId = process.env.LARK_APP_ID!;
  const redirectUri = process.env.LARK_OAUTH_REDIRECT_URI!;

  const url = new URL('https://open.larksuite.com/open-apis/authen/v1/authorize');
  url.searchParams.set('app_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'vc:reserve'); // Only VC permissions

  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}> {
  // Exchange authorization code for tokens
  // POST /open-apis/authen/v1/oidc/access_token
  // Implementation details...
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  // Refresh expired access token
  // POST /open-apis/authen/v1/oidc/refresh_access_token
  // Implementation details...
}
```

**`app/api/lark/trainer/oauth/authorize/route.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateStateToken, generateAuthorizationUrl } from '@/lib/lark-oauth';

export async function GET(request: NextRequest) {
  // Get trainer email from query params or session
  const trainerEmail = request.nextUrl.searchParams.get('email');

  if (!trainerEmail) {
    return NextResponse.json({ error: 'Trainer email required' }, { status: 400 });
  }

  // Generate CSRF state token
  const state = generateStateToken(trainerEmail);

  // Store state in session/cookie for validation later
  // (Could use encrypted cookie or session storage)

  // Generate Lark OAuth URL
  const authUrl = generateAuthorizationUrl(trainerEmail, state);

  // Redirect trainer to Lark login
  return NextResponse.redirect(authUrl);
}
```

#### Verification:
```bash
# Test authorization URL generation
curl "http://localhost:3000/api/lark/trainer/oauth/authorize?email=trainer@test.com"
# Should redirect to Lark OAuth page (or return redirect URL if testing locally)
```

#### Success Criteria:
✅ Lark app has redirect URI configured
✅ Authorization URL generates correctly
✅ State token includes trainer email for validation

---

### **PHASE 3: OAuth Callback Handler** ⏱️ 2 hours

**Goal**: Handle OAuth callback, exchange code for tokens, save to Salesforce

#### Tasks:
- [ ] 3.1: Create callback endpoint
  - File: `app/api/lark/trainer/oauth/callback/route.ts` (NEW FILE)
  - GET handler: Receives code + state from Lark

- [ ] 3.2: Implement token exchange logic
  - Validate state token (CSRF protection)
  - Exchange authorization code for access token
  - Get trainer's Lark user ID
  - Encrypt tokens before storage

- [ ] 3.3: Save tokens to Salesforce
  - Find trainer by email
  - Update Lark fields
  - Set `Lark_Connected__c = true`

- [ ] 3.4: Add encryption utility
  - File: `lib/encryption.ts` (NEW FILE)
  - Function: `encryptToken(token: string): string`
  - Function: `decryptToken(encryptedToken: string): string`
  - Use AES-256-GCM encryption

#### Code Structure:

**`lib/encryption.ts`**:
```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET = process.env.ENCRYPTION_SECRET!; // 32-byte secret key

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET, 'hex'), iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedToken: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(SECRET, 'hex'),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

**`app/api/lark/trainer/oauth/callback/route.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, validateStateToken } from '@/lib/lark-oauth';
import { encryptToken } from '@/lib/encryption';
import jsforce from 'jsforce';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  // TODO: Get trainer email from state (need to store state->email mapping)
  // For now, this is a simplified version

  try {
    // 1. Exchange code for tokens
    const { accessToken, refreshToken, expiresIn, userId } =
      await exchangeCodeForToken(code);

    // 2. Encrypt tokens
    const encryptedAccessToken = encryptToken(accessToken);
    const encryptedRefreshToken = encryptToken(refreshToken);

    // 3. Calculate expiration time
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // 4. Save to Salesforce
    const conn = new jsforce.Connection({
      loginUrl: process.env.SALESFORCE_LOGIN_URL,
    });

    await conn.login(
      process.env.SALESFORCE_USERNAME!,
      process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_SECURITY_TOKEN!
    );

    // Find trainer by email (TODO: get email from state)
    const trainerEmail = 'trainer@example.com'; // Placeholder

    const trainers = await conn.query(
      `SELECT Id FROM Onboarding_Trainer__c WHERE Email__c = '${trainerEmail}' LIMIT 1`
    );

    if (trainers.totalSize === 0) {
      throw new Error('Trainer not found');
    }

    const trainerId = trainers.records[0].Id;

    // Update trainer with Lark OAuth data
    await conn.sobject('Onboarding_Trainer__c').update({
      Id: trainerId,
      Lark_User_ID__c: userId,
      Lark_Access_Token__c: encryptedAccessToken,
      Lark_Refresh_Token__c: encryptedRefreshToken,
      Lark_Token_Expires_At__c: expiresAt.toISOString(),
      Lark_Connected__c: true,
      Lark_Connected_At__c: new Date().toISOString(),
      Lark_Last_Token_Refresh__c: new Date().toISOString(),
      Lark_Connection_Error__c: null, // Clear any previous errors
    });

    // 5. Redirect to success page
    return NextResponse.redirect(
      new URL('/trainer/settings?lark_connected=true', request.url)
    );

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/trainer/settings?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
```

#### Verification:
```bash
# Complete OAuth flow manually:
# 1. Visit authorization URL
# 2. Login to Lark (if not already)
# 3. Approve permissions
# 4. Check callback saves data to Salesforce
# 5. Verify tokens are encrypted in Salesforce
```

#### Success Criteria:
✅ OAuth callback receives code and state
✅ Tokens exchanged successfully
✅ Tokens encrypted before saving
✅ Salesforce trainer record updated
✅ `Lark_Connected__c = true`

---

### **PHASE 4: Update VC Meeting Creation Logic** ⏱️ 1.5 hours

**Goal**: Modify booking flow to use trainer's user token instead of tenant token

#### Tasks:
- [ ] 4.1: Create trainer token retrieval function
  - File: `lib/lark.ts`
  - Function: `getTrainerAccessToken(trainerEmail: string): Promise<string | null>`
  - Check if token expired → refresh if needed
  - Decrypt token before returning

- [ ] 4.2: Update `createVideoConferenceMeeting()` method
  - Accept optional `userAccessToken` parameter
  - Use user token instead of tenant token when provided

- [ ] 4.3: Modify booking flow
  - File: `app/api/lark/book-training/route.ts`
  - Before creating VC meeting, get trainer's access token
  - Pass trainer's token to `createVideoConferenceMeeting()`
  - Add fallback handling if trainer not connected

#### Code Changes:

**`lib/lark.ts`** - Add new method:
```typescript
/**
 * Get trainer's user access token for VC meeting creation
 * Automatically refreshes token if expired
 */
async getTrainerAccessToken(trainerEmail: string): Promise<string | null> {
  try {
    // Query Salesforce for trainer's Lark data
    const result = await this.conn.query(
      `SELECT
        Lark_Connected__c,
        Lark_Access_Token__c,
        Lark_Refresh_Token__c,
        Lark_Token_Expires_At__c
      FROM Onboarding_Trainer__c
      WHERE Email__c = '${trainerEmail}'
      AND Lark_Connected__c = true
      LIMIT 1`
    );

    if (result.totalSize === 0) {
      console.warn(`Trainer ${trainerEmail} has not connected Lark`);
      return null;
    }

    const trainer = result.records[0];
    const expiresAt = new Date(trainer.Lark_Token_Expires_At__c);
    const now = new Date();

    // Check if token expired or expiring soon (within 5 minutes)
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt <= fiveMinutesFromNow) {
      console.log(`Token expired for ${trainerEmail}, refreshing...`);

      // Decrypt refresh token
      const refreshToken = decryptToken(trainer.Lark_Refresh_Token__c);

      // Refresh access token
      const { accessToken, refreshToken: newRefreshToken, expiresIn } =
        await refreshAccessToken(refreshToken);

      // Encrypt new tokens
      const encryptedAccessToken = encryptToken(accessToken);
      const encryptedRefreshToken = encryptToken(newRefreshToken);
      const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

      // Update Salesforce
      await this.conn.sobject('Onboarding_Trainer__c').update({
        Id: trainer.Id,
        Lark_Access_Token__c: encryptedAccessToken,
        Lark_Refresh_Token__c: encryptedRefreshToken,
        Lark_Token_Expires_At__c: newExpiresAt.toISOString(),
        Lark_Last_Token_Refresh__c: new Date().toISOString(),
      });

      return accessToken; // Return unencrypted token
    }

    // Token still valid, decrypt and return
    return decryptToken(trainer.Lark_Access_Token__c);

  } catch (error: any) {
    console.error(`Error getting trainer access token: ${error.message}`);
    return null;
  }
}
```

**`lib/lark.ts`** - Update existing method:
```typescript
/**
 * Create Lark VC meeting
 * @param userAccessToken - Optional user token for VC API (required for VC permissions)
 */
async createVideoConferenceMeeting(
  title: string,
  startTime: number,
  endTime: number,
  hostUserId: string,
  description?: string,
  userAccessToken?: string // NEW PARAMETER
): Promise<{ meetingLink: string; reservationId: string }> {

  // Use user access token if provided, otherwise fall back to tenant token
  const accessToken = userAccessToken || this.accessToken;

  try {
    const response = await fetch(
      'https://open.larksuite.com/open-apis/vc/v1/reserves',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`, // Use provided token
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          end_time: endTime.toString(),
          meeting_settings: {
            topic: title,
            description: description || '',
            auto_record: false,
          },
        }),
      }
    );

    // ... rest of implementation
  } catch (error: any) {
    console.error('Failed to create VC meeting:', error);
    throw error;
  }
}
```

**`app/api/lark/book-training/route.ts`** - Update VC creation section (around line 421-481):
```typescript
let meetingLink: string | null = null;
let vcReservationId: string | null = null;
const isRemoteTraining = serviceType === 'remote';

if (isRemoteTraining && !mockMode && bookingType === 'training') {
  try {
    console.log('🎥 Creating Lark VC meeting for remote training...');

    // NEW: Get trainer's user access token
    const trainerAccessToken = await larkService.getTrainerAccessToken(trainer.email);

    if (!trainerAccessToken) {
      console.warn(`⚠️ Trainer ${trainer.email} has not connected Lark account`);
      console.warn('⚠️ Skipping VC meeting creation. Trainer needs to authorize Lark.');

      // TODO: Send email notification to trainer
      // TODO: Log this event for admin monitoring

    } else {
      const trainerUserId = await larkService.getUserIdFromEmail(trainer.email);

      if (!trainerUserId) {
        console.warn('⚠️ Could not get trainer Lark user ID, skipping VC creation');
      } else {
        const meetingTitle = `Remote Training: ${merchantName}`;
        const startDateTime = new Date(`${date}T${startTime}`);
        const endDateTime = new Date(`${date}T${endTime}`);
        const startTimestamp = Math.floor(startDateTime.getTime() / 1000);
        const endTimestamp = Math.floor(endDateTime.getTime() / 1000);

        // Use trainer's user token (not tenant token!)
        const vcMeeting = await larkService.createVideoConferenceMeeting(
          meetingTitle,
          startTimestamp,
          endTimestamp,
          trainerUserId,
          `Remote training session for ${merchantName}`,
          trainerAccessToken // PASS TRAINER'S TOKEN
        );

        meetingLink = vcMeeting.meetingLink;
        vcReservationId = vcMeeting.reservationId;
        console.log('✅ Lark VC meeting created:', meetingLink);
      }
    }
  } catch (vcError: any) {
    console.error('❌ Failed to create Lark VC meeting:', vcError.message);
    // Don't fail entire booking if VC creation fails
  }
}
```

#### Verification:
```bash
# Test with trainer who HAS connected Lark:
# 1. Book remote training
# 2. Check logs for "✅ Lark VC meeting created"
# 3. Verify meeting link in Salesforce
# 4. Check Lark calendar for meeting event

# Test with trainer who HAS NOT connected Lark:
# 1. Book remote training
# 2. Check logs for "⚠️ Trainer has not connected Lark account"
# 3. Verify booking still succeeds (graceful fallback)
# 4. Verify no meeting link in Salesforce
```

#### Success Criteria:
✅ Trainer's token retrieved from Salesforce
✅ Token auto-refreshes if expired
✅ VC meeting created with trainer's token
✅ Graceful fallback if trainer not connected
✅ Booking never fails due to VC issues

---

### **PHASE 5: Trainer UI - Connection Status & Button** ⏱️ 1.5 hours

**Goal**: Add UI for trainers to connect/disconnect Lark, show connection status

#### Tasks:
- [ ] 5.1: Create trainer settings/dashboard page (if doesn't exist)
  - File: `app/trainer/settings/page.tsx` (NEW FILE or existing)
  - Or add section to existing trainer dashboard

- [ ] 5.2: Add Lark connection status display
  - Show: Connected ✓ or Not Connected
  - Show: Last token refresh time
  - Show: Connection error (if any)

- [ ] 5.3: Add "Connect Lark" button
  - Links to `/api/lark/trainer/oauth/authorize?email={trainer.email}`
  - Opens in same window (will redirect back after auth)

- [ ] 5.4: Add "Disconnect" button
  - API endpoint: `DELETE /api/lark/trainer/oauth/disconnect`
  - Clears Lark tokens from Salesforce

#### Code Structure:

**`app/trainer/settings/page.tsx`**:
```typescript
'use client';

import { useState, useEffect } from 'react';

interface TrainerLarkStatus {
  connected: boolean;
  connectedAt?: string;
  lastRefresh?: string;
  error?: string;
}

export default function TrainerSettingsPage() {
  const [larkStatus, setLarkStatus] = useState<TrainerLarkStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Get trainer email from session/auth
  const trainerEmail = 'trainer@example.com'; // TODO: Get from auth

  useEffect(() => {
    fetchLarkStatus();
  }, []);

  async function fetchLarkStatus() {
    try {
      const res = await fetch(`/api/lark/trainer/status?email=${trainerEmail}`);
      const data = await res.json();
      setLarkStatus(data);
    } catch (error) {
      console.error('Failed to fetch Lark status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Lark? Remote training bookings will not generate meeting links.')) {
      return;
    }

    try {
      await fetch(`/api/lark/trainer/oauth/disconnect?email=${trainerEmail}`, {
        method: 'DELETE',
      });

      await fetchLarkStatus(); // Refresh status
      alert('Lark disconnected successfully');
    } catch (error) {
      console.error('Failed to disconnect:', error);
      alert('Failed to disconnect Lark');
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Trainer Settings</h1>

      {/* Lark Integration Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Lark Integration</h2>

        {larkStatus?.connected ? (
          // Connected State
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium text-green-700">Lark Connected ✓</span>
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              {larkStatus.connectedAt && (
                <p>Connected: {new Date(larkStatus.connectedAt).toLocaleString()}</p>
              )}
              {larkStatus.lastRefresh && (
                <p>Last synced: {new Date(larkStatus.lastRefresh).toLocaleString()}</p>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Disconnect Lark
              </button>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900">
                ✓ Remote training bookings will automatically generate Lark VC meeting links
              </p>
            </div>
          </div>
        ) : (
          // Not Connected State
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="font-medium text-yellow-700">Lark Not Connected</span>
            </div>

            {larkStatus?.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-900">Error: {larkStatus.error}</p>
              </div>
            )}

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-900 mb-3">
                ⚠️ Connect your Lark account to enable automatic meeting link generation for remote training sessions.
              </p>
              <p className="text-xs text-yellow-800">
                When connected, the system will automatically create Lark VC meeting links whenever a merchant books remote training with you.
              </p>
            </div>

            <div className="pt-2">
              <a
                href={`/api/lark/trainer/oauth/authorize?email=${encodeURIComponent(trainerEmail)}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Connect Lark Account
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Other settings sections... */}
    </div>
  );
}
```

**`app/api/lark/trainer/status/route.ts`** (NEW FILE):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import jsforce from 'jsforce';

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  try {
    const conn = new jsforce.Connection({
      loginUrl: process.env.SALESFORCE_LOGIN_URL,
    });

    await conn.login(
      process.env.SALESFORCE_USERNAME!,
      process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_SECURITY_TOKEN!
    );

    const result = await conn.query(
      `SELECT
        Lark_Connected__c,
        Lark_Connected_At__c,
        Lark_Last_Token_Refresh__c,
        Lark_Connection_Error__c
      FROM Onboarding_Trainer__c
      WHERE Email__c = '${email}'
      LIMIT 1`
    );

    if (result.totalSize === 0) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    const trainer = result.records[0];

    return NextResponse.json({
      connected: trainer.Lark_Connected__c || false,
      connectedAt: trainer.Lark_Connected_At__c || null,
      lastRefresh: trainer.Lark_Last_Token_Refresh__c || null,
      error: trainer.Lark_Connection_Error__c || null,
    });

  } catch (error: any) {
    console.error('Error fetching Lark status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**`app/api/lark/trainer/oauth/disconnect/route.ts`** (NEW FILE):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import jsforce from 'jsforce';

export async function DELETE(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  try {
    const conn = new jsforce.Connection({
      loginUrl: process.env.SALESFORCE_LOGIN_URL,
    });

    await conn.login(
      process.env.SALESFORCE_USERNAME!,
      process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_SECURITY_TOKEN!
    );

    // Find trainer
    const result = await conn.query(
      `SELECT Id FROM Onboarding_Trainer__c WHERE Email__c = '${email}' LIMIT 1`
    );

    if (result.totalSize === 0) {
      return NextResponse.json({ error: 'Trainer not found' }, { status: 404 });
    }

    // Clear Lark OAuth data
    await conn.sobject('Onboarding_Trainer__c').update({
      Id: result.records[0].Id,
      Lark_User_ID__c: null,
      Lark_Access_Token__c: null,
      Lark_Refresh_Token__c: null,
      Lark_Token_Expires_At__c: null,
      Lark_Connected__c: false,
      Lark_Connection_Error__c: null,
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error disconnecting Lark:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### Verification:
```bash
# 1. Visit trainer settings page
# 2. Click "Connect Lark" → Should redirect to Lark OAuth
# 3. Complete authorization → Should redirect back with success message
# 4. Verify "Lark Connected ✓" status shows
# 5. Click "Disconnect" → Should clear Lark data
# 6. Verify "Lark Not Connected" status shows
```

#### Success Criteria:
✅ Trainer settings page shows Lark status
✅ "Connect Lark" button redirects to OAuth flow
✅ Connection status updates after authorization
✅ "Disconnect" button clears Lark data
✅ Error messages display if connection fails

---

### **PHASE 6: Admin Monitoring Dashboard** ⏱️ 1 hour

**Goal**: Admin page to see which trainers are connected, monitor token health

#### Tasks:
- [ ] 6.1: Create admin monitoring page
  - File: `app/admin/lark-connections/page.tsx` (NEW FILE)
  - List all trainers with Lark connection status

- [ ] 6.2: Add API endpoint for admin data
  - File: `app/api/admin/lark-connections/route.ts` (NEW FILE)
  - Returns all trainers with Lark connection details

- [ ] 6.3: Add monitoring features
  - Show: Connected/Not connected count
  - Show: Tokens expiring soon (< 24 hours)
  - Show: Connection errors
  - Action: Send reminder email to non-connected trainers

#### Code Structure:

**`app/admin/lark-connections/page.tsx`**:
```typescript
'use client';

import { useState, useEffect } from 'react';

interface TrainerConnection {
  id: string;
  name: string;
  email: string;
  connected: boolean;
  connectedAt?: string;
  lastRefresh?: string;
  tokenExpiresAt?: string;
  error?: string;
}

export default function LarkConnectionsPage() {
  const [trainers, setTrainers] = useState<TrainerConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    try {
      const res = await fetch('/api/admin/lark-connections');
      const data = await res.json();
      setTrainers(data.trainers);
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setLoading(false);
    }
  }

  const connectedCount = trainers.filter(t => t.connected).length;
  const totalCount = trainers.length;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Lark Integration Monitoring</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Trainers</div>
          <div className="text-3xl font-bold">{totalCount}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Connected</div>
          <div className="text-3xl font-bold text-green-600">{connectedCount}</div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Not Connected</div>
          <div className="text-3xl font-bold text-yellow-600">{totalCount - connectedCount}</div>
        </div>
      </div>

      {/* Trainers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Trainer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Connected At
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Refresh
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Token Expires
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {trainers.map(trainer => (
              <tr key={trainer.id}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{trainer.name}</div>
                  <div className="text-sm text-gray-500">{trainer.email}</div>
                </td>
                <td className="px-6 py-4">
                  {trainer.connected ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Connected ✓
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Not Connected
                    </span>
                  )}
                  {trainer.error && (
                    <div className="mt-1 text-xs text-red-600">{trainer.error}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {trainer.connectedAt ? new Date(trainer.connectedAt).toLocaleString() : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {trainer.lastRefresh ? new Date(trainer.lastRefresh).toLocaleString() : '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {trainer.tokenExpiresAt ? (
                    <span>
                      {new Date(trainer.tokenExpiresAt).toLocaleString()}
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**`app/api/admin/lark-connections/route.ts`** (NEW FILE):
```typescript
import { NextResponse } from 'next/server';
import jsforce from 'jsforce';

export async function GET() {
  try {
    const conn = new jsforce.Connection({
      loginUrl: process.env.SALESFORCE_LOGIN_URL,
    });

    await conn.login(
      process.env.SALESFORCE_USERNAME!,
      process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_SECURITY_TOKEN!
    );

    const result = await conn.query(
      `SELECT
        Id,
        Name,
        Email__c,
        Lark_Connected__c,
        Lark_Connected_At__c,
        Lark_Last_Token_Refresh__c,
        Lark_Token_Expires_At__c,
        Lark_Connection_Error__c
      FROM Onboarding_Trainer__c
      ORDER BY Lark_Connected__c DESC, Name ASC`
    );

    const trainers = result.records.map((trainer: any) => ({
      id: trainer.Id,
      name: trainer.Name,
      email: trainer.Email__c,
      connected: trainer.Lark_Connected__c || false,
      connectedAt: trainer.Lark_Connected_At__c || null,
      lastRefresh: trainer.Lark_Last_Token_Refresh__c || null,
      tokenExpiresAt: trainer.Lark_Token_Expires_At__c || null,
      error: trainer.Lark_Connection_Error__c || null,
    }));

    return NextResponse.json({ trainers });

  } catch (error: any) {
    console.error('Error fetching Lark connections:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### Verification:
```bash
# 1. Visit /admin/lark-connections
# 2. Verify all trainers listed
# 3. Check connected/not connected counts
# 4. Verify token expiration times shown correctly
```

#### Success Criteria:
✅ Admin can see all trainers
✅ Connection status visible at a glance
✅ Token expiration times displayed
✅ Error messages shown if any

---

### **PHASE 7: Token Refresh Automation** ⏱️ 30 minutes

**Goal**: Automatic token refresh to prevent expiration

#### Tasks:
- [ ] 7.1: Create token refresh API endpoint
  - File: `app/api/cron/refresh-lark-tokens/route.ts` (NEW FILE)
  - Query all trainers with tokens expiring in < 24 hours
  - Refresh each token
  - Update Salesforce

- [ ] 7.2: Set up cron job (if using Vercel/hosting platform)
  - Configure cron to run hourly
  - Call refresh endpoint

- [ ] 7.3: Add manual refresh option in admin dashboard
  - Button: "Refresh All Tokens Now"

#### Code Structure:

**`app/api/cron/refresh-lark-tokens/route.ts`** (NEW FILE):
```typescript
import { NextResponse } from 'next/server';
import jsforce from 'jsforce';
import { refreshAccessToken } from '@/lib/lark-oauth';
import { encryptToken, decryptToken } from '@/lib/encryption';

export async function GET(request: Request) {
  // Security: Verify request is from cron job (check auth header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const conn = new jsforce.Connection({
      loginUrl: process.env.SALESFORCE_LOGIN_URL,
    });

    await conn.login(
      process.env.SALESFORCE_USERNAME!,
      process.env.SALESFORCE_PASSWORD! + process.env.SALESFORCE_SECURITY_TOKEN!
    );

    // Get all trainers with tokens expiring in next 24 hours
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await conn.query(
      `SELECT
        Id,
        Email__c,
        Lark_Refresh_Token__c,
        Lark_Token_Expires_At__c
      FROM Onboarding_Trainer__c
      WHERE Lark_Connected__c = true
      AND Lark_Token_Expires_At__c <= ${twentyFourHoursFromNow.toISOString()}`
    );

    console.log(`Found ${result.totalSize} trainers needing token refresh`);

    let successCount = 0;
    let errorCount = 0;

    for (const trainer of result.records) {
      try {
        // Decrypt refresh token
        const refreshToken = decryptToken(trainer.Lark_Refresh_Token__c);

        // Refresh access token
        const { accessToken, refreshToken: newRefreshToken, expiresIn } =
          await refreshAccessToken(refreshToken);

        // Encrypt new tokens
        const encryptedAccessToken = encryptToken(accessToken);
        const encryptedRefreshToken = encryptToken(newRefreshToken);
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

        // Update Salesforce
        await conn.sobject('Onboarding_Trainer__c').update({
          Id: trainer.Id,
          Lark_Access_Token__c: encryptedAccessToken,
          Lark_Refresh_Token__c: encryptedRefreshToken,
          Lark_Token_Expires_At__c: newExpiresAt.toISOString(),
          Lark_Last_Token_Refresh__c: new Date().toISOString(),
          Lark_Connection_Error__c: null, // Clear any errors
        });

        console.log(`✅ Refreshed token for ${trainer.Email__c}`);
        successCount++;

      } catch (error: any) {
        console.error(`❌ Failed to refresh token for ${trainer.Email__c}:`, error.message);

        // Update error in Salesforce
        await conn.sobject('Onboarding_Trainer__c').update({
          Id: trainer.Id,
          Lark_Connection_Error__c: `Token refresh failed: ${error.message}`,
        });

        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      total: result.totalSize,
      refreshed: successCount,
      errors: errorCount,
    });

  } catch (error: any) {
    console.error('Token refresh cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**`vercel.json`** (if using Vercel):
```json
{
  "crons": [
    {
      "path": "/api/cron/refresh-lark-tokens",
      "schedule": "0 * * * *"
    }
  ]
}
```

#### Verification:
```bash
# Test manual refresh:
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/refresh-lark-tokens

# Check response shows tokens refreshed
# Verify Salesforce updated with new expiration times
```

#### Success Criteria:
✅ Cron endpoint refreshes tokens
✅ Tokens expiring soon are identified
✅ Salesforce updated with new tokens
✅ Errors logged but don't crash system

---

## 🧪 End-to-End Testing

### Test Scenario 1: New Trainer Connects Lark

1. **Setup**: Trainer has never connected Lark
2. **Steps**:
   - Visit trainer settings page
   - Click "Connect Lark Account"
   - Login to Lark (or already logged in)
   - Approve permissions
   - Redirected back to settings
3. **Expected**:
   - ✅ Status shows "Lark Connected ✓"
   - ✅ Salesforce has encrypted tokens
   - ✅ `Lark_Connected__c = true`

### Test Scenario 2: Merchant Books Remote Training (Trainer Connected)

1. **Setup**: Trainer has Lark connected
2. **Steps**:
   - Merchant books remote training with this trainer
   - Wait for booking to complete
3. **Expected**:
   - ✅ Booking succeeds
   - ✅ VC meeting created in Lark
   - ✅ Meeting link saved to Salesforce
   - ✅ Meeting link displayed in portal
   - ✅ Calendar event includes meeting link
   - ✅ No store address in calendar event

### Test Scenario 3: Merchant Books Remote Training (Trainer NOT Connected)

1. **Setup**: Trainer has NOT connected Lark
2. **Steps**:
   - Merchant books remote training with this trainer
   - Wait for booking to complete
3. **Expected**:
   - ✅ Booking succeeds (graceful fallback)
   - ⚠️ No VC meeting created
   - ⚠️ No meeting link in Salesforce
   - ⚠️ Portal shows "Meeting link pending trainer setup"
   - ✅ Calendar event still created (without link)

### Test Scenario 4: Token Refresh

1. **Setup**: Trainer token expiring in 4 minutes
2. **Steps**:
   - Merchant books remote training
   - System checks token expiration
3. **Expected**:
   - ✅ Token auto-refreshed before VC creation
   - ✅ VC meeting created successfully
   - ✅ Salesforce updated with new token expiration

### Test Scenario 5: Trainer Disconnects Lark

1. **Setup**: Trainer has Lark connected
2. **Steps**:
   - Visit trainer settings
   - Click "Disconnect Lark"
   - Confirm disconnect
3. **Expected**:
   - ✅ Status shows "Lark Not Connected"
   - ✅ Salesforce tokens cleared
   - ✅ `Lark_Connected__c = false`
   - ✅ Future bookings won't create VC links

---

## 🚀 Deployment Checklist

### Environment Variables

Add to `.env.local` (development) and hosting platform (production):

```bash
# Existing
LARK_APP_ID=cli_xxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxx
SALESFORCE_USERNAME=xxxxxxxxxxxxx
SALESFORCE_PASSWORD=xxxxxxxxxxxxx
SALESFORCE_SECURITY_TOKEN=xxxxxxxxxxxxx

# New for OAuth
LARK_OAUTH_REDIRECT_URI=https://your-domain.com/api/lark/trainer/oauth/callback
LARK_OAUTH_STATE_SECRET=<generate-random-32-char-secret>
ENCRYPTION_SECRET=<generate-random-64-char-hex-secret>
CRON_SECRET=<generate-random-secret-for-cron-auth>
```

### Salesforce Setup

1. Create custom fields on `Onboarding_Trainer__c`:
   - `Lark_User_ID__c`
   - `Lark_Access_Token__c`
   - `Lark_Refresh_Token__c`
   - `Lark_Token_Expires_At__c`
   - `Lark_Connected__c`
   - `Lark_Connected_At__c`
   - `Lark_Last_Token_Refresh__c`
   - `Lark_Connection_Error__c`

2. Set field-level security (only admins can see tokens)

### Lark App Configuration

1. Go to Lark Developer Console
2. Navigate to Security Settings → Redirect URLs
3. Add: `https://your-domain.com/api/lark/trainer/oauth/callback`
4. Add: `http://localhost:3000/api/lark/trainer/oauth/callback` (for dev)
5. Save and publish app changes

### Hosting Platform Setup

If using Vercel:
1. Add all environment variables to Vercel project settings
2. Deploy `vercel.json` with cron configuration
3. Verify cron job is scheduled in Vercel dashboard

---

## 📊 Success Metrics

After implementation, track:

- **Connection Rate**: % of trainers with Lark connected
- **VC Creation Success Rate**: % of remote bookings with meeting links
- **Token Refresh Success Rate**: % of tokens successfully refreshed
- **Error Rate**: Connection errors, token refresh failures

**Target Metrics**:
- 90%+ trainers connected within 2 weeks
- 95%+ VC creation success rate (for connected trainers)
- 100% token refresh success rate
- <5% error rate

---

## 🔧 Troubleshooting

### Issue: OAuth callback fails

**Symptoms**: Redirect URL error, state mismatch
**Solution**:
- Check redirect URI matches exactly in Lark app settings
- Verify state token generation/validation logic
- Check browser allows cookies (needed for state validation)

### Issue: Token refresh fails

**Symptoms**: "Invalid refresh token" error
**Solution**:
- Check token encryption/decryption working correctly
- Verify refresh token not expired (Lark refresh tokens expire after 30 days)
- Trainer may need to re-authorize

### Issue: VC meeting creation fails

**Symptoms**: 404 or permission error
**Solution**:
- Verify using user access token, not tenant token
- Check token not expired
- Verify trainer's Lark account has VC permissions
- Check Lark app has vc:reserve permission approved

### Issue: Tokens not refreshing automatically

**Symptoms**: Tokens expire, no auto-refresh
**Solution**:
- Check cron job is running (verify in platform logs)
- Verify cron secret matches in request header
- Check Salesforce query finds expiring tokens correctly

---

## 📝 Next Steps After Implementation

1. **Phase 5 (Future)**: Trainer Edit Functionality
   - Allow trainers to manually edit/regenerate meeting links
   - Add meeting link history/audit log

2. **Phase 6 (Future)**: Rescheduling Updates
   - When training rescheduled, update VC meeting time
   - Or regenerate new meeting link

3. **Monitoring & Analytics**:
   - Track VC meeting creation success rate
   - Monitor token health
   - Alert admins of connection issues

---

## 🎯 Summary

**What We're Building**:
- Trainer-based OAuth system for Lark VC meeting creation
- Each trainer authorizes their own Lark account (one-time)
- When merchant books remote training, system creates VC meeting using trainer's token
- Automatic token refresh to prevent expiration
- Graceful fallback if trainer not connected
- Admin monitoring dashboard

**Why This Architecture**:
- ✅ Distributed tokens (no single point of failure)
- ✅ Natural ownership (trainer owns their meetings)
- ✅ Scales automatically (add trainers = add auth)
- ✅ Better UX (clear responsibility model)
- ✅ Secure (per-trainer permissions)

**Estimated Timeline**:
- Phase 1: 30 minutes
- Phase 2: 1 hour
- Phase 3: 2 hours
- Phase 4: 1.5 hours
- Phase 5: 1.5 hours
- Phase 6: 1 hour
- Phase 7: 30 minutes
- **Total: ~8 hours** (can be done over 1-2 days)

Ready to start Phase 1?
