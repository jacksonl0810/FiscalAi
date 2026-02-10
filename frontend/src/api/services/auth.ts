import apiClient, { setToken, setRefreshToken, clearTokens, getToken } from '../client';
import type { User, AuthResponse, LoginCredentials, RegisterData } from '@/types';

export const authService = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    const { token, refreshToken } = response.data;
    
    setToken(token);
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
    
    return response.data;
  },

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    const { token, refreshToken } = response.data;
    
    setToken(token);
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
    
    return response.data;
  },

  /**
   * Get current authenticated user
   */
  async me(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Logout - clear tokens and optionally call backend
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Ignore logout errors
    } finally {
      clearTokens();
    }
  },

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    return !!getToken();
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password: newPassword });
  },

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>('/auth/profile', data);
    return response.data;
  },

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  },

  /**
   * Login with Google credential
   */
  async googleLogin(credential: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/google/token', { credential });
    const { token, refreshToken } = response.data;
    
    setToken(token);
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
    
    return response.data;
  },

  /**
   * Check if Google OAuth is configured
   */
  async checkGoogleConfig(): Promise<{ configured: boolean }> {
    const response = await apiClient.get<{ configured: boolean }>('/auth/google/check');
    return response.data;
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/verify-email', { token });
    const { token: accessToken, refreshToken } = response.data;
    
    if (accessToken) {
      setToken(accessToken);
    }
    if (refreshToken) {
      setRefreshToken(refreshToken);
    }
    
    return response.data;
  },

  /**
   * Resend email verification
   */
  async resendVerification(email: string): Promise<{ message: string; alreadyVerified?: boolean }> {
    const response = await apiClient.post<{ message: string; alreadyVerified?: boolean }>('/auth/resend-verification', { email });
    return response.data;
  },
};

export default authService;
