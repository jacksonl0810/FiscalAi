# Nuvem Fiscal API Integration

This document describes the Nuvem Fiscal API integration implementation.

## Overview

The integration allows the system to:
- Register companies in Nuvem Fiscal
- Emit NFS-e (Nota Fiscal de Serviço Eletrônica)
- Check invoice status
- Cancel invoices
- Verify fiscal connection

## Setup

### 1. Get Nuvem Fiscal Credentials

1. Access the [Nuvem Fiscal Developer Console](https://dev.nuvemfiscal.com.br/)
2. Create a new application/credential
3. Choose between Sandbox or Production environment
4. Copy your `Client ID` and `Client Secret`

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
NUVEM_FISCAL_CLIENT_ID=your-client-id
NUVEM_FISCAL_CLIENT_SECRET=your-client-secret
NUVEM_FISCAL_ENVIRONMENT=sandbox  # or 'production'
```

### 3. Service Module

The integration is implemented in `backend/src/services/nuvemFiscal.js`:

- **OAuth 2.0 Authentication**: Automatic token management with caching
- **Company Registration**: `registerCompany(companyData)`
- **Connection Verification**: `checkConnection(nuvemFiscalId)`
- **NFS-e Emission**: `emitNfse(invoiceData, companyData)`
- **Status Checking**: `checkNfseStatus(nuvemFiscalId, nfseId)`
- **Invoice Cancellation**: `cancelNfse(nuvemFiscalId, nfseId, motivo)`

## API Endpoints Updated

### Companies

- `POST /api/companies/:id/register-fiscal` - Now uses real Nuvem Fiscal API
- `POST /api/companies/:id/check-fiscal-connection` - Now verifies real connection

### Invoices

- `POST /api/invoices/issue` - Now emits real NFS-e via Nuvem Fiscal
- `POST /api/invoices/:id/check-status` - Now checks real status from Nuvem Fiscal
- `POST /api/invoices/:id/cancel` - Now cancels via Nuvem Fiscal API

## Error Handling

All functions include proper error handling:
- API errors are caught and converted to user-friendly messages
- Fiscal status is updated in database on errors
- Notifications are created for important events (success/error)

## Token Management

The service automatically:
- Obtains OAuth 2.0 access tokens using `client_credentials` flow
- Caches tokens to avoid unnecessary API calls
- Refreshes tokens before expiration (60s safety margin)

## Data Mapping

### Company Registration

Our database fields → Nuvem Fiscal format:
- `cnpj` → `cnpj` (formatted)
- `razaoSocial` → `razao_social`
- `nomeFantasia` → `nome_fantasia`
- `inscricaoMunicipal` → `inscricao_municipal`
- `regimeTributario` → `regime_tributario`

### Invoice Emission

Our invoice data → NFS-e format:
- `cliente_nome` → `tomador.razao_social`
- `cliente_documento` → `tomador.cpf_cnpj`
- `descricao_servico` → `servico.descricao`
- `valor` → `servico.valor_servicos`
- `aliquota_iss` → `servico.aliquota_iss`

## Testing

### Sandbox Environment

Start with sandbox for testing:
```env
NUVEM_FISCAL_ENVIRONMENT=sandbox
```

### Production Environment

Switch to production when ready:
```env
NUVEM_FISCAL_ENVIRONMENT=production
```

## Known Limitations / TODOs

1. **Address Fields**: Company model needs address fields (logradouro, numero, bairro, codigo_municipio, cep)
2. **Client Email**: Invoice model should include client email for NFS-e
3. **Service Codes**: Default service code (1401) is used - should be configurable per company
4. **Municipality Codes**: Need IBGE municipality codes for proper registration

## Documentation

- [Nuvem Fiscal API Docs](https://dev.nuvemfiscal.com.br/docs)
- [OAuth 2.0 Authentication](https://dev.nuvemfiscal.com.br/docs/autenticacao/)
- [NFS-e Documentation](https://dev.nuvemfiscal.com.br/docs/nfse)
