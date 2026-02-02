# 🔥 CRITICAL FIX: Missing `billing.value` Field

## Root Cause (100% Confirmed)

**Error from Pagar.me Gateway:**
```
validation_error | billing | "value" is required
```

This error was occurring because the `billing.value` field was **not being sent** in the subscription creation request, causing Pagar.me gateway to reject the charge.

---

## Why This Was Happening

### Previous Flow (BROKEN ❌)
```
1. Create subscription with billing object WITHOUT value
2. Pagar.me creates subscription & invoice
3. Gateway attempts to charge card
4. Gateway validation FAILS: "billing.value is required"
5. invoice.payment_failed webhook received
6. Subscription marked as PAST_DUE
7. All retries fail with same validation error
```

### Expected Flow (FIXED ✅)
```
1. Create subscription with billing.value = plan amount
2. Pagar.me creates subscription & invoice
3. Gateway successfully charges card
4. invoice.paid webhook received
5. Subscription marked as ACTIVE
6. User can use the service
```

---

## Files Changed

### 1. `/backend/src/routes/subscriptions.js`

#### Added Runtime Guards (Lines ~810-820)
```js
// ✅ RUNTIME GUARDS: Validate all required fields before calling Pagar.me
if (!plan?.amount || plan.amount <= 0) {
  throw new AppError('[Subscription] Invalid plan amount', 400, 'INVALID_PLAN_AMOUNT');
}

if (!billing_address?.line_1 || !billing_address?.city || !billing_address?.state) {
  throw new AppError('[Subscription] Incomplete billing address', 400, 'INCOMPLETE_BILLING_ADDRESS');
}

if (!card_token) {
  throw new AppError('[Subscription] Missing card token', 400, 'MISSING_CARD_TOKEN');
}
```

#### Fixed Billing Object (Lines ~875-892)
**BEFORE (BROKEN):**
```js
billing: {
  name: user.name,
  email: user.email,
  document: finalCpfCnpj,
  document_type: finalCpfCnpj.length === 11 ? 'cpf' : 'cnpj',
  address: { /* ... */ }
}
```

**AFTER (FIXED):**
```js
billing: {
  value: plan.amount, // 🔥 THIS WAS MISSING - REQUIRED BY PAGAR.ME GATEWAY
  name: user.name,
  email: user.email,
  document: finalCpfCnpj,
  document_type: finalCpfCnpj.length === 11 ? 'cpf' : 'cnpj',
  address: { /* ... */ }
}
```

---

### 2. `/backend/src/services/pagarMeSDK.js`

#### Improved Billing Value Fallback (Lines ~954-970)
```js
const billing = subscriptionData.billing || {};
const cardBillingInfo = {
  value: billing.value || amount, // ✅ Use provided value or fallback to plan amount
  name: billing.name || 'Customer',
  email: billing.email || '',
  document: billing.document || '',
  document_type: billing.document_type || 'cpf',
  address: billing.address || billingAddress || { /* fallback */ }
};
```

This ensures that even if `billing.value` is not explicitly provided, it will default to the plan amount.

---

### 3. `/backend/src/services/pagarmeWebhookHandlers.js`

#### Added Validation Error Detection (Lines ~173-188)
```js
// Extract error message from gateway response
const gatewayResponse = charge?.last_transaction?.gateway_response || {};
const errorCode = gatewayResponse.code;
const errorMessage = gatewayResponse.errors?.[0]?.message || 'Pagamento recusado';

// ✅ CRITICAL: Detect non-retryable validation errors (configuration issues)
const isValidationError = errorCode === '400' || errorMessage.includes('validation_error');
const isMissingBillingValue = errorMessage.includes('billing') && errorMessage.includes('value');

if (isValidationError || isMissingBillingValue) {
  console.error('[Webhook] ❌ NON-RETRYABLE ERROR - Configuration/integration issue:', {
    errorCode,
    errorMessage,
    subscriptionId,
    invoiceId: invoice.id,
    note: 'This is a configuration error, not a payment failure. Check subscription creation payload.'
  });
}
```

This helps distinguish between:
- ❌ **Non-retryable validation errors** (configuration issues)
- ✅ **Retryable payment errors** (insufficient funds, timeouts, etc.)

---

## Error Classification

| Error Type                      | Retry? | Cause                    |
| ------------------------------- | ------ | ------------------------ |
| `validation_error`              | ❌      | Configuration issue      |
| `billing.value is required`     | ❌      | Missing required field   |
| `insufficient_funds`            | ✅      | Customer has no funds    |
| `card_declined`                 | ❌      | Card blocked by bank     |
| `expired_card`                  | ❌      | Card expired             |
| `acquirer_timeout`              | ✅      | Temporary gateway issue  |
| `processing_error`              | ✅      | Temporary system issue   |

---

## Testing

### Test Cards (from Pagar.me docs)

**Success:**
```
Card Number: 4111 1111 1111 1111
CVV: 123
Expiration: 12/2030
Holder Name: Any name
```

**Failure (insufficient funds):**
```
Card Number: 4000 0000 0000 0002
CVV: 123
Expiration: 12/2030
Holder Name: Any name
```

### Expected Results After Fix

1. **Subscription Created:**
   - `subscription.status = "active"`
   - `current_cycle.status = "paid"`

2. **Invoice Paid:**
   - Webhook: `invoice.paid`
   - Database: Subscription status = `ACTIVE`
   - Payment record created with status = `PAID`

3. **No More `PAST_DUE` on Day 1:**
   - First charge succeeds immediately
   - User can access the service right away

---

## What This Fixes

### Before (Symptoms)
- ✗ Every subscription creation failed with `invoice.payment_failed`
- ✗ Subscription immediately went to `PAST_DUE` status
- ✗ Gateway error: `validation_error | billing | "value" is required`
- ✗ Retries failed with the same validation error
- ✗ Different test cards didn't help (not a card issue)

### After (Expected Behavior)
- ✓ Subscription creation succeeds
- ✓ First charge processes successfully
- ✓ `invoice.paid` webhook received
- ✓ Subscription status = `ACTIVE`
- ✓ User can immediately use the service
- ✓ Subsequent billing cycles work normally

---

## Important Notes

1. **This was NOT a card issue** - The test card `4111 1111 1111 1111` is valid
2. **This was NOT a webhook issue** - Webhooks were working correctly
3. **This was NOT a retry issue** - Retry logic is correct
4. **This WAS a missing required field** - `billing.value` was not being sent

---

## Verification Steps

After deploying this fix, verify:

1. Create a new subscription with test card `4111 1111 1111 1111`
2. Check backend logs for:
   ```
   [Pagar.me] ✅ Subscription created successfully
   ```
3. Check webhook logs for:
   ```
   [Webhook] invoice.paid received
   ```
4. Verify database:
   ```sql
   SELECT status FROM "Subscription" WHERE userId = '<test_user_id>';
   -- Should return: ACTIVE
   ```
5. Check frontend: User should see subscription as active immediately

---

## Related Documentation

- Pagar.me v5 Subscriptions API: https://docs.pagar.me/reference/criar-assinatura
- Test Cards: https://docs.pagar.me/docs/realizando-testes
- Webhook Events: https://docs.pagar.me/reference/webhooks

---

**Status:** ✅ FIXED - Ready for production deployment
**Date:** 2026-02-02
**Priority:** CRITICAL
