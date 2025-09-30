dd# Implementation & Testing Plan: Merchant Onboarding Portal (Microservices)

## Quick Reference
**PRP Status:** ✅ Microservices with real-time bidirectional Salesforce sync  
**Total Tasks:** 12 tasks across 4 conversation batches  
**Estimated Timeline:** 4 conversations over 1 week

## Architecture Overview
```
Next.js Frontend → API Gateway → 5 Microservices → PostgreSQL ↔ Salesforce
                                                          ↑
                                                    Real-time sync
```

## Conversation Batching Strategy
- **Batch 1:** Foundation & Gateway (3 tasks: Project structure, API Gateway, Docker setup)
- **Batch 2:** Core Services (3 tasks: Auth, Merchant, Queue services)
- **Batch 3:** Integration Services (3 tasks: Salesforce bidirectional, Calendar, WebSockets)
- **Batch 4:** Frontend & Testing (3 tasks: Next.js UI, Integration testing, Deployment)

---

## BATCH 1: Foundation & API Gateway
**Status:** ⬜ Not Started  
**Goal:** Set up microservices architecture with API Gateway
**Context Window Strategy:** Fresh conversation, focus on structure

### Task 1: Project Structure & Docker Setup
**Status:** ⬜
**Implementation Checklist:**
- [ ] Create monorepo structure with service folders
- [ ] Set up Docker Compose for all services
- [ ] Configure shared utilities and types
- [ ] Set up Redis for messaging

**Project Structure:**
```
onboarding-portal/
├── docker-compose.yml
├── services/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── merchant-service/
│   ├── salesforce-service/
│   ├── calendar-service/
│   └── queue-service/
├── frontend/              # Next.js app
├── shared/                # Shared types & utilities
└── scripts/               # Deployment scripts
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
      
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: onboarding
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
      
  api-gateway:
    build: ./services/api-gateway
    ports:
      - "3000:3000"
    depends_on:
      - redis
      - postgres
      
  auth-service:
    build: ./services/auth-service
    ports:
      - "3001:3001"
      
  # ... other services
```

**Manual Test Commands:**
```bash
# Start all services
docker-compose up -d

# Check services are running
docker-compose ps
# Expected: All services showing as "Up"

# Test Redis connection
redis-cli ping
# Expected: PONG
```

**Success Criteria:** All services start in Docker containers

---

### Task 2: API Gateway Implementation
**Status:** ⬜
**Implementation Checklist:**
- [ ] Create Express gateway with routing
- [ ] Add service discovery logic
- [ ] Implement rate limiting
- [ ] Add subdomain parsing middleware

**API Gateway (services/api-gateway/index.js):**
```javascript
const express = require('express');
const httpProxy = require('http-proxy-middleware');
const app = express();

// Service registry
const services = {
  auth: 'http://auth-service:3001',
  merchant: 'http://merchant-service:3002',
  salesforce: 'http://salesforce-service:3003',
  calendar: 'http://calendar-service:3004',
  queue: 'http://queue-service:3005'
};

// Subdomain middleware
app.use((req, res, next) => {
  const subdomain = req.hostname.split('.')[0];
  req.headers['x-subdomain'] = subdomain;
  next();
});

// Route to services
app.use('/api/auth', proxy({ target: services.auth }));
app.use('/api/merchant', proxy({ target: services.merchant }));
app.use('/api/sync', proxy({ target: services.salesforce }));
app.use('/api/calendar', proxy({ target: services.calendar }));
```

**Manual Test Commands:**
```bash
# Test gateway routing
curl http://localhost:3000/api/health
# Expected: {"status":"ok","services":["auth","merchant",...]}

# Test subdomain parsing
curl -H "Host: testmerchant.localhost" http://localhost:3000/api/health
# Expected: Subdomain in response headers
```

**Success Criteria:** Gateway routes requests to correct services

---

### Task 3: Shared Database & Messaging Setup
**Status:** ⬜
**Implementation Checklist:**
- [ ] Set up PostgreSQL with migrations
- [ ] Configure Redis pub/sub
- [ ] Create shared data models
- [ ] Set up BullMQ for job processing

**Database Schema (shared/database/schema.sql):**
```sql
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salesforce_id VARCHAR(255) UNIQUE,
  subdomain VARCHAR(255) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  onboarding_stage VARCHAR(50) DEFAULT 'new',
  installation_date TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'pending',
  version INTEGER DEFAULT 0,
  last_sf_modified TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  operation VARCHAR(50),
  data JSONB,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50),
  event_type VARCHAR(50),
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

**Redis Pub/Sub Setup:**
```javascript
// shared/messaging/redis.js
const Redis = require('ioredis');
const pub = new Redis();
const sub = new Redis();

// Publish merchant update
pub.publish('merchant:updated', JSON.stringify({
  merchantId: '123',
  changes: { address: 'New Address' }
}));

// Subscribe in services
sub.subscribe('merchant:updated');
sub.on('message', (channel, message) => {
  const data = JSON.parse(message);
  // Handle update
});
```

**Success Criteria:** Database tables created, Redis pub/sub working

---

**Batch 1 Completion Checklist:**
- [ ] Docker Compose orchestrating all services
- [ ] API Gateway routing requests
- [ ] Database and Redis configured
- [ ] Ready for service implementation

---

## BATCH 2: Core Services Implementation
**Status:** ⬜ Not Started  
**Goal:** Build auth, merchant, and queue services
**Context Window Strategy:** Fresh conversation with infrastructure ready

### Task 4: Auth Service with JWT
**Status:** ⬜
**Implementation Checklist:**
- [ ] JWT token generation and validation
- [ ] Subdomain-based tenant resolution
- [ ] Session management with Redis
- [ ] Rate limiting per tenant

**Auth Service (services/auth-service/index.js):**
```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const redis = require('ioredis');
const app = express();
const cache = new redis();

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const subdomain = req.headers['x-subdomain'];
  
  // Validate credentials against database
  const merchant = await validateMerchant(email, password, subdomain);
  
  if (merchant) {
    const token = jwt.sign(
      { merchantId: merchant.id, subdomain },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Store session in Redis
    await cache.set(`session:${merchant.id}`, token, 'EX', 86400);
    
    res.json({ token, merchantId: merchant.id });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Validate token
app.post('/api/auth/validate', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cached = await cache.get(`session:${decoded.merchantId}`);
    
    if (cached === token) {
      res.json({ valid: true, merchantId: decoded.merchantId });
    } else {
      res.status(401).json({ valid: false });
    }
  } catch (err) {
    res.status(401).json({ valid: false });
  }
});
```

**Manual Test Commands:**
```bash
# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-subdomain: testmerchant" \
  -d '{"email":"test@example.com","password":"password"}'
# Expected: {"token":"...","merchantId":"..."}

# Test token validation
curl -X POST http://localhost:3001/api/auth/validate \
  -H "Authorization: Bearer [token]"
# Expected: {"valid":true,"merchantId":"..."}
```

**Success Criteria:** JWT authentication working with subdomain support

---

### Task 5: Merchant Service with CRUD
**Status:** ⬜
**Implementation Checklist:**
- [ ] CRUD operations for merchant data
- [ ] Progress calculation logic
- [ ] Publish updates to Redis for instant UI update
- [ ] Mark for batch sync (5 minutes)

**Merchant Service:**
```javascript
// services/merchant-service/index.js
app.get('/api/merchant/:id', async (req, res) => {
  const merchant = await db.query(
    'SELECT * FROM merchants WHERE id = $1',
    [req.params.id]
  );
  
  const progress = calculateProgress(merchant);
  res.json({ ...merchant, progress });
});

app.put('/api/merchant/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Update locally with version increment
  const result = await db.query(
    `UPDATE merchants 
     SET address = $1, phone = $2, version = version + 1,
         sync_status = 'pending', updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [updates.address, updates.phone, id]
  );
  
  // Broadcast to all connected clients IMMEDIATELY
  await pub.publish('merchant:updated', JSON.stringify({
    merchantId: id,
    changes: updates,
    version: result.rows[0].version,
    timestamp: Date.now()
  }));
  
  // Mark for batch sync (will sync in next 5-minute interval)
  // No immediate Salesforce call - batched every 5 minutes
  
  // Return immediately (feels instant to user)
  res.json({ 
    ...result.rows[0], 
    syncScheduled: true,
    nextSyncIn: calculateNextSyncTime() 
  });
});
```

**Success Criteria:** Merchant CRUD operations trigger sync events

---

### Task 6: Queue Service with 5-Minute Batch Sync
**Status:** ⬜
**Implementation Checklist:**
- [ ] Set up BullMQ with Redis
- [ ] 5-minute cron job for batch processing
- [ ] Batch multiple changes into single Salesforce call
- [ ] Dead letter queue handling

**Queue Service:**
```javascript
// services/queue-service/index.js
const { Queue, Worker, QueueScheduler } = require('bullmq');
const cron = require('node-cron');
const connection = { host: 'redis', port: 6379 };

// Create queues
const syncQueue = new Queue('sync', { connection });
const dlq = new Queue('dead-letter', { connection });

// Schedule batch sync every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Starting 5-minute batch sync...');
  
  // Get all pending merchants
  const pendingMerchants = await db.query(
    `SELECT DISTINCT merchant_id 
     FROM merchants 
     WHERE sync_status = 'pending'`
  );
  
  if (pendingMerchants.rows.length > 0) {
    // Add single batch job with all merchants
    await syncQueue.add('batch-sync', {
      merchantIds: pendingMerchants.rows.map(r => r.merchant_id),
      timestamp: Date.now()
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });
  }
});

// Worker to process batch sync
new Worker('sync', async (job) => {
  if (job.name === 'batch-sync') {
    const { merchantIds } = job.data;
    
    try {
      // Batch sync to Salesforce (single API call)
      const response = await fetch('http://salesforce-service:3003/api/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantIds })
      });
      
      if (!response.ok) throw new Error('Batch sync failed');
      
      // Update all merchants as synced
      await db.query(
        `UPDATE merchants 
         SET sync_status = 'synced', last_sf_modified = NOW()
         WHERE id = ANY($1)`,
        [merchantIds]
      );
      
      // Notify frontend that sync is complete
      merchantIds.forEach(id => {
        pub.publish(`merchant:${id}:synced`, JSON.stringify({
          syncedAt: Date.now(),
          batchSize: merchantIds.length
        }));
      });
      
      return { success: true, synced: merchantIds.length };
    } catch (error) {
      // Handle failure
      if (job.attemptsMade === 3) {
        await dlq.add('failed-batch', job.data);
      }
      throw error;
    }
  }
}, { connection });
```

**Success Criteria:** Queue processes jobs with retry logic

---

**Batch 2 Completion Checklist:**
- [ ] Auth service validates merchants with JWT
- [ ] Merchant service handles CRUD with versioning
- [ ] Queue service manages async jobs
- [ ] Services communicate via Redis pub/sub

---

## BATCH 3: Integration Services
**Status:** ⬜ Not Started  
**Goal:** Salesforce bidirectional sync, Calendar, WebSockets
**Context Window Strategy:** Focus on real-time integrations

### Task 7: Salesforce Service with Bidirectional Sync
**Status:** ⬜
**Implementation Checklist:**
- [ ] OAuth 2.0 JWT Bearer authentication
- [ ] Push changes to Salesforce (real-time)
- [ ] Change Data Capture webhook endpoint
- [ ] Conflict resolution with versioning

**Salesforce Service:**
```javascript
// services/salesforce-service/index.js
const jsforce = require('jsforce');

// Initialize connection
const conn = new jsforce.Connection({
  oauth2: {
    clientId: process.env.SF_CLIENT_ID,
    clientSecret: process.env.SF_CLIENT_SECRET,
    redirectUri: process.env.SF_REDIRECT_URI
  }
});

// Push to Salesforce (Portal → SF)
app.post('/api/sync/push', async (req, res) => {
  const { merchantId } = req.body;
  
  // Get merchant data
  const merchant = await db.query(
    'SELECT * FROM merchants WHERE id = $1',
    [merchantId]
  );
  
  // Update or create in Salesforce
  const result = await conn.sobject('Account').upsert({
    External_Id__c: merchantId,
    Name: merchant.company_name,
    BillingStreet: merchant.address,
    Phone: merchant.phone,
    Onboarding_Stage__c: merchant.onboarding_stage,
    Portal_Version__c: merchant.version
  }, 'External_Id__c');
  
  // Update sync status
  await db.query(
    'UPDATE merchants SET sync_status = $1, last_sf_modified = NOW() WHERE id = $2',
    ['synced', merchantId]
  );
  
  // Notify frontend via WebSocket
  io.emit(`merchant:${merchantId}:synced`, { 
    success: true, 
    salesforceId: result.id 
  });
  
  res.json({ success: true, salesforceId: result.id });
});

// Webhook for Change Data Capture (SF → Portal)
app.post('/api/webhook/cdc', async (req, res) => {
  const { sobject, event, record } = req.body;
  
  if (sobject === 'Account' && event === 'updated') {
    const merchantId = record.External_Id__c;
    
    // Check version for conflict
    const localMerchant = await db.query(
      'SELECT version FROM merchants WHERE id = $1',
      [merchantId]
    );
    
    if (record.Portal_Version__c > localMerchant.version) {
      // Salesforce has newer version, update local
      await db.query(
        `UPDATE merchants 
         SET company_name = $1, address = $2, phone = $3,
             version = $4, sync_status = 'synced'
         WHERE id = $5`,
        [record.Name, record.BillingStreet, record.Phone, 
         record.Portal_Version__c, merchantId]
      );
      
      // Notify frontend of external change
      io.emit(`merchant:${merchantId}:updated`, {
        source: 'salesforce',
        changes: record
      });
    }
  }
  
  res.json({ received: true });
});
```

**Manual Test Commands:**
```bash
# Test push to Salesforce
curl -X POST http://localhost:3003/api/sync/push \
  -H "Content-Type: application/json" \
  -d '{"merchantId":"123"}'
# Expected: {"success":true,"salesforceId":"..."}

# Simulate CDC webhook
curl -X POST http://localhost:3003/api/webhook/cdc \
  -H "Content-Type: application/json" \
  -d '{"sobject":"Account","event":"updated","record":{...}}'
# Expected: {"received":true}
```

**Success Criteria:** Real-time bidirectional sync working

---

### Task 8: Calendar Service Integration
**Status:** ⬜
**Implementation Checklist:**
- [ ] Cal.com API integration
- [ ] Available slots endpoint
- [ ] Booking creation with confirmation
- [ ] Sync bookings to Salesforce

**Calendar Service:**
```javascript
// services/calendar-service/index.js
const CalComAPI = require('@calcom/api');

app.get('/api/calendar/slots', async (req, res) => {
  const { date, serviceType } = req.query;
  
  const slots = await calcom.availability.list({
    dateFrom: date,
    dateTo: addDays(date, 30),
    eventTypeId: serviceType === 'installation' ? 1 : 2
  });
  
  res.json(slots);
});

app.post('/api/calendar/book', async (req, res) => {
  const { merchantId, date, time, type } = req.body;
  
  const booking = await calcom.bookings.create({
    eventTypeId: type === 'installation' ? 1 : 2,
    start: `${date}T${time}`,
    name: merchant.company_name,
    email: merchant.email,
    metadata: { merchantId }
  });
  
  // Update merchant record
  await db.query(
    `UPDATE merchants 
     SET ${type}_date = $1, sync_status = 'pending'
     WHERE id = $2`,
    [booking.startTime, merchantId]
  );
  
  // Trigger sync
  await queueService.add({ 
    type: 'salesforce:sync', 
    merchantId,
    priority: 'high'
  });
  
  res.json({ success: true, booking });
});
```

**Success Criteria:** Calendar booking updates merchant and syncs

---

### Task 9: WebSocket Implementation
**Status:** ⬜
**Implementation Checklist:**
- [ ] Socket.io server setup
- [ ] Client connection with auth
- [ ] Real-time event broadcasting
- [ ] Reconnection logic

**WebSocket Server (in API Gateway):**
```javascript
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: '*' }
});

// Authentication middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  socket.merchantId = decoded.merchantId;
  next();
});

// Subscribe to merchant updates
io.on('connection', (socket) => {
  // Join merchant-specific room
  socket.join(`merchant:${socket.merchantId}`);
  
  // Listen for Redis events
  sub.subscribe(`merchant:${socket.merchantId}:updated`);
  sub.on('message', (channel, message) => {
    const data = JSON.parse(message);
    socket.emit('merchant:updated', data);
  });
  
  socket.on('disconnect', () => {
    sub.unsubscribe(`merchant:${socket.merchantId}:updated`);
  });
});
```

**Frontend WebSocket Client:**
```javascript
// frontend/lib/websocket.js
const socket = io('http://localhost:3000', {
  auth: { token: localStorage.getItem('token') }
});

socket.on('merchant:updated', (data) => {
  // Update UI in real-time
  if (data.source === 'salesforce') {
    showNotification('Data updated from Salesforce');
  }
  refreshDashboard();
});
```

**Success Criteria:** Real-time updates reach frontend immediately

---

**Batch 3 Completion Checklist:**
- [ ] Salesforce bidirectional sync < 1 second
- [ ] Calendar integration working
- [ ] WebSocket updates in real-time
- [ ] Conflict resolution implemented

---

## BATCH 4: Frontend & Integration Testing
**Status:** ⬜ Not Started  
**Goal:** Next.js frontend and end-to-end testing
**Context Window Strategy:** Focus on UI and testing

### Task 10: Next.js Frontend with Real-time Updates
**Status:** ⬜
**Implementation Checklist:**
- [ ] Dashboard with progress visualization
- [ ] Forms with optimistic updates
- [ ] WebSocket integration
- [ ] Subdomain routing

**Dashboard Component:**
```tsx
// frontend/app/dashboard/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { socket } from '@/lib/websocket';

export default function Dashboard() {
  const [merchant, setMerchant] = useState(null);
  const [syncing, setSyncing] = useState(false);
  
  useEffect(() => {
    // Listen for real-time updates
    socket.on('merchant:updated', (data) => {
      setMerchant(prev => ({ ...prev, ...data.changes }));
      setSyncing(false);
    });
    
    socket.on('merchant:synced', (data) => {
      setSyncing(false);
      toast.success('Synced with Salesforce');
    });
    
    return () => {
      socket.off('merchant:updated');
      socket.off('merchant:synced');
    };
  }, []);
  
  const updateField = async (field: string, value: string) => {
    // Optimistic update
    setMerchant(prev => ({ ...prev, [field]: value }));
    setSyncing(true);
    
    try {
      await fetch(`/api/merchant/${merchant.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [field]: value })
      });
    } catch (error) {
      // Rollback on error
      fetchMerchant();
      toast.error('Update failed');
    }
  };
  
  return (
    <div>
      {syncing && <div>Syncing with Salesforce...</div>}
      {/* Dashboard UI */}
    </div>
  );
}
```

**Success Criteria:** Frontend reflects real-time changes

---

### Task 11: Integration Testing
**Status:** ⬜
**Implementation Checklist:**
- [ ] Service communication tests
- [ ] Bidirectional sync tests
- [ ] Load testing with 1000+ merchants
- [ ] Failure scenario testing

**Integration Tests:**
```javascript
// tests/integration/sync.test.js
describe('Bidirectional Sync', () => {
  it('should sync changes to Salesforce in < 1 second', async () => {
    const start = Date.now();
    
    // Update merchant
    await merchantService.update(merchantId, { 
      address: 'New Address' 
    });
    
    // Wait for sync
    await waitFor(() => {
      const sfRecord = salesforce.getRecord(merchantId);
      return sfRecord.address === 'New Address';
    });
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
  
  it('should handle conflicts correctly', async () => {
    // Simulate simultaneous updates
    await Promise.all([
      merchantService.update(merchantId, { phone: '111' }),
      salesforce.update(salesforceId, { Phone: '222' })
    ]);
    
    // Check resolution
    const merchant = await merchantService.get(merchantId);
    expect(merchant.phone).toBe('222'); // SF wins (newer)
  });
});
```

**Success Criteria:** All integration tests pass

---

### Task 12: Render Deployment & Monitoring
**Status:** ⬜
**Implementation Checklist:**
- [ ] Create render.yaml configuration
- [ ] Connect GitHub repository to Render
- [ ] Configure environment variables
- [ ] Set up health check endpoints
- [ ] Enable Render monitoring

**Render Configuration (render.yaml):**
```yaml
services:
  # API Gateway
  - type: web
    name: api-gateway
    env: node
    region: oregon
    plan: starter
    buildCommand: cd services/api-gateway && npm install
    startCommand: node index.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: REDIS_URL
        fromDatabase:
          name: redis-cache
          property: connectionString
      - key: DATABASE_URL
        fromDatabase:
          name: merchant-db
          property: connectionString
  
  # Auth Service
  - type: web
    name: auth-service
    env: node
    plan: starter
    buildCommand: cd services/auth-service && npm install
    startCommand: node index.js
    healthCheckPath: /health
    
  # Merchant Service  
  - type: web
    name: merchant-service
    env: node
    plan: starter
    buildCommand: cd services/merchant-service && npm install
    startCommand: node index.js
    healthCheckPath: /health
    
  # Salesforce Service
  - type: web
    name: salesforce-service
    env: node
    plan: starter
    buildCommand: cd services/salesforce-service && npm install
    startCommand: node index.js
    healthCheckPath: /health
    envVars:
      - key: SF_CLIENT_ID
        sync: false  # Set in dashboard
      - key: SF_CLIENT_SECRET
        sync: false  # Set in dashboard
    
  # Queue Service (Background Worker)
  - type: worker
    name: queue-service
    env: node
    plan: starter
    buildCommand: cd services/queue-service && npm install
    startCommand: node index.js
    
  # Calendar Service
  - type: web
    name: calendar-service
    env: node
    plan: starter
    buildCommand: cd services/calendar-service && npm install
    startCommand: node index.js
    healthCheckPath: /health

# Databases
databases:
  - name: merchant-db
    databaseName: onboarding
    user: onboarding_user
    plan: starter  # $7/month
    
  - name: redis-cache
    type: redis
    plan: starter  # $7/month
```

**Deployment Steps:**
```bash
# 1. Push render.yaml to repo
git add render.yaml
git commit -m "Add Render configuration"
git push origin main

# 2. Connect GitHub to Render
# - Go to dashboard.render.com
# - Click "New Blueprint Instance"
# - Select your repo
# - Render auto-deploys from render.yaml

# 3. Configure secrets in Render dashboard
# - Add Salesforce credentials
# - Add JWT secret
# - Add Cal.com API keys

# 4. Set up custom domain
# - Add *.onboardingstorehub.com to Render
# - Configure DNS CNAME records
```

**Health Check Implementation:**
```javascript
// Each service needs /health endpoint
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    service: 'merchant-service'
  };
  
  // Check database connection
  try {
    await db.query('SELECT 1');
    res.status(200).json(health);
  } catch (error) {
    health.message = 'Database connection failed';
    res.status(503).json(health);
  }
});
```

**Monitoring in Render:**
- Automatic metrics dashboard
- Log aggregation built-in
- Alerts for service failures
- Auto-restart on crashes
- Preview environments for PRs

**Success Criteria:** All services deployed on Render with monitoring

---

**Batch 4 Completion Checklist:**
- [ ] Frontend with real-time updates
- [ ] Integration tests passing
- [ ] All services deployed to Render
- [ ] Monitoring operational in Render dashboard
- [ ] Custom domain configured for subdomains

---

## Success Metrics
- **User Experience:** UI updates < 100ms (feels instant)
- **Portal → Salesforce:** Batch sync every 5 minutes
- **Salesforce → Portal:** Real-time via CDC (< 1 second)
- **Concurrent Users:** 1000+ supported
- **Uptime:** 99.9% SLA achieved
- **Data Consistency:** Zero data loss
- **API Efficiency:** Batch operations reduce API calls by 90%

## Architecture Benefits
1. **Service Independence** - Each service can be scaled/deployed separately
2. **Real-time Updates** - WebSockets ensure immediate UI updates
3. **Reliability** - Queue service handles failures gracefully
4. **Bidirectional Sync** - Changes from either system propagate immediately
5. **Conflict Resolution** - Version tracking prevents data loss

---

**Generated from:** `docs/prp.md` (Microservices Architecture)  
**Date:** 2025-09-30  
**Ready to implement:** Start with Batch 1, Task 1