# AI-Driven Invoice Emission Implementation

## Overview

The AI-driven invoice emission is now fully connected to the real Nuvem Fiscal API. Users can emit invoices through natural language commands, with a preview and confirmation flow before actual emission.

## Flow

### 1. User Command
User sends a natural language command to the AI assistant:
```
"Emitir nota de R$ 1.500 para João Silva"
```

### 2. AI Processing
- AI assistant (`/api/assistant/process`) interprets the command
- Returns structured JSON with action type and data
- Includes explanation and confirmation requirement

**Response:**
```json
{
  "success": true,
  "action": {
    "type": "emitir_nfse",
    "data": {
      "cliente_nome": "João Silva",
      "cliente_documento": "",
      "descricao_servico": "Serviço prestado",
      "valor": 1500.00,
      "aliquota_iss": 5,
      "municipio": "",
      "codigo_servico": "1401"
    }
  },
  "explanation": "Entendi! Vou preparar uma nota fiscal de R$ 1.500,00 para João Silva. Por favor, confirme os dados antes de emitir.",
  "requiresConfirmation": true
}
```

### 3. Preview & Confirmation
- Frontend displays preview of invoice data
- User can review and edit before confirming
- User clicks "Confirmar Emissão"

### 4. Real API Emission
- Frontend calls `/api/assistant/execute-action` with action data
- Backend validates data and company registration
- **Calls real Nuvem Fiscal API** via `emitNfse()` function
- Saves invoice to database with real NFS-e data
- Creates success notification

### 5. Result
- Invoice is emitted in Nuvem Fiscal
- Invoice record saved with:
  - Real NFS-e number
  - Verification code
  - PDF and XML URLs
  - Status from Nuvem Fiscal

## API Endpoints

### POST /api/assistant/process
Processes AI command and returns action structure.

**Request:**
```json
{
  "message": "Emitir nota de R$ 1500 para João Silva",
  "companyId": "company-uuid",
  "conversationHistory": []
}
```

**Response:**
```json
{
  "success": true,
  "action": {
    "type": "emitir_nfse",
    "data": { ... }
  },
  "explanation": "...",
  "requiresConfirmation": true
}
```

### POST /api/assistant/execute-action
Executes the AI action (emits invoice via real API).

**Request:**
```json
{
  "action_type": "emitir_nfse",
  "action_data": {
    "cliente_nome": "João Silva",
    "cliente_documento": "123.456.789-00",
    "descricao_servico": "Consultoria em marketing",
    "valor": 1500.00,
    "aliquota_iss": 5,
    "municipio": "São Paulo",
    "codigo_servico": "1401"
  },
  "company_id": "company-uuid"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Nota fiscal emitida com sucesso via IA",
  "data": {
    "invoice": {
      "id": "invoice-uuid",
      "numero": "12345",
      "status": "autorizada",
      "codigo_verificacao": "abc123",
      "pdf_url": "https://...",
      "xml_url": "https://...",
      "cliente_nome": "João Silva",
      "valor": 1500.00
    }
  }
}
```

## Implementation Details

### Backend Functions

#### `executeEmitNfse()`
- Validates invoice data
- Checks company registration in Nuvem Fiscal
- Calls `emitNfse()` from `nuvemFiscal.js` service
- Saves invoice to database
- Creates notifications
- Returns invoice data

#### `executeCheckStatus()`
- Finds invoice by ID or number
- Calls `checkNfseStatus()` from Nuvem Fiscal API
- Updates invoice status in database
- Returns current status

#### `executeCheckConnection()`
- Checks fiscal connection via Nuvem Fiscal API
- Updates fiscal integration status
- Returns connection status

### Real API Integration

The emission uses the real Nuvem Fiscal API:

1. **Authentication**: OAuth 2.0 with client credentials
2. **Endpoint**: `POST /empresas/{nuvemFiscalId}/nfse`
3. **Data Format**: Mapped to Nuvem Fiscal NFS-e format
4. **Response**: Real NFS-e number, verification code, PDF/XML URLs

### Error Handling

- **Company not registered**: Returns error with message to register first
- **Invalid data**: Validation errors with specific field messages
- **API errors**: Catches Nuvem Fiscal API errors and returns user-friendly messages
- **Notifications**: Creates error notifications for failed emissions

## Frontend Integration

The frontend should:

1. Call `/api/assistant/process` with user message
2. Display preview when `requiresConfirmation: true`
3. Allow user to edit invoice data
4. Call `/api/assistant/execute-action` on confirmation
5. Display success/error messages
6. Navigate to invoice list on success

## Testing

### Test AI Command Processing
```bash
POST /api/assistant/process
{
  "message": "Emitir nota de R$ 1500 para João Silva",
  "companyId": "company-uuid"
}
```

### Test Action Execution
```bash
POST /api/assistant/execute-action
{
  "action_type": "emitir_nfse",
  "action_data": {
    "cliente_nome": "João Silva",
    "valor": 1500.00,
    "descricao_servico": "Serviço prestado"
  },
  "company_id": "company-uuid"
}
```

## Requirements

- Company must be registered in Nuvem Fiscal (`nuvemFiscalId` must exist)
- User must have active subscription
- Valid invoice data (cliente_nome, valor required)
- Nuvem Fiscal credentials configured in environment

## Status

✅ **AI command processing** - Working  
✅ **Action structure** - Working  
✅ **Preview/confirmation flow** - Working  
✅ **Real API emission** - **IMPLEMENTED**  
✅ **Database persistence** - Working  
✅ **Error handling** - Working  
✅ **Notifications** - Working  

The AI-driven invoice emission is now fully connected to the real Nuvem Fiscal API!
