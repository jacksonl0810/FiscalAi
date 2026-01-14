# OpenAI Account Setup Guide

## How to Use Your OpenAI Account

### Step 1: Get Your API Key

1. **Go to OpenAI Platform**
   - Visit: https://platform.openai.com/
   - Log in with your OpenAI account

2. **Navigate to API Keys**
   - Click on your profile icon (top right)
   - Select "API keys" from the menu
   - Or go directly to: https://platform.openai.com/api-keys

3. **Create a New API Key**
   - Click "Create new secret key"
   - Give it a name (e.g., "FiscalAI Production")
   - **IMPORTANT**: Copy the key immediately - you won't be able to see it again!
   - The key will look like: `sk-proj-...` (starts with `sk-`)

### Step 2: Add API Key to Your Project

1. **Open your `.env` file**
   - Navigate to the `backend` folder
   - Open or create `.env` file

2. **Add the API Key**
   ```env
   OPENAI_API_KEY=sk-proj-your-actual-api-key-here
   ```

3. **Optional: Configure Model**
   ```env
   OPENAI_MODEL=gpt-4o-mini
   ```
   
   Available models:
   - `gpt-4o-mini` (default, cost-effective, recommended)
   - `gpt-4o` (more powerful, higher cost)
   - `gpt-4-turbo` (alternative)
   - `gpt-3.5-turbo` (cheaper, less capable)

### Step 3: Restart Your Backend Server

After adding the API key, restart your backend:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd backend
npm run dev
```

### Step 4: Verify It's Working

1. **Test the AI Assistant**
   - Open your app in the browser
   - Go to the Assistant page
   - Type a message like: "Emitir nota de R$ 500 para João Silva"
   - You should get an AI response (not pattern matching)

2. **Test Voice Input**
   - Click the microphone button
   - Speak a command
   - It should transcribe using Whisper API

3. **Check Backend Logs**
   - If the API key is working, you'll see successful API calls
   - If there's an error, check the console for details

## What OpenAI Enables

### ✅ AI Assistant (Chat Completions)
- **Natural language processing** for invoice commands
- **Intelligent command interpretation** in Portuguese
- **Context-aware responses** based on conversation history
- **Regime-specific adaptations** (MEI, Simples Nacional, etc.)

**Example Commands:**
- "Emitir nota de R$ 1.500 para Maria Santos"
- "Qual meu faturamento este mês?"
- "Listar minhas últimas notas fiscais"
- "Verificar conexão com prefeitura"

### ✅ Voice Transcription (Whisper API)
- **Audio to text conversion** for voice commands
- **Portuguese language support**
- **Real-time transcription** from microphone input

**How to Use:**
- Click the microphone button in the Assistant
- Speak your command
- The audio is transcribed and processed as text

### ✅ Error Explanation (GPT)
- **Fiscal connection errors** explained in Portuguese
- **User-friendly error messages**
- **Actionable troubleshooting steps**

## API Usage & Costs

### Current Configuration
- **Model**: `gpt-4o-mini` (default)
- **Max Tokens**: 1000 per request
- **Temperature**: 0.7 (balanced creativity)

### Cost Estimates (gpt-4o-mini)
- **Input**: ~$0.15 per 1M tokens
- **Output**: ~$0.60 per 1M tokens
- **Whisper**: ~$0.006 per minute of audio

**Typical Usage:**
- Chat message: ~500-1000 tokens (~$0.0005-0.001)
- Voice transcription: ~$0.01-0.05 per minute
- Monthly estimate: $5-20 for moderate usage

### Monitor Usage
- Visit: https://platform.openai.com/usage
- Set up billing alerts: https://platform.openai.com/account/billing

## Troubleshooting

### Issue: "OpenAI API key not configured"
**Solution**: Make sure `OPENAI_API_KEY` is in your `.env` file and the server was restarted.

### Issue: "Invalid API key"
**Solution**: 
- Verify the key is correct (starts with `sk-`)
- Check for extra spaces or quotes
- Ensure you copied the full key

### Issue: "Insufficient quota"
**Solution**:
- Add payment method: https://platform.openai.com/account/billing
- Check usage limits in your account

### Issue: "Rate limit exceeded"
**Solution**:
- You're making too many requests
- Wait a few minutes and try again
- Consider upgrading your OpenAI plan

### Issue: Fallback to pattern matching
**Solution**:
- Check if `OPENAI_API_KEY` is set correctly
- Verify the server was restarted after adding the key
- Check backend logs for API errors

## Security Best Practices

1. **Never commit `.env` file**
   - Already in `.gitignore` ✅
   - Never share your API key publicly

2. **Use different keys for environments**
   - Development: One key
   - Production: Separate key
   - Staging: Another key

3. **Rotate keys regularly**
   - Create new keys periodically
   - Revoke old unused keys

4. **Monitor usage**
   - Set up billing alerts
   - Review usage regularly
   - Check for unexpected spikes

## Environment Variables Summary

```env
# Required for AI features
OPENAI_API_KEY=sk-proj-your-key-here

# Optional - defaults to gpt-4o-mini
OPENAI_MODEL=gpt-4o-mini
```

## Next Steps

1. ✅ Add API key to `.env`
2. ✅ Restart backend server
3. ✅ Test AI assistant
4. ✅ Test voice input
5. ✅ Monitor usage in OpenAI dashboard

## Support

- **OpenAI Documentation**: https://platform.openai.com/docs
- **API Status**: https://status.openai.com/
- **Billing**: https://platform.openai.com/account/billing
