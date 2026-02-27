import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { assistantService } from "@/api/services";

const MAX_RECORDING_MS = 30 * 1000; // 30 seconds max

export default function VoiceButton({ onVoiceInput, disabled, showTimer = true }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const maxDurationTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current?.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Format seconds to MM:SS
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const checkMicrophonePermission = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      if (permissionStatus.state === 'denied') {
        setPermissionDenied(true);
        return false;
      }
      setPermissionDenied(false);
      return true;
    } catch {
      // Permissions API not supported, try to access directly
      return true;
    }
  };

  const startRecording = async () => {
    // Check permission first
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) {
      toast.error('Permissão do microfone negada. Verifique as configurações do navegador.', { duration: 4000 });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      setPermissionDenied(false);

      // Try different MIME types for browser compatibility
      let mimeType = 'audio/webm';
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
      ];
      
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      
      console.log('[VoiceButton] Using MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('[VoiceButton] Recording stopped, chunks:', audioChunksRef.current.length);
        
        // Clear timers
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Check if we have any audio chunks
        if (audioChunksRef.current.length === 0) {
          console.warn('[VoiceButton] No audio chunks recorded');
          toast.error('Nenhum áudio gravado. Tente novamente.', { duration: 4000 });
          setIsRecording(false);
          setRecordingTime(0);
          return;
        }

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        
        console.log('[VoiceButton] Audio blob created:', {
          size: audioBlob.size,
          type: audioBlob.type,
          chunks: audioChunksRef.current.length
        });

        // Validate blob size
        if (audioBlob.size < 1024) {
          console.warn('Audio recording too short:', audioBlob.size, 'bytes');
          toast.error('Gravação muito curta. Grave pelo menos 1 segundo.', { duration: 4000 });
          setIsRecording(false);
          setRecordingTime(0);
          return;
        }
        
        // Transcribe audio
        setIsTranscribing(true);
        try {
          const result = await assistantService.transcribeAudio(audioBlob);
          
          // Check for warnings (hallucination, no speech detected, etc.)
          if (result.warning) {
            console.log('[VoiceButton] Transcription warning:', result.warning);
            if (result.warning === 'HALLUCINATION_DETECTED' || result.warning === 'NO_SPEECH_DETECTED') {
              toast.error(result.message || 'Não entendi. Fale mais alto e claramente.', { duration: 4000 });
              return;
            }
          }
          
          if (result.text && result.text.trim()) {
            onVoiceInput?.(result.text.trim());
          } else {
            toast.error('Não foi possível transcrever. Tente falar mais claramente.', { duration: 4000 });
          }
        } catch (err) {
          console.error('Error transcribing audio:', err);
          let errorMessage = 'Erro ao transcrever. Tente novamente.';
          
          if (err?.message) {
            errorMessage = err.message;
          } else if (err?.response?.data?.message) {
            errorMessage = err.response.data.message;
          }
          
          // Simplify error messages
          if (errorMessage.includes('TLS') || errorMessage.includes('socket') || errorMessage.includes('network') || errorMessage.includes('conexão')) {
            errorMessage = 'Erro de conexão. Verifique sua internet.';
          } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            errorMessage = 'Tempo limite excedido. Tente novamente.';
          } else if (errorMessage.includes('curta') || errorMessage.includes('short')) {
            errorMessage = 'Gravação muito curta. Grave pelo menos 2 segundos.';
          }
          
          toast.error(errorMessage, { duration: 4000 });
        } finally {
          setIsTranscribing(false);
          setIsRecording(false);
          setRecordingTime(0);
        }
      };

      // Start recording with 250ms timeslice
      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer (update every second)
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Auto-stop after max duration
      maxDurationTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORDING_MS);
      
      console.log('[VoiceButton] Recording started (max %ds)', MAX_RECORDING_MS / 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        toast.error('Permissão do microfone negada. Clique no ícone de cadeado na barra de endereço para permitir.', { duration: 5000 });
      } else if (err.name === 'NotFoundError') {
        toast.error('Nenhum microfone encontrado. Conecte um microfone e tente novamente.', { duration: 4000 });
      } else if (err.name === 'NotReadableError') {
        toast.error('Microfone em uso por outro aplicativo. Feche outros apps e tente novamente.', { duration: 4000 });
      } else {
        toast.error('Não foi possível acessar o microfone. Verifique as permissões.', { duration: 4000 });
      }
    }
  };

  const stopRecording = () => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Recording timer */}
      <AnimatePresence>
        {isRecording && showTimer && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-xl"
          >
            <motion.div 
              className="w-2 h-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="text-red-400 text-sm font-mono min-w-[40px]">
              {formatTime(recordingTime)}
            </span>
            <span className="text-red-400/60 text-xs">
              / {formatTime(MAX_RECORDING_MS / 1000)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcribing indicator */}
      <AnimatePresence>
        {isTranscribing && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl"
          >
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
            <span className="text-blue-400 text-sm">Transcrevendo...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        title={
          permissionDenied 
            ? 'Permissão do microfone negada' 
            : isRecording 
            ? 'Clique para parar' 
            : isTranscribing 
            ? 'Processando áudio...' 
            : 'Clique para gravar'
        }
        className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
          permissionDenied
            ? 'bg-gradient-to-br from-gray-500 via-gray-600 to-gray-500 text-white shadow-lg shadow-gray-500/30 border border-gray-400/30'
            : isRecording
            ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-500 text-white shadow-lg shadow-red-500/30 border border-red-400/30'
            : isTranscribing
            ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 border border-blue-400/30'
            : 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500 text-white hover:from-orange-600 hover:via-orange-500 hover:to-orange-600 shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 border border-orange-400/30'
        } ${disabled || isTranscribing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <AnimatePresence mode="wait">
          {isTranscribing ? (
            <motion.div
              key="transcribing"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Loader2 className="w-6 h-6 animate-spin" />
            </motion.div>
          ) : isRecording ? (
            <motion.div
              key="recording"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="flex flex-col items-center"
            >
              <MicOff className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">PARAR</span>
            </motion.div>
          ) : permissionDenied ? (
            <motion.div
              key="denied"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <AlertCircle className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Mic className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Recording pulse animation */}
        {isRecording && (
          <>
            <motion.div
              className="absolute inset-0 rounded-2xl bg-red-500"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-2xl bg-red-500"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            />
          </>
        )}
      </motion.button>

    </div>
  );
}
