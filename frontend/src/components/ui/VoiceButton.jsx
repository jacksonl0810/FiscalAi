import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { assistantService } from "@/api/services";

export default function VoiceButton({ onVoiceInput, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
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
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Check if we have any audio chunks
        if (audioChunksRef.current.length === 0) {
          console.warn('[VoiceButton] No audio chunks recorded');
          alert('Nenhum áudio gravado. Por favor, tente novamente.');
          setIsRecording(false);
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
          alert('Gravação muito curta. Por favor, grave pelo menos 1 segundo de áudio.');
          setIsRecording(false);
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
              alert(result.message || 'Não foi possível entender o áudio. Por favor, fale mais alto e claramente.');
              return;
            }
          }
          
          if (result.text && result.text.trim()) {
            onVoiceInput?.(result.text.trim());
          } else {
            alert('Não foi possível transcrever o áudio. Por favor, fale mais alto e claramente, em um ambiente silencioso.');
          }
        } catch (error) {
          console.error('Error transcribing audio:', error);
          let errorMessage = 'Erro ao transcrever áudio. Por favor, tente novamente.';
          
          if (error?.message) {
            errorMessage = error.message;
          } else if (error?.response?.data?.message) {
            errorMessage = error.response.data.message;
          }
          
          // Show user-friendly error messages
          if (errorMessage.includes('TLS') || errorMessage.includes('socket') || errorMessage.includes('network') || errorMessage.includes('conexão')) {
            errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
          } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
            errorMessage = 'Tempo limite excedido. Tente novamente.';
          } else if (errorMessage.includes('curta') || errorMessage.includes('short')) {
            errorMessage = 'Gravação muito curta. Por favor, grave pelo menos 2 segundos de áudio.';
          }
          
          alert(errorMessage);
        } finally {
          setIsTranscribing(false);
          setIsRecording(false);
        }
      };

      // Start recording with 250ms timeslice to collect data regularly
      mediaRecorder.start(250);
      setIsRecording(true);
      console.log('[VoiceButton] Recording started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Não foi possível acessar o microfone. Por favor, verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Request final data before stopping
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
      // Don't set isRecording to false here - let onstop handle it
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
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      disabled={disabled}
      className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
        isRecording
          ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-500 text-white shadow-lg shadow-red-500/30 border border-red-400/30'
          : isTranscribing
          ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 border border-blue-400/30'
          : 'bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500 text-white hover:from-orange-600 hover:via-orange-500 hover:to-orange-600 shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 border border-orange-400/30'
      } ${disabled || isTranscribing ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled || isTranscribing}
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
          >
            <MicOff className="w-6 h-6" />
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
  );
}