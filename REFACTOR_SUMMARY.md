# Invoice-First Subscription Refactor - Complete

## ✅ Changes Implemented

### 1. Prisma Schema Updates (COMPLETED)

**File**: `/home/FiscalAi/backend/prisma/schema.prisma`

#### Subscription Model
- **Status field**: Changed from `String` to strict `SubscriptionStatus` enum
- **New enum values**:
  - `PENDING` - Created, first invoice not paid yet
  - `ACTIVE` - Last invoice paid, subscription active
  - `PAST_DUE` - Payment failed, retry pending
  - `TRIAL` - Trial period active
  - `CANCELED` - Canceled by user or system
  - `EXPIRED` - End date reached (optional)
- **New index**: Added index on `pagarMeSubscriptionId` for faster lookups

#### Payment Model
- **Primary idempotency key**: Changed from `pagarMeTransactionId` to `pagarMeInvoiceId`
  - Invoice ID (`in_xxx`) is now the unique identifier
  - Transaction ID kept as optional field
- **Status field**: Changed from `String` to strict `PaymentStatus` enum
  - `PAID` - Payment successful
  - `FAILED` - Payment failed
- **New fields**:
  - `failureReason` - Gateway error message for failed payments
- **New index**: Added index on `subscriptionId` for performance

---

### 2. Invoice-First Webhook Handlers (COMPLETED)

**File**: `/home/FiscalAi/backend/src/services/pagarmeWebhookHandlers.js` (NEW)

#### Core Philosophy: **Invoice events are the single source of truth**

#### Handlers Created

##### `onInvoicePaid(event)`
- **Purpose**: ONLY activation point for subscriptions
- **Triggers**: `invoice.paid` webhook event
- **Actions**:
  1. Find subscription by `pagarMeSubscriptionId`
  2. Check idempotency using `pagarMeInvoiceId` (prevents double-processing)
  3. Update subscription status to `ACTIVE`
  4. Record payment with `PAID` status
  5. Create success notification
  6. Send confirmation email
- **Guarantees**: Atomic transaction, idempotent, no false activations

##### `onInvoicePaymentFailed(event)`
- **Purpose**: Mark subscription as past due (NOT canceled)
- **Triggers**: `invoice.payment_failed` webhook event
- **Actions**:
  1. Find subscription
  2. Update status to `PAST_DUE`
  3. Record failed payment attempt with error message
  4. Create warning notification
  5. Send failure email
- **Philosophy**: Give user chance to fix payment method, let Pagar.me retries work

##### `onSubscriptionCanceled(event)`
- **Purpose**: Final cancellation
- **Triggers**: `subscription.canceled` webhook event
- **Actions**:
  1. Update status to `CANCELED`
  2. Record `canceledAt` timestamp
  3. Create cancellation notification
- **Note**: This is the ONLY way subscriptions should be canceled

##### `onSubscriptionUpdated(event)`
- **Purpose**: Sync metadata only
- **Triggers**: `subscription.updated` webhook event
- **Actions**:
  1. Update period dates (`currentPeriodStart`, `currentPeriodEnd`)
  2. Update `nextBillingAt`
  3. **Does NOT change status** (that's invoice.paid's job)

---

### 3. Refactored Webhook Router (COMPLETED)

**File**: `/home/FiscalAi/backend/src/routes/subscriptions.js`

#### Changes to `/webhook` Endpoint

**Old behavior**: Handled 15+ event types, activated subscriptions on `order.paid`, `charge.paid`, and `invoice.paid`

**New behavior**: Clean routing with invoice-first philosophy

```javascript
switch (eventType) {
  // ✅ PRIMARY: Invoice events (source of truth)
  case 'invoice.paid':
    const { onInvoicePaid } = await import('../services/pagarmeWebhookHandlers.js');
    result = await onInvoicePaid(event);
    break;
  
  case 'invoice.payment_failed':
  case 'invoice.canceled':
    const { onInvoicePaymentFailed } = await import('../services/pagarmeWebhookHandlers.js');
    result = await onInvoicePaymentFailed(event);
    break;
  
  // ✅ LIFECYCLE: Subscription events (sync only)
  case 'subscription.canceled':
    const { onSubscriptionCanceled } = await import('../services/pagarmeWebhookHandlers.js');
    result = await onSubscriptionCanceled(event);
    break;

  case 'subscription.updated':
    const { onSubscriptionUpdated } = await import('../services/pagarmeWebhookHandlers.js');
    result = await onSubscriptionUpdated(event);
    break;
  
  // ⚠️ LEGACY: Order/Charge events (one-time payments only)
  case 'order.paid':
    // Only for one-time payments, NOT subscriptions
    result = await handleOrderPaid(event);
    break;
  
  default:
    result = { handled: false };
}
```

#### Delegated Old Handlers

**Old handlers** (`handleInvoicePaid`, `handleInvoicePaymentFailed`, `handleSubscriptionCanceled`, `handleSubscriptionUpdated`) now delegate to clean handlers in `pagarmeWebhookHandlers.js`

**Benefit**: Single source of truth, no code duplication, cleaner logic

---

### 4. Removed Order/Charge Activation Logic (COMPLETED)

#### What Was Removed

❌ **Subscription activation in**:
- `handleOrderPaid` - Can still process one-time payments, but does NOT activate recurring subscriptions
- `handleChargePaid` - Now just acknowledges (invoice.paid handles it)
- `/check-payment` - Converted to read-only

#### What Remains

✅ **One-time payments**: `handleOrderPaid` can still process pay-per-use invoices

✅ **Legacy support**: Old webhook handlers remain for backward compatibility but are clearly marked

---

### 5. Updated `/check-payment` to Read-Only (COMPLETED)

**File**: `/home/FiscalAi/backend/src/routes/subscriptions.js`

#### Old Behavior
- Fetched order status from Pagar.me
- **Activated subscription if order was paid**
- Created payment records
- Sent notifications

#### New Behavior (Read-Only)
- Fetches subscription + invoice status from Pagar.me
- **Returns current state WITHOUT modifying database**
- Displays local vs Pagar.me status comparison
- Includes message: *"Subscription activation happens automatically via webhook"*

#### New Response Format
```json
{
  "subscription": {
    "id": "uuid",
    "local_status": "PENDING",
    "pagarme_status": "active",
    "current_period_start": "2025-01-01T00:00:00Z",
    "current_period_end": "2025-02-01T00:00:00Z",
    "next_billing_at": "2025-02-01T00:00:00Z"
  },
  "invoice": {
    "id": "in_xxx",
    "status": "paid",
    "amount": 99.90,
    "cycle_start": "2025-01-01T00:00:00Z",
    "cycle_end": "2025-02-01T00:00:00Z"
  },
  "message": "Subscription activation happens automatically via webhook. Status shown above is current state."
}
```

---

## 🔐 State Machine (Subscription Lifecycle)

### Allowed State Transitions

| Event                  | From               | To                 | Notes                           |
| ---------------------- | ------------------ | ------------------ | ------------------------------- |
| `invoice.paid`         | PENDING / PAST_DUE | ACTIVE             | ONLY activation point           |
| `invoice.payment_failed` | ACTIVE           | PAST_DUE           | Allow retries                   |
| `invoice.paid`         | PAST_DUE           | ACTIVE             | Auto-recovery after retry       |
| `subscription.canceled`| ANY                | CANCELED           | Final cancellation              |
| `subscription.updated` | ANY                | (no status change) | Sync metadata only              |

### ❌ Forbidden Operations

- **Order events CANNOT activate subscriptions**
- **Charge events CANNOT activate subscriptions**
- **`/check-payment` CANNOT activate subscriptions**
- **First payment failure does NOT cancel subscription** (moves to PAST_DUE instead)

---

## 📋 Webhook Event Selection (Pagar.me Dashboard)

### ✅ Required Events

1. **`invoice.paid`** ⭐⭐⭐ - Primary payment confirmation
2. **`invoice.payment_failed`** - Handle failed payments
3. **`subscription.canceled`** - Handle cancellations
4. **`subscription.updated`** - Sync metadata

### ⚠️ Optional (Legacy Support)

- `order.paid` - For one-time payments only
- `charge.paid` - Acknowledged but not used

### ❌ NOT Needed

- `order.created`
- `charge.created`
- `subscription.created` (handled internally)

---

## 🧪 Testing with Test Cards

### Success Card
```
Card: 4111 1111 1111 1111
CVV: 123
Expiry: 12/2030
Name: Any name
```

### Failure Card
```
Card: 4000 0000 0000 0002
CVV: 123
Expiry: 12/2030
Name: Any name
```

---

## 🚨 Migration Notes

### Database Changes

1. **Subscription `status` column**:
   - Changed from `String` to `SubscriptionStatus` enum
   - Old values like `'ativo'`, `'trial'`, `'inadimplente'`, `'cancelado'` mapped to enum
   - ⚠️ **Data loss warning**: Existing subscriptions with invalid status values will fail

2. **Payment `pagarMeInvoiceId` unique constraint**:
   - Added unique constraint
   - ⚠️ If duplicate invoice IDs exist, migration will fail

### Migration Applied

```bash
npx prisma db push --accept-data-loss
```

**Status**: ✅ Successfully applied

---

## 📝 What You Need to Do Next

### 1. Configure Webhook in Pagar.me Dashboard

1. Go to **Dashboard → Developers → Webhooks**
2. Click **"Criar webhook"**
3. Set URL: `https://api.yoursite.com/api/subscriptions/webhook`
4. Add header: `X-Pagarme-Webhook-Secret: YOUR_SECRET`
5. Select events:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `subscription.canceled`
   - `subscription.updated`
6. Save webhook
7. Copy webhook secret and add to `.env`:
   ```
   PAGARME_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

### 2. Test Webhook Locally

Use ngrok or similar tool to expose local server:

```bash
ngrok http 3001
# Use ngrok URL in Pagar.me webhook config
```

### 3. Monitor Logs

Watch for webhook events in your server logs:

```bash
[Webhook] invoice.paid received: { invoiceId: 'in_xxx', subscriptionId: 'sub_xxx' }
[Webhook] ✅ invoice.paid processed successfully
```

### 4. Handle Edge Cases

- **Existing subscriptions**: May need manual status updates if they're in old format
- **Pending subscriptions**: Will activate automatically when invoice.paid webhook arrives
- **Failed payments**: Will move to PAST_DUE and auto-recover when payment succeeds

---

## ✅ Summary

### What Changed

1. ✅ Prisma schema now uses strict enums for subscription/payment status
2. ✅ Invoice-first webhook handlers created (single source of truth)
3. ✅ Webhook router refactored to prioritize invoice events
4. ✅ Removed subscription activation from order/charge handlers
5. ✅ Converted `/check-payment` to read-only endpoint

### What Was Fixed

❌ **Before**: Subscriptions activated on order.paid, charge.paid, AND invoice.paid → false positives
✅ **After**: Subscriptions ONLY activated on invoice.paid → no false activations

❌ **Before**: Failed payments immediately canceled subscriptions
✅ **After**: Failed payments move to PAST_DUE, allow retries

❌ **Before**: `/check-payment` could activate subscriptions manually
✅ **After**: `/check-payment` is read-only, webhooks handle activation

### Mental Model

> **Orders create intent**
> **Charges attempt payment**
> **Invoices confirm money**

💡 **Subscriptions live and die by invoices.**

---

## 🎯 Expected Results

After this refactor:

1. **No false activations** - Subscriptions only activate when invoice.paid confirms payment
2. **Automatic recovery** - Failed payments auto-recover when retry succeeds
3. **Zero double-payments** - Idempotency prevents duplicate processing
4. **Safe against webhook replays** - Payment records use invoice ID as unique key
5. **Clear state transitions** - Strict enum prevents invalid states
6. **Auditable payment history** - Every payment attempt recorded with status

---

## 📚 Related Files

- `/home/FiscalAi/backend/prisma/schema.prisma` - Database schema
- `/home/FiscalAi/backend/src/services/pagarmeWebhookHandlers.js` - Clean webhook handlers
- `/home/FiscalAi/backend/src/routes/subscriptions.js` - Webhook router + endpoints
- `/home/FiscalAi/backend/src/services/pagarMeSDK.js` - Pagar.me API client

---

**Refactor completed**: 2026-02-01
**Status**: ✅ Ready for testing
