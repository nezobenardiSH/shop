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
- Backend: Single Node.js/Express application with service modules
- Background Jobs: node-cron with database queue table
- Data Storage: PostgreSQL + Salesforce (bidirectional sync)
- Real-time: WebSockets (Socket.io) for live updates
- Session Management: Redis for caching and pub/sub
- Deployment: Render (single web service deployment)

**MONOLITH WITH SERVICE MODULES ARCHITECTURE:**
```
Next.js Frontend
    ↓
Single Express App
    ↓
/services (modules, not microservices)
  ├── authService.js         # Authentication & tenant management
  ├── merchantService.js     # Merchant data CRUD operations
  ├── salesforceService.js   # Real-time SF sync (bidirectional)
  ├── calendarService.js     # Cal.com integration
  └── queueService.js        # Background jobs with node-cron
    ↓
PostgreSQL ↔ Salesforce (5-min batch → | ← CDC real-time)
```

**SERVICE COMMUNICATION:**
- Direct function calls between service modules
- Redis pub/sub for real-time events
- Database-based job queue with node-cron
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

**API ENDPOINTS (Single Express App):**
```
Authentication:
  POST /api/auth/login
  POST /api/auth/validate
  GET  /api/auth/tenant/:subdomain

Merchant Management:
  GET  /api/merchant/:id
  PUT  /api/merchant/:id
  GET  /api/merchant/:id/progress

Salesforce Integration:
  POST /api/sync/push
  POST /api/sync/pull
  POST /api/webhook/cdc (Change Data Capture)
  
Calendar Integration:
  GET  /api/calendar/slots
  POST /api/calendar/book

Queue Management:
  GET  /api/queue/status
  POST /api/queue/retry/:id
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
- `express` - Main web server
- `jsforce` - Salesforce API integration
- `node-cron` & `redis` - Background jobs and caching
- `socket.io` - WebSockets for real-time updates
- `@calcom/embed-react` - Calendar integration
- `pg` - PostgreSQL database driver
- `jsonwebtoken` - JWT authentication
- `bcrypt` - Password hashing

**CONSTRAINTS:**
- Must handle 1000+ concurrent merchants
- UI must feel instant (< 100ms response)
- Portal → Salesforce sync every 5 minutes
- Salesforce → Portal sync real-time via CDC
- 99.9% uptime SLA
- Salesforce API limits (15,000 calls/day)
- Zero data loss tolerance

### 8. Service Module Implementation Details

**authService.js:**
- JWT with refresh tokens
- Subdomain-based tenant resolution
- Session management with Redis
- Rate limiting per tenant

**merchantService.js:**
- CRUD operations with validation
- Progress calculation algorithm
- Caching layer with Redis
- Audit trail for all changes

**salesforceService.js:**
- OAuth 2.0 JWT Bearer flow
- Connection pooling
- Circuit breaker pattern
- Bulk API for batch operations
- Change Data Capture listener

**queueService.js:**
- Database-based job queue with priority levels
- node-cron for scheduled processing
- Exponential backoff retry logic
- Failed job handling and monitoring

**calendarService.js:**
- Cal.com API integration
- Availability caching
- Timezone handling
- Booking conflict prevention

### 9. Render Deployment Configuration

**SIMPLIFIED RENDER DEPLOYMENT:**
```yaml
# render.yaml
services:
  # Single Backend Application
  - type: web
    name: onboarding-portal-backend
    env: node
    region: oregon
    plan: starter
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        fromDatabase:
          name: merchant-db
          property: connectionString
      - key: REDIS_URL
        fromDatabase:
          name: redis-cache
          property: connectionString
      - key: JWT_SECRET
        sync: false
      - key: SF_CLIENT_ID
        sync: false
      - key: SF_CLIENT_SECRET
        sync: false
      - key: CALCOM_API_KEY
        sync: false

  # Frontend (Optional - can be separate repo)
  - type: web
    name: onboarding-portal-frontend
    env: static
    buildCommand: cd frontend && npm install && npm run build
    staticPublishPath: frontend/dist
    envVars:
      - key: NEXT_PUBLIC_API_URL
        value: https://onboarding-portal-backend.onrender.com

databases:
  - name: merchant-db
    databaseName: onboarding
    plan: starter
    
  - name: redis-cache
    type: redis
    plan: starter
```

**DEPLOYMENT STRATEGY:**
- Single application deployment (much simpler)
- GitHub integration for auto-deploy on push
- Environment variables managed in Render dashboard
- Automatic SSL certificates and custom domains
- Built-in logging and monitoring
- No container orchestration needed

### 10. Code Quality Requirements
- Maximum 25 lines per function
- Comprehensive error handling
- Unit tests for each service (80% coverage)
- Integration tests for service communication
- TypeScript for type safety
- API documentation with OpenAPI/Swagger
- Structured logging with correlation IDs
- Health checks for each service

### 11. Definition of Done
**SYSTEM COMPLETE WHEN:**
- Single Express application deployed with all service modules
- Portal → Salesforce sync batching every 5 minutes
- Salesforce → Portal real-time sync via CDC (< 1 second)
- UI updates feel instant via WebSockets (< 100ms)
- Subdomain routing functional ({merchantname}.onboardingstorehub.com)
- Merchant can complete full onboarding flow
- Zero data loss between PostgreSQL and Salesforce
- Health checks and monitoring operational
- Load testing confirms 1000+ concurrent users
- API calls reduced by 90% through batching
- Full API documentation with Swagger/OpenAPI