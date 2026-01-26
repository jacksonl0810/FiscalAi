import apiClient from '../client';
import type { Notification, CreateNotificationData } from '@/types';

export const notificationsService = {
  /**
   * Get all notifications for the current user
   */
  async list(params?: { sort?: string }): Promise<Notification[]> {
    const response = await apiClient.get<Notification[]>('/notifications', { params });
    return response.data;
  },

  /**
   * Get unread notifications
   */
  async listUnread(): Promise<Notification[]> {
    const response = await apiClient.get<Notification[]>('/notifications', {
      params: { unread: true },
    });
    return response.data;
  },

  /**
   * Get a single notification
   */
  async get(id: string): Promise<Notification> {
    const response = await apiClient.get<Notification>(`/notifications/${id}`);
    return response.data;
  },

  /**
   * Create a notification (usually done by backend)
   */
  async create(data: CreateNotificationData): Promise<Notification> {
    const response = await apiClient.post<Notification>('/notifications', data);
    return response.data;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification> {
    const response = await apiClient.put<Notification>(`/notifications/${id}`, { lida: true });
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    await apiClient.post('/notifications/mark-all-read');
  },

  /**
   * Delete a notification
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
  },

  /**
   * Delete all notifications
   */
  async deleteAll(): Promise<void> {
    await apiClient.delete('/notifications/delete-all');
  },

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get<{ count: number }>('/notifications/unread-count');
    return response.data.count;
  },
};

export default notificationsService;
