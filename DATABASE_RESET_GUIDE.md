# Database Reset & Seed Guide

## Quick Commands

### Option 1: Reset Database Only (Drop All Tables)
```bash
cd backend
npm run db:reset
```

### Option 2: Reset + Seed (Drop All Tables + Add Demo Data)
```bash
cd backend
npm run db:reset:seed
```

### Option 3: Manual Step-by-Step

#### Step 1: Drop All Tables
```bash
cd backend
npx prisma migrate reset --force --skip-seed
```

#### Step 2: Seed Database (Optional)
```bash
npm run db:seed
```

## What Each Command Does

### `npm run db:reset`
- Drops all database tables
- Recreates the schema from scratch
- **Does NOT** populate with data
- Safe to run multiple times

### `npm run db:reset:seed`
- Drops all database tables
- Recreates the schema
- **Automatically** runs seed to populate demo data
- Perfect for fresh start with test data

### `npm run db:seed`
- Populates database with demo data:
  - Demo user (email: `demo@fiscalai.com`, password: `demo123`)
  - Demo company
  - Sample invoices
  - Sample notifications
  - DAS payments

## Prisma Commands Reference

### Reset Database (Prisma Native)
```bash
npx prisma migrate reset
```
- Drops database
- Recreates it
- Applies all migrations
- Runs seed script (if configured)

### Reset Without Seed
```bash
npx prisma migrate reset --force --skip-seed
```

### Generate Prisma Client
```bash
npm run db:generate
```

### Push Schema Changes (Development)
```bash
npm run db:push
```

### Create Migration
```bash
npm run db:migrate
```

### Open Prisma Studio (Database GUI)
```bash
npm run db:studio
```

## Complete Reset Workflow

### For Fresh Start:
```bash
# 1. Navigate to backend
cd backend

# 2. Reset database and seed
npm run db:reset:seed

# 3. Start backend server
npm run dev
```

### For Testing:
```bash
# Reset before each test run
cd backend
npm run db:reset:seed
```

## What Gets Deleted

⚠️ **WARNING**: These commands will delete **ALL** data:

- ✅ All users
- ✅ All companies
- ✅ All invoices
- ✅ All notifications
- ✅ All subscriptions
- ✅ All payments
- ✅ All status history
- ✅ All settings

## What Gets Created (After Seed)

After running `db:seed`, you'll have:

### Demo User
- **Email**: `demo@fiscalai.com`
- **Password**: `demo123`
- **Name**: Usuário Demo

### Demo Company
- Company registered in Nuvem Fiscal
- Digital certificate uploaded
- Fiscal connection configured

### Sample Invoices
- 2-3 authorized invoices
- 1 pending invoice
- Various statuses for testing

### Sample Notifications
- Success notifications
- Error notifications
- Info notifications

## Troubleshooting

### Error: "Database does not exist"
```bash
# Create database first (PostgreSQL)
createdb fiscalai
# or
psql -U postgres -c "CREATE DATABASE fiscalai;"
```

### Error: "Connection refused"
- Check if PostgreSQL is running
- Verify `DATABASE_URL` in `.env` file
- Check database credentials

### Error: "Migration failed"
```bash
# Force reset
npx prisma migrate reset --force
```

### Error: "Schema drift detected"
```bash
# Reset and push schema
npx prisma migrate reset --force
npx prisma db push
```

## Environment Setup

Make sure your `.env` file has:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/fiscalai?schema=public"
```

## Quick Test After Reset

1. Reset database:
   ```bash
   cd backend
   npm run db:reset:seed
   ```

2. Start backend:
   ```bash
   npm run dev
   ```

3. Login with demo account:
   - Email: `demo@fiscalai.com`
   - Password: `demo123`

4. Verify data:
   - Check Documents page for invoices
   - Check Notifications page
   - Check Company setup

## Production Warning

⚠️ **NEVER** run reset commands in production!

These commands are for **development only**.

For production:
- Use proper migrations
- Backup database before changes
- Use staging environment for testing
