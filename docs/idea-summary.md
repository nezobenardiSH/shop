# Project Understanding

## Core Problem
Merchant onboarding is currently managed through fragmented WhatsApp/text conversations, causing lost context, incomplete data collection, manual tracking overhead, and repetitive status questions. The Merchant Onboarding Managers (MOMs) spend excessive time coordinating what should be a structured process.

## Target Users
- **Primary:** Merchants going through onboarding process (need to provide information, schedule dates, upload documents, track their onboarding status)
- **Secondary:** Merchant Onboarding Managers (need real-time visibility of merchant progress and automated data flow to Salesforce)

## Solution Approach
A self-service merchant portal with path-based routing (onboardingstorehub.com/m/{merchant-slug}) built as a single Next.js application that provides:
- Centralized place for merchants to view onboarding status and timeline
- Update business information (address, phone number, etc.)
- Schedule key dates (installation, training) via simple date picker
- Track onboarding progress
- See what information is missing or required

All data syncs bidirectionally with Salesforce:
- Portal → Salesforce: Immediate sync on save (fire-and-forget)
- Salesforce → Portal: Real-time via webhook endpoint
- Simple last-write-wins conflict resolution

## Key User Journey
1. Merchant navigates to their portal URL (onboardingstorehub.com/m/bestbuy)
2. Logs in with credentials provided by MOM
3. Views dashboard showing onboarding progress/status
4. Sees required actions clearly highlighted
5. Updates any missing business information
6. Selects available installation and training dates
7. All changes sync to Salesforce immediately
8. MOM sees updates in Salesforce in real-time

## Success Looks Like
- 80% reduction in WhatsApp/text coordination messages
- Complete merchant data captured in one session vs. multiple fragmented conversations
- Zero manual data entry for MOMs - everything flows to Salesforce automatically
- Merchants can answer their own status questions 24/7
- Installation and training scheduling happens without back-and-forth
- Simple, maintainable codebase that can be built in 3-5 days

## Technical Direction
- **Architecture:** Single Next.js application with API routes
- **Frontend:** Next.js 14 with TypeScript and Tailwind CSS
- **Authentication:** Simple JWT (no refresh tokens needed for MVP)
- **Data Storage:** PostgreSQL via Prisma ORM
- **Salesforce Integration:** jsforce library for direct API calls
- **Sync Strategy:**
  - Portal → Salesforce: Immediate on save
  - Salesforce → Portal: Webhook endpoint for real-time updates
- **Deployment:** Render Web Service ($7/month) + PostgreSQL ($7/month)

## First Version Focus
MVP should handle core onboarding workflow:
1. Merchant login with path-based routing (/m/merchant-slug)
2. Dashboard showing onboarding progress
3. Business information collection forms
4. Date selection for installation and training
5. Onboarding status visualization
6. Immediate bidirectional sync with Salesforce
7. Simple error handling and logging