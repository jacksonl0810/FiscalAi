import apiClient from '../client';
import type { UserSettings, UpdateUserSettingsData } from '@/types';

export const settingsService = {
  /**
   * Get current user settings
   */
  async get(): Promise<UserSettings | null> {
    try {
      const response = await apiClient.get<UserSettings>('/settings');
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Create or update user settings
   */
  async save(data: UpdateUserSettingsData): Promise<UserSettings> {
    const response = await apiClient.put<UserSettings>('/settings', data);
    return response.data;
  },

  /**
   * Update specific setting
   */
  async update(data: UpdateUserSettingsData): Promise<UserSettings> {
    const response = await apiClient.patch<UserSettings>('/settings', data);
    return response.data;
  },

  /**
   * Set active company
   */
  async setActiveCompany(companyId: string): Promise<UserSettings> {
    const response = await apiClient.patch<UserSettings>('/settings', {
      active_company_id: companyId,
    });
    return response.data;
  },

  /**
   * Set theme
   */
  async setTheme(theme: 'dark' | 'light'): Promise<UserSettings> {
    const response = await apiClient.patch<UserSettings>('/settings', { theme });
    return response.data;
  },

  /**
   * Set font size
   */
  async setFontSize(fontSize: 'small' | 'medium' | 'large'): Promise<UserSettings> {
    const response = await apiClient.patch<UserSettings>('/settings', { font_size: fontSize });
    return response.data;
  },
};

export default settingsService;
