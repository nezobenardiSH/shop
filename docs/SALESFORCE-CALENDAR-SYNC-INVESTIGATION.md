# Salesforce to Google Calendar Sync - Investigation Guide

**Date:** 2025-11-25
**Status:** Sync Not Working - Investigation Required
**Audience:** Technical Team, Salesforce Administrators

---

## 🎯 Executive Summary

**Current Issue:** Salesforce Events are not automatically syncing to Google Calendar/Lark Calendar.

**Root Cause:** The portal does NOT have automatic sync built-in. Salesforce Events and Lark Calendar are **separate, independent systems**.

**Impact:**
- ✅ Events ARE created in both Salesforce and Lark (manually by portal)
- ❌ Changes in one system do NOT automatically reflect in the other
- ❌ No automatic sync exists between Salesforce ↔ Google/Lark Calendar

---

## 📊 Current System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Merchant Books Appointment                  │
└────────────────────┬────────────────────────────────────┘
                     ↓
         ┌───────────────────────┐
         │   Portal Backend      │
         │  (Next.js API)        │
         └──────┬────────┬───────┘
                │        │
        Manual  │        │  Manual
        Create  │        │  Create
                ↓        ↓
    ┌────────────────┐  ┌─────────────────┐
    │ Lark Calendar  │  │ Salesforce      │
    │  (Primary)     │  │  Events         │
    │                │  │  (Secondary)    │
    │ - Real-time    │  │ - KPI tracking  │
    │ - Scheduling   │  │ - Reports       │
    └────────────────┘  └─────────────────┘
           ↕                     ↕
    NO AUTOMATIC SYNC EXISTS
           ↕                     ↕
    Google Calendar?    Google Calendar?
```

**Key Finding:** The portal acts as a "bridge" that creates events in BOTH systems independently. There is no automatic sync mechanism.

---

## 🔍 Investigation Steps

### Step 1: Run the Diagnostic Script

```bash
cd /Users/nezobenardi/AI_stuff/OnboardingPortal
node scripts/diagnose-salesforce-calendar-sync.js
```

This script will check:
1. ✅ Salesforce connection status
2. ✅ Recent Salesforce Events (last 7 days)
3. ✅ Users with events assigned
4. ✅ Einstein Activity Capture configuration
5. ✅ Connected Apps for calendar integration
6. ✅ Sync settings

### Step 2: Verify Events Are Being Created

**In Salesforce:**
1. Log into Salesforce
2. Navigate to any Trainer's record
3. Click "Activity" tab
4. Look for Events with subjects like:
   - "Remote Training - [Merchant Name]"
   - "Onsite Training - [Merchant Name]"
   - "Installation - [Merchant Name]"

**Check Event Details:**
```sql
-- Query in Developer Console
SELECT Id, Subject, StartDateTime, EndDateTime,
       Owner.Name, What.Name, CreatedDate
FROM Event
WHERE CreatedDate = LAST_N_DAYS:7
ORDER BY CreatedDate DESC
```

**Expected Result:** You should see events created by the portal.

**In Lark Calendar:**
1. Check trainer's Lark Calendar directly
2. Look for same appointments
3. Verify they exist in Lark

**Expected Result:** Events exist in BOTH systems, but independently.

### Step 3: Check for Einstein Activity Capture

**What is Einstein Activity Capture?**
- Salesforce enterprise feature
- Automatically syncs Salesforce Events → Google Calendar
- Requires Sales Cloud Unlimited or Einstein tier

**How to Check:**

1. **In Salesforce Setup:**
   - Go to Setup (gear icon)
   - Quick Find: "Einstein Activity Capture"
   - Check if the feature exists

2. **Check License:**
   - Setup → Company Information → User Licenses
   - Look for "Sales Cloud Einstein" or "Einstein Activity Capture"

3. **Check User Permissions:**
   - Setup → Users → Permission Sets
   - Look for "Einstein Activity Capture User"

**If NOT Found:**
❌ Your org doesn't have Einstein Activity Capture
→ See [Alternative Solutions](#alternative-solutions) below

**If Found:**
✅ Proceed to [Configure Einstein Activity Capture](#configure-einstein-activity-capture)

### Step 4: Check Google Calendar Integration

**User-Level Integration:**

1. Each user must connect their Google Calendar to Salesforce
2. Check if trainers have done this:

**In Salesforce:**
```
Setup → Users → [Select User] → Calendar Integration
```

Look for:
- ✅ "Google Calendar Connected"
- ❌ "Not Connected"

**If Not Connected:**
- Users need to authorize Google Calendar access
- Go to: Personal Settings → Calendar & Reminders → Sync

### Step 5: Check Portal Event Creation

**Verify portal is creating Salesforce Events:**

```bash
# Check recent bookings in logs
cd /Users/nezobenardi/AI_stuff/OnboardingPortal
grep "Salesforce Event created" logs/*.log | tail -20
```

**Or check database:**
```sql
-- If you store event IDs
SELECT merchant_id, training_event_id, training_salesforce_event_id
FROM onboarding_portal
WHERE training_date > NOW() - INTERVAL '7 days'
```

**Expected Log Output:**
```
✅ Salesforce Event created for KPI tracking: 00U8d000001234ABC
```

**If NOT seeing this:**
→ Check `lib/salesforce-events.ts` - Event creation may be failing silently

### Step 6: Manual Sync Test

**Test if manual event sync works:**

1. Create a test event in Salesforce manually
2. Check if it appears in trainer's Google Calendar
3. Wait 5-10 minutes for sync

**If Appears:**
✅ Automatic sync IS working (Einstein or other integration)

**If Does NOT Appear:**
❌ No automatic sync configured

---

## 🔧 Alternative Solutions

If automatic sync is not working, here are your options:

### Option 1: Enable Einstein Activity Capture (Recommended)

**Requirements:**
- Sales Cloud Unlimited Edition OR
- Sales Cloud Einstein Add-on License

**Cost:** $50-150/user/month (check with Salesforce)

**Benefits:**
- ✅ Automatic bidirectional sync
- ✅ Email integration
- ✅ Meeting intelligence
- ✅ Activity metrics

**Setup Guide:** [Configure Einstein Activity Capture](#configure-einstein-activity-capture)

---

### Option 2: Use AppExchange Integration

**Popular Apps:**
1. **Ebsta** - Calendar sync + email tracking
2. **Cirrus Insight** - Gmail/Outlook + Salesforce sync
3. **Groove** - Sales engagement + calendar sync

**Cost:** $10-50/user/month

**To Install:**
1. Go to AppExchange: https://appexchange.salesforce.com
2. Search "Google Calendar sync"
3. Install chosen app
4. Configure per app documentation

---

### Option 3: Build Custom Sync Integration

**Architecture:**

```
Salesforce Platform Events
         ↓
    Middleware (Node.js/Python)
         ↓
   Google Calendar API
         ↓
    Lark Calendar API
```

**Implementation Steps:**

1. **Create Salesforce Platform Event**
```apex
// In Salesforce Developer Console
// Create new Platform Event: Event_Sync__e

public class EventSyncPlatformEvent {
    public String eventId;
    public String subject;
    public DateTime startDateTime;
    public DateTime endDateTime;
    public String ownerId;
    public String ownerEmail;
}
```

2. **Create Trigger to Publish Events**
```apex
trigger EventSyncTrigger on Event (after insert, after update, after delete) {
    List<Event_Sync__e> syncEvents = new List<Event_Sync__e>();

    if (Trigger.isInsert || Trigger.isUpdate) {
        for (Event evt : Trigger.new) {
            Event_Sync__e syncEvt = new Event_Sync__e();
            syncEvt.EventId__c = evt.Id;
            syncEvt.Subject__c = evt.Subject;
            syncEvt.StartDateTime__c = evt.StartDateTime;
            syncEvt.EndDateTime__c = evt.EndDateTime;
            syncEvt.OwnerEmail__c = evt.Owner.Email;
            syncEvents.add(syncEvt);
        }
    }

    EventBus.publish(syncEvents);
}
```

3. **Create Middleware Service**

File: `/scripts/salesforce-calendar-sync-middleware.js`

```javascript
const jsforce = require('jsforce');
const { larkService } = require('../lib/lark');

// Subscribe to Salesforce Platform Events
async function subscribeToEventChanges() {
  const conn = new jsforce.Connection({ /* credentials */ });
  await conn.login(/* credentials */);

  // Subscribe to platform event
  const channel = '/event/Event_Sync__e';

  conn.streaming.topic(channel).subscribe(async (message) => {
    console.log('Received event sync:', message);

    const { EventId__c, OwnerEmail__c, StartDateTime__c, EndDateTime__c } = message;

    // Get trainer's Lark calendar ID
    const calendarId = await getTrainerCalendarId(OwnerEmail__c);

    // Create/Update event in Lark Calendar
    await larkService.createOrUpdateEvent(calendarId, {
      // Map Salesforce event to Lark event
    });
  });
}
```

4. **Deploy and Monitor**
```bash
# Run middleware as background service
pm2 start scripts/salesforce-calendar-sync-middleware.js
pm2 logs salesforce-calendar-sync
```

**Pros:**
- ✅ Full control over sync logic
- ✅ Can customize to your needs
- ✅ No additional licensing cost

**Cons:**
- ❌ Requires development and maintenance
- ❌ Need to host middleware service
- ❌ Must handle error cases and retries

---

### Option 4: Keep Current Architecture (No Sync)

**If sync is not critical:**

The current system works fine with NO automatic sync:
- ✅ Portal creates events in BOTH systems
- ✅ Events are visible to trainers in Lark
- ✅ Events are visible to managers in Salesforce
- ⚠️  Manual changes in one system won't reflect in the other

**When to choose this:**
- Bookings are only made through portal (no manual changes)
- Trainers primarily use Lark Calendar (not Salesforce)
- Managers primarily use Salesforce (not Lark)

---

## ⚙️ Configure Einstein Activity Capture

**Prerequisites:**
- Sales Cloud Unlimited or Einstein license
- System Administrator access
- Users have Google accounts

### Step 1: Enable Einstein Activity Capture

1. **In Salesforce Setup:**
   - Quick Find → "Einstein Activity Capture"
   - Click "Settings"
   - Toggle "Enable Einstein Activity Capture" → ON

2. **Choose Integration Type:**
   - Select "Google Calendar"
   - Follow OAuth configuration wizard

3. **Configure Sync Settings:**
   ```
   ☑ Sync Salesforce Events to Google Calendar
   ☑ Sync Google Calendar to Salesforce Events
   ☐ Sync Emails (optional)
   ```

### Step 2: Assign Users

1. **Create Permission Set:**
   - Setup → Permission Sets → New
   - Name: "Einstein Activity Capture Users"
   - Enable: "Einstein Activity Capture User"

2. **Assign to Trainers:**
   - Select each trainer user
   - Assign permission set

### Step 3: User Authentication

Each trainer must:
1. Go to Personal Settings
2. Click "Einstein Activity Capture"
3. Click "Connect Calendar"
4. Authorize Google account
5. Select calendars to sync

### Step 4: Configure Sync Rules

**In Einstein Activity Capture Settings:**

1. **Event Matching Rules:**
   ```
   Match By: Subject, Start Time, Location
   Conflict Resolution: Salesforce Wins
   ```

2. **Field Mapping:**
   ```
   Salesforce Field     → Google Calendar Field
   Subject              → Title
   StartDateTime        → Start
   EndDateTime          → End
   Location             → Location
   Description          → Description
   ```

3. **Sync Direction:**
   ```
   ☑ Salesforce → Google (push events)
   ☑ Google → Salesforce (pull external events)
   ```

### Step 5: Test Sync

1. Create a test event in Salesforce
2. Wait 5 minutes
3. Check trainer's Google Calendar
4. Verify event appears

**If successful:** ✅ Sync is working!

---

## 🧪 Testing Checklist

After configuring sync, test these scenarios:

### Test 1: New Event Sync
- [ ] Create Salesforce Event manually
- [ ] Verify appears in Google Calendar within 5 minutes
- [ ] Check all fields mapped correctly

### Test 2: Event Update Sync
- [ ] Update Salesforce Event (change time)
- [ ] Verify update reflects in Google Calendar
- [ ] Check no duplicate events created

### Test 3: Event Deletion Sync
- [ ] Delete Salesforce Event
- [ ] Verify deleted from Google Calendar
- [ ] Check no orphaned events

### Test 4: Portal Booking
- [ ] Book training via portal
- [ ] Verify event in Lark Calendar (created by portal)
- [ ] Verify event in Salesforce (created by portal)
- [ ] Verify event in Google Calendar (synced by Einstein)

### Test 5: Conflict Resolution
- [ ] Create event in Google Calendar
- [ ] Create event in Salesforce at same time
- [ ] Verify conflict resolution rule applied

---

## 📊 Monitoring and Troubleshooting

### Check Sync Status

**In Salesforce:**
```
Setup → Einstein Activity Capture → Sync Status
```

Look for:
- Last Sync Time
- Events Synced Today
- Sync Errors

### Common Issues

#### Issue 1: Events Not Syncing

**Symptoms:**
- Salesforce Events created
- Not appearing in Google Calendar

**Causes:**
1. User hasn't connected Google account
2. Calendar sync disabled for user
3. Event doesn't meet sync criteria

**Fix:**
1. Check user's Einstein Activity Capture settings
2. Verify "Connect Calendar" is green
3. Check sync rules in Settings

#### Issue 2: Duplicate Events

**Symptoms:**
- Same event appears twice in calendar

**Causes:**
1. Portal creates event in Lark
2. Einstein syncs Salesforce event to Google
3. Both appear if Lark = Google account

**Fix:**
- Choose ONE system for calendar events
- Either: Portal → Lark only, OR Portal → Salesforce → Google

#### Issue 3: Sync Delay

**Symptoms:**
- Events take 10+ minutes to appear

**Causes:**
- Einstein sync runs every 5-10 minutes (not real-time)

**Fix:**
- This is normal behavior
- For real-time sync, need custom integration

#### Issue 4: Partial Field Sync

**Symptoms:**
- Event syncs but some fields missing

**Causes:**
- Field mapping not configured

**Fix:**
- Setup → Einstein Activity Capture → Field Mappings
- Map custom fields

---

## 🎯 Recommended Solution

Based on your current architecture, here's what I recommend:

### **Option A: No Sync Required** ⭐ (RECOMMENDED)

**Why:**
- Portal already creates events in BOTH systems
- Trainers use Lark (not Salesforce) for scheduling
- Managers use Salesforce (not Lark) for KPI tracking
- No manual changes happen in either system

**Action:**
- No changes needed
- Document that systems are intentionally separate
- Train users to only book via portal

### **Option B: Enable Einstein Activity Capture** (if budget allows)

**Why:**
- Future-proof for manual event management
- Better for managers who need calendar view
- Provides email tracking and more features

**Action:**
- Check license availability
- Follow [Configure Einstein Activity Capture](#configure-einstein-activity-capture)
- Budget $50-150/user/month

### **Option C: Custom Integration** (if you need full control)

**Why:**
- Can sync Salesforce ↔ Lark directly
- No Google Calendar needed as intermediary
- Custom logic for your workflow

**Action:**
- Use Platform Events approach above
- Develop and maintain middleware
- Deploy as background service

---

## 📚 Additional Resources

### Salesforce Documentation
- [Einstein Activity Capture Overview](https://help.salesforce.com/s/articleView?id=sf.einstein_activity_capture_overview.htm)
- [Connect Google Calendar](https://help.salesforce.com/s/articleView?id=sf.einstein_activity_capture_google.htm)
- [Platform Events Guide](https://developer.salesforce.com/docs/atlas.en-us.platform_events.meta/platform_events/)

### Code References
- Event Creation: `lib/salesforce-events.ts`
- Booking Flow: `app/api/lark/book-training/route.ts:790-896`
- Diagnostic Script: `scripts/diagnose-salesforce-calendar-sync.js`

### Support Contacts
- Salesforce Support: 1-800-NO-SOFTWARE
- Einstein Activity Capture: einstein-support@salesforce.com

---

## 🔄 Next Steps

1. **Run Diagnostic Script:**
   ```bash
   node scripts/diagnose-salesforce-calendar-sync.js
   ```

2. **Review Findings:**
   - Check if Einstein Activity Capture is available
   - Verify events are being created
   - Confirm users have connected calendars

3. **Choose Solution:**
   - Option A: Keep separate (no changes)
   - Option B: Enable Einstein (requires license)
   - Option C: Build custom sync (requires dev)

4. **Implement:**
   - Follow relevant section above
   - Test thoroughly
   - Document for team

5. **Monitor:**
   - Check sync status daily for first week
   - Address any errors immediately
   - Train users on new workflow

---

**Questions or Issues?**
Contact: Technical Team Lead or Salesforce Administrator
