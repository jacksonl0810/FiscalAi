# Nuvem Fiscal Credentials Setup

## Quick Setup

### 1. Get Credentials

1. Sign up at [Nuvem Fiscal](https://www.nuvemfiscal.com.br/)
2. Go to [Developer Console](https://dev.nuvemfiscal.com.br/)
3. Create a new credential (choose **Sandbox** for testing)
4. Copy your **Client ID** and **Client Secret**

### 2. Configure Environment Variables

Add these to your `.env` file in the `backend/` directory:

```env
NUVEM_FISCAL_CLIENT_ID=your-client-id-here
NUVEM_FISCAL_CLIENT_SECRET=your-client-secret-here
NUVEM_FISCAL_ENVIRONMENT=sandbox
```

### 3. Verify

Start your server:
```bash
cd backend
npm run dev
```

If credentials are correct, the server will start without errors. If you see authentication errors, double-check your Client ID and Secret.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NUVEM_FISCAL_CLIENT_ID` | OAuth Client ID from Nuvem Fiscal | ✅ Yes |
| `NUVEM_FISCAL_CLIENT_SECRET` | OAuth Client Secret | ✅ Yes |
| `NUVEM_FISCAL_ENVIRONMENT` | `sandbox` or `production` | ✅ Yes (default: sandbox) |

## Production Setup

When ready for production:
1. Create Production credentials in Nuvem Fiscal console
2. Update `.env`:
   ```env
   NUVEM_FISCAL_ENVIRONMENT=production
   NUVEM_FISCAL_CLIENT_ID=your-production-client-id
   NUVEM_FISCAL_CLIENT_SECRET=your-production-client-secret
   ```

## Troubleshooting

**Error: "Nuvem Fiscal credentials not configured"**
- Make sure `.env` file exists in `backend/` directory
- Verify variable names are correct (case-sensitive)
- Restart server after changing `.env`

**Error: "401 Unauthorized"**
- Check Client ID and Secret are correct
- Verify environment matches (sandbox vs production)
- Make sure credentials are active in Nuvem Fiscal console

## Documentation

- [Nuvem Fiscal API Docs](https://dev.nuvemfiscal.com.br/docs)
- [OAuth Authentication](https://dev.nuvemfiscal.com.br/docs/autenticacao/)
