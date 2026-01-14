# Subscription Access Control Implementation

## Overview

The application implements subscription-based access control to restrict features based on user subscription status. This ensures that only users with active subscriptions (or valid trial periods) can access premium features.

## Subscription Statuses

### Active Statuses (Allowed Access)
- **`ativo`**: Active paid subscription - Full access
- **`trial`**: Trial period - Full access (limited time)

### Restricted Statuses (Blocked Access)
- **`inadimplente`**: Payment failed - Access blocked
- **`cancelado`**: Subscription canceled - Access blocked
- **`null`**: No subscription - Trial period check (7 days from registration)

## Middleware Functions

### 1. `requireActiveSubscription`

Allows access for users with `ativo` or `trial` status. Blocks access for `inadimplente`, `cancelado`, or expired trial.

**Usage:**
```javascript
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';

// Apply to all routes in a router
router.use(requireActiveSubscription);

// Apply to specific route
router.get('/protected-route', requireActiveSubscription, handler);
```

**Behavior:**
- Checks if user has subscription
- If no subscription: Allows 7-day trial from registration date
- If subscription exists: Checks status
  - `ativo` or `trial`: Allows access
  - `trial` with expired `trialEndsAt`: Blocks access
  - `inadimplente`: Blocks with payment update message
  - `cancelado`: Blocks with reactivation message

**Error Responses:**
- `403 SUBSCRIPTION_REQUIRED`: No subscription and trial expired
- `403 TRIAL_EXPIRED`: Trial period expired
- `403 SUBSCRIPTION_DELINQUENT`: Payment failed
- `403 SUBSCRIPTION_CANCELED`: Subscription canceled
- `403 SUBSCRIPTION_INVALID`: Invalid subscription status

### 2. `requirePaidSubscription`

Only allows access for users with `ativo` status (blocks trial users).

**Usage:**
```javascript
import { requirePaidSubscription } from '../middleware/subscriptionAccess.js';

router.get('/premium-feature', requirePaidSubscription, handler);
```

**Behavior:**
- Only allows `ativo` status
- Blocks all other statuses including `trial`

**Error Response:**
- `403 PAID_SUBSCRIPTION_REQUIRED`: Subscription not active

## Protected Routes

The following routes require active subscription:

### Invoices (`/api/invoices/*`)
- **All invoice operations** require active subscription
- Creating, viewing, updating, deleting invoices
- Issuing NFS-e
- Checking invoice status
- Canceling invoices

**Applied to:** All routes in `backend/src/routes/invoices.js`

### AI Assistant (`/api/assistant/*`)
- **All AI assistant features** require active subscription
- Processing commands
- Getting suggestions

**Applied to:** All routes in `backend/src/routes/assistant.js`

### Companies (`/api/companies/*`)
- **All company operations** require active subscription
- Creating, updating, deleting companies
- Registering companies in Nuvem Fiscal
- Checking fiscal connection status

**Applied to:** All routes in `backend/src/routes/companies.js`

### Taxes/DAS (`/api/taxes/*`)
- **All tax operations** require active subscription
- Viewing DAS payments
- Generating DAS
- Tax summaries

**Applied to:** All routes in `backend/src/routes/taxes.js`

## Public Routes (No Subscription Required)

The following routes are accessible without active subscription:

### Authentication (`/api/auth/*`)
- Login, register, logout
- Token refresh
- Profile management

### Subscriptions (`/api/subscriptions/*`)
- Creating customer
- Creating subscription
- Viewing current subscription
- Canceling subscription
- **Note:** Webhook endpoint is public (no auth)

### Settings (`/api/settings/*`)
- Viewing and updating user settings
- Changing active company

### Notifications (`/api/notifications/*`)
- Viewing notifications
- Marking as read

## Trial Period Logic

### New Users (No Subscription)
- **Trial Duration:** 7 days from registration date
- **Access:** Full access during trial period
- **After Trial:** Must subscribe to continue

### Trial Subscription Status
- **Trial Duration:** Based on `trialEndsAt` field
- **Access:** Full access until `trialEndsAt` date
- **After Trial:** Must upgrade to `ativo` status

## Error Messages

All error messages are in Portuguese (Brazil):

| Error Code | Message |
|------------|---------|
| `SUBSCRIPTION_REQUIRED` | "Assinatura necessária para acessar este recurso. Por favor, assine um plano." |
| `TRIAL_EXPIRED` | "Período de teste expirado. Por favor, assine um plano." |
| `SUBSCRIPTION_DELINQUENT` | "Sua assinatura está inadimplente. Por favor, atualize seu método de pagamento." |
| `SUBSCRIPTION_CANCELED` | "Sua assinatura foi cancelada. Por favor, reative sua assinatura." |
| `SUBSCRIPTION_INVALID` | "Assinatura inválida. Por favor, entre em contato com o suporte." |
| `PAID_SUBSCRIPTION_REQUIRED` | "Assinatura ativa necessária para acessar este recurso." |

## Implementation Example

### Route Protection
```javascript
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscriptionAccess.js';

const router = express.Router();

// Apply to all routes
router.use(authenticate);
router.use(requireActiveSubscription);

// Or apply to specific routes
router.get('/public', handler); // No subscription required
router.get('/protected', requireActiveSubscription, handler); // Subscription required
```

### Conditional Protection
```javascript
// Some routes public, some protected
router.get('/public-route', authenticate, handler);
router.post('/protected-route', authenticate, requireActiveSubscription, handler);
```

### Premium Features
```javascript
import { requirePaidSubscription } from '../middleware/subscriptionAccess.js';

// Only paid subscribers (not trial)
router.get('/premium-feature', authenticate, requirePaidSubscription, handler);
```

## Testing Access Control

### Test Trial User
```bash
# User registered 3 days ago, no subscription
# Should have access (within 7-day trial)
GET /api/invoices
# Expected: 200 OK
```

### Test Expired Trial
```bash
# User registered 10 days ago, no subscription
# Should be blocked (trial expired)
GET /api/invoices
# Expected: 403 SUBSCRIPTION_REQUIRED
```

### Test Active Subscription
```bash
# User with status='ativo'
GET /api/invoices
# Expected: 200 OK
```

### Test Delinquent Subscription
```bash
# User with status='inadimplente'
GET /api/invoices
# Expected: 403 SUBSCRIPTION_DELINQUENT
```

### Test Canceled Subscription
```bash
# User with status='cancelado'
GET /api/invoices
# Expected: 403 SUBSCRIPTION_CANCELED
```

## Frontend Integration

The frontend should handle 403 errors and redirect users to subscription page:

```javascript
// Example error handling
try {
  const response = await fetch('/api/invoices');
  if (!response.ok) {
    if (response.status === 403) {
      const error = await response.json();
      if (error.code === 'SUBSCRIPTION_REQUIRED' || 
          error.code === 'TRIAL_EXPIRED' ||
          error.code === 'SUBSCRIPTION_DELINQUENT' ||
          error.code === 'SUBSCRIPTION_CANCELED') {
        // Redirect to subscription page
        window.location.href = '/subscription';
      }
    }
  }
} catch (error) {
  // Handle error
}
```

## Best Practices

1. **Always apply authentication first** before subscription middleware
2. **Use `requireActiveSubscription`** for most protected routes
3. **Use `requirePaidSubscription`** only for premium features that should exclude trial users
4. **Handle errors gracefully** in frontend with appropriate user messages
5. **Log access attempts** for monitoring and analytics
6. **Test all subscription statuses** during development

## Monitoring

Monitor the following metrics:
- Access denied rate by subscription status
- Trial conversion rate
- Subscription status distribution
- Error rates by error code

## Future Enhancements

- [ ] Feature-based access control (different features for different plans)
- [ ] Usage limits (e.g., X invoices per month)
- [ ] Grace period for delinquent subscriptions
- [ ] Admin override for support purposes
- [ ] Access control logging and analytics
