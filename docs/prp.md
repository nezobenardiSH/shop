# Product Requirements Plan (PRP) - Merchant Onboarding Portal (Simplified)

### 1. Core Identity
A self-service merchant onboarding portal built as a single Next.js application that replaces fragmented WhatsApp/text coordination with a structured web interface. Merchants update their information and track onboarding progress while the system maintains immediate bidirectional sync with Salesforce.

### 2. Single Success Scenario
- User does: Merchant logs in via path URL and updates missing store address, selects installation date
- System responds: Saves to PostgreSQL instantly, syncs to Salesforce immediately
- User verifies: Dashboard shows new address and scheduled date, Salesforce reflects changes in real-time

### 3. User Flows
**PRIMARY FLOW:**
1. User navigates to path-based URL (onboardingstorehub.com/bestbuy)
2. System identifies merchant from URL slug
3. User enters credentials → JWT validates → shows dashboard
4. User clicks "Update Information" → saves to DB → syncs to Salesforce
5. Result: Immediate bidirectional sync ensures data consistency

**ERROR HANDLING:**
- Invalid credentials: Show "Invalid login" message
- Salesforce sync failure: Log error, continue (fire-and-forget)
- Database error: Show user-friendly error message

### 4. Technical Stack & Architecture
**STACK:**
- Full-Stack Framework: Next.js 14 with TypeScript
- Database: PostgreSQL with Prisma ORM
- Salesforce Integration: jsforce library
- Authentication: Simple JWT tokens
- Styling: Tailwind CSS
- Deployment: Render Web Service

**SIMPLIFIED ARCHITECTURE:**
```
Next.js App (with API routes)
    ↓ ↑
PostgreSQL (Prisma)
    ↓ ↑
Salesforce API (jsforce)
```

### 5. API Design & Data Models
**DATA MODEL (Prisma Schema):**
```prisma
model Merchant {
  id            String   @id @default(cuid())
  slug          String   @unique  // e.g., "bestbuy"
  salesforceId  String?  @unique
  companyName   String
  email         String   @unique
  passwordHash  String
  address       String?
  phone         String?
  onboardingStage String @default("new")
  installationDate DateTime?
  trainingDate  DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

**API ENDPOINTS (Next.js API Routes):**
```
Authentication:
  POST /api/auth/login
  GET  /api/auth/verify

Merchant Management:
  GET  /api/merchant/[slug]
  PUT  /api/merchant/[id]
  GET  /api/merchant/[id]/progress

Salesforce Integration:
  POST /api/salesforce/webhook
```

### 6. Bidirectional Sync (Simplified)
**PORTAL → SALESFORCE (Immediate):**
```typescript
// When user saves data
async function updateMerchant(data) {
  // Save to PostgreSQL
  const merchant = await prisma.merchant.update({ data })
  
  // Sync to Salesforce immediately (don't await)
  salesforce.sobject('Account')
    .update({ Id: merchant.salesforceId, ...data })
    .catch(error => console.error('SF sync failed:', error))
  
  return merchant
}
```

**SALESFORCE → PORTAL (Webhook):**
```typescript
// Webhook endpoint
export async function POST(request) {
  const { recordId, changes } = await request.json()
  
  await prisma.merchant.update({
    where: { salesforceId: recordId },
    data: changes
  })
  
  return Response.json({ success: true })
}
```

### 7. Dependencies & Constraints
**REQUIRED PACKAGES:**
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "@prisma/client": "^5.0.0",
    "jsforce": "^2.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "tailwindcss": "^3.3.0"
  }
}
```

**CONSTRAINTS:**
- Must work on Render Starter plan ($7/month)
- Simple enough to build in 3-5 days
- No complex queue systems or Redis needed
- Path-based routing instead of subdomains
- Direct API calls instead of batching

### 8. File Structure (Minimal)
```
merchant-portal/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── login/route.ts
│   │   ├── merchant/
│   │   │   └── [id]/route.ts
│   │   └── salesforce/
│   │       └── webhook/route.ts
│   ├── [merchant]/
│   │   └── page.tsx          # Merchant dashboard
│   ├── layout.tsx
│   └── page.tsx                  # Landing/login
├── lib/
│   ├── prisma.ts                 # Prisma client
│   ├── salesforce.ts             # jsforce setup
│   └── auth.ts                   # JWT helpers
├── prisma/
│   └── schema.prisma
├── package.json
├── render.yaml
└── .env.local
```

### 9. Render Deployment Configuration
```yaml
# render.yaml
services:
  - type: web
    name: merchant-portal
    runtime: node
    region: oregon
    plan: starter  # $7/month
    buildCommand: npm install && npm run build && npx prisma generate
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: portal-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: SF_USERNAME
        sync: false
      - key: SF_PASSWORD
        sync: false
      - key: SF_TOKEN
        sync: false

databases:
  - name: portal-db
    plan: starter  # $7/month
    databaseName: merchants
```

### 10. Code Quality Requirements
- Maximum 50 lines per function
- Simple try/catch error handling
- No unit tests for MVP (add later)
- TypeScript for basic type safety
- Comments only where necessary
- Focus on working code over perfect code

### 11. Definition of Done
**SYSTEM COMPLETE WHEN:**
- Single Next.js app deployed on Render
- Merchants can login via path URL (/m/merchant-slug)
- CRUD operations work for merchant data
- Changes sync immediately to Salesforce
- Salesforce webhook updates local database
- Basic dashboard shows onboarding progress
- Authentication works with simple JWT
- Total cost under $15/month on Render

### 12. Implementation Priority
**Day 1:** Setup & Foundation
- Create Next.js app with TypeScript
- Set up Prisma with PostgreSQL
- Deploy skeleton to Render

**Day 2:** Core Features
- Build authentication with JWT
- Create merchant CRUD API routes
- Build basic dashboard UI

**Day 3:** Salesforce Integration
- Set up jsforce connection
- Implement sync on update
- Create webhook endpoint

**Day 4-5:** Polish & Testing
- Add error handling
- Style with Tailwind CSS
- Manual testing
- Production configuration