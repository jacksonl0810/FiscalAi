# Testing Guide: Invoice Cancellation Service

## Prerequisites

Before testing cancellation, you need:

1. **An authorized invoice** (`status: 'autorizada'`)
   - Can be created via AI Assistant or Documents page
   - Must be within the cancellation time limit (24-120 hours depending on municipality)

2. **Company setup**
   - Company registered in Nuvem Fiscal
   - Digital certificate uploaded
   - Fiscal connection verified

## Test Scenarios

### 1. Test via UI (Documents Page)

#### Step 1: Create an Authorized Invoice
1. Go to AI Assistant or Documents page
2. Create a new invoice
3. Wait for it to be authorized (or use a recent authorized invoice)

#### Step 2: Test Cancellation
1. Navigate to **Documents** page (`/documents`)
2. Find an invoice with status **"Autorizada"**
3. Click the **red cancel icon** (FileX) next to the invoice
4. The cancellation modal should open

#### Step 3: Check Cancellation Info
- Modal should display:
  - ✅ Deadline countdown (hours remaining)
  - ✅ Municipality rules
  - ✅ Warnings (if approaching deadline)

#### Step 4: Enter Cancellation Reason
1. Type a reason (minimum 15 characters)
   - ✅ Valid: "Erro no cadastro do cliente, necessário corrigir dados"
   - ❌ Invalid: "Erro" (too short)
2. Character counter should show progress
3. "Confirmar Cancelamento" button should be enabled when valid

#### Step 5: Confirm Cancellation
1. Click "Confirmar Cancelamento"
2. Should see success toast notification
3. Invoice status should change to "Cancelada"
4. Notification should be created

### 2. Test via AI Assistant

#### Test Case 1: Cancel with Invoice Number
```
User: "Cancelar nota 12345"
AI: "Para cancelar a nota fiscal #12345, preciso que você informe o motivo do cancelamento (mínimo 15 caracteres). Por favor, descreva o motivo."
User: "Erro no cadastro do cliente, necessário corrigir os dados"
AI: [Executes cancellation]
```

#### Test Case 2: Cancel without Invoice Number
```
User: "Como cancelar uma nota fiscal?"
AI: [Provides guidance to UI]
```

### 3. Test Edge Cases

#### Test Case 1: Time Limit Exceeded
1. Find or create an invoice older than the municipality limit
2. Try to cancel
3. **Expected**: Error message "O prazo para cancelamento expirou"

#### Test Case 2: Invalid Status
1. Try to cancel a "Rejeitada" or "Processando" invoice
2. **Expected**: Error "Notas com status X não podem ser canceladas"

#### Test Case 3: Already Cancelled
1. Cancel an invoice successfully
2. Try to cancel it again
3. **Expected**: Error "Esta nota fiscal já foi cancelada"

#### Test Case 4: Short Justification
1. Try to cancel with reason < 15 characters
2. **Expected**: Validation error "O motivo deve ter pelo menos 15 caracteres"

#### Test Case 5: Approaching Deadline (80% threshold)
1. Create invoice close to deadline (within 20% of time limit)
2. **Expected**: Warning message "Atenção: Restam apenas X hora(s)"

### 4. Manual API Testing

#### Test Cancellation Info Endpoint
```bash
# Get cancellation info
curl -X GET "http://localhost:3000/api/invoices/{invoice_id}/cancellation-info" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "canCancel": true,
    "deadline": "25/01/2025 14:30:00",
    "hoursRemaining": 12,
    "isExpired": false,
    "rules": {
      "maxHoursAfterEmission": 48,
      "requiresJustification": true,
      "municipalityNotes": "São Paulo permite cancelamento em até 48 horas"
    },
    "warnings": []
  }
}
```

#### Test Cancellation Endpoint
```bash
# Cancel invoice
curl -X POST "http://localhost:3000/api/invoices/{invoice_id}/cancel" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Erro no cadastro do cliente, necessário corrigir dados"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Nota fiscal cancelada com sucesso",
  "data": {
    "invoice_id": "...",
    "numero": "12345",
    "status": "cancelada",
    "warnings": []
  }
}
```

### 5. Database Verification

After cancellation, verify:

#### Check Invoice Status
```sql
SELECT id, numero, status, data_emissao, updated_at 
FROM "Invoice" 
WHERE id = '{invoice_id}';
```
- `status` should be `'cancelada'`
- `updated_at` should be recent

#### Check Status History
```sql
SELECT * FROM "InvoiceStatusHistory" 
WHERE "invoiceId" = '{invoice_id}' 
ORDER BY "createdAt" DESC;
```
- Should have entry with `status: 'cancelada'`
- `message` should contain cancellation reason
- `metadata` should contain cancellation details

#### Check Notifications
```sql
SELECT * FROM "Notification" 
WHERE "invoiceId" = '{invoice_id}' 
ORDER BY "created_at" DESC;
```
- Should have notification with `tipo: 'info'`
- `titulo: 'Nota Fiscal Cancelada'`
- `mensagem` should contain cancellation details

### 6. Municipality-Specific Testing

Test different municipalities with different time limits:

| Municipality | IBGE Code | Time Limit | Test Invoice Age |
|-------------|-----------|------------|------------------|
| São Paulo | 3550308 | 48 hours | Create invoice 30 hours ago |
| Rio de Janeiro | 3304557 | 72 hours | Create invoice 60 hours ago |
| Belo Horizonte | 3106200 | 24 hours | Create invoice 20 hours ago |
| Porto Alegre | 4314902 | 120 hours | Create invoice 100 hours ago |

### 7. Backend Logs Verification

Check console logs for:

1. **Cancellation Info Request:**
```
[Invoice] Checking cancellation info for invoice: {invoice_id}
[Cancellation] Validation result: {canCancel: true, ...}
```

2. **Cancellation Attempt:**
```
[Invoice] Canceling invoice: {invoice_id}
[NuvemFiscal] Canceling NFS-e: {nfse_id}
[Invoice] Invoice canceled successfully
```

3. **Error Cases:**
```
[Cancellation] Validation failed: TIME_LIMIT_EXCEEDED
[Invoice] Cancellation not allowed: {reason}
```

### 8. Frontend Console Verification

Open browser DevTools and check:

1. **Network Tab:**
   - `GET /api/invoices/{id}/cancellation-info` - 200 OK
   - `POST /api/invoices/{id}/cancel` - 200 OK

2. **Console Tab:**
   - No error messages
   - Success toast notifications

### 9. Quick Test Checklist

- [ ] Can see cancel button on authorized invoices
- [ ] Modal opens with cancellation info
- [ ] Deadline countdown displays correctly
- [ ] Reason validation works (15+ characters)
- [ ] Cancellation succeeds with valid reason
- [ ] Invoice status updates to "cancelada"
- [ ] Notification is created
- [ ] Error messages are translated (Portuguese)
- [ ] Time limit validation works
- [ ] Status validation works (only authorized)
- [ ] Already cancelled check works
- [ ] Warning appears when approaching deadline

### 10. Common Issues & Solutions

#### Issue: "Cancelamento não permitido" immediately
**Solution:** Check invoice status - must be `'autorizada'`

#### Issue: "Prazo expirado" for new invoice
**Solution:** Check `data_emissao` - might be set incorrectly in database

#### Issue: Nuvem Fiscal API error
**Solution:** 
- Check if `nuvemFiscalId` exists on invoice
- Check if company has `nuvemFiscalId`
- Verify Nuvem Fiscal API is accessible

#### Issue: Modal doesn't show deadline
**Solution:** Check backend logs for cancellation info endpoint errors

## Testing Commands

### Create Test Invoice (via API)
```bash
curl -X POST "http://localhost:3000/api/invoices" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_nome": "Test Client",
    "cliente_documento": "123.456.789-00",
    "descricao_servico": "Test service",
    "valor": 100.00,
    "aliquota_iss": 5,
    "municipio": "São Paulo",
    "codigo_servico": "1401"
  }'
```

### Update Invoice Status to "autorizada" (for testing)
```sql
UPDATE "Invoice" 
SET status = 'autorizada', 
    "dataEmissao" = NOW() - INTERVAL '10 hours'
WHERE id = '{invoice_id}';
```

## Success Criteria

✅ Cancellation works for authorized invoices within time limit
✅ Validation prevents invalid cancellations
✅ Error messages are user-friendly and translated
✅ Status history is logged correctly
✅ Notifications are created
✅ UI updates reflect cancellation status
✅ AI assistant can handle cancellation requests
