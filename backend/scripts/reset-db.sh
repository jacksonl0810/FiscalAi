#!/bin/bash

# Database Reset Script
# This script will completely reset the database based on the current Prisma schema

set -e

echo "🔄 Starting database reset..."
echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR"

echo "📋 Step 1: Resetting database with Prisma..."
npx prisma db push --force-reset --accept-data-loss

echo ""
echo "📋 Step 2: Generating Prisma Client..."
npx prisma generate

echo ""
echo "📋 Step 3: Running seed script (if available)..."
if [ -f "prisma/seed.js" ]; then
  node prisma/seed.js || echo "⚠️  Seed script failed, continuing..."
else
  echo "   No seed file found, skipping..."
fi

echo ""
echo "✅ Database reset completed successfully!"
echo ""
echo "📊 Verifying database tables..."
npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;" 2>/dev/null || echo "Could not list tables"
