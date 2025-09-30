# Project Understanding

## Core Problem
Merchant onboarding is currently managed through fragmented WhatsApp/text conversations, causing lost context, incomplete data collection, manual tracking overhead, and repetitive status questions. The Merchant Onboarding Managers (MOMs) spend excessive time coordinating what should be a structured process.

## Target Users
- **Primary:** Merchants going through onboarding process (need to provide information, schedule dates, upload documents, track their onboarding status)
- **Secondary:** Merchant Onboarding Managers (need real-time visibility of merchant progress and automated data flow to Salesforce)

## Solution Approach
A white-labeled merchant portal with subdomain routing ({merchantname}.onboardingstorehub.com) built on microservices architecture that provides:
- Centralized place for merchants to view onboarding status and timeline
- Upload required documents (store videos, etc.)
- Update business information (address, phone number, etc.)
- Schedule key dates (hardware delivery, installation, training) via integrated scheduling tools (Cal.com)
- Track hardware shipment status
- See what information is missing or required

All data syncs bidirectionally with Salesforce:
- Portal → Salesforce: Batch sync every 5 minutes (reduces API calls by 90%)
- Salesforce → Portal: Real-time via Change Data Capture webhooks
- UI feels instant with WebSocket updates (< 100ms response time)

## Key User Journey
1. Merchant navigates to their subdomain portal ({merchantname}.onboardingstorehub.com)
2. Logs in with credentials provided by MOM
3. Views dashboard showing onboarding progress/status
4. Sees required actions clearly highlighted
5. Updates any missing business information (instant UI feedback)
6. Selects available installation and training dates via calendar integration
7. Uploads required store video
8. Tracks hardware shipment status
9. All changes appear immediately in UI (WebSocket broadcast)
10. MOM sees updates in Salesforce within 5 minutes

## Success Looks Like
- 80% reduction in WhatsApp/text coordination messages
- Complete merchant data captured in one session vs. multiple fragmented conversations
- Zero manual data entry for MOMs - everything flows to Salesforce automatically
- Merchants can answer their own status questions 24/7
- Installation and training scheduling happens automatically without back-and-forth
- UI feels instant despite 5-minute sync intervals
- 90% reduction in Salesforce API calls through batching

## Technical Direction
- **Architecture:** Microservices (5 independent services)
  - API Gateway (routing & WebSockets)
  - Auth Service (JWT + subdomain handling)
  - Merchant Service (CRUD operations)
  - Salesforce Service (bidirectional sync)
  - Queue Service (batch processing)
  - Calendar Service (Cal.com integration)
- **Frontend:** Next.js 14 with TypeScript
- **Authentication:** JWT with refresh tokens
- **Data Storage:** PostgreSQL (immediate writes) + Salesforce (source of truth)
- **Real-time:** WebSockets for instant UI updates
- **Message Queue:** BullMQ with Redis for job processing
- **Integrations:** 
  - Salesforce API (OAuth 2.0 JWT Bearer, Composite API for batching)
  - Cal.com API for scheduling
  - Shipping tracking API for hardware status
- **Sync Strategy:**
  - Portal → Salesforce: 5-minute batch intervals
  - Salesforce → Portal: Real-time via Change Data Capture
- **Deployment:** Docker Compose for local development, Render for production

## First Version Focus
MVP should handle core onboarding workflow:
1. Merchant login with subdomain routing
2. Dashboard with real-time progress updates
3. Business information collection (instant UI feedback)
4. Date selection for installation and training
5. Store video upload capability
6. Onboarding status visualization
7. 5-minute batch sync to Salesforce (feels instant to users)
8. Real-time sync from Salesforce via webhooks
9. WebSocket broadcasting for all UI updates