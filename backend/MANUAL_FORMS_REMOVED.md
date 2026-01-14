# Manual Invoice Forms Removal

## Overview

Manual invoice creation has been disabled. All invoice emissions must now go through the AI assistant.

## Changes Made

### Backend Changes

1. **POST /api/invoices** - Disabled
   - Returns 403 error with message directing users to use AI assistant
   - Error code: `MANUAL_CREATION_DISABLED`

2. **POST /api/invoices/issue** - Deprecated
   - Still functional but logs warning
   - Should use `/api/assistant/execute-action` instead
   - Will be removed in future version

3. **POST /api/assistant/execute-action** - New endpoint
   - Executes AI actions (including invoice emission)
   - Calls real Nuvem Fiscal API
   - This is the only way to emit invoices now

### Frontend Changes

1. **Assistant.jsx** - Updated
   - `handleConfirmInvoice()` now uses `assistantService.executeAction()`
   - Calls `/api/assistant/execute-action` instead of `/api/invoices/issue`
   - Emits via real Nuvem Fiscal API

2. **assistantService.ts** - Enhanced
   - Added `executeAction()` method
   - Calls `/api/assistant/execute-action` endpoint

3. **InvoiceConfirmation.jsx** - Status
   - This page appears to be unused or for testing
   - Should be removed or updated to only work with AI flow
   - Currently has hardcoded data (not connected to AI)

## Flow

### Old Flow (Removed)
```
User → Manual Form → POST /api/invoices → Draft Created
User → Manual Form → POST /api/invoices/issue → Invoice Emitted
```

### New Flow (AI-Only)
```
User → AI Command → POST /api/assistant/process → Action Returned
User → Preview → Confirm → POST /api/assistant/execute-action → Real API Emission
```

## Migration Guide

### For Frontend Developers

**Before:**
```javascript
// OLD - Manual creation
await invoicesService.create({
  company_id: company.id,
  cliente_nome: "João Silva",
  // ...
});

// OLD - Manual emission
await invoicesService.issue({
  companyId: company.id,
  cliente_nome: "João Silva",
  // ...
});
```

**After:**
```javascript
// NEW - AI-driven emission
await assistantService.executeAction({
  action_type: 'emitir_nfse',
  action_data: {
    cliente_nome: "João Silva",
    valor: 1500.00,
    // ...
  },
  company_id: company.id
});
```

### For API Consumers

**Before:**
```bash
POST /api/invoices
{
  "company_id": "...",
  "cliente_nome": "...",
  "valor": 1500
}
```

**After:**
```bash
# Step 1: Process AI command
POST /api/assistant/process
{
  "message": "Emitir nota de R$ 1500 para João Silva"
}

# Step 2: Execute action
POST /api/assistant/execute-action
{
  "action_type": "emitir_nfse",
  "action_data": { ... },
  "company_id": "..."
}
```

## Error Handling

### Manual Creation Attempt
```json
{
  "status": "error",
  "message": "Criação manual de notas fiscais foi desabilitada. Use o assistente IA para emitir notas fiscais...",
  "code": "MANUAL_CREATION_DISABLED"
}
```

## Benefits

1. **Consistency**: All invoices go through AI, ensuring consistent format
2. **User Experience**: Natural language interface is more intuitive
3. **Error Prevention**: AI validates and suggests corrections
4. **Audit Trail**: All emissions tracked through AI assistant
5. **Real API Integration**: Direct connection to Nuvem Fiscal

## Testing

### Test AI Emission
1. Go to Assistant page
2. Type: "Emitir nota de R$ 1500 para João Silva"
3. Review preview
4. Click "Confirmar emissão"
5. Verify invoice is emitted via real API

### Test Manual Creation (Should Fail)
```bash
POST /api/invoices
# Expected: 403 MANUAL_CREATION_DISABLED
```

## Next Steps

- [ ] Remove or update InvoiceConfirmation.jsx page
- [ ] Update any remaining references to manual invoice creation
- [ ] Add UI messaging directing users to AI assistant
- [ ] Remove deprecated `/api/invoices/issue` endpoint in future version
