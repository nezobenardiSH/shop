# Development Notes

## Port Configuration
**IMPORTANT: Always use port 3010 for this project**

- Server runs on: http://localhost:3010
- Health check: http://localhost:3010/api/health
- All API endpoints are prefixed with /api

## Development Commands
```bash
# Full development server (tries to connect to DB/Redis)
npm run dev

# Simple development server (no external dependencies)
npm run dev:simple

# Production server
npm start
```

## Manual Test Commands (Updated for Port 3010)
```bash
# Health check
curl http://localhost:3010/api/health

# Test subdomain parsing
curl -H "Host: testmerchant.example.com" http://localhost:3010/api/health

# Test routes
curl http://localhost:3010/api/auth/login -X POST
curl http://localhost:3010/api/merchant/123
curl http://localhost:3010/api/sync/push -X POST
curl http://localhost:3010/api/calendar/slots
```

## Development Services
- PostgreSQL: localhost:5432
- Redis: localhost:6379
- Main App: localhost:3010