# Real Fiscal Connection Verification

## Overview

Fiscal connection verification is now fully implemented with real API calls to Nuvem Fiscal. The system verifies that companies are properly registered and can communicate with the fiscal authority.

## Implementation

### Backend Service (`nuvemFiscal.js`)

**Function:** `checkConnection(nuvemFiscalId)`

**Verification Steps:**

1. **OAuth Token Validation**
   - Verifies that OAuth credentials are valid
   - Obtains access token using client_credentials flow
   - Returns error if credentials are invalid

2. **Company Existence Check**
   - Fetches company data from Nuvem Fiscal API
   - Verifies company exists with the provided ID
   - Handles 404 (not found) and 401/403 (auth) errors

3. **Data Structure Validation**
   - Validates that API response contains expected company data
   - Checks for CNPJ or ID in response

4. **Status Verification**
   - Checks if company is active/enabled
   - Identifies inactive states: 'inativo', 'suspenso', 'cancelado', 'bloqueado', 'desabilitado'
   - Returns failure if company is inactive

5. **Permission Check (Optional)**
   - Attempts to access NFS-e configuration endpoint
   - Verifies sufficient permissions for invoice emission
   - Non-critical if endpoint doesn't exist

### API Endpoints

#### `POST /api/companies/:id/check-fiscal-connection`

**Authentication:** Required (JWT)

**Subscription:** Requires active subscription

**Request:**
```http
POST /api/companies/{companyId}/check-fiscal-connection
Authorization: Bearer {token}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Conexão com a prefeitura estabelecida com sucesso",
  "data": {
    "connectionStatus": "conectado",
    "message": "Conexão com a prefeitura estabelecida com sucesso",
    "details": "Empresa XYZ está conectada e pronta para emitir notas fiscais.",
    "data": {
      "id": "empresa-123",
      "cnpj": "12.345.678/0001-90",
      "razao_social": "Empresa XYZ Ltda",
      "nome_fantasia": "XYZ",
      "status": "ativo",
      "inscricao_municipal": "123456"
    }
  }
}
```

**Response (Failure):**
```json
{
  "status": "success",
  "message": "Empresa não encontrada na Nuvem Fiscal",
  "data": {
    "connectionStatus": "falha",
    "message": "Empresa não encontrada na Nuvem Fiscal",
    "details": "A empresa com ID empresa-123 não foi encontrada. Pode ser necessário registrar a empresa novamente."
  }
}
```

#### `POST /api/assistant/execute-action` (verificar_conexao)

**Action Type:** `verificar_conexao`

**Request:**
```json
{
  "action_type": "verificar_conexao",
  "action_data": {},
  "company_id": "company-uuid"
}
```

**Response:** Same format as above

### Database Updates

The verification automatically updates the `FiscalIntegrationStatus` table:

```javascript
await prisma.fiscalIntegrationStatus.upsert({
  where: { companyId: company.id },
  update: {
    status: connectionResult.status === 'conectado' ? 'conectado' : 'falha',
    mensagem: connectionResult.details || connectionResult.message,
    ultimaVerificacao: new Date()
  },
  create: {
    companyId: company.id,
    status: connectionResult.status === 'conectado' ? 'conectado' : 'falha',
    mensagem: connectionResult.details || connectionResult.message,
    ultimaVerificacao: new Date()
  }
});
```

## Error Handling

### Common Error Scenarios

1. **Company Not Registered**
   - Status: `falha`
   - Message: "Empresa não registrada na Nuvem Fiscal"
   - Solution: Register company first

2. **Invalid Credentials**
   - Status: `falha`
   - Message: "Erro de autenticação com Nuvem Fiscal"
   - Solution: Check CLIENT_ID and CLIENT_SECRET

3. **Company Not Found**
   - Status: `falha`
   - Message: "Empresa não encontrada na Nuvem Fiscal"
   - Solution: Re-register company

4. **Insufficient Permissions**
   - Status: `falha`
   - Message: "Permissões insuficientes"
   - Solution: Check Nuvem Fiscal account permissions

5. **Network/Timeout Errors**
   - Status: `falha`
   - Message: "Erro de conexão com Nuvem Fiscal"
   - Solution: Check internet connection, retry

6. **Inactive Company**
   - Status: `falha`
   - Message: "Empresa com status: [status]"
   - Solution: Activate company in Nuvem Fiscal

## Timeout Configuration

- **Request Timeout:** 30 seconds
- **Automatic Retry:** Not implemented (can be added)
- **Timeout Error:** Returns 408 status with clear message

## Frontend Integration

### FiscalStatusIndicator Component

The frontend component automatically displays connection status:

- **Conectado** (Green): Company is connected and ready
- **Falha** (Red): Connection failed, shows error details
- **Verificando** (Yellow): Currently checking connection

### Manual Verification

Users can trigger verification via:
1. UI button in FiscalStatusIndicator
2. AI command: "Verificar conexão com prefeitura"
3. Company settings page

## Testing

### Test Scenarios

1. **Valid Company**
   - Register company → Verify connection → Should return "conectado"

2. **Unregistered Company**
   - Try to verify without registration → Should return "falha" with registration message

3. **Invalid Credentials**
   - Use wrong CLIENT_ID/SECRET → Should return authentication error

4. **Network Error**
   - Disconnect internet → Should return connection error

5. **Timeout**
   - Simulate slow API → Should timeout after 30 seconds

## Configuration

### Environment Variables

```env
NUVEM_FISCAL_CLIENT_ID=your-client-id
NUVEM_FISCAL_CLIENT_SECRET=your-client-secret
NUVEM_FISCAL_ENVIRONMENT=sandbox  # or 'production'
```

### API Endpoints

- **Sandbox:** `https://sandbox.nuvemfiscal.com.br/v2`
- **Production:** `https://api.nuvemfiscal.com.br/v2`

## Status Values

### Connection Status
- `conectado` - Successfully connected and ready
- `falha` - Connection failed or company inactive
- `verificando` - Currently checking (temporary state)

### Company Status (from Nuvem Fiscal)
- `ativo` / `habilitado` - Active and ready
- `inativo` / `suspenso` / `cancelado` / `bloqueado` - Inactive

## Benefits

1. **Real Verification**: Actually checks with Nuvem Fiscal API
2. **Detailed Errors**: Provides specific error messages
3. **Automatic Updates**: Updates database status automatically
4. **User Feedback**: Clear status indicators in UI
5. **AI Integration**: Can be triggered via AI assistant

## Future Enhancements

- [ ] Automatic periodic verification (cron job)
- [ ] Retry logic for transient failures
- [ ] Connection health monitoring
- [ ] Email notifications on status changes
- [ ] Detailed connection logs
- [ ] Performance metrics
