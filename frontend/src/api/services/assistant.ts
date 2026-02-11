import apiClient from '../client';
import type { AIResponse, AIMessage } from '@/types';

export const assistantService = {
  /**
   * Process an AI command/message
   */
  async processCommand(data: {
    message: string;
    companyId?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
  }): Promise<AIResponse> {
    const response = await apiClient.post<AIResponse>('/assistant/process', data);
    return response.data;
  },

  /**
   * Get suggested actions based on context
   */
  async getSuggestions(companyId?: string): Promise<string[]> {
    const response = await apiClient.get<string[]>('/assistant/suggestions', {
      params: { companyId },
    });
    return response.data;
  },

  /**
   * Transcribe audio to text (voice input)
   */
  async transcribeAudio(audioBlob: Blob): Promise<{ text: string; warning?: string; message?: string }> {
    // Validate blob
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Audio recording is empty. Please try recording again.');
    }

    if (audioBlob.size < 1024) {
      throw new Error('Recording is too short. Please record at least 1 second of audio.');
    }

    console.log('[transcribeAudio] Sending audio:', {
      size: audioBlob.size,
      type: audioBlob.type
    });

    const formData = new FormData();
    
    // Determine file extension from MIME type
    let extension = 'webm';
    if (audioBlob.type.includes('ogg')) extension = 'ogg';
    else if (audioBlob.type.includes('mp4')) extension = 'mp4';
    else if (audioBlob.type.includes('wav')) extension = 'wav';
    else if (audioBlob.type.includes('mp3') || audioBlob.type.includes('mpeg')) extension = 'mp3';
    
    // Use a File object with proper name and type for better compatibility
    const audioFile = new File([audioBlob], `recording.${extension}`, { 
      type: audioBlob.type || 'audio/webm' 
    });
    formData.append('audio', audioFile);

    console.log('[transcribeAudio] FormData created with file:', audioFile.name, audioFile.type, audioFile.size);

    // Don't set Content-Type header - axios will set it automatically with boundary
    const response = await apiClient.post<{ status: string; message: string; data?: { text: string; warning?: string; details?: string } }>('/assistant/transcribe', formData);
    
    console.log('[transcribeAudio] Response:', response.data);
    
    // Handle both response formats (wrapped in data or direct)
    let text = '';
    let warning = '';
    let message = response.data.message || '';
    
    if (response.data.data?.text) {
      text = response.data.data.text;
    } else if ((response.data as any).text) {
      text = (response.data as any).text;
    }
    
    if (response.data.data?.warning) {
      warning = response.data.data.warning;
    }
    
    // Return warning info so the caller can handle it
    if (warning === 'HALLUCINATION_DETECTED' || warning === 'NO_SPEECH_DETECTED') {
      return { text: '', warning, message };
    }
    
    return { text, warning, message };
  },

  /**
   * Get conversation history
   */
  async getHistory(limit?: number): Promise<AIMessage[]> {
    const response = await apiClient.get<AIMessage[]>('/assistant/history', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<void> {
    await apiClient.delete('/assistant/history');
  },

  /**
   * Save a message to conversation history
   * Used to persist success/error messages generated client-side
   */
  async saveMessage(data: {
    role: 'user' | 'assistant';
    content: string;
    metadata?: object;
  }): Promise<{ id: string; role: string; content: string; createdAt: string }> {
    const response = await apiClient.post<{ status: string; data: any }>('/assistant/history', data);
    return response.data.data;
  },

  async executeAction(data: {
    action_type: string;
    action_data: any;
    company_id: string;
  }): Promise<{ status: string; message: string; data?: any }> {
    const response = await apiClient.post<{ status: string; message: string; data?: any }>(
      '/assistant/execute-action',
      data
    );
    return response.data;
  },

  async translateError(error: string | object, context?: object): Promise<{
    message: string;
    explanation: string;
    action: string;
    category: string;
    ai_explanation: string;
  }> {
    const response = await apiClient.post<{ status: string; data: any }>('/assistant/translate-error', {
      error,
      context
    });
    return response.data.data || response.data;
  },

  async validateIssuance(companyId: string, invoiceData: object): Promise<{
    valid: boolean;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
    company: object;
    limits: object;
  }> {
    const response = await apiClient.post<{ status: string; data: any }>('/assistant/validate-issuance', {
      company_id: companyId,
      invoice_data: invoiceData
    });
    return response.data.data || response.data;
  },

  /**
   * Validate client data against registered clients
   * Used when editing invoice preview
   */
  async validateClient(data: {
    cliente_nome?: string;
    cliente_documento?: string;
  }): Promise<{
    status: string;
    found: boolean;
    canAutoCreate?: boolean;
    documentValid?: boolean;
    client?: {
      id: string;
      nome: string;
      documento: string;
      tipoPessoa: string;
      email?: string;
      telefone?: string;
    };
    suggestedData?: {
      nome: string;
      documento: string;
      tipoPessoa: string;
    };
    similarClients?: Array<{
      id: string;
      nome: string;
      documento: string;
    }>;
    message: string;
  }> {
    const response = await apiClient.post<any>('/assistant/validate-client', data);
    return response.data;
  },
};

export default assistantService;
