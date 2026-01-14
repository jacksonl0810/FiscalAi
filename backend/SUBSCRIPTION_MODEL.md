# Subscription Database Model

## Overview

The subscription database model has been implemented to support Pagar.me integration for recurring billing. The model consists of two main tables: `Subscription` and `Payment`.

## Database Schema

### Subscription Model

The `Subscription` model tracks user subscriptions with the following fields:

```prisma
model Subscription {
  id                    String    @id @default(uuid())
  userId                String    @unique @map("user_id")
  pagarMeSubscriptionId String    @unique @map("pagar_me_subscription_id")
  pagarMePlanId        String    @map("pagar_me_plan_id")
  status                String    @default("trial") // 'trial', 'ativo', 'inadimplente', 'cancelado'
  currentPeriodStart    DateTime? @map("current_period_start")
  currentPeriodEnd      DateTime? @map("current_period_end")
  canceledAt            DateTime? @map("canceled_at")
  trialEndsAt           DateTime? @map("trial_ends_at")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  // Relations
  user    User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  payments Payment[]

  @@map("subscriptions")
}
```

**Fields:**
- `id`: Unique identifier (UUID)
- `userId`: Foreign key to User (one-to-one relationship)
- `pagarMeSubscriptionId`: Pagar.me subscription ID (unique)
- `pagarMePlanId`: Pagar.me plan ID
- `status`: Subscription status - `'trial'`, `'ativo'`, `'inadimplente'`, `'cancelado'`
- `currentPeriodStart`: Start date of current billing period
- `currentPeriodEnd`: End date of current billing period
- `canceledAt`: Date when subscription was canceled
- `trialEndsAt`: Date when trial period ends
- `createdAt`: Record creation timestamp
- `updatedAt`: Record last update timestamp

### Payment Model

The `Payment` model tracks individual payment transactions:

```prisma
model Payment {
  id                String   @id @default(uuid())
  subscriptionId    String   @map("subscription_id")
  pagarMeTransactionId String @unique @map("pagar_me_transaction_id")
  amount            Decimal  @db.Decimal(15, 2)
  status            String   // 'pending', 'paid', 'failed', 'refunded'
  paymentMethod     String   @map("payment_method") // 'credit_card', 'boleto', 'pix'
  paidAt            DateTime? @map("paid_at")
  failedAt          DateTime? @map("failed_at")
  nfseId            String?  @map("nfse_id") // Link to fiscal invoice
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@map("payments")
}
```

**Fields:**
- `id`: Unique identifier (UUID)
- `subscriptionId`: Foreign key to Subscription (many-to-one relationship)
- `pagarMeTransactionId`: Pagar.me transaction ID (unique)
- `amount`: Payment amount (Decimal with 15 digits, 2 decimal places)
- `status`: Payment status - `'pending'`, `'paid'`, `'failed'`, `'refunded'`
- `paymentMethod`: Payment method - `'credit_card'`, `'boleto'`, `'pix'`
- `paidAt`: Date when payment was completed
- `failedAt`: Date when payment failed
- `nfseId`: Link to fiscal invoice (NFS-e) if emitted
- `createdAt`: Record creation timestamp
- `updatedAt`: Record last update timestamp

### User Model Updates

The `User` model has been updated to include:
- `pagarMeCustomerId`: Pagar.me customer ID (optional)
- `cpfCnpj`: User's CPF or CNPJ (optional)
- `subscription`: One-to-one relationship with Subscription

## Relationships

```
User (1) ──< (1) Subscription (1) ──< (N) Payment
```

- One User can have one Subscription
- One Subscription can have many Payments
- When a User is deleted, their Subscription is also deleted (Cascade)
- When a Subscription is deleted, all related Payments are also deleted (Cascade)

## Status Values

### Subscription Status
- **`trial`**: User is in trial period (7 days for new users)
- **`ativo`**: Active paid subscription
- **`inadimplente`**: Payment failed, subscription is delinquent
- **`cancelado`**: Subscription has been canceled

### Payment Status
- **`pending`**: Payment is being processed
- **`paid`**: Payment was successful
- **`failed`**: Payment failed
- **`refunded`**: Payment was refunded

## Database Tables

The schema has been pushed to the database. The following tables have been created:

- `subscriptions` - Stores subscription records
- `payments` - Stores payment transaction records

## Usage Examples

### Create Subscription
```javascript
const subscription = await prisma.subscription.create({
  data: {
    userId: user.id,
    pagarMeSubscriptionId: 'sub_xxxxx',
    pagarMePlanId: 'plan_xxxxx',
    status: 'ativo',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
});
```

### Create Payment
```javascript
const payment = await prisma.payment.create({
  data: {
    subscriptionId: subscription.id,
    pagarMeTransactionId: 'trans_xxxxx',
    amount: 99.00,
    status: 'paid',
    paymentMethod: 'credit_card',
    paidAt: new Date()
  }
});
```

### Get User Subscription
```javascript
const subscription = await prisma.subscription.findUnique({
  where: { userId: user.id },
  include: {
    payments: {
      orderBy: { createdAt: 'desc' },
      take: 10
    }
  }
});
```

## Migration Status

✅ **Schema defined** in `prisma/schema.prisma`  
✅ **Prisma Client generated**  
✅ **Database tables created** via `prisma db push`

The subscription database model is now fully implemented and ready to use with the Pagar.me integration.
