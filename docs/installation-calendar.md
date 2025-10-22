# Installation Calendar System Documentation

## ⚠️ Quick Reference - Common Issues

### 🔴 CRITICAL: Location-Based Installer Assignment
- **Within Klang Valley**: Internal StoreHub installers with calendar booking
- **Outside of Klang Valley**: External vendor with request-based scheduling
- **Location Field**: `Merchant_Location__c` in Salesforce
- **Configuration File**: `config/installers.json`

### 🔴 CRITICAL: All Times Must Use Singapore Timezone
- **Standard**: `Asia/Singapore` (UTC+8)
- **Date Format**: `2025-10-15T14:00:00+08:00`
- **Common Error**: Using server local time instead of Singapore time
- **Fix**: All date calculations must use `+08:00` timezone

### 🔴 CRITICAL: Calendar Access Requirements
- **OAuth Authorization**: Installers must authorize Lark calendar access
- **Calendar Permissions**: Same as trainers - full calendar event access
- **Fallback**: If no OAuth token, installer is assumed available

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Installation Types](#installation-types)
3. [Installer Configuration](#installer-configuration)
4. [Calendar Integration](#calendar-integration)
5. [Availability Checking](#availability-checking)
6. [Booking Process](#booking-process)
7. [API Endpoints](#api-endpoints)
8. [Salesforce Integration](#salesforce-integration)
9. [Troubleshooting Guide](#troubleshooting-guide)

## System Overview

The installation calendar system manages hardware installation scheduling with two distinct workflows:

1. **Internal Installations** (Within Klang Valley)
   - Real-time calendar availability from StoreHub installers
   - Direct booking with automatic installer assignment
   - Calendar event creation in Lark
   - Immediate confirmation

2. **External Installations** (Outside of Klang Valley)
   - Request-based scheduling with vendor partners
   - Preferred date/time submission
   - Vendor callback within 24 hours
   - Manual confirmation process

## Installation Types

### Internal StoreHub Installers
- **Coverage**: Klang Valley area (KL, Selangor, PJ, etc.)
- **Scheduling**: Direct calendar booking
- **Assignment**: Automatic based on availability
- **Confirmation**: Immediate
- **Calendar**: Lark calendar integration

### External Vendor Partners
- **Coverage**: All areas outside Klang Valley
- **Scheduling**: Request submission
- **Assignment**: Vendor handles assignment
- **Confirmation**: Manual callback
- **Calendar**: No direct integration

## Installer Configuration

### Configuration File Structure (`config/installers.json`)

```json
{
  "internal": {
    "description": "Internal StoreHub installers (when Merchant_Location__c = 'Within Klang Valley')",
    "locationValue": "Within Klang Valley",
    "scheduling": "calendar",
    "installers": [
      {
        "name": "Installer Name",
        "email": "installer@storehub.com",
        "larkUserId": "",
        "larkCalendarId": "",
        "phone": "+60123456789",
        "isActive": true
      }
    ]
  },
  "external": {
    "description": "External vendor (when Merchant_Location__c = 'Outside of Klang Valley')",
    "locationValue": "Outside of Klang Valley",
    "scheduling": "request",
    "vendors": [
      {
        "name": "Vendor Company",
        "contactPerson": "Contact Name",
        "email": "vendor@example.com",
        "phone": "+60123456789",
        "isActive": true,
        "notificationMethod": "email",
        "responseTime": "24 hours"
      }
    ]
  },
  "settings": {
    "defaultTimeSlots": [
      { "start": "09:00", "end": "11:00", "label": "9:00 AM - 11:00 AM" },
      { "start": "11:00", "end": "13:00", "label": "11:00 AM - 1:00 PM" },
      { "start": "14:00", "end": "16:00", "label": "2:00 PM - 4:00 PM" },
      { "start": "16:00", "end": "18:00", "label": "4:00 PM - 6:00 PM" }
    ],
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "advanceBookingDays": 7,
    "bufferTimeMinutes": 30,
    "timezone": "Asia/Kuala_Lumpur"
  }
}
```

### Adding New Installers

1. **Internal Installer**:
   - Add to `internal.installers` array
   - Ensure email is registered in Lark
   - Installer must authorize calendar access via OAuth

2. **External Vendor**:
   - Add to `external.vendors` array
   - Configure notification preferences
   - Set response time expectations

## Calendar Integration

### OAuth Authorization Flow

1. **Installer Authorization**:
   - Installer visits `/trainers/authorize` (same system as trainers)
   - Authorizes Lark calendar access
   - System stores OAuth tokens

2. **Calendar Access**:
   - System uses stored OAuth tokens
   - Accesses installer's Lark calendar
   - Reads busy times and creates events

### Calendar Permissions Required

- `calendar:calendar.event:create` - Create installation events
- `calendar:calendar.event:read` - Check existing bookings
- `calendar:calendar.event:update` - Modify bookings
- `calendar:calendar.event:delete` - Cancel bookings
- `calendar:calendar:readonly` - Check availability

## Availability Checking

### Internal Installer Availability

```javascript
// lib/installer-availability.ts
export async function getInternalInstallersAvailability(
  startDate: string,
  endDate: string
): Promise<InstallerAvailability[]> {
  // 1. Get active installers
  const installers = installersConfig.internal.installers.filter(i => i.isActive)
  
  // 2. Check OAuth authorization
  for (const installer of installers) {
    const hasToken = await larkOAuthService.isUserAuthorized(installer.email)
    
    // 3. Get calendar busy times
    if (hasToken) {
      const busySlots = await larkService.getRawBusyTimes(
        installer.email,
        startDateTime,
        endDateTime
      )
    }
    
    // 4. Calculate available slots
    // 5. Return combined availability
  }
}
```

### Availability Algorithm

1. **Fetch Busy Times**: Get all busy periods from installer calendars
2. **Check Time Slots**: For each 2-hour slot, check if any installer is free
3. **Combine Results**: Show slot as available if ANY installer can do it
4. **Return Format**: Date → Slots → Available Installers

## Booking Process

### Internal Installation Booking Flow

1. **Location Check**:
   ```javascript
   const installerType = await getInstallerType(merchantId)
   // Returns 'internal' or 'external' based on Merchant_Location__c
   ```

2. **Show Availability**:
   - Fetch real-time calendar availability
   - Display available dates and time slots
   - Show number of installers available per slot

3. **Installer Assignment**:
   ```javascript
   function assignInstaller(availableInstallers: string[]): string {
     // Random selection if multiple installers available
     const randomIndex = Math.floor(Math.random() * availableInstallers.length)
     return availableInstallers[randomIndex]
   }
   ```

4. **Create Calendar Event**:
   ```javascript
   const eventResponse = await larkService.createCalendarEvent(
     installer.email,
     {
       summary: `Installation: ${merchantName}`,
       description: `Installation for ${merchantName} (ID: ${merchantId})`,
       start_time: { timestamp: startTimestamp },
       end_time: { timestamp: endTimestamp }
     }
   )
   ```

5. **Update Salesforce**:
   - `Installation_Date__c` - Scheduled date
   - `Assigned_Installer__c` - Installer name
   - `Installation_Status__c` - 'Scheduled'
   - `Installation_Type__c` - 'Internal'

### External Installation Request Flow

1. **Location Check**: Detect "Outside of Klang Valley"
2. **Show Request Form**: Date and time preference inputs
3. **Submit Request**: Store preferences
4. **Notify Vendor**: Send email notification
5. **Update Salesforce**:
   - `Preferred_Installation_Date__c` - Requested date
   - `Installation_Status__c` - 'Pending Vendor Confirmation'
   - `Installation_Type__c` - 'External'
   - `Installation_Vendor__c` - Vendor name

## API Endpoints

### 1. Check Installer Type
```
GET /api/installation/availability?merchantId={id}&startDate={date}&endDate={date}

Response:
{
  "type": "internal" | "external",
  "availability": [...] // Only for internal
}
```

### 2. Book Installation
```
POST /api/installation/book

Body (Internal):
{
  "merchantId": "string",
  "merchantName": "string",
  "date": "2025-10-15",
  "timeSlot": {
    "start": "09:00",
    "end": "11:00",
    "label": "9:00 AM - 11:00 AM"
  },
  "availableInstallers": ["Installer1", "Installer2"],
  "contactPhone": "+60123456789"
}

Body (External):
{
  "merchantId": "string",
  "merchantName": "string",
  "date": "2025-10-15",
  "preferredTime": "09:00",
  "contactPhone": "+60123456789"
}

Response:
{
  "success": true,
  "type": "internal" | "external",
  "assignedInstaller": "string", // Internal only
  "eventId": "string", // Internal only
  "message": "string" // External only
}
```

## Salesforce Integration

### Fields Used

| Field | Description | Type |
|-------|-------------|------|
| `Merchant_Location__c` | Determines installer type | Picklist |
| `Installation_Date__c` | Scheduled installation date | Date |
| `Preferred_Installation_Date__c` | Requested date (external) | Date |
| `Preferred_Installation_Time__c` | Requested time (external) | Text |
| `Assigned_Installer__c` | Internal installer name | Text |
| `Installation_Vendor__c` | External vendor name | Text |
| `Installation_Status__c` | Current status | Picklist |
| `Installation_Type__c` | Internal/External | Picklist |

### Status Values

- `Not Started` - Default state
- `Scheduled` - Internal booking confirmed
- `Pending Vendor Confirmation` - External request submitted
- `Confirmed` - Vendor confirmed appointment
- `Completed` - Installation finished
- `Cancelled` - Booking cancelled

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. "External vendor installation required" for Klang Valley merchants

**Cause**: `Merchant_Location__c` field not set correctly in Salesforce

**Solution**:
1. Check Salesforce record for correct value: "Within Klang Valley"
2. Ensure field is accessible via API
3. Verify merchant ID is being passed correctly

#### 2. No availability showing for internal installers

**Cause**: Installers haven't authorized Lark calendar access

**Solution**:
1. Have installers visit `/trainers/authorize`
2. Complete OAuth authorization flow
3. Verify tokens are stored in database

#### 3. Calendar events not created

**Cause**: Invalid calendar permissions or wrong calendar ID

**Solution**:
1. Check OAuth scopes include calendar event creation
2. Verify calendar ID is resolved correctly
3. Check Lark API response for errors

#### 4. Installer assigned but not available

**Cause**: Busy times not properly detected from calendar

**Solution**:
1. Verify `getRawBusyTimes` is returning all events
2. Check timezone calculations (must use Singapore time)
3. Ensure recurring events are included

#### 5. External vendor not receiving notifications

**Cause**: Email configuration or vendor settings incorrect

**Solution**:
1. Verify vendor email in config
2. Check email service configuration
3. Review notification logs

### Debug Checklist

- [ ] Merchant location field value in Salesforce
- [ ] Installer OAuth authorization status
- [ ] Calendar permissions and access
- [ ] Timezone consistency (Asia/Singapore)
- [ ] API endpoint responses
- [ ] Salesforce field updates
- [ ] Event creation in Lark calendar
- [ ] Vendor notification delivery

## Best Practices

1. **Always use Singapore timezone** for all date/time operations
2. **Check OAuth status** before attempting calendar operations
3. **Handle failures gracefully** with appropriate fallbacks
4. **Log all operations** for debugging
5. **Validate merchant location** before processing
6. **Test with both internal and external scenarios**
7. **Monitor vendor response times** for external installations
8. **Keep installer configuration up to date**

## Testing Scenarios

### Internal Installation Test
1. Set merchant location to "Within Klang Valley"
2. Ensure at least one installer has authorized OAuth
3. Check availability shows correct free slots
4. Book installation and verify:
   - Calendar event created
   - Salesforce updated
   - Confirmation shown

### External Installation Test
1. Set merchant location to "Outside of Klang Valley"
2. Submit installation request
3. Verify:
   - Request stored in system
   - Vendor notification sent
   - Salesforce updated with pending status

### Edge Cases to Test
- All installers busy
- No installers authorized
- Invalid merchant location
- Past date selection
- Weekend selection
- Overlapping bookings

## Future Enhancements

1. **Load Balancing**: Distribute installations evenly among installers
2. **Skill Matching**: Match installer expertise with installation type
3. **Travel Time**: Account for travel between installations
4. **Vendor Portal**: Web interface for vendors to confirm appointments
5. **SMS Notifications**: Add SMS alongside email notifications
6. **Installation Tracking**: Real-time status updates
7. **Photo Upload**: Installation completion photos
8. **Customer Feedback**: Post-installation surveys