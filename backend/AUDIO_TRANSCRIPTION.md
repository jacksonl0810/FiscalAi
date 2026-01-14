# Audio Transcription with OpenAI Whisper

## Overview

Audio transcription is now implemented using OpenAI's Whisper API, allowing users to speak commands to the AI assistant instead of typing.

## Implementation

### Backend

**Endpoint:** `POST /api/assistant/transcribe`

**Authentication:** Required (JWT token)

**Subscription:** Requires active subscription

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `audio`
- Supported formats: MP3, WAV, WebM, OGG, M4A
- Max file size: 25MB (Whisper API limit)

**Response:**
```json
{
  "status": "success",
  "message": "Audio transcrito com sucesso",
  "data": {
    "text": "Emitir nota fiscal de R$ 1.500 para João Silva"
  }
}
```

**Error Responses:**
- `400 AUDIO_FILE_REQUIRED` - No audio file provided
- `400 UNSUPPORTED_AUDIO_FORMAT` - Unsupported file format
- `400 NO_SPEECH_DETECTED` - No speech found in audio
- `500 OPENAI_NOT_CONFIGURED` - OpenAI API key not configured
- `500 WHISPER_API_ERROR` - OpenAI Whisper API error
- `500 TRANSCRIPTION_ERROR` - General transcription error

### Frontend

**VoiceButton Component:**
- Uses browser MediaRecorder API to record audio
- Records in WebM format with Opus codec
- Shows recording state (red background)
- Shows transcribing state (blue background with spinner)
- Automatically transcribes after recording stops
- Calls `onVoiceInput` callback with transcribed text

**Features:**
- Real-time recording with visual feedback
- Automatic transcription after recording
- Error handling for microphone access
- Loading states during transcription

## Flow

### 1. User Clicks Voice Button
```
User clicks → Request microphone permission → Start recording
```

### 2. Recording
```
MediaRecorder captures audio → Visual feedback (red pulse) → User clicks again to stop
```

### 3. Transcription
```
Stop recording → Create audio blob → POST /api/assistant/transcribe → OpenAI Whisper API
```

### 4. Result
```
Whisper returns text → Call onVoiceInput callback → Process as regular message
```

## Code Structure

### Backend Route
```javascript
router.post('/transcribe', 
  authenticate, 
  requireActiveSubscription, 
  upload.single('audio'),
  asyncHandler(async (req, res) => {
    // Validate OpenAI API key
    // Validate audio file
    // Call Whisper API
    // Return transcribed text
  })
);
```

### Frontend Component
```javascript
const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  // ... recording logic
};

const stopRecording = () => {
  mediaRecorder.stop();
  // Create blob and transcribe
  const result = await assistantService.transcribeAudio(audioBlob);
  onVoiceInput(result.text);
};
```

## Configuration

### Environment Variables
- `OPENAI_API_KEY` - Required for Whisper API access

### Multer Configuration
- Memory storage (no disk writes)
- 25MB file size limit
- Supported MIME types: audio/mpeg, audio/mp3, audio/wav, audio/webm, audio/ogg, audio/m4a

## Browser Compatibility

**MediaRecorder API:**
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ⚠️ Limited support (may need different codec)
- Mobile browsers: ✅ Generally supported

**Fallback:**
- If MediaRecorder not available, shows error message
- User can still type messages manually

## Testing

### Test Recording
1. Click voice button
2. Grant microphone permission
3. Speak: "Emitir nota de R$ 1500 para João Silva"
4. Click again to stop
5. Wait for transcription
6. Verify text appears in input field

### Test Error Handling
1. Deny microphone permission → Should show error
2. Record empty audio → Should handle gracefully
3. Test with different audio formats
4. Test with large files (should reject >25MB)

## Security Considerations

1. **Authentication Required**: Only authenticated users can transcribe
2. **Subscription Check**: Requires active subscription
3. **File Size Limit**: 25MB max to prevent abuse
4. **File Type Validation**: Only audio formats allowed
5. **API Key Security**: OpenAI key stored in environment, never exposed

## Performance

- **Recording**: Real-time, minimal overhead
- **Transcription**: Depends on audio length (Whisper API)
- **Typical latency**: 1-3 seconds for short audio clips
- **File size**: WebM format is efficient, typically <1MB for 10-30 second recordings

## Future Enhancements

- [ ] Real-time transcription (streaming)
- [ ] Multiple language support
- [ ] Audio quality optimization
- [ ] Offline transcription fallback
- [ ] Transcription history
- [ ] Voice command shortcuts
