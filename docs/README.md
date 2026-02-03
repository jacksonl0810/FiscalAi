# Documentation Index

## Stripe Integration

### Getting Started
- **[STRIPE_FRONTEND_GUIDE.md](../STRIPE_FRONTEND_GUIDE.md)** - Complete guide for migrating from Pagar.me to Stripe on the frontend

### Content Security Policy (CSP)
- **[CSP_STRIPE_FIX.md](CSP_STRIPE_FIX.md)** - Troubleshooting CSP issues with Stripe.js ⭐ **START HERE if Stripe isn't loading**
- **[nginx-stripe.conf](nginx-stripe.conf)** - Production-ready nginx configuration for Stripe
- **[cloudflare-stripe-setup.md](cloudflare-stripe-setup.md)** - Step-by-step Cloudflare setup for Stripe

### Deployment
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Complete deployment checklist with verification steps

## Other Documentation
- **[NUVEM_FISCAL_OPTIONAL.md](NUVEM_FISCAL_OPTIONAL.md)** - Optional Nuvem Fiscal integration
- **[README.md](README.md)** - Project overview (if exists in root)

## Quick Links

### Having Issues?

| Symptom | Check This |
|---------|-----------|
| 🔴 Stripe card field is blank | [CSP_STRIPE_FIX.md](CSP_STRIPE_FIX.md) |
| 🔴 Console shows CSP violations | [CSP_STRIPE_FIX.md](CSP_STRIPE_FIX.md) |
| 🔴 "Failed to load Stripe.js" | Run `scripts/check-csp.sh` |
| 🔴 Multiple CSP headers | [nginx-stripe.conf](nginx-stripe.conf) or [cloudflare-stripe-setup.md](cloudflare-stripe-setup.md) |
| 🔴 Webhook returns 400 error | [WEBHOOK_RAW_BODY_FIX.md](WEBHOOK_RAW_BODY_FIX.md) ⭐ |
| 🔴 "Webhook signature verification failed" | [WEBHOOK_RAW_BODY_FIX.md](WEBHOOK_RAW_BODY_FIX.md) |
| 🔴 Payment succeeds but status stays PENDING | [WEBHOOK_INVALID_DATE_FIX.md](WEBHOOK_INVALID_DATE_FIX.md) ⭐⭐ |
| 🔴 "Invalid Date" error in webhook logs | [WEBHOOK_INVALID_DATE_FIX.md](WEBHOOK_INVALID_DATE_FIX.md) |
| 🔴 Webhook logs "no subscription" with undefined ID | [STRIPE_API_2026_INVOICE_FIX.md](STRIPE_API_2026_INVOICE_FIX.md) ⭐⭐⭐ |
| 🔴 "Invoice paid but no subscription" in logs | [STRIPE_API_2026_INVOICE_FIX.md](STRIPE_API_2026_INVOICE_FIX.md) |
| 📋 Ready to deploy? | [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) |

### Tools

- **`scripts/check-csp.sh`** - Diagnose CSP configuration issues
  ```bash
  ./scripts/check-csp.sh https://mayassessorfiscal.com.br
  ```

## Migration Status

The Pagar.me → Stripe migration is **complete**. All code is ready for deployment.

### What's Done ✅
- Backend Stripe SDK integration
- Frontend Stripe Elements UI
- Webhook handlers for Stripe events
- CSP configuration for Stripe.js
- Customer Portal integration
- Test mode ready

### What You Need to Do ⚠️
1. Add Stripe API keys to production `.env` (see backend `.env.example`)
2. Create Stripe Prices in dashboard (Pro monthly/annual, Business monthly/annual)
3. Configure CSP on your web server (nginx or Cloudflare)
4. Set up webhook endpoint in Stripe dashboard
5. Deploy and test with test card: `4242 4242 4242 4242`

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete steps.
