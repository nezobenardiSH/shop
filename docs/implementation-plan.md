# Implementation & Testing Plan: Merchant Onboarding Portal (Simplified)

## Quick Reference
**Architecture:** Single Next.js application with immediate bidirectional Salesforce Sandbox sync
**Total Tasks:** 8 tasks across 4 days
**Estimated Timeline:** 3-5 days
**Development:** Local SQLite database
**Salesforce Environment:** Sandbox (https://test.salesforce.com)
**Production Deployment:** TBD (Render/Vercel/Other)

## Architecture Overview
```
Next.js App (with API routes)
    ↓ ↑
SQLite (Local Development) / PostgreSQL (Future Production)
    ↓ ↑
Salesforce Sandbox API (jsforce)
```

---

## Day 1: Project Setup & Foundation
**Goal:** Set up Next.js app with local SQLite database  
**Time:** 4-6 hours

### Task 1: Create Next.js Application
**Status:** ⬜ Not Started  
**Implementation:**
```bash
# Create Next.js app with TypeScript and Tailwind
npx create-next-app@latest merchant-portal --typescript --tailwind --app
cd merchant-portal

# Install additional dependencies
npm install @prisma/client prisma jsforce jsonwebtoken bcrypt
npm install -D @types/jsonwebtoken @types/bcrypt
```

**Project Structure:**
```
merchant-portal/
├── app/
│   ├── api/
│   │   └── health/route.ts       # Health check endpoint
│   ├── [merchant]/
│   │   └── page.tsx          # Merchant dashboard (placeholder)
│   ├── layout.tsx
│   └── page.tsx                  # Landing page
├── lib/
│   └── prisma.ts                 # Prisma client
├── prisma/
│   └── schema.prisma
├── package.json
├── next.config.js                # Next.js config with port 3010
└── .env.local
```

**Next.js Configuration (next.config.js):**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Port configuration is set via package.json scripts
}

module.exports = nextConfig
```

**Package.json Scripts Update:**
```json
{
  "scripts": {
    "dev": "next dev -p 3010",
    "build": "next build",
    "start": "next start -p 3010",
    "lint": "next lint"
  }
}
```

**Health Check Endpoint (app/api/health/route.ts):**
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
  })
}
```

**Manual Test:**
```bash
cd merchant-portal
npm run dev
# Visit http://localhost:3010/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Task 2: Set Up Prisma and Database Schema
**Status:** ⬜ Not Started  
**Implementation:**
```bash
# Initialize Prisma
npx prisma init
```

**Database Schema (prisma/schema.prisma):**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Merchant {
  id              String    @id @default(cuid())
  slug            String    @unique
  salesforceId    String?   @unique
  companyName     String
  email           String    @unique
  passwordHash    String
  address         String?
  phone           String?
  onboardingStage String    @default("new")
  installationDate DateTime?
  trainingDate    DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Prisma Client (lib/prisma.ts):**
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

**Commands:**
```bash
# Create .env file for local SQLite development
cat > .env << EOF
PORT=3010
DATABASE_URL="file:./dev.db"
JWT_SECRET="development-secret-key-change-in-production"
SF_USERNAME=""
SF_PASSWORD=""
SF_TOKEN=""
EOF

# Run migration to create SQLite database
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# Seed test data (optional)
npx prisma db seed
```

**Manual Test:**
```bash
cd merchant-portal
# Verify database was created
ls prisma/dev.db
# Expected: file exists

# Open Prisma Studio to inspect database
npx prisma studio
# Visit http://localhost:5555
# Expected: See Merchant table with schema fields

# Test Prisma client generation
npx prisma generate
# Expected: "✔ Generated Prisma Client"
```

### Task 3: Deploy to Render
**Status:** ⬜ Not Started  
**Implementation:**

**Create render.yaml:**
```yaml
services:
  - type: web
    name: merchant-portal
    runtime: node
    region: oregon
    plan: starter
    buildCommand: npm install && npm run build && npx prisma generate && npx prisma migrate deploy
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: portal-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: PORT
        value: 3010
      - key: NEXTAUTH_URL
        value: https://merchant-portal.onrender.com

databases:
  - name: portal-db
    plan: starter
    databaseName: merchants
```

**Deployment Steps:**
```bash
# Initialize git and push to GitHub
git init
git add .
git commit -m "Initial setup"
git remote add origin https://github.com/yourusername/merchant-portal.git
git push -u origin main

# In Render Dashboard:
# 1. New > Blueprint
# 2. Connect GitHub repo
# 3. Render will auto-deploy using render.yaml
```

**Manual Test:**
```bash
cd merchant-portal
# Initialize git repository
git init
git add .
git commit -m "Initial setup"

# Push to GitHub (after creating repo)
git remote add origin https://github.com/yourusername/merchant-portal.git
git push -u origin main

# After deployment on Render:
curl https://merchant-portal.onrender.com/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

**Success Criteria:** 
- App accessible at merchant-portal.onrender.com
- Health check returns 200
- Database connected

---

## Day 2: Core Features
**Goal:** Build authentication and merchant CRUD operations  
**Time:** 6-8 hours

### Task 4: JWT Authentication
**Status:** ⬜ Not Started  
**Implementation:**

**Auth Helpers (lib/auth.ts):**
```typescript
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret'

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}
```

**Login Endpoint (app/api/auth/login/route.ts):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    const merchant = await prisma.merchant.findUnique({
      where: { email }
    })
    
    if (!merchant) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    const valid = await verifyPassword(password, merchant.passwordHash)
    
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    const token = generateToken({ 
      id: merchant.id, 
      email: merchant.email,
      slug: merchant.slug 
    })
    
    return NextResponse.json({ 
      token, 
      merchant: {
        id: merchant.id,
        companyName: merchant.companyName,
        slug: merchant.slug
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
```

**Manual Test:**
```bash
# Create test merchant first
npx prisma studio
# Add a merchant with hashed password

# Test login
curl -X POST http://localhost:3010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# Expected: {"token":"...","merchant":{...}}
```

### Task 5: Merchant CRUD Operations
**Status:** ⬜ Not Started  
**Implementation:**

**Get Merchant (app/api/merchant/[slug]/route.ts):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        companyName: true,
        address: true,
        phone: true,
        onboardingStage: true,
        installationDate: true,
        trainingDate: true
      }
    })
    
    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(merchant)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch merchant' },
      { status: 500 }
    )
  }
}
```

**Update Merchant (app/api/merchant/[id]/route.ts):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncToSalesforce } from '@/lib/salesforce'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json()
    
    // Update in database
    const merchant = await prisma.merchant.update({
      where: { id: params.id },
      data: {
        address: data.address,
        phone: data.phone,
        installationDate: data.installationDate,
        trainingDate: data.trainingDate
      }
    })
    
    // Sync to Salesforce (fire and forget)
    syncToSalesforce(merchant).catch(console.error)
    
    return NextResponse.json(merchant)
  } catch (error) {
    return NextResponse.json(
      { error: 'Update failed' },
      { status: 500 }
    )
  }
}
```

**Manual Test:**
```bash
cd merchant-portal
# Test GET merchant endpoint
curl http://localhost:3010/api/merchant/bestbuy
# Expected: {"error":"Merchant not found"} or merchant data

# Test PUT merchant endpoint (need existing merchant)
curl -X PUT http://localhost:3010/api/merchant/[merchant-id] \
  -H "Content-Type: application/json" \
  -d '{"address":"123 Main St","phone":"555-1234"}'
# Expected: Updated merchant data
```

---

## Day 3: Salesforce Integration
**Goal:** Implement bidirectional sync with Salesforce  
**Time:** 6-8 hours

### Task 6: Salesforce Connection and Sync
**Status:** ⬜ Not Started  
**Implementation:**

**Salesforce Setup (lib/salesforce.ts):**
```typescript
import jsforce from 'jsforce'

let connection: jsforce.Connection | null = null

export async function getSalesforceConnection() {
  if (!connection) {
    connection = new jsforce.Connection({
      loginUrl: 'https://login.salesforce.com'
    })
    
    await connection.login(
      process.env.SF_USERNAME!,
      process.env.SF_PASSWORD! + process.env.SF_TOKEN!
    )
  }
  
  return connection
}

export async function syncToSalesforce(merchant: any) {
  try {
    const conn = await getSalesforceConnection()
    
    const sfData = {
      Name: merchant.companyName,
      BillingStreet: merchant.address,
      Phone: merchant.phone,
      External_Id__c: merchant.id,
      Onboarding_Stage__c: merchant.onboardingStage
    }
    
    if (merchant.salesforceId) {
      // Update existing
      await conn.sobject('Account').update({
        Id: merchant.salesforceId,
        ...sfData
      })
    } else {
      // Create new
      const result = await conn.sobject('Account').create(sfData)
      
      // Update merchant with SF ID
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: { salesforceId: result.id }
      })
    }
  } catch (error) {
    console.error('Salesforce sync failed:', error)
    // Don't throw - this is fire and forget
  }
}
```

**Manual Test:**
```bash
cd merchant-portal
# Since Salesforce requires credentials, test with mock data
# Create test merchant in Prisma Studio first
# Then test sync function (will fail without SF creds but logs error)
node -e "console.log('Test would require SF credentials')"
# Expected: "Salesforce sync failed:" error in console if no creds
```

### Task 7: Salesforce Webhook Endpoint
**Status:** ⬜ Not Started  
**Implementation:**

**Webhook Endpoint (app/api/salesforce/webhook/route.ts):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { recordId, changes } = await request.json()
    
    // Find merchant by Salesforce ID
    const merchant = await prisma.merchant.findUnique({
      where: { salesforceId: recordId }
    })
    
    if (merchant) {
      // Update local database with Salesforce changes
      await prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          address: changes.BillingStreet,
          phone: changes.Phone,
          onboardingStage: changes.Onboarding_Stage__c
        }
      })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook processing failed:', error)
    return NextResponse.json(
      { error: 'Webhook failed' },
      { status: 500 }
    )
  }
}
```

**Salesforce Configuration:**
1. In Salesforce Setup, create a Platform Event or Workflow
2. Set webhook URL: `https://merchant-portal.onrender.com/api/salesforce/webhook`
3. Configure to trigger on Account record changes

**Manual Test:**
```bash
cd merchant-portal
# Test webhook endpoint with mock data
curl -X POST http://localhost:3010/api/salesforce/webhook \
  -H "Content-Type: application/json" \
  -d '{"recordId":"SF123","changes":{"BillingStreet":"456 New St","Phone":"555-5678"}}'
# Expected: {"success":true}
```

---

## Day 4: Frontend UI
**Goal:** Build merchant dashboard with forms  
**Time:** 4-6 hours

### Task 8: Merchant Dashboard UI
**Status:** ⬜ Not Started  
**Implementation:**

**Dashboard Page (app/[merchant]/page.tsx):**
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function MerchantDashboard() {
  const params = useParams()
  const [merchant, setMerchant] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    fetchMerchant()
  }, [params.merchant])
  
  async function fetchMerchant() {
    const res = await fetch(`/api/merchant/${params.merchant}`)
    const data = await res.json()
    setMerchant(data)
  }
  
  async function handleUpdate(field: string, value: string) {
    setLoading(true)
    
    const res = await fetch(`/api/merchant/${merchant.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    })
    
    if (res.ok) {
      const updated = await res.json()
      setMerchant(updated)
    }
    
    setLoading(false)
  }
  
  if (!merchant) return <div>Loading...</div>
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        Welcome, {merchant.companyName}
      </h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Business Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Address
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              defaultValue={merchant.address}
              onBlur={(e) => handleUpdate('address', e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Phone
            </label>
            <input
              type="tel"
              className="w-full border rounded px-3 py-2"
              defaultValue={merchant.phone}
              onBlur={(e) => handleUpdate('phone', e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Installation Date
            </label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              defaultValue={merchant.installationDate?.split('T')[0]}
              onChange={(e) => handleUpdate('installationDate', e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Training Date
            </label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              defaultValue={merchant.trainingDate?.split('T')[0]}
              onChange={(e) => handleUpdate('trainingDate', e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Onboarding Status</h2>
        <div className="text-lg">
          Current Stage: <span className="font-bold">{merchant.onboardingStage}</span>
        </div>
      </div>
      
      {loading && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded">
          Syncing with Salesforce...
        </div>
      )}
    </div>
  )
}
```

**Manual Test:**
```bash
cd merchant-portal
# Visit merchant dashboard
# http://localhost:3010/bestbuy
# Expected: Dashboard loads with "Welcome, bestbuy"

# Test with existing merchant slug
# http://localhost:3010/[merchant-slug]
# Expected: Merchant data loads and forms are interactive
```

---

## Day 5: Testing and Polish
**Goal:** Manual testing, error handling, and production configuration  
**Time:** 2-4 hours

### Testing Checklist
- [ ] Create test merchant account
- [ ] Test login flow
- [ ] Test updating merchant information
- [ ] Verify Salesforce sync (check SF record)
- [ ] Test Salesforce webhook (make change in SF)
- [ ] Verify bidirectional sync works
- [ ] Test error scenarios
- [ ] Check mobile responsiveness

### Production Configuration
```env
# .env.production
DATABASE_URL=[from Render]
JWT_SECRET=[from Render]
SF_USERNAME=your.salesforce@email.com
SF_PASSWORD=yourpassword
SF_TOKEN=yoursecuritytoken
```

### Deployment Verification
```bash
# Check health endpoint
curl https://merchant-portal.onrender.com/api/health

# Monitor logs in Render dashboard
# Check database connections
# Verify Salesforce webhook registration
```

---

## Success Metrics
- **Build Time:** 3-5 days
- **Code Lines:** ~500-700 total
- **Files:** ~15-20 files
- **Dependencies:** 5 production, 4 dev
- **Monthly Cost:** $14 (Render + PostgreSQL)
- **Response Time:** < 200ms
- **Sync Latency:** < 1 second

## Architecture Benefits
1. **Simplicity** - Single Next.js app, no microservices
2. **Speed** - Can be built by one developer in under a week
3. **Cost** - Under $15/month to run
4. **Maintainability** - Standard Next.js patterns
5. **Scalability** - Can handle 100s of merchants easily
6. **Reliability** - Direct API calls, no complex queues

---

**Generated from:** `docs/prp.md` (Simplified Architecture)  
**Date:** 2025-09-30  
**Ready to implement:** Start with Day 1, Task 1