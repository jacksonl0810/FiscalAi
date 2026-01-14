# Fiscal Status UI Button with GPT Error Explanation

## Overview

The fiscal status indicator now includes a "Verificar conexão com prefeitura" button that uses GPT to explain connection errors in Portuguese when verification fails.

## Implementation

### Frontend Component

**File:** `frontend/src/components/layout/FiscalStatusIndicator.jsx`

**Features:**
1. **Button Text**: "Verificar conexão com prefeitura" (as per requirements)
2. **Error Detection**: Automatically detects when connection verification fails
3. **GPT Explanation**: Calls AI assistant to explain errors in Portuguese
4. **Visual Feedback**: Shows loading state while GPT analyzes error
5. **Error Display**: Shows GPT explanation in a highlighted box below the status

### Flow

1. **User Clicks Button**
   ```
   User clicks "Verificar conexão com prefeitura"
   → verifyMutation.mutate() called
   ```

2. **Connection Check**
   ```
   POST /api/companies/:id/check-fiscal-connection
   → Real Nuvem Fiscal API call
   → Returns connection status
   ```

3. **Error Detection**
   ```
   If status === 'falha':
   → explainError() called
   → GPT prompt created with error details
   ```

4. **GPT Explanation**
   ```
   POST /api/assistant/process
   → GPT analyzes error
   → Returns explanation in Portuguese
   → Displayed to user
   ```

### GPT Prompt

When an error occurs, the system sends this prompt to GPT:

```
Explique de forma clara e em português brasileiro o seguinte erro de conexão fiscal:

"[error details]"

Forneça:
1. Uma explicação simples do problema
2. Possíveis causas
3. Passos para resolver

Seja conciso e direto.
```

### UI States

**Success State:**
- Green indicator: "🟢 Conectado"
- No GPT explanation shown
- Button available for re-verification

**Failure State:**
- Red indicator: "🔴 Falha de conexão"
- GPT explanation automatically requested
- Explanation shown in blue highlighted box
- Button available for retry

**Loading State:**
- Yellow indicator: "🟡 Verificando"
- Button disabled during verification
- GPT explanation loading shown if error detected

### Error Explanation Display

The GPT explanation appears in a styled box:
- **Background**: Blue tint (`bg-blue-500/10`)
- **Border**: Blue border (`border-blue-500/20`)
- **Icon**: Sparkles icon (AI indicator)
- **Text**: Gray text with proper formatting
- **Animation**: Smooth fade in/out

### Example Error Explanations

**Error:** "Empresa não encontrada na Nuvem Fiscal"

**GPT Explanation:**
```
O problema indica que a empresa não está registrada no sistema da Nuvem Fiscal.

Possíveis causas:
- A empresa ainda não foi cadastrada na plataforma
- O ID da empresa pode estar incorreto
- A empresa pode ter sido removida do sistema

Passos para resolver:
1. Verifique se a empresa foi registrada corretamente
2. Tente registrar a empresa novamente na Nuvem Fiscal
3. Confirme que o ID da empresa está correto
```

**Error:** "Erro de autenticação com Nuvem Fiscal"

**GPT Explanation:**
```
O sistema não conseguiu autenticar com a Nuvem Fiscal.

Possíveis causas:
- Credenciais (CLIENT_ID ou CLIENT_SECRET) estão incorretas
- As credenciais podem ter expirado
- Problema de configuração no ambiente

Passos para resolver:
1. Verifique as credenciais no arquivo .env
2. Confirme que CLIENT_ID e CLIENT_SECRET estão corretos
3. Entre em contato com o suporte da Nuvem Fiscal se necessário
```

## Benefits

1. **User-Friendly**: Errors explained in simple Portuguese
2. **Actionable**: Provides steps to resolve issues
3. **Automatic**: No need to manually ask for explanation
4. **Contextual**: Explanation appears right where the error is shown
5. **AI-Powered**: Uses GPT for natural language explanations

## Integration Points

### Backend
- `POST /api/companies/:id/check-fiscal-connection` - Returns connection status
- `POST /api/assistant/process` - Processes GPT explanation request

### Frontend
- `FiscalStatusIndicator` component - Main UI component
- `companiesService.checkFiscalConnection()` - API call
- `assistantService.processCommand()` - GPT explanation

## Error Handling

- **GPT Unavailable**: Falls back to showing original error message
- **Network Error**: Shows error without GPT explanation
- **Timeout**: Handles gracefully, shows original error
- **Invalid Response**: Validates GPT response before displaying

## Future Enhancements

- [ ] Cache GPT explanations for common errors
- [ ] Add "Copy explanation" button
- [ ] Support for multiple languages
- [ ] Detailed troubleshooting guide links
- [ ] Error history tracking
- [ ] Proactive error detection
