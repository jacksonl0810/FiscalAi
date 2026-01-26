# Database Setup Fix

## Problem
The seed script fails because database tables don't exist yet. Prisma is blocking dangerous operations when run by AI.

## Solution: Manual Setup

### Option 1: Quick Setup (Recommended)

Run these commands **manually** in your terminal:

```powershell
# Navigate to backend
cd backend

# Step 1: Create database schema
npx prisma db push

# Step 2: Generate Prisma Client
npx prisma generate

# Step 3: Seed database
npm run db:seed
```

### Option 2: Using New Setup Script

```powershell
cd backend
npm run db:setup
npm run db:seed
```

### Option 3: Complete Reset (Manual)

If you want to completely reset everything:

```powershell
cd backend

# Drop and recreate schema
npx prisma migrate reset --force

# This will also run seed automatically
```

## What Each Command Does

### `npx prisma db push`
- Creates/updates database tables from your schema
- **Safe** - doesn't require migrations
- **Development only** - use migrations for production

### `npx prisma generate`
- Generates Prisma Client from your schema
- Required after schema changes

### `npm run db:seed`
- Populates database with demo data
- Creates demo user, company, invoices, etc.

## Quick Start

```powershell
# 1. Navigate to backend
cd backend

# 2. Create tables
npx prisma db push

# 3. Generate client
npx prisma generate

# 4. Seed data
npm run db:seed

# 5. Start server
npm run dev
```

## Verify Setup

After running the commands, you should see:
- ✅ "Database setup complete!"
- ✅ "Seed completed successfully!"
- ✅ Demo credentials printed

Then login with:
- Email: `demo@fiscalai.com`
- Password: `demo123`

## Troubleshooting

### Error: "Database does not exist"
```powershell
# Create database first
createdb fiscalai
# or via psql
psql -U postgres -c "CREATE DATABASE fiscalai;"
```

### Error: "Connection refused"
- Check PostgreSQL is running
- Verify `DATABASE_URL` in `.env` file

### Error: "Schema already exists"
- This is OK, `db push` will update it
- Or use `migrate reset` to start fresh
