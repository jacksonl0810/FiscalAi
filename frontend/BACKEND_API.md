# Backend API Specification

This document describes the API endpoints that your Node.js backend needs to implement for the FiscalAI frontend.

## Database Schema (PostgreSQL)

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Companies Table
```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    cnpj VARCHAR(18) NOT NULL,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cidade VARCHAR(100) NOT NULL,
    uf CHAR(2) NOT NULL,
    cnae_principal VARCHAR(20),
    regime_tributario VARCHAR(50) NOT NULL,
    certificado_digital BOOLEAN DEFAULT FALSE,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    inscricao_municipal VARCHAR(50) NOT NULL,
    nuvem_fiscal_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Invoices Table
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    numero VARCHAR(50),
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_documento VARCHAR(20) NOT NULL,
    descricao_servico TEXT NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    aliquota_iss DECIMAL(5,2) DEFAULT 5,
    valor_iss DECIMAL(15,2),
    iss_retido BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) DEFAULT 'rascunho',
    municipio VARCHAR(100),
    codigo_verificacao VARCHAR(100),
    data_emissao DATE,
    data_prestacao DATE,
    codigo_servico VARCHAR(20),
    pdf_url VARCHAR(500),
    xml_url VARCHAR(500),
    nuvem_fiscal_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Status enum values: 'rascunho', 'pendente_confirmacao', 'enviada', 'autorizada', 'rejeitada', 'cancelada'
```

### Notifications Table
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    mensagem TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL, -- 'sucesso', 'erro', 'alerta', 'info'
    lida BOOLEAN DEFAULT FALSE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Settings Table
```sql
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(10) DEFAULT 'dark',
    font_size VARCHAR(10) DEFAULT 'medium',
    active_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### DAS (Tax Payments) Table
```sql
CREATE TABLE das (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    referencia VARCHAR(10) NOT NULL, -- e.g., '01/2025'
    data_vencimento DATE NOT NULL,
    valor_total DECIMAL(15,2) NOT NULL,
    valor_inss DECIMAL(15,2),
    valor_icms DECIMAL(15,2),
    valor_iss DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'pago'
    codigo_barras VARCHAR(100),
    pdf_url VARCHAR(500),
    data_pagamento DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Fiscal Integration Status Table
```sql
CREATE TABLE fiscal_integration_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'verificando', -- 'conectado', 'falha', 'verificando'
    mensagem TEXT,
    ultima_verificacao TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Authentication

#### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
    "email": "user@example.com",
    "password": "password123"
}
```

**Response:**
```json
{
    "user": {
        "id": "uuid",
        "email": "user@example.com",
        "name": "User Name",
        "avatar": "url"
    },
    "token": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
}
```

#### POST /api/auth/register
Register a new user.

**Request:**
```json
{
    "name": "User Name",
    "email": "user@example.com",
    "password": "password123"
}
```

**Response:** Same as login.

#### GET /api/auth/me
Get current authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": "url",
    "created_at": "2025-01-01T00:00:00Z"
}
```

#### POST /api/auth/refresh
Refresh access token.

**Request:**
```json
{
    "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
    "token": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
}
```

### Invoices

#### POST /api/invoices/issue
Issue an invoice to the fiscal authority.

**Request:**
```json
{
    "companyId": "uuid",
    "cliente_nome": "Client Name",
    "cliente_documento": "123.456.789-00",
    "descricao_servico": "Service description",
    "valor": 1000.00,
    "aliquota_iss": 5,
    "municipio": "São Paulo",
    "data_prestacao": "2025-01-01",
    "codigo_servico": "1401"
}
```

**Response:**
```json
{
    "status": "success",
    "message": "Invoice issued successfully",
    "invoice": {
        "id": "uuid",
        "numero": "NFS12345",
        "status": "autorizada",
        "codigo_verificacao": "ABC123",
        "pdf_url": "https://...",
        "xml_url": "https://..."
    }
}
```

### AI Assistant

#### POST /api/assistant/process
Process an AI command.

**Request:**
```json
{
    "message": "Emitir nota de R$ 2000 para João Silva",
    "companyId": "uuid",
    "conversationHistory": [
        { "role": "user", "content": "previous message" },
        { "role": "assistant", "content": "previous response" }
    ]
}
```

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
            "valor": 2000,
            "aliquota_iss": 5
        }
    },
    "explanation": "Entendi! Vou preparar uma nota fiscal de R$ 2.000,00 para João Silva.",
    "requiresConfirmation": true
}
```

## Integration with Nuvem Fiscal

For the fiscal integration to work, your backend needs to:

1. Register companies in Nuvem Fiscal API
2. Send invoice data to Nuvem Fiscal for authorization
3. Check invoice status from Nuvem Fiscal
4. Store PDF/XML URLs returned by Nuvem Fiscal

Refer to [Nuvem Fiscal API Documentation](https://dev.nuvemfiscal.com.br/) for details.

## Environment Variables (Backend)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fiscalai

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Nuvem Fiscal API
NUVEM_FISCAL_CLIENT_ID=your-client-id
NUVEM_FISCAL_CLIENT_SECRET=your-client-secret
NUVEM_FISCAL_USE_SANDBOX=true

# OpenAI (for AI assistant)
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini

# Email (for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
```

## CORS Configuration

Your backend should allow CORS from the frontend origin:

```javascript
// Express.js example
const cors = require('cors');

app.use(cors({
    origin: ['http://localhost:5173', 'https://your-frontend-domain.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
```
