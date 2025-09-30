# Project Understanding

## Core Problem
Merchant onboarding is currently managed through fragmented WhatsApp/text conversations, causing lost context, incomplete data collection, manual tracking overhead, and repetitive status questions. The Merchant Onboarding Managers (MOMs) spend excessive time coordinating what should be a structured process.

## Target Users
- **Primary:** Merchants going through onboarding process (need to provide information, schedule dates, upload documents, track their onboarding status)
- **Secondary:** Merchant Onboarding Managers (need real-time visibility of merchant progress and automated data flow to Salesforce)

## Solution Approach
A white-labeled merchant portal (subdomain: {merchantname}.onboardingstorehub.com) that provides a centralized place for merchants to:
- View their complete onboarding status and timeline
- Upload required documents (store videos, etc.)
- Update their business information (address, phone number, etc.)
- Schedule key dates (hardware delivery, installation, training) via integrated scheduling tools (Calendly/Cal.com)
- Track hardware shipment status
- See what information is missing or required

All data syncs bidirectionally with Salesforce in near real-time, maintaining Salesforce as the source of truth while eliminating manual data entry.

## Key User Journey
1. Merchant receives portal credentials from MOM
2. Logs into their branded subdomain portal
3. Views dashboard showing onboarding progress/status
4. Sees required actions clearly highlighted
5. Updates any missing business information
6. Selects available installation and training dates via calendar integration
7. Uploads required store video
8. Tracks hardware shipment status
9. Receives notifications of status changes
10. MOM sees all updates automatically in Salesforce

## Success Looks Like
- 80% reduction in WhatsApp/text coordination messages
- Complete merchant data captured in one session vs. multiple fragmented conversations
- Zero manual data entry for MOMs - everything flows to Salesforce automatically
- Merchants can answer their own status questions 24/7
- Installation and training scheduling happens automatically without back-and-forth coordination

## Technical Direction
- **Platform:** Web application with responsive design for mobile access
- **Authentication:** Credential-based login (provided by company, user-changeable)
- **Integrations:** 
  - Salesforce API (bidirectional near real-time sync)
  - Calendly or Cal.com API for scheduling
  - Shipping tracking API for hardware status
- **Architecture:** Multi-tenant with subdomain-based merchant isolation
- **Data Flow:** Portal ↔ Salesforce (bidirectional), Shipping API → Portal (read-only)

## First Version Focus
MVP should handle core onboarding workflow:
1. Merchant login and dashboard
2. Business information collection (address, phone, etc.)
3. Date selection for installation and training (via calendar integration)
4. Store video upload capability
5. Onboarding status visualization
6. Salesforce bidirectional sync for all collected data
7. Basic hardware tracking status display