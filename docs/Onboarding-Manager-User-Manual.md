# Onboarding Manager User Manual
## Merchant Onboarding Portal Platform

**Version:** 1.0  
**Last Updated:** November 2024  
**For:** Onboarding Managers & Customer Success Managers

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Understanding the Merchant Portal](#understanding-the-merchant-portal)
4. [Managing Merchant Onboarding](#managing-merchant-onboarding)
5. [Notification System Setup](#notification-system-setup)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## 1. Introduction

### What is the Onboarding Portal?

The Merchant Onboarding Portal is a self-service platform that allows merchants to:
- Track their onboarding progress in real-time
- Schedule installation and training sessions
- Upload required documents and videos
- View important deadlines and reminders

As an Onboarding Manager, you'll use this platform to:
- Monitor merchant progress through Salesforce
- Receive notifications for external vendor installations
- Ensure smooth onboarding workflows

### Key Benefits

✅ **Automated Scheduling** - Merchants can book their own training sessions  
✅ **Real-time Updates** - All changes sync with Salesforce automatically  
✅ **Reduced Manual Work** - Less back-and-forth communication  
✅ **Better Visibility** - Track all merchants in one place  
✅ **Faster Onboarding** - Self-service reduces delays

---

## 2. Getting Started

### Portal Access

**Merchant Portal URL Format:**
```
https://your-portal-domain.com/merchant/{merchant-name}
```

**Manager Notification Setup:**
```
https://your-portal-domain.com/managers/authorize
```

### How Portal URLs are Created

1. When you create an `Onboarding_Trainer__c` record in Salesforce, the portal URL becomes **instantly available**
2. The merchant name in the URL is automatically generated from the Salesforce record
3. No manual setup or configuration is required

### Sharing Portal Access with Merchants

**Step 1:** Create the Onboarding_Trainer__c record in Salesforce

**Step 2:** Share the portal URL with the merchant via:
- Email
- WhatsApp
- SMS
- Or any preferred communication channel

**Step 3:** Inform the merchant about the PIN:
> "To log in, use the last 4 digits of your registered phone number as the PIN"

**Accepted Phone Numbers:**
- Business Owner contact phone
- Merchant PIC contact number
- Operation Manager contact phone

---

## 3. Understanding the Merchant Portal

### The 6-Stage Onboarding Journey

The portal displays a visual timeline with 6 main stages:

#### **Stage 1: Welcome to StoreHub**
- **What happens:** Initial welcome call with the merchant
- **Merchant sees:** Welcome message and first call details
- **Status updates when:** `Welcome_Call_Status__c` = "Welcome Call Completed" in Salesforce

#### **Stage 2: Preparation** (3 Sub-stages)

**2a. Hardware Delivery**
- **What happens:** Hardware is ordered and shipped to merchant
- **Merchant sees:** 
  - Order status
  - Fulfillment date
  - Tracking link (when available)
- **Status updates when:** `Tracking_Link__c` is filled in Salesforce

**2b. Product Setup**
- **What happens:** Merchant submits menu and StoreHub team sets up the system
- **Merchant sees:**
  - Menu submission deadline (3 working days before installation)
  - Submit Menu Collection Form button
  - Product setup status
- **Status updates when:** 
  - Merchant submits menu → `Product_Setup_Status__c` = "Ticket Created - Pending Completion"
  - Setup complete → `Completed_Product_Setup__c` = "Yes"

**2c. Store Setup**
- **What happens:** Merchant records a 1-minute video of their store setup
- **Merchant sees:**
  - Video submission deadline (before installation date)
  - Video checklist (3 stops to record)
  - Upload video button
  - Network setup guide link
- **Status updates when:** `Video_Proof_Link__c` is filled

#### **Stage 3: Installation**
- **What happens:** Hardware is installed at merchant's location
- **Merchant sees:**
  - Installation date and time
  - Installer name
  - Store address
  - Schedule/Change Date button
- **Merchant can:** Book or reschedule installation appointment
- **Status updates when:** `Actual_Installation_Date__c` is filled

#### **Stage 4: Training**
- **What happens:** POS and Back Office training sessions
- **Merchant sees:**
  - Training date and time
  - Trainer name
  - Schedule/Change Date button
- **Merchant can:** Book or reschedule training session
- **Status updates when:** `Training_Date__c` is filled and date has passed

#### **Stage 5: Ready to Go Live**
- **What happens:** Final preparations before going live
- **Merchant sees:** Countdown to go-live date
- **Status:** Automatically shown when all previous stages are complete

#### **Stage 6: Live**
- **What happens:** Merchant is live and using the system
- **Merchant sees:** Congratulations message
- **Status updates when:** Go-live date has passed

---

## 4. Managing Merchant Onboarding

### Monitoring Progress in Salesforce

All merchant actions in the portal automatically update Salesforce fields:

| Merchant Action | Salesforce Field Updated |
|----------------|-------------------------|
| Submits menu | `Product_Setup_Status__c` → "Ticket Created - Pending Completion" |
| Uploads store video | `Video_Proof_Link__c` → [URL] |
| Books installation | `Installation_Date__c` → [Selected Date/Time] |
| Books training | `Training_Date__c` → [Selected Date/Time] |

### Understanding the Booking System

**Installation Booking:**
- Merchant selects preferred date and time
- System checks installer availability from `config/installers.json`
- For external vendors: You receive a Lark notification with merchant details
- For internal installers: Calendar event is created automatically
- Installer is auto-assigned based on availability

**Training Booking:**
- Merchant selects from available 2-hour slots (10am - 6pm)
- System checks real trainer calendar availability via Lark Calendar
- Only shows slots where at least one authorized trainer is available
- Trainer is auto-assigned when merchant confirms booking
- Calendar event is created with format: "{POS/BackOffice} Training: {Trainer Name}"

**Scheduling Constraints:**
- Installation must be scheduled before training
- Training must be scheduled before go-live date
- System enforces these constraints automatically

### Key Salesforce Fields to Monitor

**Progress Tracking:**
- `Welcome_Call_Status__c` - Welcome stage completion
- `Completed_Product_Setup__c` - Product setup completion
- `Video_Proof_Link__c` - Store setup video submission
- `Actual_Installation_Date__c` - Installation completion
- `Training_Date__c` - Training completion

**Merchant Information:**
- `Onboarding_Trainer__c.Email__c` - Merchant email
- `Account.Name` - Business name
- `Store_Address__c` - Installation location

**Assignment Fields:**
- `CSM_Name__c` - Customer Success Manager (lookup to User object)
- `CSM_Name_BO__c` - Back Office CSM (lookup to User object)
- `Installer_Name__c` - Assigned installer (lookup to User object)

---

## 5. Notification System Setup

### Setting Up External Vendor Installation Notifications

When merchants book installations with external vendors, you need to receive notifications to coordinate with the vendor.

**Step 1: Access the Authorization Page**

Navigate to:
```
https://your-portal-domain.com/managers/authorize
```

**Step 2: Authorize Your Lark Account**

1. Click the **"Authorize with Lark"** button
2. Log in with your Lark account
3. Grant the requested permissions
4. You'll be redirected back and see a success message

**Step 3: Verify Authorization**

You should see your email listed under "Authorized Managers" with:
- ✅ Green checkmark
- Your name
- Your email address
- Token expiry date

### What Notifications You'll Receive

When a merchant books an installation with an external vendor, you'll receive a Lark message containing:

- **Merchant Name**
- **Merchant ID**
- **Merchant Email**
- **Store Address**
- **Preferred Date/Time**
- **Sales Order Number**
- **List of Hardware Items**
- **Requester Name and Phone**

### Managing Authorizations

**To Revoke Authorization:**
1. Go to `/managers/authorize`
2. Find your email in the list
3. Click the **"Revoke"** button
4. Confirm the action

**To Add Other Managers:**
- Share the `/managers/authorize` URL with them
- Each manager must authorize individually using their own Lark account

---

## 6. Troubleshooting

### Common Issues and Solutions

#### Merchant Can't Log In

**Problem:** "Invalid PIN" error

**Solutions:**
1. Verify the phone number in Salesforce matches what merchant is using
2. Check these fields: Business Owner phone, PIC phone, Operation Manager phone
3. Ensure merchant is using the **last 4 digits** only
4. Check for rate limiting (max 5 attempts per 15 minutes)

#### Merchant Can't See Available Time Slots

**Problem:** No training slots showing

**Solutions:**
1. Verify at least one trainer is authorized at `/trainers/authorize`
2. Check trainer calendar availability in Lark
3. Ensure trainers have marked busy times correctly (only "Busy" events block availability)
4. Verify trainer coverage in `config/trainers.json`

#### Installation/Training Not Updating in Salesforce

**Problem:** Booking completed but Salesforce not updated

**Solutions:**
1. Check Salesforce API connection status
2. Verify field permissions for the integration user
3. Check error logs in the portal admin panel
4. Manually update the field if needed

#### Video Upload Failing

**Problem:** Merchant can't upload store setup video

**Solutions:**
1. Check file size (max 100MB)
2. Verify file format (MP4, MOV, AVI supported)
3. Check Salesforce storage limits
4. Try uploading from different browser

---

## 7. Best Practices

### For Smooth Onboarding

✅ **Share Portal URL Early**
- Send the portal link as soon as the Salesforce record is created
- Include clear instructions about the PIN (last 4 digits of phone)

✅ **Set Realistic Deadlines**
- Ensure installation date allows 3 working days for menu submission
- Schedule training after installation is confirmed

✅ **Monitor Progress Regularly**
- Check Salesforce daily for merchants approaching deadlines
- Follow up with merchants who haven't completed required steps

✅ **Keep Trainer Calendars Updated**
- Ensure trainers mark their availability accurately in Lark
- Only mark events as "Busy" if truly unavailable (not "Free")

✅ **Maintain Configuration Files**
- Keep `config/trainers.json` updated with active trainers
- Keep `config/installers.json` updated with active installers
- Remove inactive staff promptly

### Communication Tips

**When Sharing Portal Access:**
```
Hi [Merchant Name],

Welcome to StoreHub! 🎉

Track your onboarding progress here:
[Portal URL]

To log in, use the last 4 digits of your registered phone number.

If you have any questions, feel free to reach out!

Best regards,
[Your Name]
```

**When Following Up on Pending Actions:**
```
Hi [Merchant Name],

Just a friendly reminder:

⚠️ Please submit your menu by [Date] (3 working days before installation)
⚠️ Please upload your store setup video before [Installation Date]

You can do both through your onboarding portal:
[Portal URL]

Let me know if you need any help!

Best regards,
[Your Name]
```

### Monitoring Checklist

Use this daily checklist to stay on top of merchant onboarding:

- [ ] Check merchants with upcoming installation dates (next 3 days)
- [ ] Verify menu submissions received for upcoming installations
- [ ] Confirm store setup videos uploaded before installation
- [ ] Review training bookings for the week
- [ ] Follow up with merchants stuck in Preparation stage for >5 days
- [ ] Verify external vendor notifications received and actioned
- [ ] Check for any failed Salesforce sync issues

---

## Quick Reference

### Important URLs

| Purpose | URL |
|---------|-----|
| Merchant Portal | `/merchant/{merchant-name}` |
| Manager Notifications | `/managers/authorize` |
| Trainer Authorization | `/trainers/authorize` |

### Key Salesforce Fields

| Field | Purpose |
|-------|---------|
| `Welcome_Call_Status__c` | Welcome stage completion |
| `Product_Setup_Status__c` | Menu submission status |
| `Completed_Product_Setup__c` | Product setup completion |
| `Video_Proof_Link__c` | Store video submission |
| `Installation_Date__c` | Scheduled installation |
| `Actual_Installation_Date__c` | Installation completion |
| `Training_Date__c` | Training session date |
| `Tracking_Link__c` | Hardware delivery tracking |

### Support Contacts

For technical issues with the portal:
- Contact: IT/Development Team
- For Salesforce sync issues: Check API logs
- For Lark integration issues: Verify OAuth tokens

---

**Document Version:** 1.0  
**Last Updated:** November 2024  
**Maintained By:** Product Team

