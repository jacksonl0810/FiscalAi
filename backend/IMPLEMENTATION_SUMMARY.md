# Subscription Service Implementation Summary

## ✅ Completed

1. **Database Schema Updates**
   - ✅ Created `Plan` model with: id, planId, pagarmePlanId, amountCents, interval, intervalCount, trialDays, planType
   - ✅ Created `Customer` model with: id, userId, pagarmeCustomerId, document
   - ✅ Created `Transaction` model (renamed from Payment) with: id, subscriptionId, pagarMeTransactionId, amountCents, status, paymentMethod, paidAt
   - ✅ Created `WebhookEvent` model for webhook logging and idempotency
   - ✅ Updated `Subscription` model to have FK to Plan and use Transaction model
   - ✅ Removed `pagarMeCustomerId` from User model (moved to Customer)

2. **Migration Scripts**
   - ✅ Created `scripts/seed-plans.js` to sync plans from config to database
   - ✅ Added `db:seed-plans` script to package.json

## 🔄 In Progress / TODO

1. **Update Subscription Routes** (`src/routes/subscriptions.js`)
   - [ ] Replace `user.pagarMeCustomerId` with Customer model lookups
   - [ ] Use `getOrCreateCustomer()` from customerService
   - [ ] Update subscription creation to use Plan FK
   - [ ] Update payment recording to use Transaction model instead of Payment
   - [ ] Add webhook event logging to WebhookEvent table

2. **Create Customer Service** (`src/services/customerService.js`)
   - [ ] Implement `getOrCreateCustomer()` function
   - [ ] Implement `getCustomerByUserId()` function
   - [ ] Update subscription routes to use this service

3. **Update Plan Service** (`src/services/planService.js`)
   - [ ] Update to use database Plan model as primary source
   - [ ] Keep config file as fallback for backward compatibility
   - [ ] Ensure planType is properly handled

4. **Webhook Handler Updates**
   - [ ] Log all webhook events to WebhookEvent table
   - [ ] Add idempotency checks using eventId
   - [ ] Update subscription status based on webhook events

5. **Frontend Updates**
   - [ ] Update to handle planType field
   - [ ] Display plan type in pricing page if needed

## 📝 Key Changes Required

### Customer Model Usage
- Replace: `user.pagarMeCustomerId`
- With: `customer.pagarMeCustomerId` from Customer model
- Use: `getOrCreateCustomer()` service function

### Plan Model Usage
- Replace: String planId in Subscription
- With: FK to Plan model
- Use: `plan.planId` for lookups, `plan.id` for FK

### Transaction Model Usage
- Replace: Payment model for new records
- With: Transaction model
- Keep: Payment model for backward compatibility during migration

### Webhook Event Logging
- Add: Log all webhook events to WebhookEvent table
- Check: eventId for idempotency before processing
- Update: processed flag after successful processing

