import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for playing audio from base64 or URL
 * Used for TTS playback in the assistant
 */
export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const currentUrlRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
      }
    };
  }, []);

  /**
   * Play audio from base64 string
   * @param {string} base64Audio - Base64 encoded audio data
   * @param {string} format - Audio format (mp3, wav, etc.)
   */
  const playBase64 = useCallback(async (base64Audio, format = 'mp3') => {
    if (!base64Audio) {
      setError('No audio data provided');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Revoke old URL if exists
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
      }

      // Convert base64 to blob
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: `audio/${format}` });
      
      // Create URL for audio element
      const audioUrl = URL.createObjectURL(blob);
      currentUrlRef.current = audioUrl;

      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = (e) => {
        console.error('[AudioPlayer] Playback error:', e);
        setError('Failed to play audio');
        setIsPlaying(false);
        setIsLoading(false);
      };

      await audio.play();
    } catch (err) {
      console.error('[AudioPlayer] Error playing audio:', err);
      setError(err.message || 'Failed to play audio');
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, []);

  /**
   * Play audio from URL
   * @param {string} url - Audio URL
   */
  const playUrl = useCallback(async (url) => {
    if (!url) {
      setError('No audio URL provided');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = (e) => {
        console.error('[AudioPlayer] Playback error:', e);
        setError('Failed to play audio');
        setIsPlaying(false);
        setIsLoading(false);
      };

      await audio.play();
    } catch (err) {
      console.error('[AudioPlayer] Error playing audio:', err);
      setError(err.message || 'Failed to play audio');
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, []);

  /**
   * Stop currently playing audio
   */
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  /**
   * Pause currently playing audio
   */
  const pause = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  /**
   * Resume paused audio
   */
  const resume = useCallback(async () => {
    if (audioRef.current && !isPlaying) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        setError(err.message);
      }
    }
  }, [isPlaying]);

  return {
    isPlaying,
    isLoading,
    error,
    playBase64,
    playUrl,
    stop,
    pause,
    resume
  };
}

export default useAudioPlayer;
