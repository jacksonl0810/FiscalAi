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
  async transcribeAudio(audioBlob: Blob): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append('audio', audioBlob);

    const response = await apiClient.post<{ status: string; message: string; data?: { text: string } }>('/assistant/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    // Handle both response formats (wrapped in data or direct)
    if (response.data.data?.text) {
      return { text: response.data.data.text };
    }
    if ((response.data as any).text) {
      return { text: (response.data as any).text };
    }
    throw new Error('No transcription text in response');
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
   * Execute an AI action (e.g., emit invoice)
   */
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
};

export default assistantService;
