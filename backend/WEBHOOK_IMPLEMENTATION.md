# Pagar.me Webhook Implementation

## Overview

The webhook implementation handles all Pagar.me payment and subscription events, ensuring reliable processing with proper error handling, idempotency, and logging.

## Webhook Endpoint

**URL:** `POST /api/subscriptions/webhook`

**Authentication:** None (publicly accessible, secured by signature validation)

## Security

### Signature Validation

All webhook requests are validated using HMAC SHA256 signature:

1. Pagar.me sends signature in header: `x-hub-signature-256`
2. Format: `sha256=<hash>` or just the hash
3. Signature is calculated using: `HMAC-SHA256(webhook_secret, payload)`
4. Validation uses timing-safe comparison to prevent timing attacks

**Environment Variable:**
```env
PAGARME_WEBHOOK_SECRET=your-webhook-secret-here
```

## Supported Events

### 1. subscription.created

Triggered when a new subscription is created in Pagar.me.

**Handler:** `handleSubscriptionCreated()`

**Actions:**
- Creates or updates subscription record in database
- Maps Pagar.me subscription ID to user
- Sets subscription status based on Pagar.me status
- Stores billing period dates

**Event Data:**
```json
{
  "type": "subscription.created",
  "id": "event_xxxxx",
  "data": {
    "id": "sub_xxxxx",
    "customer": {
      "external_id": "user-uuid"
    },
    "plan": {
      "id": "plan_xxxxx"
    },
    "status": "paid",
    "current_period_start": 1234567890,
    "current_period_end": 1234567890
  }
}
```

### 2. subscription.paid / transaction.paid

Triggered when a subscription payment is successfully processed.

**Handler:** `handlePaymentApproved()`

**Actions:**
- Updates subscription status to `ativo`
- Creates payment record with status `paid`
- Updates billing period dates
- Creates success notification
- **Automatically emits NFS-e** for the payment

**Idempotency:** Checks if payment already exists to prevent duplicate processing

**Event Data:**
```json
{
  "type": "transaction.paid",
  "id": "event_xxxxx",
  "data": {
    "id": "trans_xxxxx",
    "subscription_id": "sub_xxxxx",
    "amount": 9900,
    "payment_method": "credit_card",
    "date_created": 1234567890
  }
}
```

### 3. subscription.payment_failed / transaction.refused

Triggered when a subscription payment fails.

**Handler:** `handlePaymentFailed()`

**Actions:**
- Updates subscription status to `inadimplente`
- Creates payment record with status `failed`
- Creates error notification with failure reason
- Logs failure details

**Event Data:**
```json
{
  "type": "transaction.refused",
  "id": "event_xxxxx",
  "data": {
    "id": "trans_xxxxx",
    "subscription_id": "sub_xxxxx",
    "amount": 9900,
    "refuse_reason": "insufficient_funds"
  }
}
```

### 4. subscription.canceled

Triggered when a subscription is canceled.

**Handler:** `handleSubscriptionCanceled()`

**Actions:**
- Updates subscription status to `cancelado`
- Sets cancellation date
- Creates info notification

**Event Data:**
```json
{
  "type": "subscription.canceled",
  "id": "event_xxxxx",
  "data": {
    "id": "sub_xxxxx",
    "canceled_at": 1234567890
  }
}
```

### 5. subscription.updated

Triggered when subscription details are updated (plan changes, etc.).

**Handler:** `handleSubscriptionUpdated()`

**Actions:**
- Updates subscription fields (status, billing periods)
- Logs changes

## Idempotency

The webhook implementation includes idempotency checks:

1. **Payment Processing:** Checks if payment with same `pagarMeTransactionId` already exists
2. **Database Constraints:** Unique constraints prevent duplicate records
3. **Status Checks:** Verifies current status before updating

## Error Handling

### Response Codes

- **200 OK:** Webhook processed successfully (or acknowledged even if error)
- **400 Bad Request:** Invalid JSON payload
- **401 Unauthorized:** Invalid webhook signature

### Error Logging

All errors are logged with:
- Event ID
- Event type
- Error message and stack trace
- Processing time
- Event data (for debugging)

### Retry Logic

Pagar.me will automatically retry failed webhooks. The implementation:
- Returns 200 for most errors to prevent infinite retries
- Logs errors for manual investigation
- In production, consider implementing a dead letter queue

## Logging

All webhook events are logged with structured logging:

```
[Webhook] Received event: event_xxxxx
[Webhook] Processing event: subscription.paid
[Webhook] Event processed successfully: subscription.paid (processingTime: 150ms)
```

## Automatic NFS-e Emission

When a payment is approved (`transaction.paid`), the system automatically:

1. Finds user's active company
2. Emits NFS-e for the subscription payment
3. Links payment to NFS-e via `nfseId` field
4. Creates success notification

**Note:** If NFS-e emission fails, the payment is still recorded as successful. The error is logged for manual retry.

## Testing

### Local Development with ngrok

1. Start your server:
   ```bash
   npm run dev
   ```

2. Expose local server with ngrok:
   ```bash
   ngrok http 3000
   ```

3. Configure webhook in Pagar.me Dashboard:
   - URL: `https://your-ngrok-url.ngrok.io/api/subscriptions/webhook`
   - Events: Select all subscription and transaction events

4. Test with Pagar.me test cards or webhook simulator

### Manual Testing

You can test webhook processing by sending POST requests:

```bash
curl -X POST http://localhost:3000/api/subscriptions/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=<calculated-signature>" \
  -d '{
    "type": "transaction.paid",
    "id": "test_event_123",
    "data": {
      "id": "trans_test_123",
      "subscription_id": "sub_test_123",
      "amount": 9900,
      "payment_method": "credit_card"
    }
  }'
```

## Monitoring

### Key Metrics to Monitor

1. **Webhook Success Rate:** Percentage of successfully processed events
2. **Processing Time:** Average time to process each event
3. **Error Rate:** Number of failed webhook processings
4. **Payment Processing:** Success/failure rate of payments
5. **NFS-e Emission:** Success rate of automatic invoice emission

### Recommended Alerts

- High error rate (>5%)
- Slow processing time (>1 second)
- Payment failures
- NFS-e emission failures

## Production Checklist

- [ ] Webhook secret configured in environment variables
- [ ] Webhook URL configured in Pagar.me Dashboard
- [ ] All required events subscribed
- [ ] Error logging and monitoring set up
- [ ] Dead letter queue for failed events (optional)
- [ ] Rate limiting configured (if needed)
- [ ] Webhook endpoint accessible from internet
- [ ] SSL/TLS enabled (HTTPS)
- [ ] Idempotency verified
- [ ] Tested with real Pagar.me events

## Troubleshooting

### Webhook not receiving events
- Check webhook URL is accessible
- Verify events are subscribed in Pagar.me Dashboard
- Check server logs for incoming requests

### Invalid signature errors
- Verify `PAGARME_WEBHOOK_SECRET` matches Pagar.me configuration
- Check signature header name (`x-hub-signature-256`)
- Ensure raw body is used (not parsed JSON)

### Duplicate processing
- Check idempotency logic
- Verify database constraints
- Review event IDs in logs

### Payment not updating
- Check event type matches handler
- Verify subscription exists in database
- Review error logs for processing failures
