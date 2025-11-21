# Menu Submission Notification - Polling Implementation

## Overview

This document provides step-by-step instructions to implement a polling-based notification system that checks Salesforce every 5 minutes for new menu submissions and sends Lark notifications to Onboarding Managers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CRON JOB (Runs every 5 minutes)                           │
│  /api/cron/check-menu-submissions                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Query Salesforce                                           │
│  - Get Onboarding_Trainer__c records                       │
│  - WHERE Menu_Collection_Submission_Link__c IS NOT NULL    │
│  - AND LastModifiedDate >= (NOW - 10 minutes)              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Check Database                                             │
│  - Have we already notified about this submission?         │
│  - Table: menu_submission_notifications                    │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
         ▼               ▼
    ┌─────────┐    ┌──────────┐
    │ Already │    │   NEW    │
    │ Notified│    │Submission│
    └────┬────┘    └────┬─────┘
         │              │
         │              ▼
         │    ┌──────────────────┐
         │    │ Send Lark        │
         │    │ Notification     │
         │    │ to MSM           │
         │    └────┬─────────────┘
         │         │
         │         ▼
         │    ┌──────────────────┐
         │    │ Save to Database │
         │    │ (mark as notified)│
         │    └──────────────────┘
         │
         └─────► Skip (do nothing)
```

---

## Implementation Steps

### **Step 1: Database Schema**

Create a new Prisma model to track which submissions we've already notified about.

**File: `prisma/schema.prisma`**

Add this model:

```prisma
model MenuSubmissionNotification {
  id              String   @id @default(cuid())
  trainerId       String   // Onboarding_Trainer__c ID
  submissionLink  String   // Menu_Collection_Submission_Link__c value
  merchantName    String?  // For reference
  msmEmail        String?  // Manager who was notified
  notifiedAt      DateTime @default(now())
  createdAt       DateTime @default(now())

  @@unique([trainerId, submissionLink])
  @@index([trainerId])
  @@index([notifiedAt])
  @@map("menu_submission_notifications")
}
```

**Actions:**
1. Add the model to `prisma/schema.prisma`
2. Run: `npx prisma migrate dev --name add_menu_submission_notifications`
3. Run: `npx prisma generate`

---

### **Step 2: Create Cron API Route**

Create the API endpoint that will be called by the cron job.

**File: `app/api/cron/check-menu-submissions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSalesforceConnection } from '@/lib/salesforce'
import { sendMenuSubmissionNotification } from '@/lib/lark-notifications'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds timeout

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 [CRON] Starting menu submission check...')

    // Step 1: Query Salesforce for recent menu submissions
    const conn = await getSalesforceConnection()
    if (!conn) {
      throw new Error('Failed to connect to Salesforce')
    }

    // Get records updated in last 10 minutes (to avoid missing any due to timing)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const query = `
      SELECT Id, Name, Menu_Collection_Submission_Link__c,
             MSM_Name__r.Email, MSM_Name__r.Name,
             LastModifiedDate
      FROM Onboarding_Trainer__c
      WHERE Menu_Collection_Submission_Link__c != NULL
        AND LastModifiedDate >= ${tenMinutesAgo}
      ORDER BY LastModifiedDate DESC
    `

    console.log('📋 Querying Salesforce for recent submissions...')
    const result = await conn.query(query)

    console.log(`📊 Found ${result.totalSize} records with menu submissions`)

    if (result.totalSize === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new menu submissions found',
        checked: 0,
        notified: 0
      })
    }

    // Step 2: Process each record
    let notifiedCount = 0
    let skippedCount = 0

    for (const record of result.records) {
      const trainer = record as any
      const trainerId = trainer.Id
      const submissionLink = trainer.Menu_Collection_Submission_Link__c
      const merchantName = trainer.Name
      const msmEmail = trainer.MSM_Name__r?.Email
      const msmName = trainer.MSM_Name__r?.Name

      console.log(`\n🔍 Processing: ${merchantName} (${trainerId})`)

      // Check if we already notified about this submission
      const existingNotification = await prisma.menuSubmissionNotification.findUnique({
        where: {
          trainerId_submissionLink: {
            trainerId,
            submissionLink
          }
        }
      })

      if (existingNotification) {
        console.log(`   ⏭️  Already notified on ${existingNotification.notifiedAt.toISOString()}`)
        skippedCount++
        continue
      }

      // Check if MSM is configured
      if (!msmEmail) {
        console.log(`   ⚠️  No MSM email found, skipping notification`)
        skippedCount++
        continue
      }

      // Send notification
      try {
        await sendMenuSubmissionNotification(msmEmail, merchantName, trainerId)
        console.log(`   ✅ Notification sent to: ${msmName} (${msmEmail})`)

        // Record that we sent the notification
        await prisma.menuSubmissionNotification.create({
          data: {
            trainerId,
            submissionLink,
            merchantName,
            msmEmail
          }
        })

        notifiedCount++
      } catch (notificationError) {
        console.error(`   ❌ Failed to send notification:`, notificationError)
        // Continue with next record even if this one fails
      }
    }

    console.log(`\n📈 Summary: ${notifiedCount} notified, ${skippedCount} skipped`)

    return NextResponse.json({
      success: true,
      message: 'Menu submission check completed',
      checked: result.totalSize,
      notified: notifiedCount,
      skipped: skippedCount
    })

  } catch (error: any) {
    console.error('❌ [CRON] Menu submission check failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
```

**Actions:**
1. Create the file `app/api/cron/check-menu-submissions/route.ts`
2. Copy the code above

---

### **Step 3: Test Manually**

Before setting up the cron job, test the endpoint manually:

```bash
# Local testing
curl http://localhost:3010/api/cron/check-menu-submissions

# Production testing
curl https://onboarding-portal-5fhi.onrender.com/api/cron/check-menu-submissions
```

**Expected output:**
```json
{
  "success": true,
  "message": "Menu submission check completed",
  "checked": 1,
  "notified": 1,
  "skipped": 0
}
```

**Check logs to verify:**
- Salesforce query executed
- Records found
- Notifications sent
- Database records created

---

### **Step 4: Configure Cron Job on Render**

Render supports cron jobs natively.

**Option A: Using Render Cron Jobs (Recommended)**

1. Go to your Render dashboard
2. Click on your service: `onboarding-portal-5fhi`
3. Go to **"Cron Jobs"** tab
4. Click **"Add Cron Job"**
5. Configure:
   - **Name:** `Check Menu Submissions`
   - **Command:** `curl https://onboarding-portal-5fhi.onrender.com/api/cron/check-menu-submissions`
   - **Schedule:** `*/5 * * * *` (every 5 minutes)
6. Click **"Save"**

**Option B: Using an External Cron Service**

If Render doesn't support cron jobs on your plan, use:

1. **Cron-job.org** (free)
   - Create account
   - Add cron job
   - URL: `https://onboarding-portal-5fhi.onrender.com/api/cron/check-menu-submissions`
   - Schedule: Every 5 minutes

2. **EasyCron** (free tier available)
   - Similar setup as above

3. **GitHub Actions** (if your repo is on GitHub)
   - Create workflow file to run every 5 minutes

---

### **Step 5: Add Cron Job Security (Optional but Recommended)**

To prevent unauthorized access to your cron endpoint:

**Option A: API Key Authentication**

Add to `app/api/cron/check-menu-submissions/route.ts`:

```typescript
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // ... rest of code
}
```

Add to `.env`:
```
CRON_SECRET=your-random-secret-here
```

Update cron command:
```bash
curl -H "Authorization: Bearer your-random-secret-here" https://onboarding-portal-5fhi.onrender.com/api/cron/check-menu-submissions
```

**Option B: IP Whitelist**

Only allow requests from Render's IP ranges or your cron service's IPs.

---

### **Step 6: Monitor and Verify**

After deployment, monitor the cron job:

**Check Render Logs:**
1. Go to Render dashboard
2. Select your service
3. View logs
4. Look for `[CRON]` prefixed messages every 5 minutes

**Expected log pattern (every 5 minutes):**
```
🔄 [CRON] Starting menu submission check...
📋 Querying Salesforce for recent submissions...
📊 Found 0 records with menu submissions
```

**When a submission happens:**
```
🔄 [CRON] Starting menu submission check...
📋 Querying Salesforce for recent submissions...
📊 Found 1 records with menu submissions

🔍 Processing: Nasi Lemak (a0yQ9000003aAvBIAU)
   ✅ Notification sent to: John Manager (john@example.com)

📈 Summary: 1 notified, 0 skipped
```

---

## Testing Checklist

Before going live:

- [ ] Database migration ran successfully
- [ ] Manual API call returns success
- [ ] Test with a real menu submission in Salesforce
- [ ] Verify notification received in Lark
- [ ] Check database record was created
- [ ] Verify duplicate submissions are skipped
- [ ] Cron job scheduled correctly on Render
- [ ] Logs show cron running every 5 minutes

---

## Troubleshooting

### Issue: "Failed to connect to Salesforce"
**Solution:** Check Salesforce credentials in environment variables

### Issue: "No MSM email found"
**Solution:** Ensure `MSM_Name__c` field is populated in Salesforce

### Issue: Notifications not being sent
**Solution:**
1. Check Lark authentication for MSM
2. Verify `sendMenuSubmissionNotification` function works
3. Check logs for error messages

### Issue: Duplicate notifications
**Solution:**
1. Check database for existing records
2. Verify unique constraint on `trainerId_submissionLink`

### Issue: Cron not running
**Solution:**
1. Verify cron job is active on Render
2. Check schedule syntax (`*/5 * * * *`)
3. Test endpoint manually with curl

---

## Performance Considerations

- **Salesforce API Limits:** Each run uses 1 API call. At 5-minute intervals = ~288 calls/day (well within limits)
- **Database Growth:** Table will grow over time. Consider archiving old records after 90 days
- **Render Sleep:** If using free tier, service may sleep. Upgrade to paid tier for 24/7 operation

---

## Future Enhancements

- [ ] Add retry logic for failed notifications
- [ ] Send digest summary email (daily/weekly)
- [ ] Dashboard to view notification history
- [ ] Alert if cron job stops running
- [ ] Support for multiple notification channels (email, SMS, etc.)

---

## Rollback Plan

If something goes wrong:

1. **Disable cron job** on Render immediately
2. **Check logs** to identify the issue
3. **Fix the code** and redeploy
4. **Test manually** before re-enabling cron
5. **Rollback database migration** if needed:
   ```bash
   npx prisma migrate reset
   ```

---

## Summary

This implementation provides:
- ✅ Automatic polling every 5 minutes
- ✅ No Salesforce configuration needed
- ✅ Duplicate prevention
- ✅ Easy to monitor and debug
- ✅ Scalable and maintainable

**Total Implementation Time:** ~30 minutes

**Maintenance Required:** Minimal (monitor logs weekly)
