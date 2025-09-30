# Product Requirements Plan (PRP) - Merchant Onboarding Portal

### 1. Core Identity
A self-service merchant onboarding portal built on microservices architecture that replaces fragmented WhatsApp/text coordination with a structured web interface. Merchants update their information, schedule installation dates, and track onboarding progress while the system maintains bidirectional sync with Salesforce (5-minute batches outbound, real-time inbound via CDC).

### 2. Single Success Scenario
- User does: Merchant logs in via subdomain and updates missing store address, selects installation date from calendar
- System responds: Saves to PostgreSQL instantly, UI updates via WebSocket (< 100ms), shows progress (60% → 80%)
- User verifies: Dashboard shows new address immediately, scheduled date confirmed, Salesforce updated within 5 minutes

### 3. User Flows
**PRIMARY FLOW:**
1. User navigates to subdomain ({merchantname}.onboardingstorehub.com)
2. System identifies merchant from subdomain via auth-service
3. User enters credentials → auth-service validates → shows dashboard
4. User clicks "Update Information" → merchant-service processes → syncs to Salesforce
5. Result: Real-time bidirectional sync ensures data consistency

**ERROR HANDLING:**
- Invalid credentials: Show "Invalid login" message
- Salesforce sync failure: Queue in queue-service, retry with exponential backoff
- Service down: Circuit breaker activates, fallback to cache

### 4. Technical Stack & Architecture
**STACK:**
- Frontend: Next.js 14 with TypeScript (client application)
- API Gateway: Express.js (routes requests to services)
- Backend Services: Node.js microservices
- Message Queue: BullMQ with Redis
- Data Storage: PostgreSQL + Salesforce (bidirectional sync)
- Real-time: WebSockets for live updates
- Deployment: Render (managed platform with auto-scaling)

**MICROSERVICES ARCHITECTURE:**
```
Next.js Frontend
    ↓
API Gateway (Express)
    ↓
/services
  ├── auth-service/          # Authentication & tenant management
  ├── merchant-service/      # Merchant data CRUD operations
  ├── salesforce-service/    # Real-time SF sync (bidirectional)
  ├── calendar-service/      # Cal.com integration
  └── queue-service/         # Message queue & retry logic
    ↓
PostgreSQL ↔ Salesforce (Real-time bidirectional)
```

**SERVICE COMMUNICATION:**
- REST APIs between services
- Redis pub/sub for real-time events
- BullMQ for async job processing
- WebSockets for client updates

### 5. API Design & Data Models
**DATA MODELS:**
```javascript
Merchant {
  id, salesforce_id, subdomain, company_name,
  address, phone, onboarding_stage, 
  installation_date, training_date, hardware_status,
  last_sf_modified, sync_status, version
}
OnboardingTask {
  id, merchant_id, task_type, status, 
  required_data, completed_at
}
SyncQueue {
  id, merchant_id, operation, data,
  created_at, retry_count, error_message
}
EventLog {
  id, source, event_type, payload,
  timestamp, processed
}
```

**SERVICE ENDPOINTS:**
```
auth-service:
  POST /api/auth/login
  POST /api/auth/validate
  GET  /api/auth/tenant/:subdomain

merchant-service:
  GET  /api/merchant/:id
  PUT  /api/merchant/:id
  GET  /api/merchant/:id/progress

salesforce-service:
  POST /api/sync/push
  POST /api/sync/pull
  POST /api/webhook/cdc (Change Data Capture)
  
calendar-service:
  GET  /api/calendar/slots
  POST /api/calendar/book

queue-service:
  POST /api/queue/add
  GET  /api/queue/status
```

### 6. Near Real-time Bidirectional Sync
**SALESFORCE → PORTAL (Real-time via CDC):**
- Change Data Capture (CDC) publishes events
- Webhook endpoint receives changes immediately
- Queue-service processes and updates PostgreSQL
- WebSocket notifies frontend of changes instantly

**PORTAL → SALESFORCE (5-minute batch with instant UI):**
- Changes saved to PostgreSQL immediately
- UI updates optimistically (feels instant to user)
- WebSocket broadcasts changes to all connected clients
- Queue batches changes every 5 minutes for Salesforce sync
- Composite API for efficient batch operations

**CONFLICT RESOLUTION:**
```javascript
// Version-based conflict resolution
if (localVersion !== salesforceVersion) {
  // Compare timestamps
  if (salesforceTimestamp > localTimestamp) {
    // Salesforce wins, update local
  } else {
    // Local wins, force update to Salesforce
  }
  // Log conflict for audit
}
```

### 7. Dependencies & Constraints
**REQUIRED PACKAGES:**
- `express` - API Gateway
- `jsforce` - Salesforce API
- `bullmq` & `redis` - Queue management
- `socket.io` - WebSockets
- `@calcom/embed-react` - Calendar
- `pg` - PostgreSQL
- `docker` - Containerization

**CONSTRAINTS:**
- Must handle 1000+ concurrent merchants
- UI must feel instant (< 100ms response)
- Portal → Salesforce sync every 5 minutes
- Salesforce → Portal sync real-time via CDC
- 99.9% uptime SLA
- Salesforce API limits (15,000 calls/day)
- Zero data loss tolerance

### 8. Service Implementation Details

**AUTH-SERVICE:**
- JWT with refresh tokens
- Subdomain-based tenant resolution
- Session management with Redis
- Rate limiting per tenant

**MERCHANT-SERVICE:**
- CRUD operations with validation
- Progress calculation algorithm
- Caching layer with Redis
- Audit trail for all changes

**SALESFORCE-SERVICE:**
- OAuth 2.0 JWT Bearer flow
- Connection pooling
- Circuit breaker pattern
- Bulk API for batch operations
- Change Data Capture listener

**QUEUE-SERVICE:**
- Priority queues (critical/normal/low)
- Exponential backoff retry
- Dead letter queue handling
- Job scheduling and monitoring

**CALENDAR-SERVICE:**
- Cal.com API integration
- Availability caching
- Timezone handling
- Booking conflict prevention

### 9. Code Quality Requirements
- Maximum 25 lines per function
- Comprehensive error handling
- Unit tests for each service (80% coverage)
- Integration tests for service communication
- TypeScript for type safety
- API documentation with OpenAPI/Swagger
- Structured logging with correlation IDs
- Health checks for each service

### 10. Definition of Done
**SYSTEM COMPLETE WHEN:**
- All 5 microservices deployed and communicating via API Gateway
- Portal → Salesforce sync batching every 5 minutes
- Salesforce → Portal real-time sync via CDC (< 1 second)
- UI updates feel instant via WebSockets (< 100ms)
- Subdomain routing functional ({merchantname}.onboardingstorehub.com)
- Merchant can complete full onboarding flow
- Zero data loss between PostgreSQL and Salesforce
- All services have health checks and monitoring
- Load testing confirms 1000+ concurrent users
- API calls reduced by 90% through batching
- Full API documentation with Swagger/OpenAPI