# Database Setup for Local Development

## PostgreSQL on Render

This application uses a PostgreSQL database hosted on Render for storing Lark OAuth tokens.

### Important: Use External URL for Local Development

When running the application locally, you must use the **external** database URL, not the internal one.

#### ❌ Internal URL (only works within Render's network):
```
DATABASE_URL=postgresql://user:pass@dpg-xxxxx-a/database_name
```

#### ✅ External URL (works from your local machine):
```
DATABASE_URL=postgresql://user:pass@dpg-xxxxx-a.singapore-postgres.render.com/database_name
```

### Environment Variables

In your `.env.local` file, make sure to set:

```env
# For local development - use external URL
DATABASE_URL=postgresql://user:pass@dpg-xxxxx-a.singapore-postgres.render.com/database_name

# Keep internal URL for reference (used in production on Render)
INTERNAL_DATABASE_URL=postgresql://user:pass@dpg-xxxxx-a/database_name
```

### Troubleshooting

If you see errors like:
```
Can't reach database server at `dpg-xxxxx-a:5432`
```

This means you're using the internal URL locally. Switch to the external URL with the full hostname.

### Database Contents

The database stores:
- Lark OAuth tokens for installer calendar access
- User authorization status for calendar integration

### Prisma ORM

The application uses Prisma as the ORM. To manage the database schema:

```bash
# View current database state
npx prisma studio

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```