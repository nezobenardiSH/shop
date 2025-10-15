# Direct Booking URLs

This document explains how to use URL parameters to automatically open booking modals for merchants.

## Overview

Users can click on special URLs that automatically open the booking modal with a specific booking type pre-selected. This is useful for:
- Email campaigns
- WhatsApp messages
- SMS notifications
- Calendar invites
- Salesforce custom buttons
- Direct merchant communication

## URL Format

```
/merchant/[merchantId]?booking=[bookingType]
```

## Available Booking Types

### 1. POS Training
**URL Parameter:** `?booking=pos-training`

**Full URL Example:**
```
https://your-domain.com/merchant/Nasi-Lemak?booking=pos-training
```

**Use Case:** Direct link for merchants to schedule their Point of Sale system training session.

---

### 2. BackOffice Training
**URL Parameter:** `?booking=backoffice-training`

**Full URL Example:**
```
https://your-domain.com/merchant/Nasi-Lemak?booking=backoffice-training
```

**Use Case:** Direct link for merchants to schedule their BackOffice system training session.

---

### 3. Installation
**URL Parameter:** `?booking=installation`

**Full URL Example:**
```
https://your-domain.com/merchant/Nasi-Lemak?booking=installation
```

**Use Case:** Direct link for merchants to schedule their hardware installation appointment.

---

## How It Works

1. **User clicks the link** with the `?booking=` parameter
2. **Page loads** and fetches merchant/trainer data from Salesforce
3. **Booking modal automatically opens** with the specified booking type
4. **Language selection** is blank (opt-in) - user must select language(s)
5. **URL is cleaned** - the `?booking=` parameter is removed from the browser URL after the modal opens
6. **User completes booking** - selects date, time, and language(s)

## User Experience

### Before (Without URL Parameter)
1. User visits merchant portal
2. User navigates to Training stage
3. User clicks "Schedule POS Training" button
4. Modal opens

### After (With URL Parameter)
1. User clicks direct link: `/merchant/Nasi-Lemak?booking=pos-training`
2. Modal opens automatically ✨
3. User books immediately

**Time saved:** 2-3 clicks per booking

## Example Use Cases

### Email Template
```html
<p>Hi [Merchant Name],</p>
<p>It's time to schedule your POS training session!</p>
<p><a href="https://portal.storehub.com/merchant/[merchantId]?booking=pos-training">
  Click here to schedule your POS training
</a></p>
```

### WhatsApp Message
```
Hi! Ready to schedule your BackOffice training? 
Click this link to book: 
https://portal.storehub.com/merchant/Nasi-Lemak?booking=backoffice-training
```

### SMS Notification
```
StoreHub: Schedule your installation now! 
https://portal.storehub.com/merchant/Nasi-Lemak?booking=installation
```

### Salesforce Custom Button
Create a custom button in Salesforce that generates the URL:
```javascript
var merchantId = '{!Onboarding_Trainer__c.Name}';
var bookingType = 'pos-training'; // or 'backoffice-training' or 'installation'
var url = 'https://portal.storehub.com/merchant/' + merchantId + '?booking=' + bookingType;
window.open(url, '_blank');
```

## Technical Details

### Supported Booking Types
- `pos-training` - POS Training session
- `backoffice-training` - BackOffice Training session
- `installation` - Hardware Installation appointment

### Invalid Parameters
If an invalid booking type is provided (e.g., `?booking=invalid`), the modal will **not** open automatically. The page will load normally.

### Multiple Parameters
Only the `booking` parameter is currently supported. Other parameters are ignored.

### URL Cleanup
After the modal opens, the URL parameter is automatically removed using:
```javascript
window.history.replaceState({}, '', window.location.pathname)
```

This ensures:
- Clean URLs in browser history
- No duplicate modal openings on page refresh
- Better user experience

## Language Selection

When the modal opens via URL parameter:
- **No languages are pre-selected** (opt-in approach)
- User must select at least one language: English, Bahasa Malaysia, or Chinese
- Available time slots are filtered based on selected language(s)
- Trainers are auto-assigned based on availability and language capability

## Trainer Assignment

The system automatically:
1. Checks which trainers are available for the selected time slot
2. Filters trainers by selected language(s)
3. Auto-assigns one available trainer
4. Displays the assigned trainer's name after booking

## Salesforce Integration

After booking is completed:
- **POS Training:** Updates `POS_Training_Date__c` field
- **BackOffice Training:** Updates `BackOffice_Training_Date__c` field
- **Installation:** Updates `Installation_Date__c` field

## Testing

### Local Development
```
http://localhost:3010/merchant/Nasi-Lemak?booking=pos-training
http://localhost:3010/merchant/Nasi-Lemak?booking=backoffice-training
http://localhost:3010/merchant/Nasi-Lemak?booking=installation
```

### Production
```
https://onboarding-portal-b0ay.onrender.com/merchant/[merchantId]?booking=pos-training
https://onboarding-portal-b0ay.onrender.com/merchant/[merchantId]?booking=backoffice-training
https://onboarding-portal-b0ay.onrender.com/merchant/[merchantId]?booking=installation
```

## Best Practices

1. **Use descriptive link text** - "Schedule your POS training" instead of "Click here"
2. **Include context** - Explain what will happen when they click the link
3. **Test links** - Always test the full URL before sending to merchants
4. **Track usage** - Monitor which booking types are most used via URL parameters
5. **Personalize** - Use merchant-specific URLs with their actual merchant ID

## Future Enhancements

Potential future URL parameters:
- `?booking=go-live` - Go-live scheduling
- `?booking=hardware-fulfillment` - Hardware delivery scheduling
- `?date=2025-10-20` - Pre-select a specific date
- `?language=English` - Pre-select language(s)
- `?trainer=Nezo` - Request specific trainer

---

*Last Updated: October 2025*
*Document Owner: Engineering Team*

