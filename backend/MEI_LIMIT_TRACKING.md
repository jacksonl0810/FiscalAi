# MEI Limit Tracking

## Overview

MEI (Microempreendedor Individual) has an annual revenue limit of R$ 81.000. This service monitors revenue against this limit and creates automatic alerts when approaching or exceeding the limit.

## Implementation

### Backend Service

**File:** `backend/src/services/meiLimitTracking.js`

**Functions:**

1. **`calculateYearlyRevenue(companyId, year)`**
   - Calculates total revenue for a company in a given year
   - Only counts invoices with status 'autorizada' or 'enviada'
   - Returns total revenue as number

2. **`checkMEILimit(companyId, userId)`**
   - Checks if company is MEI
   - Calculates yearly revenue
   - Determines alert level based on percentage
   - Creates notifications when thresholds are reached
   - Returns detailed limit status

3. **`getMEILimitStatus(companyId)`**
   - Public function to get limit status
   - Returns null if company is not MEI
   - Returns limit status object if MEI

### Alert Levels

**Exceeded (>100%)**
- Status: `exceeded`
- Notification Type: `erro`
- Message: "⚠️ ATENÇÃO: Você ultrapassou o limite anual do MEI..."
- Action: Immediate notification

**Critical (90-100%)**
- Status: `critical`
- Notification Type: `alerta`
- Message: "🚨 ATENÇÃO: Você está muito próximo do limite..."
- Action: Immediate notification

**Warning (70-90%)**
- Status: `warning`
- Notification Type: `info`
- Message: "💡 Aviso: Você já utilizou X% do limite..."
- Action: Immediate notification

**Info (50-70%)**
- Status: `info`
- Notification Type: None
- Action: Tracked but no notification

**OK (<50%)**
- Status: `ok`
- Notification Type: None
- Action: No action needed

### API Endpoint

**GET /api/companies/:id/mei-limit-status**

**Authentication:** Required (JWT)

**Subscription:** Requires active subscription

**Response:**
```json
{
  "status": "success",
  "message": "MEI limit status retrieved successfully",
  "data": {
    "isMEI": true,
    "yearlyRevenue": 65000.00,
    "limit": 81000,
    "percentage": 80.25,
    "remaining": 16000.00,
    "alertLevel": "warning",
    "status": "warning"
  }
}
```

**Response (Not MEI):**
```json
{
  "status": "success",
  "message": "Company is not MEI",
  "data": {
    "isMEI": false
  }
}
```

### Automatic Tracking

**After Invoice Emission:**
- When an invoice is emitted via AI assistant
- `checkMEILimit()` is called automatically
- Creates notification if threshold reached
- Does not block invoice emission if limit check fails

**Notification Deduplication:**
- Checks for recent notifications (last 24 hours)
- Prevents spam by not creating duplicate notifications
- Only creates new notification if none exists for the alert level

### Frontend Integration

**Dashboard Component:**
- Fetches MEI limit status from backend
- Displays `MEILimitBar` component for MEI companies
- Shows real-time revenue tracking
- Displays alerts based on status

**MEILimitBar Component:**
- Visual progress bar
- Color-coded status (green/yellow/red)
- Shows percentage, revenue, and remaining
- Displays warning messages at thresholds

### Database Integration

**Revenue Calculation:**
- Queries `Invoice` table
- Filters by:
  - Company ID
  - Status: 'autorizada' or 'enviada'
  - Year: Current year (or specified)
- Sums all invoice values

**Notifications:**
- Creates entries in `Notification` table
- Links to user (not company)
- Includes alert level in message
- Timestamped for tracking

## Usage Examples

### Check Limit After Invoice Emission

```javascript
// In assistant.js after invoice emission
await checkMEILimit(company.id, userId);
```

### Get Limit Status for Dashboard

```javascript
// In companies.js
const limitStatus = await getMEILimitStatus(companyId);
```

### Frontend Query

```javascript
const { data: meiLimitStatus } = useQuery({
  queryKey: ['meiLimitStatus', companyId],
  queryFn: () => companiesService.getMEILimitStatus(companyId),
  enabled: !!companyId && company.regime_tributario === 'MEI',
});
```

## Configuration

**MEI Annual Limit:**
- Current: R$ 81.000
- Configurable in `meiLimitTracking.js`
- Constant: `MEI_ANNUAL_LIMIT`

**Alert Thresholds:**
- Critical: 90%
- Warning: 70%
- Info: 50%

## Benefits

1. **Proactive Alerts**: Users warned before exceeding limit
2. **Automatic Tracking**: No manual calculation needed
3. **Real-time Updates**: Status updated after each invoice
4. **Smart Notifications**: Prevents notification spam
5. **Accurate Calculation**: Only counts authorized invoices

## Future Enhancements

- [ ] Monthly limit tracking (R$ 6.750/month)
- [ ] Projection based on current rate
- [ ] Email notifications for critical alerts
- [ ] Migration suggestions to Simples Nacional
- [ ] Historical limit tracking
- [ ] Multiple year support
- [ ] Export limit reports
