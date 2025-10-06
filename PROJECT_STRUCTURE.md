# Project Structure

This document outlines the clean, organized structure of the StoreHub Merchant Onboarding Portal.

## Root Directory Structure

```
OnboardingPortal/
├── app/                          # Next.js App Router (main application)
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── lark/                 # Lark calendar integration
│   │   └── salesforce/           # Salesforce API endpoints
│   ├── login/                    # Login pages
│   ├── merchant/                 # Main merchant portal
│   │   └── [merchantId]/         # Dynamic merchant pages
│   ├── unauthorized/             # Unauthorized access page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/                   # Reusable React components
│   ├── BookingModal.tsx          # Training booking modal
│   ├── DatePickerModal.tsx       # Date picker component
│   ├── LoginForm.tsx             # Login form component
│   ├── MerchantHeader.tsx        # Header component
│   ├── OnboardingTimeline.tsx    # Main timeline component
│   └── WhatsAppButton.tsx        # Support button
├── lib/                          # Utility libraries
│   ├── auth.ts                   # Authentication utilities
│   ├── auth-utils.ts             # Auth helper functions
│   ├── lark.ts                   # Lark API integration
│   ├── prisma.ts                 # Database client
│   ├── salesforce.ts             # Salesforce API client
│   ├── storehub-theme.ts         # Design system theme
│   ├── trainer-assignment.ts     # Trainer assignment logic
│   └── trainer-availability.ts   # Availability management
├── config/                       # Configuration files
│   ├── merchant-trainer-mapping.json
│   └── trainers.json
├── docs/                         # Documentation
│   ├── salesforce-automation-setup.md
│   ├── storehub-design-system.md
│   └── ... (other docs)
├── prisma/                       # Database schema and migrations
│   ├── schema.prisma
│   └── migrations/
├── public/                       # Static assets
│   └── SH_logo.avif
├── scripts/                      # Utility scripts
│   ├── create-test-merchant.js
│   ├── list-merchants.js
│   ├── test-menu-upload.js
│   └── view-db.js
├── testing/                      # All testing-related files
│   ├── e2e/                      # End-to-end tests
│   ├── pages/                    # Test pages
│   ├── test-results/             # Test results
│   ├── playwright-report/        # Playwright reports
│   └── playwright.config.ts      # Playwright configuration
├── types/                        # TypeScript type definitions
├── middleware.ts                 # Next.js middleware
├── next.config.js                # Next.js configuration
├── package.json                  # Dependencies and scripts
├── tailwind.config.js            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── render.yaml                   # Deployment configuration
├── .env.example                  # Environment variables template
├── .env.local                    # Local environment variables
└── README.md                     # Project overview
```

## Key Application Routes

### Public Routes
- `/` - Home page with project information
- `/login/[merchantId]` - Merchant login page

### Protected Routes (Merchant Portal)
- `/merchant/[merchantId]` - Main merchant dashboard
- `/merchant/[merchantId]/details` - Detailed merchant information

### API Routes

#### Authentication
- `POST /api/auth/merchant-login` - Merchant login
- `POST /api/auth/merchant-logout` - Merchant logout  
- `GET /api/auth/me` - Get current user

#### Salesforce Integration
- `GET /api/salesforce/merchant/[merchantId]` - Get merchant data
- `POST /api/salesforce/update-trainer` - Update trainer data
- `POST /api/salesforce/webhook` - Handle Salesforce webhooks
- `POST /api/salesforce/menu-upload` - Process menu uploads
- `POST /api/salesforce/upload-video` - Upload store readiness videos

#### Lark Calendar Integration  
- `GET /api/lark/availability` - Get trainer availability
- `POST /api/lark/book-training` - Book training sessions
- `POST /api/lark/cancel-training` - Cancel training sessions

## Component Architecture

### Main Components
- **OnboardingTimeline**: The core component showing merchant progress
- **BookingModal**: Handles training session booking
- **MerchantHeader**: Navigation and merchant info display
- **LoginForm**: Authentication interface

### Utility Libraries
- **auth.ts**: JWT token handling and validation
- **salesforce.ts**: Salesforce API client and data mapping
- **lark.ts**: Lark calendar API integration
- **trainer-availability.ts**: Complex availability calculation logic

## Database Schema (Prisma)

The application uses PostgreSQL with Prisma ORM:
- **Merchant**: Core merchant information
- **Opportunity**: Salesforce opportunity sync
- **Training**: Training session records

## Environment Configuration

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SALESFORCE_*` - Salesforce API credentials
- `LARK_*` - Lark application credentials
- `JWT_SECRET` - JWT signing secret

## Development Commands

```bash
npm run dev        # Start development server (port 3010)
npm run build      # Build for production
npm run start      # Start production server
npm run db:push    # Push schema changes to database
npm run db:studio  # Open Prisma Studio
```

## Key Features

1. **Merchant Authentication**: Secure login with JWT tokens
2. **Progress Tracking**: Visual timeline showing onboarding stages
3. **Training Booking**: Integration with Lark calendar for scheduling
4. **Salesforce Sync**: Real-time data synchronization
5. **Status Automation**: Automatic status updates via webhooks
6. **Video Upload**: Store readiness video submission
7. **Mobile Responsive**: Optimized for all device sizes

## Clean Architecture Benefits

✅ **Clear Separation**: API routes, components, and utilities are well-organized  
✅ **Easy Navigation**: Intuitive folder structure  
✅ **Maintainable**: Related files are grouped together  
✅ **Scalable**: Easy to add new features without clutter  
✅ **Testing**: All test files consolidated in `/testing`  
✅ **Documentation**: Comprehensive docs in `/docs`  

This structure follows Next.js best practices and makes the codebase much easier to understand and maintain.