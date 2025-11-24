# Salesforce Task Creation Implementation Guide

## Overview

This document outlines the step-by-step implementation for automatically creating Salesforce Tasks when:
1. Menu is submitted (via cron job)
2. Store setup video is uploaded (real-time)
3. External vendor booking is requested (real-time)

## Current State Analysis

### Menu Submission
- **File**: `app/api/salesforce/menu-upload/route.ts`
- **Flow**: Real-time Lark notification + Cron backup at `app/api/cron/check-menu-submissions/route.ts`
- **Database**: `MenuSubmissionNotification` table tracks notifications

### Video Upload
- **File**: `app/api/salesforce/upload-video/route.ts`
- **Flow**: Real-time Lark notification (line 122-143)
- **Database**: No tracking table

### External Vendor Booking
- **File**: `lib/installer-availability.ts` (`submitExternalInstallationRequest()`)
- **Flow**: Real-time Lark notification (line 1231-1327) + Lark Base record
- **Database**: No tracking table

---

## Implementation Plan

### Phase 1: Setup Salesforce API Integration

#### Step 1.1: Add Environment Variables
Add to `.env`:
```env
# Salesforce API Configuration
SALESFORCE_CLIENT_ID=your_connected_app_client_id
SALESFORCE_CLIENT_SECRET=your_connected_app_client_secret
SALESFORCE_USERNAME=your_salesforce_username
SALESFORCE_PASSWORD=your_salesforce_password
SALESFORCE_SECURITY_TOKEN=your_security_token
SALESFORCE_INSTANCE_URL=https://storehub.lightning.force.com
```

**Action Items**:
- [ ] Create Salesforce Connected App (if not exists)
- [ ] Get Client ID and Secret
- [ ] Get Security Token
- [ ] Add variables to `.env`
- [ ] Add variables to production environment (Vercel/Railway/etc.)

#### Step 1.2: Create Salesforce Task API Module
**File**: `lib/salesforce-tasks.ts`

**Functions to implement**:
1. `getSalesforceAccessToken()` - OAuth authentication
2. `getMsmSalesforceUserId(email: string)` - Convert MSM email to Salesforce User ID
3. `createSalesforceTask(params)` - Create Task via REST API
4. `updateSalesforceTask(taskId, updates)` - Update Task (for future completion)

**API Endpoints**:
- Auth: `POST /services/oauth2/token`
- Create Task: `POST /services/data/v60.0/sobjects/Task`
- Query User: `GET /services/data/v60.0/query?q=SELECT Id FROM User WHERE Email = '{email}'`

**Task Fields**:
```typescript
{
  Subject: string,           // Task title
  Description: string,       // Detailed info with links
  Status: "Not Started",     // Initial status
  Priority: "High" | "Normal",
  OwnerId: string,          // Salesforce User ID (MSM)
  WhatId: string,           // Onboarding_Trainer__c ID
  ActivityDate: string      // Due date (YYYY-MM-DD)
}
```

---

### Phase 2: Database Schema Update

#### Step 2.1: Add Prisma Model for Task Tracking
**File**: `prisma/schema.prisma`

Add new model:
```prisma
model SalesforceTaskTracking {
  id              String   @id @default(cuid())
  taskId          String   @unique // Salesforce Task.Id
  trainerId       String   // Onboarding_Trainer__c.Id
  taskType        TaskType
  merchantName    String?
  msmEmail        String?
  createdAt       DateTime @default(now())
  completedAt     DateTime?

  @@unique([trainerId, taskType])
  @@index([trainerId])
  @@index([taskType])
  @@index([createdAt])
  @@map("salesforce_task_tracking")
}

enum TaskType {
  MENU_SUBMISSION
  VIDEO_UPLOAD
  EXTERNAL_VENDOR_BOOKING
}
```

**Action Items**:
- [ ] Add model to schema
- [ ] Run `npx prisma migrate dev --name add_salesforce_task_tracking`
- [ ] Run `npx prisma generate`
- [ ] Verify migration in database

---

### Phase 3: Implementation - Menu Submission (Cron-based)

#### Step 3.1: Update Menu Submission Cron Job
**File**: `app/api/cron/check-menu-submissions/route.ts`

**Location**: After Lark notification is sent (around line 80-100)

**Implementation**:
```typescript
// After sending Lark notification
try {
  // Check if task already created
  const existingTask = await prisma.salesforceTaskTracking.findUnique({
    where: {
      trainerId_taskType: {
        trainerId: trainer.Id,
        taskType: 'MENU_SUBMISSION'
      }
    }
  });

  if (!existingTask) {
    // Get MSM Salesforce User ID
    const msmUserId = await getMsmSalesforceUserId(msmEmail);

    // Create Salesforce Task
    const taskId = await createSalesforceTask({
      subject: `Review menu submission for ${trainer.Name}`,
      description: `
        Merchant: ${trainer.Name}
        The merchant has submitted their menu/product information.

        Menu Link: ${trainer.Menu_Collection_Submission_Link__c}
        🔗 Salesforce: ${process.env.SALESFORCE_INSTANCE_URL}/${trainer.Id}
      `,
      status: 'Not Started',
      priority: 'High',
      ownerId: msmUserId,
      whatId: trainer.Id,
      activityDate: new Date().toISOString().split('T')[0]
    });

    // Track in database
    await prisma.salesforceTaskTracking.create({
      data: {
        taskId,
        trainerId: trainer.Id,
        taskType: 'MENU_SUBMISSION',
        merchantName: trainer.Name,
        msmEmail
      }
    });
  }
} catch (error) {
  console.error('Failed to create Salesforce task:', error);
  // Don't fail the notification if task creation fails
}
```

**Action Items**:
- [ ] Import `salesforce-tasks.ts` functions
- [ ] Add task creation logic after Lark notification
- [ ] Add error handling
- [ ] Test with cron trigger

---

### Phase 4: Implementation - Video Upload (Real-time)

#### Step 4.1: Update Video Upload Handler
**File**: `app/api/salesforce/upload-video/route.ts`

**Location**: After Lark notification is sent (around line 143)

**Implementation**:
```typescript
// After sendStoreVideoNotification()
try {
  // Check if task already created
  const existingTask = await prisma.salesforceTaskTracking.findFirst({
    where: {
      trainerId: trainerId,
      taskType: 'VIDEO_UPLOAD',
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  });

  if (!existingTask) {
    // Get MSM Salesforce User ID
    const msmUserId = await getMsmSalesforceUserId(msmEmail);

    // Create Salesforce Task
    const taskId = await createSalesforceTask({
      subject: `Review setup video for ${merchantName}`,
      description: `
        Merchant: ${merchantName}
        The merchant has uploaded their store setup video proof.

        Video Link: ${videoProofLink}
        🔗 Salesforce: ${process.env.SALESFORCE_INSTANCE_URL}/${trainerId}
      `,
      status: 'Not Started',
      priority: 'Normal',
      ownerId: msmUserId,
      whatId: trainerId,
      activityDate: new Date().toISOString().split('T')[0]
    });

    // Track in database
    await prisma.salesforceTaskTracking.create({
      data: {
        taskId,
        trainerId,
        taskType: 'VIDEO_UPLOAD',
        merchantName,
        msmEmail
      }
    });
  }
} catch (error) {
  console.error('Failed to create Salesforce task:', error);
  // Don't fail the upload if task creation fails
}
```

**Action Items**:
- [ ] Import `salesforce-tasks.ts` functions
- [ ] Add task creation logic after Lark notification
- [ ] Add error handling
- [ ] Test with video upload

---

### Phase 5: Implementation - External Vendor Booking (Real-time)

#### Step 5.1: Update External Vendor Request Handler
**File**: `lib/installer-availability.ts`

**Location**: In `submitExternalInstallationRequest()` after Lark notification (around line 1327)

**Implementation**:
```typescript
// After sendExternalVendorNotificationToManager()
try {
  // Check if task already created
  const existingTask = await prisma.salesforceTaskTracking.findUnique({
    where: {
      trainerId_taskType: {
        trainerId: trainer.Id,
        taskType: 'EXTERNAL_VENDOR_BOOKING'
      }
    }
  });

  if (!existingTask) {
    // Get MSM Salesforce User ID
    const msmUserId = await getMsmSalesforceUserId(msmEmail);

    // Format vendor type
    const vendorType = "External Installation Vendor";

    // Format hardware list
    const hardwareList = orderItems
      .map(item => `- ${item.Product2.Name}`)
      .join('\n');

    // Create Salesforce Task
    const taskId = await createSalesforceTask({
      subject: `Book external installation for ${trainer.Name}`,
      description: `
        Merchant: ${trainer.Name}
        Store Address: ${fullAddress}

        ACTION REQUIRED: Book installation on external vendor website

        Requested Date: ${formattedDate}
        Requested Time: ${formattedTime}

        Hardware:
        ${hardwareList}

        Merchant Email: ${trainer.Email__c}
        Sales Order: ${orderNumber}

        🔗 Salesforce: ${process.env.SALESFORCE_INSTANCE_URL}/${trainer.Id}
      `,
      status: 'Not Started',
      priority: 'High',
      ownerId: msmUserId,
      whatId: trainer.Id,
      activityDate: requestedDate.toISOString().split('T')[0]
    });

    // Track in database
    await prisma.salesforceTaskTracking.create({
      data: {
        taskId,
        trainerId: trainer.Id,
        taskType: 'EXTERNAL_VENDOR_BOOKING',
        merchantName: trainer.Name,
        msmEmail
      }
    });
  }
} catch (error) {
  console.error('Failed to create Salesforce task:', error);
  // Don't fail the booking if task creation fails
}
```

**Action Items**:
- [ ] Import `salesforce-tasks.ts` functions
- [ ] Add task creation logic after Lark notification
- [ ] Add error handling
- [ ] Test with external vendor booking

---

## Testing Plan

### Test 1: Menu Submission Task Creation
1. Trigger cron job: `GET /api/cron/check-menu-submissions`
2. Verify Lark notification sent
3. Check Salesforce for new Task in OM's task list
4. Verify `SalesforceTaskTracking` record created
5. Trigger cron again - confirm no duplicate task

### Test 2: Video Upload Task Creation
1. Upload video through portal
2. Verify Lark notification sent
3. Check Salesforce for new Task
4. Verify `SalesforceTaskTracking` record created
5. Upload another video - confirm new task created (different from menu)

### Test 3: External Vendor Booking Task Creation
1. Book installation for external location
2. Verify Lark notification sent
3. Check Salesforce for new Task
4. Verify `SalesforceTaskTracking` record created
5. Verify task includes all booking details

### Test 4: Error Handling
1. Test with invalid MSM email (no Salesforce user)
2. Test with Salesforce API down
3. Verify notifications still work even if task creation fails

---

## Future Enhancements

### Auto-Complete Tasks
When OM completes action in portal, automatically mark Salesforce Task as completed:

**Triggers**:
- Menu approved → Update Task status to "Completed"
- Video reviewed → Update Task status to "Completed"
- Vendor booking confirmed → Update Task status to "Completed"

**Implementation**:
```typescript
// In relevant API endpoints
const task = await prisma.salesforceTaskTracking.findUnique({
  where: { trainerId_taskType: { trainerId, taskType } }
});

if (task && !task.completedAt) {
  await updateSalesforceTask(task.taskId, {
    Status: 'Completed',
    CompletedDateTime: new Date().toISOString()
  });

  await prisma.salesforceTaskTracking.update({
    where: { id: task.id },
    data: { completedAt: new Date() }
  });
}
```

---

## Rollback Plan

If issues occur:
1. Disable task creation by adding feature flag check
2. Remove Salesforce API calls from code
3. Revert database migration if needed
4. Lark notifications will continue working independently

---

## Checklist

### Phase 1: Setup
- [ ] Create Salesforce Connected App
- [ ] Add environment variables
- [ ] Create `lib/salesforce-tasks.ts` module
- [ ] Test Salesforce authentication

### Phase 2: Database
- [ ] Add Prisma schema
- [ ] Run migration
- [ ] Test database operations

### Phase 3: Menu Submission
- [ ] Update cron job code
- [ ] Test with real menu submission
- [ ] Verify task in Salesforce

### Phase 4: Video Upload
- [ ] Update upload handler
- [ ] Test with real video upload
- [ ] Verify task in Salesforce

### Phase 5: External Vendor
- [ ] Update vendor booking handler
- [ ] Test with real booking
- [ ] Verify task in Salesforce

### Phase 6: Production
- [ ] Deploy to staging
- [ ] Run all tests
- [ ] Deploy to production
- [ ] Monitor for errors

---

## Notes

- All task creation is non-blocking - failures won't affect notifications
- Tasks are assigned to MSM from `MSM_Name__r` field
- Deduplication prevents duplicate tasks
- Task IDs stored for future auto-completion feature
