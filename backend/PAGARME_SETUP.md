# Pagar.me Integration Setup Guide

This guide will help you set up Pagar.me integration for subscription billing.

## 1. Create Pagar.me Account

1. Sign up at [Pagar.me Dashboard](https://dashboard.pagar.me/)
2. Complete account verification
3. Enable subscriptions and recurring billing in settings

## 2. Get API Credentials

1. Log in to Pagar.me Dashboard
2. Navigate to **Settings** → **API Keys**
3. Generate a new API Key (Secret Key)
4. Copy the **API Key** and **Encryption Key** (if needed)
5. Navigate to **Settings** → **Webhooks**
6. Generate a **Webhook Secret** for signature validation

## 3. Configure Environment Variables

Add these variables to your `.env` file:

```env
# Pagar.me Configuration
PAGARME_API_KEY=your-api-key-here
PAGARME_ENCRYPTION_KEY=your-encryption-key-here  # Optional, for card encryption
PAGARME_WEBHOOK_SECRET=your-webhook-secret-here
PAGARME_ENVIRONMENT=sandbox  # or 'production'
```

## 4. Create Subscription Plan

You can create a plan in two ways:

### Option A: Via Pagar.me Dashboard (Recommended)
1. Go to **Plans** in dashboard
2. Create a new plan:
   - Name: "FiscalAI Monthly"
   - Amount: R$ 99.00 (9900 cents)
   - Billing cycle: Monthly (30 days)
   - Payment methods: Credit card, Boleto, PIX
3. Copy the **Plan ID**

### Option B: Via API
```bash
POST /api/subscriptions/create-plan
{
  "name": "FiscalAI Monthly",
  "amount": 9900,  # in cents
  "days": 30
}
```

## 5. Configure Webhook Endpoint

1. In Pagar.me Dashboard, go to **Settings** → **Webhooks**
2. Add webhook URL: `https://your-domain.com/api/subscriptions/webhook`
3. Select events to listen:
   - `subscription.created`
   - `subscription.paid`
   - `subscription.payment_failed`
   - `subscription.canceled`
   - `transaction.paid`
   - `transaction.refused`
4. Save the webhook secret (use it in `PAGARME_WEBHOOK_SECRET`)

## 6. Testing

### Test Customer Creation
```bash
POST /api/subscriptions/create-customer
Authorization: Bearer <token>
{
  "cpf_cnpj": "12345678909",
  "phone": "+5511999998888"
}
```

### Test Subscription Creation
```bash
POST /api/subscriptions/create
Authorization: Bearer <token>
{
  "plan_id": "plan_xxxxx",
  "payment_method": {
    "type": "credit_card",
    "card": {
      "number": "4111111111111111",
      "holder_name": "John Doe",
      "exp_month": 12,
      "exp_year": 2025,
      "cvv": "123"
    }
  }
}
```

### Test Webhook (using ngrok for local development)
```bash
# Install ngrok
npm install -g ngrok

# Start your server
npm run dev

# In another terminal, expose your local server
ngrok http 3000

# Use the ngrok URL in Pagar.me webhook settings
# Example: https://abc123.ngrok.io/api/subscriptions/webhook
```

## 7. Subscription Flow

1. **User Registration**: User signs up (customer creation is optional at this stage)
2. **Customer Creation**: User completes profile with CPF/CNPJ → Creates Pagar.me customer
3. **Subscription**: User selects plan → Creates subscription in Pagar.me
4. **Payment**: Pagar.me processes payment automatically
5. **Webhook**: Payment events trigger webhooks → Update subscription status
6. **Invoice Emission**: On payment approved → Automatically emit NFS-e

## 8. Subscription Statuses

- **trial**: New user (7 days free trial)
- **ativo**: Active paid subscription
- **inadimplente**: Payment failed
- **cancelado**: Subscription canceled

## 9. Access Control

The system includes middleware to restrict access based on subscription status:

- `requireActiveSubscription`: Allows 'ativo' and 'trial' users
- `requirePaidSubscription`: Only allows 'ativo' users

Apply to protected routes:
```javascript
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';

router.get('/protected-route', authenticate, requireActiveSubscription, handler);
```

## 10. Production Checklist

- [ ] Switch `PAGARME_ENVIRONMENT` to `production`
- [ ] Update API keys to production keys
- [ ] Configure production webhook URL
- [ ] Test subscription creation with real cards
- [ ] Verify webhook signature validation
- [ ] Set up monitoring for failed payments
- [ ] Configure email notifications for payment events
- [ ] Test NFS-e emission for subscription payments

## Troubleshooting

### Webhook not receiving events
- Check webhook URL is accessible
- Verify webhook secret matches
- Check Pagar.me dashboard for webhook delivery logs

### Payment failing
- Verify customer has valid payment method
- Check Pagar.me transaction logs
- Ensure subscription plan is active

### NFS-e not emitting
- Verify company is registered in Nuvem Fiscal
- Check company has valid fiscal credentials
- Review error logs for emission failures
