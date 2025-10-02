# 🚀 Render Production Deployment Guide

## 📋 Overview
This guide provides step-by-step instructions for deploying the Merchant Onboarding Portal to Render with PostgreSQL database, Salesforce integration, and Lark calendar booking.

## 🔍 Pre-Deployment Checklist

### Required Accounts & Access
- [ ] Render account (create at render.com)
- [ ] GitHub/GitLab repository
- [ ] Salesforce Sandbox credentials
- [ ] Lark App credentials (if using calendar booking)
- [ ] Domain name (optional, Render provides free subdomain)

### Local Environment Verification
- [ ] Application runs successfully locally
- [ ] All tests pass
- [ ] `.env` file contains all required variables
- [ ] No hardcoded secrets in code
- [ ] `.gitignore` includes sensitive files

## 📦 Step 1: Database Migration (SQLite → PostgreSQL)

### 1.1 Update Prisma Schema
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"  // Changed from "sqlite"
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

### 1.2 Generate PostgreSQL Migration
```bash
# Remove old SQLite migrations (backup first!)
mv prisma/migrations prisma/migrations_sqlite_backup

# Generate new PostgreSQL migration
npx prisma migrate dev --name init_postgres

# Test locally with PostgreSQL (optional)
docker run -e POSTGRES_PASSWORD=testpass -p 5432:5432 postgres
DATABASE_URL="postgresql://postgres:testpass@localhost:5432/merchantportal" npm run dev
```

## 📝 Step 2: Configuration Files

### 2.1 Update render.yaml
```yaml
services:
  - type: web
    name: merchant-portal
    runtime: node
    region: oregon  # Choose nearest region
    plan: starter   # Or 'free' for testing
    buildCommand: npm install && npm run build && npx prisma generate && npx prisma migrate deploy
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      # Database (auto-connected)
      - key: DATABASE_URL
        fromDatabase:
          name: portal-db
          property: connectionString
      
      # Security
      - key: JWT_SECRET
        generateValue: true
      
      # App Configuration
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3010
      - key: NEXTAUTH_URL
        sync: false  # Set manually after deployment
      
      # Salesforce (set in dashboard)
      - key: SF_USERNAME
        sync: false
      - key: SF_PASSWORD
        sync: false
      - key: SF_TOKEN
        sync: false
      - key: SF_LOGIN_URL
        value: https://test.salesforce.com
      
      # Lark (optional, set in dashboard)
      - key: LARK_APP_ID
        sync: false
      - key: LARK_APP_SECRET
        sync: false

databases:
  - name: portal-db
    plan: starter  # Or 'free' for testing
    databaseName: merchants
    user: merchantadmin
```

### 2.2 Update next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  
  // Production optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

### 2.3 Create .env.production.example
```env
# Database (provided by Render)
DATABASE_URL=postgresql://user:password@host:port/database

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=production

# Application
PORT=3010
NEXTAUTH_URL=https://your-app-name.onrender.com

# Salesforce Sandbox
SF_USERNAME=your.email@company.com.sandbox
SF_PASSWORD=yourpassword
SF_TOKEN=yourSecurityToken
SF_LOGIN_URL=https://test.salesforce.com

# Lark Calendar Integration (optional)
LARK_APP_ID=cli_xxxxxx
LARK_APP_SECRET=xxxxxx

# Logging
LOG_LEVEL=info
```

## 🔐 Step 3: Environment Variables

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-provided by Render |
| `JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 32` |
| `SF_USERNAME` | Salesforce sandbox username | user@company.com.sandbox |
| `SF_PASSWORD` | Salesforce password | your-password |
| `SF_TOKEN` | Salesforce security token | your-security-token |
| `SF_LOGIN_URL` | Salesforce login endpoint | https://test.salesforce.com |
| `NEXTAUTH_URL` | Your app's full URL | https://merchant-portal.onrender.com |

### Optional Variables
| Variable | Description | When Needed |
|----------|-------------|-------------|
| `LARK_APP_ID` | Lark application ID | For calendar booking |
| `LARK_APP_SECRET` | Lark application secret | For calendar booking |
| `LOG_LEVEL` | Logging verbosity | Default: info |

## 🚀 Step 4: Deployment Process

### 4.1 Prepare Repository
```bash
# Ensure all changes are committed
git add .
git commit -m "Prepare for Render deployment"

# Push to main branch
git push origin main
```

### 4.2 Deploy to Render

#### Option A: Using render.yaml (Recommended)
1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click "New +" → "Blueprint"
3. Connect your GitHub/GitLab account
4. Select your repository
5. Render will detect `render.yaml` and create resources
6. Click "Apply" to deploy

#### Option B: Manual Setup
1. Create PostgreSQL Database:
   - New → PostgreSQL
   - Name: `portal-db`
   - Database: `merchants`
   - User: `merchantadmin`

2. Create Web Service:
   - New → Web Service
   - Connect repository
   - Name: `merchant-portal`
   - Runtime: Node
   - Build: `npm install && npm run build && npx prisma generate && npx prisma migrate deploy`
   - Start: `npm start`

### 4.3 Configure Environment Variables
1. Go to your service dashboard
2. Navigate to "Environment" tab
3. Add each variable:
   ```
   SF_USERNAME = your.email@company.com.sandbox
   SF_PASSWORD = yourpassword
   SF_TOKEN = yourSecurityToken
   LARK_APP_ID = cli_xxxxx (if using)
   LARK_APP_SECRET = xxxxx (if using)
   ```
4. Update `NEXTAUTH_URL` with your Render URL:
   ```
   NEXTAUTH_URL = https://merchant-portal.onrender.com
   ```

## ✅ Step 5: Post-Deployment Verification

### 5.1 Check Service Health
```bash
# Test health endpoint
curl https://your-app.onrender.com/api/health

# Expected response:
# {"status":"healthy","timestamp":"..."}
```

### 5.2 Test Salesforce Connection
Navigate to: `https://your-app.onrender.com/api/salesforce/test`

Expected response:
```json
{
  "success": true,
  "message": "Successfully connected to Salesforce Sandbox",
  "instanceUrl": "https://your-instance.sandbox.salesforce.com"
}
```

### 5.3 Test Application
1. Visit main page: `https://your-app.onrender.com`
2. Try merchant portal: `https://your-app.onrender.com/merchant/[merchantId]`
3. Check logs in Render dashboard for any errors

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Database Connection Failed
**Error**: `Can't reach database server`
**Solution**: 
- Check DATABASE_URL in environment variables
- Ensure database is running (check Render dashboard)
- Verify connection string format

#### Salesforce Authentication Failed
**Error**: `INVALID_LOGIN: authentication failure`
**Solution**:
- Verify SF_USERNAME includes sandbox suffix
- Check SF_PASSWORD + SF_TOKEN concatenation
- Ensure SF_LOGIN_URL points to sandbox
- Reset security token in Salesforce if needed

#### Build Failures
**Error**: `Build failed`
**Solution**:
- Check build logs in Render dashboard
- Ensure all dependencies are in package.json
- Verify Node version compatibility
- Check for TypeScript errors

#### Prisma Migration Issues
**Error**: `Migration failed`
**Solution**:
```bash
# Reset database (CAUTION: deletes all data)
npx prisma migrate reset --force

# Or manually in Render shell:
npx prisma db push --force-reset
```

## 📊 Monitoring & Maintenance

### Regular Checks
- [ ] Monitor service health daily
- [ ] Check error logs weekly
- [ ] Review database size monthly
- [ ] Update dependencies quarterly

### Performance Optimization
1. **Cold Starts** (Free/Starter tier):
   - Implement warm-up endpoint
   - Use cron job to ping service

2. **Database Performance**:
   - Add indexes for frequently queried fields
   - Monitor slow queries
   - Consider connection pooling

3. **Caching**:
   - Implement Redis for session storage
   - Cache Salesforce API responses
   - Use Next.js ISR for static content

### Backup Strategy
```bash
# Manual database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20240101.sql
```

## 🔄 Updates & Deployments

### Deploy Updates
1. Push to main branch:
   ```bash
   git add .
   git commit -m "Update: description"
   git push origin main
   ```
2. Render auto-deploys from main branch

### Database Migrations
```bash
# Create migration locally
npx prisma migrate dev --name migration_name

# Deploy will auto-run:
npx prisma migrate deploy
```

### Rollback Procedure
1. Go to Render dashboard
2. Navigate to "Events" tab
3. Find previous successful deploy
4. Click "Rollback to this deploy"

## 📞 Support Resources

### Render Support
- Documentation: https://render.com/docs
- Status Page: https://status.render.com
- Community: https://community.render.com

### Troubleshooting Checklist
1. Check service logs in Render dashboard
2. Verify all environment variables are set
3. Test database connection
4. Confirm external API connections (Salesforce, Lark)
5. Review recent code changes
6. Check Render status page for outages

## 🎯 Production Readiness Checklist

### Security
- [ ] Strong JWT_SECRET generated
- [ ] HTTPS enforced (automatic on Render)
- [ ] Environment variables secured
- [ ] No secrets in code repository
- [ ] CORS configured properly

### Performance
- [ ] Database indexes created
- [ ] Query optimization done
- [ ] Image optimization enabled
- [ ] Caching strategy implemented
- [ ] Rate limiting configured

### Reliability
- [ ] Error handling comprehensive
- [ ] Logging configured
- [ ] Health checks passing
- [ ] Backup strategy in place
- [ ] Monitoring alerts set up

### Compliance
- [ ] Data privacy measures implemented
- [ ] User consent mechanisms in place
- [ ] Audit logging enabled
- [ ] Security headers configured
- [ ] SSL certificate valid

## 📝 Notes

- **Free Tier Limitations**: Services sleep after 15 minutes of inactivity
- **Starter Tier**: No sleep, better for production
- **Database Backups**: Automatic daily backups on paid plans
- **Custom Domains**: Available on all plans
- **SSL Certificates**: Automatic and free

---

*Last Updated: October 2025*
*Version: 1.0.0*