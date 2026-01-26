# Nuvem Fiscal Integration - Optional Configuration

## Overview

The Nuvem Fiscal integration is **OPTIONAL**. The application will work without it, but you won't be able to emit official NFS-e invoices.

## What Happens Without Configuration?

When Nuvem Fiscal credentials are not configured:

✅ **Working Features:**
- User authentication and registration
- Company management (create, edit, delete)
- AI assistant conversations
- Invoice previews and data validation
- Payment integration (Pagar.me)
- All other features

❌ **Disabled Features:**
- Official NFS-e emission
- Fiscal connection verification
- Company registration with tax authorities

## Current Status Check

The application automatically detects if Nuvem Fiscal is configured. You'll see helpful messages like:

- **Company Registration**: "Nuvem Fiscal não configurado. Configure as credenciais para habilitar a integração fiscal."
- **Connection Check**: "Integração fiscal não configurada."
- **Invoice Emission**: "Integração fiscal não configurada. Para emitir notas fiscais, configure as credenciais..."

## How to Enable Nuvem Fiscal

### Step 1: Create a Nuvem Fiscal Account

1. Visit [Nuvem Fiscal](https://www.nuvemfiscal.com.br/)
2. Create an account
3. Choose **Sandbox** for testing or **Production** for real invoices

### Step 2: Get API Credentials

1. Log in to your Nuvem Fiscal account
2. Go to **API Settings** or **Configurações da API**
3. Generate:
   - **Client ID** (OAuth 2.0 Client ID)
   - **Client Secret** (OAuth 2.0 Client Secret)

### Step 3: Configure Environment Variables

Add these to your `backend/.env` file:

```env
# Nuvem Fiscal API Configuration
# Get credentials from: https://console.nuvemfiscal.com.br
NUVEM_FISCAL_CLIENT_ID=your_client_id_here
NUVEM_FISCAL_CLIENT_SECRET=your_client_secret_here
NUVEM_FISCAL_ENVIRONMENT=sandbox
# Use 'production' when ready for real invoices

# API URLs (optional - defaults are correct per official documentation)
# Auth URL: https://auth.nuvemfiscal.com.br/oauth/token
# Production: https://api.nuvemfiscal.com.br
# Sandbox: https://api.sandbox.nuvemfiscal.com.br
```

### Step 4: Restart Backend

```bash
cd backend
npm run dev
```

### Step 5: Test Connection

1. Open the application
2. Go to a company
3. Click "Verificar conexão com prefeitura"
4. If successful, you should see "Conectado" status

## Troubleshooting

### "ENOTFOUND sandbox.nuvemfiscal.com.br"

**Problem**: DNS resolution failed - can't reach Nuvem Fiscal servers

**Possible causes:**
1. No internet connection
2. Firewall blocking the domain
3. DNS issues
4. Nuvem Fiscal sandbox is down (rare)

**Solutions:**
- Check your internet connection
- Try accessing https://sandbox.nuvemfiscal.com.br in your browser
- Check firewall/antivirus settings
- Try again later if the sandbox is down
- Contact Nuvem Fiscal support if the issue persists

### "Credentials not configured"

**Problem**: Environment variables are not set

**Solution:**
1. Check if `backend/.env` exists
2. Verify `NUVEM_FISCAL_CLIENT_ID` and `NUVEM_FISCAL_CLIENT_SECRET` are set
3. Restart the backend server after adding them

### "Empresa não registrada na Nuvem Fiscal"

**Problem**: Company needs to be registered first

**Solution:**
1. Go to the company settings
2. Click "Verificar conexão com prefeitura" or use the registration button
3. This will register your company with Nuvem Fiscal

## Working Without Nuvem Fiscal

You can develop and test most features without Nuvem Fiscal:

1. **Skip fiscal setup** during company creation
2. **Use the AI assistant** for conversations and commands
3. **Preview invoices** without actually emitting them
4. **Test payment flows** with Pagar.me
5. **Configure everything else** and add Nuvem Fiscal later

## When to Configure Nuvem Fiscal

Configure Nuvem Fiscal when you:
- Want to emit **official** NFS-e invoices
- Need to test the **complete invoice emission flow**
- Are ready to **integrate with tax authorities**
- Want to **validate** fiscal data with the government system

## Support

- **Nuvem Fiscal Docs**: https://dev.nuvemfiscal.com.br/docs
- **Nuvem Fiscal Support**: Contact through their website
- **Application Issues**: Check backend logs for detailed error messages
