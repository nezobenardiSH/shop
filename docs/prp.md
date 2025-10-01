# Product Requirements Plan (PRP) - Onboarding Trainer Portal ✅ COMPLETED

### 1. Core Identity - IMPLEMENTED ✅
A trainer-focused onboarding portal built as a Next.js application that provides comprehensive management of merchant onboarding through direct Salesforce integration. Each trainer gets their own portal URL for managing their assigned merchants with real-time data sync.

### 2. Success Scenario - ACHIEVED ✅
- **User does**: Trainer navigates to `localhost:3010/merchant/Nasi-Lemak` and views comprehensive onboarding data
- **System responds**: Loads real-time data from Salesforce, displays trainer info, contact details, stage progress, and dates
- **User interacts**: Updates trainer information, changes stages, sends contact reminders
- **System syncs**: All changes immediately sync to Salesforce sandbox environment
- **Result**: Complete trainer portal with stage management, contact functionality, and real-time Salesforce integration

### 3. User Flows - IMPLEMENTED ✅
**PRIMARY FLOW - COMPLETED:**
1. ✅ User navigates to trainer-specific URL (`localhost:3010/merchant/Nasi-Lemak`)
2. ✅ System identifies trainer from URL parameter (`Onboarding_Trainer__c.Name`)
3. ✅ User clicks "📥 Load Trainer Data" → system queries Salesforce
4. ✅ System displays comprehensive trainer information with interactive interface
5. ✅ User can edit fields, navigate stages, send reminders → changes sync to Salesforce
6. ✅ Result: Real-time Salesforce integration with immediate data sync

**IMPLEMENTED FEATURES:**
- ✅ **Stage Management**: Interactive tabbed interface for 11 onboarding stages
- ✅ **Contact Management**: Multiple phone numbers with reminder functionality
- ✅ **Data Editing**: Update trainer information directly in Salesforce
- ✅ **Error Handling**: Comprehensive debugging and user-friendly error messages
- ✅ **Real-time Sync**: Immediate updates to Salesforce on save

### 4. Technical Stack & Architecture - IMPLEMENTED ✅
**IMPLEMENTED STACK:**
- ✅ **Framework**: Next.js 15.0.3 with TypeScript
- ✅ **Salesforce Integration**: jsforce library with direct API connection
- ✅ **Environment**: Salesforce Sandbox (test.salesforce.com)
- ✅ **Styling**: Tailwind CSS with responsive design
- ✅ **Development**: Local development server (localhost:3010)

**IMPLEMENTED ARCHITECTURE:**
```
Next.js 15 App (with API routes)
    ↓ ↑ (Real-time)
Salesforce Sandbox API (jsforce)
    ↓ ↑
Onboarding_Trainer__c + Contact objects
```

**KEY ARCHITECTURAL DECISIONS:**
- ✅ **Direct Salesforce Integration**: No intermediate database, direct API calls
- ✅ **URL-based Routing**: `/merchant/{Onboarding_Trainer__c.Name}` structure
- ✅ **Real-time Data**: Live queries to Salesforce for current data
- ✅ **JavaScript Filtering**: Client-side filtering for complex name matching

### 5. Data Models & API Design - IMPLEMENTED ✅
**SALESFORCE DATA MODEL (Implemented):**
```javascript
// Onboarding_Trainer__c Object
{
  Id: "a0yBE000002SwCnYAK",
  Name: "Nasi Lemak",
  First_Revised_EGLD__c: "2026-01-31",
  Onboarding_Trainer_Stage__c: "New", // 11 possible stages
  Installation_Date__c: null,
  Phone_Number__c: "+6012345678",
  Merchant_PIC_Contact_Number__c: "+6012345678",
  Operation_Manager_Contact__c: "003BE00000J9oEKYAZ", // Contact ID
  Business_Owner_Contact__c: "003BE00000J9CnoYAF", // Contact ID
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