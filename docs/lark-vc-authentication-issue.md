# Lark VC API Authentication Issue

## Diagnosis Summary

**Issue**: The Lark VC API requires **User Access Token** authentication, but the current implementation uses **Tenant Access Token**.

**Evidence**:
- VC permissions in Lark Developer Console show "User token" requirement:
  - `vc:reserve` (Update meeting reservation) - User token ✅ Added
  - `vc:reserve:readonly` (Obtain meeting reservation) - User token ✅ Added
- All VC API endpoints return **404 "page not found"** when using tenant access token
- Tested endpoints:
  - `POST /open-apis/vc/v1/reserve/apply` → 404
  - `POST /open-apis/vc/v1/reserves` → 404
  - `POST /open-apis/vc/v1/meetings` → 404

## Why This Matters

**Tenant Access Token** (current):
- App-level authentication
- No user login required
- Works for app-to-app operations
- ❌ Cannot access user-specific APIs like VC

**User Access Token** (required):
- User-level authentication via OAuth
- Requires user login and authorization
- Works for user-specific operations like creating VC meetings
- ✅ Required for VC API

## Solution Options

### Option 1: Change Permissions to Tenant Token (SIMPLEST)

**What to do:**
1. Go to Lark Developer Console → Your App → Permissions & Scopes
2. For both VC permissions, change from "User token" to "Tenant token"
3. Request admin approval again
4. Current code will work without changes ✅

**Pros:**
- No code changes needed
- Current implementation already ready
- Maintains current simple architecture

**Cons:**
- May not be available (Lark might require user token for VC)
- Need to wait for admin re-approval

### Option 2: Implement User OAuth Flow (CORRECT)

**What to do:**
Implement full OAuth 2.0 user authentication flow:

1. **Add OAuth redirect URL** in Lark Developer Console
   - Set to: `https://your-domain.com/api/lark/oauth/callback`

2. **Create OAuth endpoints:**
   ```
   /api/lark/oauth/login → Redirects user to Lark login
   /api/lark/oauth/callback → Handles OAuth callback
   ```

3. **Store user tokens:**
   - Save user_access_token per user in database
   - Handle token refresh (tokens expire in 2 hours)
   - Associate tokens with trainers

4. **Update VC API calls:**
   - Use user_access_token instead of tenant_access_token
   - Retrieve correct trainer's token when creating meetings

**Pros:**
- Correct authentication method
- More secure (user-level authorization)
- Aligns with Lark's permission model

**Cons:**
- Significant development effort
- Requires user login/authorization flow
- Token management complexity
- Database schema changes needed

### Option 3: Use Alternative Meeting Creation Method (WORKAROUND)

**What to do:**
Instead of Lark VC API, use alternative methods:

A. **Manual Link Entry**: Trainers manually add meeting links
B. **External VC Platform**: Use Zoom/Google Meet instead
C. **Lark Calendar Events**: Create calendar events with VC enabled (if this API works with tenant token)

**Pros:**
- Avoids OAuth complexity
- Works immediately

**Cons:**
- Not automated
- Requires manual trainer intervention
- Less integrated experience

## Recommended Approach

### Immediate (Quickest):
Try **Option 1** first - check if VC permissions can be changed to "Tenant token" in Lark Developer Console.

### If Option 1 Not Available:
Choose based on your requirements:
- **Need full automation?** → Implement Option 2 (OAuth)
- **Can accept manual process?** → Use Option 3A (manual links)
- **Want faster solution?** → Use Option 3B (external VC platform like Zoom)

## Implementation Checklist for Option 2 (OAuth)

If you decide to implement OAuth user authentication:

- [ ] **Phase 1: OAuth Setup**
  - [ ] Add OAuth redirect URL in Lark Developer Console
  - [ ] Add OAuth scopes to Lark app configuration
  - [ ] Create OAuth state management (CSRF protection)

- [ ] **Phase 2: OAuth Endpoints**
  - [ ] Create `/api/lark/oauth/login` endpoint
  - [ ] Create `/api/lark/oauth/callback` endpoint
  - [ ] Implement token exchange logic
  - [ ] Add error handling for OAuth failures

- [ ] **Phase 3: Token Storage**
  - [ ] Add database fields for user tokens
    - `user_access_token`
    - `user_refresh_token`
    - `token_expires_at`
  - [ ] Create token management utilities
  - [ ] Implement token refresh logic

- [ ] **Phase 4: Update VC Integration**
  - [ ] Modify `createVideoConferenceMeeting()` to use user token
  - [ ] Add trainer token lookup logic
  - [ ] Handle token expiration/refresh
  - [ ] Add fallback for missing tokens

- [ ] **Phase 5: Trainer Authorization Flow**
  - [ ] Add "Connect Lark" button in trainer settings
  - [ ] Display authorization status
  - [ ] Handle re-authorization when token expires
  - [ ] Add admin tools to manage trainer authorizations

## Testing Results

Test script: `test-lark-vc-permissions.js`

```bash
✅ Access token obtained (tenant token)
❌ VC API endpoints all return 404
   - vc/v1/reserve/apply → 404
   - vc/v1/reserves → 404
   - vc/v1/meetings → 404
```

**Conclusion**: Permissions are approved, but wrong authentication type is being used.

## Next Steps

1. **Decide which option to pursue** (1, 2, or 3)
2. If Option 1: Check Lark Developer Console for tenant token option
3. If Option 2: I can implement the OAuth flow (estimate: 4-6 hours development)
4. If Option 3: Determine which workaround fits your workflow best

Let me know which approach you'd like to take!
