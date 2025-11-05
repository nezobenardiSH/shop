# Merchant Onboarding Portal

A self-service merchant onboarding portal built with Next.js that provides a structured web interface for merchants to update their information and track onboarding progress.

## Tech Stack

- **Framework**: Next.js 14 with TypeScript
- **Database**: SQLite (development) / PostgreSQL (production)
- **ORM**: Prisma
- **Authentication**: JWT tokens
- **Styling**: Tailwind CSS
- **Salesforce Integration**: jsforce

## Local Development Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd merchant-portal
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env file from the example
cp .env.example .env
```

4. Initialize the database:
```bash
# Run Prisma migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:3010

## Database Management

### View Database with Prisma Studio

```bash
npx prisma studio
```

This opens a GUI at http://localhost:5555 where you can view and edit your database.

### Direct SQLite Access

```bash
# View tables
sqlite3 prisma/dev.db ".tables"

# Query merchants
sqlite3 prisma/dev.db "SELECT * FROM Merchant;"
```

## Project Structure

```
merchant-portal/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── merchant/     # Merchant CRUD operations
│   │   └── salesforce/   # Salesforce webhooks
│   ├── [merchant]/       # Dynamic merchant pages
│   └── layout.tsx        # Root layout
├── lib/                   # Shared utilities
│   ├── prisma.ts         # Prisma client instance
│   ├── auth.ts           # Authentication helpers
│   └── salesforce.ts     # Salesforce integration
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── dev.db           # SQLite database (local)
└── public/              # Static assets
```

## API Endpoints

- `GET /api/health` - Health check endpoint
- `POST /api/auth/login` - Merchant login
- `GET /api/merchant/[slug]` - Get merchant by slug
- `PUT /api/merchant/[id]` - Update merchant information
- `POST /api/salesforce/webhook` - Salesforce sync webhook

## Environment Variables

```env
# Server Configuration
PORT=3010

# Database
DATABASE_URL="file:./dev.db"  # SQLite for local development

# Authentication
JWT_SECRET="your-secret-key"

# Salesforce (optional for local development)
SF_USERNAME=""
SF_PASSWORD=""
SF_TOKEN=""
```

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Open Prisma Studio
npx prisma studio

# Create a new migration
npx prisma migrate dev --name <migration-name>

# Reset database
npx prisma migrate reset
```

## Testing

Manual testing checklist:
- [ ] Health endpoint returns 200
- [ ] Database connection works
- [ ] Prisma Studio opens correctly
- [ ] Can create and query merchants
- [ ] JWT authentication works
- [ ] Merchant dashboard loads

## Documentation

### Calendar Integration
- [Lark FreeBusy API Fix Documentation](docs/LARK_FREEBUSY_API_FIX.md) - Details about the FreeBusy API response handling fix
- [Calendar Troubleshooting Guide](docs/CALENDAR_TROUBLESHOOTING_GUIDE.md) - Step-by-step guide for diagnosing calendar availability issues

### Troubleshooting

If you encounter calendar availability issues:
1. Check the [Calendar Troubleshooting Guide](docs/CALENDAR_TROUBLESHOOTING_GUIDE.md)
2. Use the debug endpoints documented in the guide
3. Verify events are marked as "Busy" in Lark Calendar
4. Ensure users have completed OAuth authorization

## Future Production Deployment

When ready for production, you can deploy to:
- **Render**: Simple deployment with PostgreSQL
- **Vercel**: Free tier with external database
- **Railway**: One-click deploy with database
- **Self-hosted**: VPS with Docker

Update the `DATABASE_URL` in production to use PostgreSQL instead of SQLite.

## License

Private - All rights reserved