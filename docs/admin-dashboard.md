# Admin Dashboard Documentation

## Overview

The Admin Dashboard provides a centralized interface for managing authorized users (trainers, installers, and managers) in the Onboarding Portal system.

## Access

**URL:** `https://onboarding-portal-5fhi.onrender.com/admin`

**Credentials:**
- Email: `product@storehub.com`
- Password: `faithhopelove1`

## Features

### 1. View Authorized Users

The dashboard displays three categories of users:

- **Trainers**: Users who conduct training sessions
- **Installers**: Users who perform hardware installations
- **Managers**: Onboarding managers who oversee the process

For each user, you can see:
- Name
- Email address
- Location (for trainers and installers)
- Languages (for trainers only)
- Authorization status (Authorized / Not Authorized)

### 2. Add New Users

**For Trainers:**

1. Click the "Add Trainer" button
2. Fill in the required information:
   - Name
   - Email
   - Location (Within Klang Valley, Penang, or Johor Bahru)
   - Languages (select one or more):
     - English
     - Bahasa Malaysia
     - Chinese
3. Click "Add"

The trainer will be added to `config/trainers.json` with the specified languages and location.

**For Installers:**

1. Click the "Add Installer" button
2. Fill in the required information:
   - Name
   - Email
   - Location (Within Klang Valley, Penang, or Johor Bahru)
3. Click "Add"

The installer will be added to `config/installers.json`.

**Note:** After adding a user to the config, they must authorize the application by visiting:
- Trainers: `https://onboarding-portal-5fhi.onrender.com/trainers/authorize`
- Installers: `https://onboarding-portal-5fhi.onrender.com/installers/authorize`
- Managers: `https://onboarding-portal-5fhi.onrender.com/managers/authorize`

### 3. Revoke Authorization

To revoke a user's access to the calendar system:

1. Find the user in the list
2. Click the "Revoke" button
3. Confirm the action

This removes their OAuth tokens from the database, preventing the system from accessing their calendar.

### 4. Remove Users

To completely remove a user from the system:

1. Find the user in the list
2. Click the "Remove" button
3. Confirm the action

This will:
- Remove the user from the configuration file
- Revoke their authorization (if they were authorized)

**Note:** Managers cannot be removed via the admin dashboard as they are not stored in config files. You can only revoke their authorization.

## Summary Statistics

The dashboard displays summary cards showing:
- **Trainers**: Authorized / Total count
- **Installers**: Authorized / Total count
- **Managers**: Total authorized count

## Technical Details

### API Endpoints

- `POST /api/admin/login` - Admin authentication
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/users` - Fetch all users and their status
- `POST /api/admin/users/add` - Add new trainer or installer
- `POST /api/admin/users/remove` - Remove trainer or installer
- `POST /api/admin/users/revoke` - Revoke user authorization

### Configuration Files

- **Trainers**: `config/trainers.json`
- **Installers**: `config/installers.json`

### Database

User authorizations are stored in the `LarkAuthToken` table with the following fields:
- `userEmail` (unique)
- `userName`
- `larkUserId`
- `userType` ('trainer', 'installer', or 'manager')
- `accessToken`
- `refreshToken`
- `expiresAt`
- `calendarId`

## Workflow for New Team Members

The admin dashboard displays the complete onboarding workflow under each tab. Here's the detailed process:

### For Trainers and Installers:

1. **Add to Config** (via Admin Dashboard)
   - Click "Add Trainer" or "Add Installer" button
   - Enter name, email, and location
   - System adds them to the config file with empty Lark IDs

2. **Send Authorization Link** (to the team member)
   - **Trainers:** `https://onboarding-portal-5fhi.onrender.com/trainers/authorize`
   - **Installers:** `https://onboarding-portal-5fhi.onrender.com/installers/authorize`

3. **User Authorization** (by the team member)
   - They visit the authorization link
   - Click "Authorize with Lark" and log in with their Lark account
   - System automatically:
     - Stores their OAuth tokens in the database
     - Updates the config file with their Lark IDs

4. **Verification** (via Admin Dashboard)
   - Refresh the admin dashboard
   - Check that the user's status shows as "Authorized"
   - They are now ready to use the system

### For Managers:

1. **Send Authorization Link** (to the manager)
   - **Managers:** `https://onboarding-portal-5fhi.onrender.com/managers/authorize`
   - Note: Managers are not stored in config files

2. **Manager Authorization** (by the manager)
   - They visit the authorization link
   - Click "Authorize with Lark" and log in with their Lark account
   - System stores their OAuth tokens in the database

3. **Verification** (via Admin Dashboard)
   - Check the Managers tab
   - Verify they appear as "Authorized"

## Workflow for Resigned Team Members

1. **Revoke Authorization** (via Admin Dashboard)
   - Click "Revoke" to remove their OAuth tokens
   
2. **Remove from Config** (via Admin Dashboard)
   - Click "Remove" to delete them from the configuration
   
3. **Verification**
   - User should no longer appear in the list
   - System will no longer check their calendar availability

## Security

- Admin access is protected by hardcoded credentials
- Admin session uses JWT tokens stored in httpOnly cookies
- Session expires after 24 hours
- Middleware protects all `/admin` routes

