# Conversation History Persistence

## Overview

Conversation history is now persisted in the database, allowing users to see their previous conversations with the AI assistant when they return to the app.

## Database Model

### ConversationMessage Model

```prisma
model ConversationMessage {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  role      String   // 'user' or 'assistant'
  content   String   @db.Text
  metadata  Json?    // Store action data, timestamps, etc.
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("conversation_messages")
}
```

**Fields:**
- `id`: Unique identifier (UUID)
- `userId`: Foreign key to User
- `role`: Message role - `'user'` or `'assistant'`
- `content`: Message content (text)
- `metadata`: Optional JSON field for storing action data, company ID, etc.
- `createdAt`: Timestamp when message was created

## Implementation

### Backend

1. **Save Messages Automatically**
   - User messages saved when `/api/assistant/process` is called
   - Assistant responses saved after processing
   - Pattern matching responses also saved

2. **Load History**
   - `GET /api/assistant/history` - Returns last 50 messages (configurable)
   - Messages ordered by creation date (ascending)
   - Includes metadata for action data

3. **Clear History**
   - `DELETE /api/assistant/history` - Deletes all messages for user
   - Cascade delete when user is deleted

### Frontend

1. **Load on Mount**
   - Loads conversation history when Assistant page opens
   - Shows welcome message if no history exists
   - Displays loading state while fetching

2. **Clear History Button**
   - Button in header to clear conversation history
   - Confirmation dialog before clearing
   - Resets to welcome message after clearing

3. **Automatic Persistence**
   - Messages automatically saved as user chats
   - No need to manually save

## API Endpoints

### GET /api/assistant/history

Get conversation history for current user.

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50)

**Response:**
```json
[
  {
    "id": "uuid",
    "role": "user",
    "content": "Emitir nota de R$ 1500 para João Silva",
    "metadata": { "companyId": "..." },
    "createdAt": "2025-01-15T10:30:00Z"
  },
  {
    "id": "uuid",
    "role": "assistant",
    "content": "Entendi! Vou preparar uma nota fiscal...",
    "metadata": { "action": { ... } },
    "createdAt": "2025-01-15T10:30:05Z"
  }
]
```

### DELETE /api/assistant/history

Clear all conversation history for current user.

**Response:**
```json
{
  "status": "success",
  "message": "Histórico de conversa limpo com sucesso"
}
```

## Flow

### 1. User Opens Assistant
```
Frontend → GET /api/assistant/history
Backend → Returns last 50 messages
Frontend → Displays messages or welcome message
```

### 2. User Sends Message
```
Frontend → POST /api/assistant/process { message, conversationHistory }
Backend → Saves user message to database
Backend → Processes with AI (or pattern matching)
Backend → Saves assistant response to database
Backend → Returns response
Frontend → Displays response
```

### 3. User Clears History
```
Frontend → DELETE /api/assistant/history
Backend → Deletes all messages for user
Frontend → Shows welcome message
```

## Benefits

1. **Context Preservation**: AI can reference previous conversations
2. **User Experience**: Users can see their conversation history
3. **Continuity**: Conversations persist across sessions
4. **Analytics**: Can analyze conversation patterns
5. **Debugging**: Can review what was said in previous sessions

## Performance Considerations

- **Indexed Queries**: Index on `userId` and `createdAt` for fast retrieval
- **Limit Messages**: Only loads last 50 messages to avoid large payloads
- **Cascade Delete**: Automatically cleans up when user is deleted
- **JSON Metadata**: Efficient storage of action data

## Future Enhancements

- [ ] Pagination for large conversation histories
- [ ] Search functionality within history
- [ ] Export conversation history
- [ ] Conversation threads/sessions
- [ ] Message editing/deletion
- [ ] Conversation sharing
