# Installation Scheduling System

## Overview
The installation scheduling system assigns installers based on the `Merchant_Location__c` field in Salesforce, with different workflows for internal StoreHub installers and external vendors.

## Location-Based Assignment Rules

### 1. **Internal StoreHub Installers**
- **When**: `Merchant_Location__c = "Within Klang Valley"`
- **Scheduling Method**: Direct calendar booking with real-time availability
- **Process**:
  1. System checks `Merchant_Location__c` field from Installation stage
  2. Shows available time slots from internal installers' calendars
  3. Merchant selects preferred slot
  4. System automatically assigns installer based on availability
  5. Creates calendar event and sends confirmation

### 2. **External Vendor**
- **When**: `Merchant_Location__c = "Outside of Klang Valley"`
- **Scheduling Method**: Request-based with vendor callback
- **Process**:
  1. System checks `Merchant_Location__c` field from Installation stage
  2. Shows date/time preference form (not real-time availability)
  3. Merchant submits preferred installation date and time
  4. System notifies external vendor via email
  5. Vendor contacts merchant directly to finalize appointment

## Implementation Architecture

### Location Check from Salesforce
```javascript
// lib/installer-type.ts
async function getInstallerType(merchantId: string): Promise<'internal' | 'external'> {
  // Query Salesforce for merchant location
  const conn = await getSalesforceConnection();
  const query = `
    SELECT Merchant_Location__c 
    FROM Onboarding_Trainer__c 
    WHERE Id = '${merchantId}'
  `;
  
  const result = await conn.query(query);
  const merchantLocation = result.records[0]?.Merchant_Location__c;
  
  // Check location value from Salesforce
  if (merchantLocation === 'Within Klang Valley') {
    return 'internal';
  } else if (merchantLocation === 'Outside of Klang Valley') {
    return 'external';
  }
  
  // Default to external if location not set
  return 'external';
}
```

### Installer Assignment Logic

#### Internal (When Merchant_Location__c = "Within Klang Valley")
```javascript
// Similar to trainer assignment
async function assignInternalInstaller(date: string, timeSlot: TimeSlot) {
  const availableInstallers = await checkInstallersAvailability(date, timeSlot);
  
  if (availableInstallers.length === 0) {
    throw new Error('No installers available for selected slot');
  }
  
  // Random assignment if multiple available
  if (availableInstallers.length > 1) {
    return availableInstallers[Math.floor(Math.random() * availableInstallers.length)];
  }
  
  return availableInstallers[0];
}
```

#### External (When Merchant_Location__c = "Outside of Klang Valley")
```javascript
async function submitExternalInstallationRequest(merchantInfo, preferredDateTime) {
  // Store preference in database
  await saveInstallationRequest({
    merchantId: merchantInfo.id,
    preferredDate: preferredDateTime.date,
    preferredTime: preferredDateTime.time,
    status: 'pending_vendor_confirmation'
  });
  
  // Notify vendor via email
  await sendVendorNotification({
    vendor: getActiveVendor(),
    merchantInfo,
    preferredDateTime
  });
  
  return {
    status: 'request_submitted',
    message: 'Vendor will contact you within 24 hours to confirm'
  };
}
```

## UI/UX Flow

### Internal Installation (Merchant_Location__c = "Within Klang Valley")
1. **Location Check**: System reads `Merchant_Location__c` from Salesforce
2. **Calendar View**: Shows real-time availability calendar
3. **Time Slot Selection**: 2-hour slots (9am, 11am, 2pm, 4pm)
4. **Instant Confirmation**: Immediate booking with assigned installer
5. **Calendar Event**: Created in installer's Lark calendar

### External Installation (Merchant_Location__c = "Outside of Klang Valley")
1. **Location Check**: System reads `Merchant_Location__c` from Salesforce
2. **Preference Form**: Date picker and time preference (not availability)
3. **Submit Request**: Sends notification to vendor
4. **Pending Status**: Shows "Vendor will contact you within 24 hours"
5. **Manual Confirmation**: Vendor calls to finalize appointment

## Configuration File Structure

### `/config/installers.json`
- **Internal Section**: StoreHub installers with calendar integration
- **External Section**: Vendor contact information
- **Settings**: Time slots, working days, timezone

## API Endpoints

### Installation Scheduling
```
GET  /api/installation/check-location      # Determine internal/external
GET  /api/installation/availability        # Get calendar slots (internal only)
POST /api/installation/book               # Book internal installation
POST /api/installation/request            # Submit external request
GET  /api/installation/status/:id         # Check installation status
```

## Database Schema Updates

```prisma
model Installation {
  id                String    @id @default(cuid())
  merchantId        String
  type              String    // 'internal' or 'external'
  assignedInstaller String?   // For internal
  vendorId          String?   // For external
  scheduledDate     DateTime?
  preferredDate     DateTime  // User's preference
  preferredTime     String    // User's preference
  status            String    // 'confirmed', 'pending', 'completed'
  larkEventId       String?   // For internal calendar events
  notes             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

## Salesforce Integration

### Fields to Update
- `Installation_Date__c` - Scheduled installation date
- `Installation_Status__c` - Status tracking
- `Assigned_Installer__c` - Installer name (internal)
- `Installation_Vendor__c` - Vendor name (external)
- `Installation_Type__c` - 'Internal' or 'External'

## Testing Scenarios

### Internal (Merchant_Location__c = "Within Klang Valley")
1. Verify system correctly reads `Merchant_Location__c` field
2. Verify calendar availability shows correctly
3. Test installer assignment with multiple available
4. Confirm Lark calendar event creation
5. Validate Salesforce field updates

### External (Merchant_Location__c = "Outside of Klang Valley")
1. Verify system correctly reads `Merchant_Location__c` field
2. Verify preference form appears (not calendar)
3. Test vendor email notification
4. Confirm request storage in database
5. Validate status tracking

## Future Enhancements

1. **SMS Notifications**: Add SMS alongside email for vendors
2. **Vendor Portal**: Web interface for vendors to confirm appointments
3. **Auto-Assignment**: Automatic vendor selection based on coverage area
4. **Installation Tracking**: Real-time status updates and completion photos
5. **Performance Metrics**: Track installation completion rates and times