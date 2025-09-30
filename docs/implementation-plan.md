# Implementation & Testing Plan: Merchant Onboarding Portal (Monolith with Service Modules)

## Quick Reference
**PRP Status:** ✅ Simplified monolith with service modules and real-time Salesforce sync  
**Total Tasks:** 10 tasks across 4 conversation batches  
**Estimated Timeline:** 4 conversations over 1 week

## Architecture Overview
```
Next.js Frontend → Single Express App → Service Modules → PostgreSQL ↔ Salesforce
                                                                ↑
                                                          Real-time sync
```

## Conversation Batching Strategy
- **Batch 1:** Project Foundation (3 tasks: Project structure, Express setup, Database)
- **Batch 2:** Service Modules (3 tasks: Auth, Merchant, Queue modules)
- **Batch 3:** Integration Services (2 tasks: Salesforce sync, WebSockets + Calendar)
- **Batch 4:** Frontend & Testing (2 tasks: Next.js UI, Integration testing + Deployment)

---

## BATCH 1: Project Foundation
**Status:** ⬜ Not Started  
**Goal:** Set up single Express application with project structure
**Context Window Strategy:** Fresh conversation, focus on monolith setup

### Task 1: Project Structure & Package Setup
**Status:** ⬜
**Implementation Checklist:**
- [ ] Create monolith project structure
- [ ] Initialize package.json with dependencies
- [ ] Set up environment configuration
- [ ] Create basic Express app structure

**Project Structure:**
```
onboarding-portal/
├── package.json
├── .env.example
├── .gitignore
├── server/
│   ├── index.js           # Main Express application
│   ├── routes/            # API route handlers
│   │   ├── auth.js
│   │   ├── merchant.js
│   │   ├── salesforce.js
│   │   └── calendar.js
│   ├── services/          # Business logic modules
│   │   ├── authService.js
│   │   ├── merchantService.js
│   │   ├── salesforceService.js
│   │   ├── calendarService.js
│   │   └── queueService.js
│   ├── middleware/        # Express middleware
│   ├── database/          # Database connection & migrations
│   └── utils/             # Helper functions
├── frontend/              # Next.js app (separate)
└── scripts/               # Deployment scripts
```

**Package.json:**
```json
{
  "name": "onboarding-portal",
  "version": "1.0.0",
  "scripts": {
    "start": "node server/index.js",
    "dev": "nodemon server/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.0",
    "socket.io": "^4.7.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "jsforce": "^2.0.0",
    "node-cron": "^3.0.0",
    "cors": "^2.8.0",
    "helmet": "^7.0.0",
    "dotenv": "^16.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0",
    "jest": "^29.0.0"
  }
}
```

**Manual Test Commands:**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test server is running
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

**Success Criteria:** Express server starts and responds to health check

---

### Task 2: Express Server & Routing Setup
**Status:** ⬜
**Implementation Checklist:**
- [ ] Create main Express application
- [ ] Set up middleware stack
- [ ] Implement subdomain parsing
- [ ] Create API route structure

**Main Express App (server/index.js):**
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Subdomain parsing middleware
app.use((req, res, next) => {
  const host = req.get('host') || '';
  const subdomain = host.split('.')[0];
  if (subdomain !== 'localhost' && subdomain !== '127') {
    req.subdomain = subdomain;
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/merchant', require('./routes/merchant'));
app.use('/api/sync', require('./routes/salesforce'));
app.use('/api/calendar', require('./routes/calendar'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    subdomain: req.subdomain
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };
```

**Manual Test Commands:**
```bash
# Test server health
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Test subdomain parsing
curl -H "Host: testmerchant.localhost:3000" http://localhost:3000/api/health
# Expected: {"status":"ok","subdomain":"testmerchant"}
```

**Success Criteria:** Express server with routing and subdomain parsing working

---

### Task 3: Database & Redis Setup
**Status:** ⬜
**Implementation Checklist:**
- [ ] Set up PostgreSQL connection
- [ ] Create database schema and migrations
- [ ] Configure Redis for caching and pub/sub
- [ ] Create database service module

**Database Connection (server/database/connection.js):**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/onboarding',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};
```

**Database Schema (server/database/schema.sql):**
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

**Redis Setup (server/utils/redis.js):**
```javascript
const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const publisher = client.duplicate();
const subscriber = client.duplicate();

async function connectRedis() {
  await client.connect();
  await publisher.connect();
  await subscriber.connect();
  console.log('Redis connected');
}

// Publish merchant update
async function publishUpdate(channel, data) {
  await publisher.publish(channel, JSON.stringify(data));
}

// Subscribe to updates
async function subscribeToUpdates(channel, callback) {
  await subscriber.subscribe(channel, (message) => {
    const data = JSON.parse(message);
    callback(data);
  });
}

module.exports = {
  client,
  publisher,
  subscriber,
  connectRedis,
  publishUpdate,
  subscribeToUpdates
};
```

**Manual Test Commands:**
```bash
# Test database connection
psql postgresql://user:password@localhost:5432/onboarding -c "SELECT 1;"
# Expected: Returns 1

# Test Redis connection
redis-cli ping
# Expected: PONG
```

**Success Criteria:** Database tables created, Redis connection working

---

**Batch 1 Completion Checklist:**
- [ ] Express server running with health endpoint
- [ ] Database schema created and connected
- [ ] Redis configured for pub/sub
- [ ] Project structure established
- [ ] Ready for service module implementation

---

## BATCH 2: Service Modules Implementation
**Status:** ⬜ Not Started  
**Goal:** Build auth, merchant, and queue service modules
**Context Window Strategy:** Fresh conversation with foundation ready

### Task 4: Auth Service Module
**Status:** ⬜
**Implementation Checklist:**
- [ ] Create authService.js module
- [ ] JWT token generation and validation
- [ ] Subdomain-based tenant resolution
- [ ] Create auth routes
- [ ] Session management with Redis

**Auth Service Module (server/services/authService.js):**
```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../database/connection');
const { client: redis } = require('../utils/redis');

class AuthService {
  // Generate JWT token
  generateToken(merchantId, subdomain) {
    return jwt.sign(
      { merchantId, subdomain },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // Validate merchant credentials
  async validateMerchant(email, password, subdomain) {
    try {
      const result = await db.query(
        'SELECT * FROM merchants WHERE email = $1 AND subdomain = $2',
        [email, subdomain]
      );
      
      if (result.rows.length === 0) return null;
      
      const merchant = result.rows[0];
      const validPassword = await bcrypt.compare(password, merchant.password_hash);
      
      return validPassword ? merchant : null;
    } catch (error) {
      console.error('Auth validation error:', error);
      return null;
    }
  }

  // Store session in Redis
  async storeSession(merchantId, token) {
    await redis.set(`session:${merchantId}`, token, 'EX', 86400);
  }

  // Validate token
  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const cached = await redis.get(`session:${decoded.merchantId}`);
      
      return cached === token ? decoded : null;
    } catch (error) {
      return null;
    }
  }

  // Get merchant by subdomain
  async getMerchantBySubdomain(subdomain) {
    const result = await db.query(
      'SELECT * FROM merchants WHERE subdomain = $1',
      [subdomain]
    );
    return result.rows[0] || null;
  }
}

module.exports = new AuthService();
```

**Auth Routes (server/routes/auth.js):**
```javascript
const express = require('express');
const authService = require('../services/authService');
const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const subdomain = req.subdomain;
    
    if (!subdomain) {
      return res.status(400).json({ error: 'Subdomain required' });
    }
    
    const merchant = await authService.validateMerchant(email, password, subdomain);
    
    if (merchant) {
      const token = authService.generateToken(merchant.id, subdomain);
      await authService.storeSession(merchant.id, token);
      
      res.json({ 
        token, 
        merchantId: merchant.id,
        companyName: merchant.company_name 
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Validate token
router.post('/validate', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = await authService.validateToken(token);
    
    if (decoded) {
      res.json({ valid: true, merchantId: decoded.merchantId });
    } else {
      res.status(401).json({ valid: false });
    }
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

// Get tenant info
router.get('/tenant/:subdomain', async (req, res) => {
  try {
    const merchant = await authService.getMerchantBySubdomain(req.params.subdomain);
    
    if (merchant) {
      res.json({ 
        exists: true, 
        companyName: merchant.company_name,
        onboardingStage: merchant.onboarding_stage
      });
    } else {
      res.status(404).json({ exists: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Tenant lookup failed' });
  }
});

module.exports = router;
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

### Task 10: Render Deployment & Integration Testing
**Status:** ⬜
**Implementation Checklist:**
- [ ] Create simplified render.yaml configuration
- [ ] Connect GitHub repository to Render
- [ ] Configure environment variables
- [ ] Set up health check endpoint
- [ ] Run integration tests
- [ ] Enable Render monitoring

**Simplified Render Configuration (render.yaml):**
```yaml
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

# Databases
databases:
  - name: merchant-db
    databaseName: onboarding
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
// Single health endpoint in main app
app.get('/api/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    service: 'onboarding-portal'
  };
  
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    // Check Redis connection
    await redis.ping();
    
    res.status(200).json(health);
  } catch (error) {
    health.message = 'Service connection failed';
    health.error = error.message;
    res.status(503).json(health);
  }
});
```

**Integration Testing:**
```javascript
// tests/integration/full-flow.test.js
describe('Full User Flow', () => {
  it('should complete merchant onboarding end-to-end', async () => {
    // Test login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@merchant.com', password: 'password' });
    
    expect(loginResponse.status).toBe(200);
    const { token } = loginResponse.body;
    
    // Test merchant update
    const updateResponse = await request(app)
      .put('/api/merchant/123')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: 'New Address' });
    
    expect(updateResponse.status).toBe(200);
    
    // Verify sync to Salesforce (wait for batch)
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const sfRecord = await salesforce.getRecord('123');
    expect(sfRecord.BillingStreet).toBe('New Address');
  });
});
```

**Monitoring in Render:**
- Automatic metrics dashboard
- Log aggregation built-in
- Alerts for service failures
- Auto-restart on crashes
- Preview environments for PRs

**Success Criteria:** Single application deployed on Render with full integration tests passing

---

**Batch 4 Completion Checklist:**
- [ ] Frontend with real-time updates
- [ ] Integration tests passing  
- [ ] Single application deployed to Render
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
1. **Simplicity** - Single application, easier to develop and debug
2. **Real-time Updates** - WebSockets ensure immediate UI updates
3. **Reliability** - Queue service module handles failures gracefully
4. **Bidirectional Sync** - Changes from either system propagate immediately
5. **Conflict Resolution** - Version tracking prevents data loss
6. **Easy Deployment** - Single application deployment to Render
7. **Scalable Path** - Can be split into microservices later if needed

---

**Generated from:** `docs/prp.md` (Monolith with Service Modules Architecture)  
**Date:** 2025-09-30  
**Ready to implement:** Start with Batch 1, Task 1