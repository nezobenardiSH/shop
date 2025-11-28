# Salesforce Calendar Sync - Quick Investigation Guide

**TL;DR:** Your system does NOT have automatic sync. Events are created manually by the portal in BOTH systems independently.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Run the Diagnostic Tool

```bash
cd /Users/nezobenardi/AI_stuff/OnboardingPortal
node scripts/diagnose-salesforce-calendar-sync.js
```

### Step 2: Check if Events Exist

**In Salesforce:**
1. Go to any Trainer record
2. Click "Activity" tab
3. Look for events like "Remote Training - [Merchant]"

**In Lark Calendar:**
1. Open trainer's Lark Calendar
2. Look for same appointments

### Step 3: Determine Status

| Salesforce Events | Lark Calendar | Status | Action |
|-------------------|---------------|--------|--------|
| ✅ Exist | ✅ Exist | 🟢 **WORKING** | No sync needed - systems are separate |
| ✅ Exist | ❌ Missing | 🟡 **PORTAL ISSUE** | Check portal booking code |
| ❌ Missing | ✅ Exist | 🟡 **SF ISSUE** | Check Salesforce event creation |
| ❌ Missing | ❌ Missing | 🔴 **BOOKING FAILED** | Check portal logs |

---

## 🎯 Understanding the Architecture

```
Portal creates events in BOTH systems:

User Books
    ↓
Portal Backend
    ├──→ Lark Calendar (for trainer's schedule)
    └──→ Salesforce Events (for manager's KPI tracking)

❌ NO AUTOMATIC SYNC BETWEEN THEM
```

**Key Point:** This is BY DESIGN, not a bug.

---

## ⚠️ If You Need Automatic Sync

You have 3 options:

### Option 1: Einstein Activity Capture ($$)
- **Cost:** $50-150/user/month
- **Time:** 1-2 hours setup
- **Benefit:** Automatic sync Salesforce ↔ Google Calendar
- **How:** See `docs/SALESFORCE-CALENDAR-SYNC-INVESTIGATION.md`

### Option 2: AppExchange App ($$)
- **Cost:** $10-50/user/month
- **Time:** 30 minutes setup
- **Benefit:** Third-party sync solution
- **How:** Search AppExchange for "Google Calendar sync"

### Option 3: Custom Integration (time)
- **Cost:** Free (developer time)
- **Time:** 1-2 weeks development
- **Benefit:** Full control, sync Salesforce ↔ Lark directly
- **How:** See custom integration section in investigation guide

---

## 🔍 Common Scenarios

### Scenario 1: "Events not syncing to Google Calendar"

**Expected Behavior:** Events DON'T automatically sync (no sync exists)

**What's Happening:**
- Portal creates event in Lark ✅
- Portal creates event in Salesforce ✅
- They stay separate ✅

**Fix:** This is normal. Enable sync if needed (see options above).

---

### Scenario 2: "Changes in Salesforce don't appear in Lark"

**Expected Behavior:** Changes DON'T sync (no sync exists)

**What's Happening:**
- Systems are independent
- No mechanism to propagate changes

**Fix:** Either:
1. Always book/change via portal (updates both)
2. Enable automatic sync (see options above)

---

### Scenario 3: "Trainer updated Google Calendar, Salesforce not updated"

**Expected Behavior:** Updates DON'T sync (no sync exists)

**What's Happening:**
- Google/Lark and Salesforce are separate
- Manual changes stay local

**Fix:**
1. Train users to only update via portal
2. Enable Einstein Activity Capture for bidirectional sync

---

## 📋 Quick Checks

### Check 1: Are Events Being Created?

```bash
# Check portal logs
grep "Salesforce Event created" logs/*.log | tail -10
grep "calendar event created" logs/*.log | tail -10
```

**Expected:** Both log entries for each booking

### Check 2: Verify Salesforce Events Exist

In Salesforce Developer Console:
```sql
SELECT Id, Subject, StartDateTime, Owner.Name
FROM Event
WHERE CreatedDate = LAST_N_DAYS:7
ORDER BY CreatedDate DESC
LIMIT 10
```

**Expected:** See recent training/installation events

### Check 3: Check Portal Event IDs Stored

```sql
SELECT Training_Event_ID__c, Training_Salesforce_Event_ID__c
FROM Onboarding_Portal__c
WHERE Training_Date__c > TODAY - 7
```

**Expected:** Both fields populated for recent bookings

---

## 🆘 Troubleshooting

### Issue: No Salesforce Events Created

**Check:**
```bash
# Check for errors in logs
grep "Salesforce Event.*failed" logs/*.log
grep "Error creating Salesforce Event" logs/*.log
```

**Common Causes:**
1. Salesforce connection failed
2. User ID not found for trainer
3. Invalid event data

**Fix:** Check `lib/salesforce-events.ts:82-89` for error logs

---

### Issue: No Lark Calendar Events Created

**Check:**
```bash
# Check for Lark errors
grep "Lark.*failed" logs/*.log
grep "calendar.*failed" logs/*.log
```

**Common Causes:**
1. Trainer hasn't authorized Lark OAuth
2. Calendar ID incorrect
3. Lark API error

**Fix:** Check trainer authorization at `/trainers/authorize`

---

## 🎓 Key Takeaways

1. **No automatic sync exists** - This is normal
2. **Portal creates events in BOTH systems** - This works
3. **Manual changes don't sync** - Users must use portal
4. **To enable sync:** Need Einstein/AppExchange/Custom solution
5. **Current system works fine** - If all bookings via portal

---

## 📚 Full Documentation

For complete investigation guide with detailed solutions:
- **See:** `docs/SALESFORCE-CALENDAR-SYNC-INVESTIGATION.md`

For diagnostic tool details:
- **Run:** `node scripts/diagnose-salesforce-calendar-sync.js`

For code references:
- Salesforce Events: `lib/salesforce-events.ts`
- Booking Flow: `app/api/lark/book-training/route.ts`
- Lark Integration: `lib/lark.ts`

---

## ✅ Recommended Action

**If bookings work correctly:**
→ No action needed. Systems are separate by design.

**If you need automatic sync:**
→ Follow `docs/SALESFORCE-CALENDAR-SYNC-INVESTIGATION.md`

**If events are missing:**
→ Run diagnostic script and check portal logs
