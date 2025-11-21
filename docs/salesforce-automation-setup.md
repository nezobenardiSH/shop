# Salesforce Automation Setup Guide

## Overview

This guide covers optional Salesforce automations for the Onboarding Portal. Note that **menu submission notifications now work automatically via polling** and don't require any Salesforce setup.

---

## Menu Submission Notifications

**Status: ✅ Automated via Polling**

Menu submission notifications are handled automatically by the portal's cron job system:
- Portal checks Salesforce every 5 minutes for new submissions
- Sends Lark notifications to Onboarding Managers automatically
- **No Salesforce configuration required**

See: `docs/MENU_NOTIFICATION_POLLING_IMPLEMENTATION.md` for details.

---

## Optional Salesforce Automations

The following automations can be set up in Salesforce for other workflow improvements:

### 1. Installation Date → Installation Status Update

**Trigger**: When `Installation_Date__c` is filled out
**Action**: Update `Hardware_Installation_Status__c` to "Ticket Submitted"

### 2. Training Date → Training Status Update

**Trigger**: When training dates are scheduled
**Action**: Update `Training_Status__c` to "Training Scheduled"

---

## Implementation (Process Builder)

If you want to set up the optional automations above:

1. **Setup → Process Builder → New Process**
2. **Object**: Onboarding_Trainer__c
3. **Start Process**: When a record is created or edited

### Installation Date Automation

**Criteria:**
```
Conditions:
- [Onboarding_Trainer__c].Installation_Date__c IS NOT NULL
- ISCHANGED([Onboarding_Trainer__c].Installation_Date__c) EQUALS True

Additional Criteria (to avoid overwriting advanced statuses):
- [Onboarding_Trainer__c].Hardware_Installation_Status__c EQUALS "Not Started"
  OR
- [Onboarding_Trainer__c].Hardware_Installation_Status__c IS NULL
```

**Action:**
- Action Type: Update Records
- Record: [Onboarding_Trainer__c] (the record that started the process)
- Field Updates:
  - `Hardware_Installation_Status__c` = "Ticket Submitted"

### Training Date Automation

**Criteria:**
```
Conditions:
- [Onboarding_Trainer__c].Training_Date__c IS NOT NULL
- ISCHANGED([Onboarding_Trainer__c].Training_Date__c) EQUALS True

Additional Criteria:
- [Onboarding_Trainer__c].Training_Status__c EQUALS "Not Started"
  OR
- [Onboarding_Trainer__c].Training_Status__c IS NULL
```

**Action:**
- Action Type: Update Records
- Record: [Onboarding_Trainer__c] (the record that started the process)
- Field Updates:
  - `Training_Status__c` = "Training Scheduled"

---

## Notes

- These automations are **optional** and not required for the portal to function
- The portal already handles critical workflows automatically
- Set up these automations only if you need automatic status updates in Salesforce
