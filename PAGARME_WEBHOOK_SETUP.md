# Pagar.me Webhook Configuration Guide

## Step-by-Step Setup for Subscription Payment Confirmation

### Prerequisites
- Backend server running and accessible from the internet
- Pagar.me account with API keys configured
- Environment variables set up

---

## Step 1: Get Your Webhook URL

Your webhook endpoint is already configured at:
```
POST https://your-domain.com/api/subscriptions/webhook
```

**For Local Development (Testing):**
- Use a tunneling service like **ngrok** or **localtunnel** to expose your local server
- See detailed ngrok setup instructions below

**For Production:**
- Use your production domain: `https://yourdomain.com/api/subscriptions/webhook`

---

## Step 2: Configure Environment Variables

Add the webhook secret to your `.env` file:

```env
# Pagar.me Configuration
PAGARME_API_KEY=sk_test_xxxxxxxxxxxxx  # Your secret key
PAGARME_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx  # Your public key
PAGARME_WEBHOOK_SECRET=your_webhook_secret_here  # Set this in Pagar.me dashboard
```

**Important:**
- The `PAGARME_WEBHOOK_SECRET` should match the secret you configure in Pagar.me dashboard
- If not set, it defaults to `PAGARME_API_KEY` (less secure, not recommended for production)

---

## Step 3: Configure Webhook in Pagar.me Dashboard

### 3.1 Access Pagar.me Dashboard

1. Log in to [Pagar.me Dashboard](https://dashboard.pagar.me/)
2. Navigate to **Configurações** (Settings) → **Webhooks**

### 3.2 Create New Webhook

1. Click **"Criar Webhook"** or **"Novo Webhook"**
2. Fill in the webhook configuration:

   **URL do Webhook:**
   ```
   https://your-domain.com/api/subscriptions/webhook
   ```

   **Eventos (Events) to Subscribe:**
   Select the following events:
   - ✅ `order.paid` - Order payment confirmed
   - ✅ `order.payment_failed` - Order payment failed
   - ✅ `order.closed` - Order closed
   - ✅ `order.canceled` - Order canceled
   - ✅ `charge.paid` - Charge payment confirmed
   - ✅ `charge.payment_failed` - Charge payment failed
   - ✅ `charge.refused` - Charge refused
   - ✅ `charge.refunded` - Charge refunded
   - ✅ `subscription.created` - Subscription created (legacy)
   - ✅ `subscription.paid` - Subscription payment confirmed (legacy)
   - ✅ `subscription.payment_failed` - Subscription payment failed (legacy)
   - ✅ `subscription.canceled` - Subscription canceled (legacy)
   - ✅ `subscription.updated` - Subscription updated (legacy)

   **Secret (Chave Secreta):**
   - Generate a strong random secret (e.g., using `openssl rand -hex 32`)
   - Copy this secret and add it to your `.env` file as `PAGARME_WEBHOOK_SECRET`
   - Example: `PAGARME_WEBHOOK_SECRET=abc123def456...`

3. Click **"Salvar"** or **"Criar Webhook"**

### 3.3 Webhook Status

- After creation, Pagar.me will send a test webhook to verify the endpoint
- Check your backend logs to see if the test webhook was received
- The webhook status should show as **"Ativo"** (Active) in the dashboard

---

## Step 4: Verify Webhook Configuration

### 4.1 Check Backend Logs

When a webhook is received, you should see logs like:
```
[Webhook] Received event: evt_xxxxx
[Webhook] Processing event: order.paid
[Webhook] Event processed successfully: order.paid
```

### 4.2 Test Webhook (Development Only)

You can test the webhook endpoint locally:

```bash
# Test webhook endpoint availability
curl http://localhost:3000/api/subscriptions/webhook/test
```

**Note:** This test endpoint is only available in development mode.

---

## Step 5: Handle Webhook Events

The webhook handler automatically processes these events:

### Payment Success Events:
- `order.paid` → Updates subscription to `ativo`, creates payment record
- `charge.paid` → Updates subscription status
- `subscription.paid` → Updates subscription status (legacy)

### Payment Failure Events:
- `order.payment_failed` → Updates subscription to `inadimplente`
- `charge.payment_failed` → Updates subscription status
- `subscription.payment_failed` → Updates subscription status (legacy)

### Subscription Events:
- `subscription.created` → Creates subscription record
- `subscription.canceled` → Cancels subscription
- `subscription.updated` → Updates subscription details

---

## Step 6: Security Best Practices

### 6.1 Webhook Signature Verification

The webhook handler automatically verifies signatures using HMAC-SHA256:

```javascript
// Signature is verified automatically
const signature = req.headers['x-hub-signature-256'];
const isValid = validateWebhookSignature(signature, payload);
```

### 6.2 Environment Variables

**Development:**
```env
PAGARME_API_KEY=sk_test_xxxxxxxxxxxxx
PAGARME_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
PAGARME_WEBHOOK_SECRET=test_webhook_secret
```

**Production:**
```env
PAGARME_API_KEY=sk_live_xxxxxxxxxxxxx
PAGARME_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx
PAGARME_WEBHOOK_SECRET=production_webhook_secret_strong_random_string
```

### 6.3 HTTPS Required

- **Production webhooks MUST use HTTPS**
- Pagar.me will reject HTTP URLs in production
- Use SSL certificates (Let's Encrypt, etc.)

---

## Step 7: Troubleshooting

### Issue: Webhook not received

**Check:**
1. ✅ Webhook URL is correct and accessible
2. ✅ Server is running and reachable from internet
3. ✅ Firewall allows incoming connections on port 443 (HTTPS)
4. ✅ Webhook is active in Pagar.me dashboard
5. ✅ Check Pagar.me webhook logs for delivery status

**Solution:**
- Use ngrok for local testing: `ngrok http 3000`
- Check backend logs for incoming requests
- Verify webhook URL in Pagar.me dashboard

### Issue: Invalid signature error

**Check:**
1. ✅ `PAGARME_WEBHOOK_SECRET` matches the secret in Pagar.me dashboard
2. ✅ Secret is correctly set in `.env` file
3. ✅ Backend server restarted after changing `.env`

**Solution:**
- Regenerate webhook secret in Pagar.me dashboard
- Update `PAGARME_WEBHOOK_SECRET` in `.env`
- Restart backend server

### Issue: Webhook received but not processed

**Check:**
1. ✅ Event type is in the handler switch statement
2. ✅ Backend logs show event processing
3. ✅ Database connection is working
4. ✅ User/subscription exists in database

**Solution:**
- Check backend logs for error messages
- Verify event type matches handler cases
- Check database for subscription records

---

## Step 8: Monitoring Webhooks

### 8.1 Backend Logs

Monitor your backend logs for webhook activity:
```bash
# Watch logs in real-time
tail -f logs/app.log
# Or if using console.log
# Check your server console output
```

### 8.2 Pagar.me Dashboard

1. Go to **Webhooks** in Pagar.me dashboard
2. Click on your webhook
3. View **"Histórico"** (History) to see:
   - Delivery status
   - Response codes
   - Retry attempts
   - Error messages

### 8.3 Database Verification

Check subscription status in database:
```sql
SELECT id, user_id, plan_id, status, pagarMeSubscriptionId 
FROM subscriptions 
WHERE status = 'ativo';
```

---

## Step 9: Production Checklist

Before going live, verify:

- [ ] Webhook URL uses HTTPS
- [ ] `PAGARME_WEBHOOK_SECRET` is set and matches dashboard
- [ ] All required events are subscribed
- [ ] Webhook status is "Ativo" in dashboard
- [ ] Backend logs show successful webhook processing
- [ ] Test payment flow end-to-end
- [ ] Monitor webhook delivery in Pagar.me dashboard
- [ ] Set up alerts for webhook failures

---

## Step 10: Getting a Test Domain with ngrok

### 10.1 Install ngrok

**Option A: Download from Website (Recommended)**
1. Go to [ngrok.com](https://ngrok.com/)
2. Click **"Get started for free"** or **"Sign up"**
3. Create a free account (email + password)
4. Download ngrok for your OS:
   - **Windows**: Download `.zip` file, extract it
   - **Mac**: Download `.zip` file or use Homebrew: `brew install ngrok/ngrok/ngrok`
   - **Linux**: Download `.zip` file or use package manager

**Option B: Using Package Managers**
```bash
# Windows (using Chocolatey)
choco install ngrok

# Mac (using Homebrew)
brew install ngrok/ngrok/ngrok

# Linux (using snap)
snap install ngrok
```

### 10.2 Authenticate ngrok

1. **Get your authtoken:**
   - Log in to [ngrok dashboard](https://dashboard.ngrok.com/)
   - Go to **"Your Authtoken"** section
   - Copy your authtoken (looks like: `2abc123def456ghi789jkl012mno345pq_6rst789uvw012xyz345`)

2. **Set authtoken:**
   ```bash
   ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
   ```
   
   Example:
   ```bash
   ngrok config add-authtoken 2abc123def456ghi789jkl012mno345pq_6rst789uvw012xyz345
   ```

### 10.3 Start ngrok Tunnel

1. **Make sure your backend is running:**
   ```bash
   cd backend
   npm run dev
   # Server should be running on http://localhost:3000
   ```

2. **Start ngrok in a new terminal:**
   ```bash
   ngrok http 3000
   ```

3. **You'll see output like this:**
   ```
   ngrok                                                                      
                                                                              
   Session Status                online                                      
   Account                       Your Name (Plan: Free)                       
   Version                       3.x.x                                        
   Region                        United States (us)                           
   Latency                       -                                            
   Web Interface                 http://127.0.0.1:4040                        
   Forwarding                    https://abc123-def456.ngrok-free.app -> http://localhost:3000
                                                                              
   Connections                   ttl     opn     rt1     rt5     p50     p90  
                                 0       0       0.00    0.00    0.00    0.00  
   ```

4. **Copy your HTTPS URL:**
   - Look for the line: `Forwarding https://abc123-def456.ngrok-free.app -> http://localhost:3000`
   - Your test domain is: `https://abc123-def456.ngrok-free.app`
   - **Note:** The URL changes each time you restart ngrok (unless you have a paid plan with static domain)

### 10.4 Use the Test Domain

**Your webhook URL will be:**
```
https://abc123-def456.ngrok-free.app/api/subscriptions/webhook
```

**Configure in Pagar.me:**
1. Go to Pagar.me Dashboard → Webhooks
2. Set webhook URL: `https://abc123-def456.ngrok-free.app/api/subscriptions/webhook`
3. Set webhook secret
4. Subscribe to events

### 10.5 Monitor ngrok Traffic

**ngrok Web Interface:**
- Open in browser: `http://127.0.0.1:4040`
- See all incoming requests in real-time
- Inspect request/response details
- Replay requests for testing

**Features:**
- ✅ View all HTTP requests
- ✅ See request headers and body
- ✅ See response status and body
- ✅ Replay requests
- ✅ Export request data

### 10.6 Keep ngrok Running

**Important:**
- Keep the ngrok terminal window open while testing
- If you close ngrok, the URL will stop working
- Restart ngrok to get a new URL (or use a paid plan for static domain)

**To run ngrok in background (optional):**
```bash
# Windows (PowerShell)
Start-Process ngrok -ArgumentList "http 3000"

# Mac/Linux
ngrok http 3000 &
```

### 10.7 ngrok Free vs Paid Plans

**Free Plan:**
- ✅ Random URL each time (changes on restart)
- ✅ 1 tunnel at a time
- ✅ Basic request inspection
- ✅ Limited requests per month

**Paid Plans:**
- ✅ Static domain (same URL every time)
- ✅ Multiple tunnels
- ✅ Custom domains
- ✅ More requests
- ✅ Reserved IPs

**For testing webhooks, the free plan is sufficient!**

### 10.8 Troubleshooting ngrok

**Issue: "command not found"**
- Make sure ngrok is installed
- Add ngrok to your PATH environment variable
- Or use full path: `C:\path\to\ngrok.exe http 3000`

**Issue: "authtoken required"**
- Run: `ngrok config add-authtoken YOUR_TOKEN`
- Get token from [ngrok dashboard](https://dashboard.ngrok.com/)

**Issue: "port already in use"**
- Check if port 3000 is already in use
- Use a different port: `ngrok http 3001`
- Update your backend to use that port

**Issue: "tunnel session failed"**
- Check your internet connection
- Verify ngrok service is online
- Try restarting ngrok

### 10.9 Alternative: Use ngrok with Custom Port

If your backend runs on a different port:
```bash
# Backend on port 5000
ngrok http 5000

# Backend on port 8080
ngrok http 8080
```

### 10.10 Complete Example Workflow

```bash
# Terminal 1: Start backend
cd backend
npm run dev
# Server running on http://localhost:3000

# Terminal 2: Start ngrok
ngrok http 3000
# Copy the HTTPS URL: https://abc123.ngrok-free.app

# Terminal 3: Configure webhook in Pagar.me
# URL: https://abc123.ngrok-free.app/api/subscriptions/webhook
# Secret: your_webhook_secret
# Events: order.paid, order.payment_failed, etc.

# Test: Make a payment and check:
# - ngrok web interface (http://127.0.0.1:4040)
# - Backend logs
# - Pagar.me webhook delivery status
```

### Using curl (for testing):

```bash
# Test webhook endpoint (development only)
curl -X GET http://localhost:3000/api/subscriptions/webhook/test
```

---

## Additional Resources

- [Pagar.me Webhook Documentation](https://docs.pagar.me/reference/webhooks)
- [Pagar.me Dashboard](https://dashboard.pagar.me/)
- [ngrok Documentation](https://ngrok.com/docs)

---

## Support

If you encounter issues:
1. Check backend logs for error messages
2. Verify webhook configuration in Pagar.me dashboard
3. Test webhook endpoint manually
4. Check Pagar.me webhook delivery history
