import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// Vite provides import.meta.env at runtime, but TypeScript needs type definitions
// The vite-env.d.ts file should provide these, but as a fallback we use type assertion
interface ImportMetaEnv {
  VITE_API_URL?: string;
}

const getApiBaseUrl = () => {
  const envUrl = ((import.meta as unknown as { env: ImportMetaEnv }).env?.VITE_API_URL);
  if (envUrl && !envUrl.startsWith('/')) {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Don't set default Content-Type - let axios set it automatically based on data type
// For JSON, axios will set application/json
// For FormData, axios will set multipart/form-data with correct boundary

// Token management
const TOKEN_KEY = 'fiscalai_token';
const REFRESH_TOKEN_KEY = 'fiscalai_refresh_token';

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setRefreshToken = (token: string): void => {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
};

export const clearTokens = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// Request interceptor - add auth token and set Content-Type appropriately
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Skip Authorization header for public endpoints
    const publicEndpoints = [
      '/subscriptions/tokenize-card',
      '/auth/register',
      '/auth/login',
      '/auth/refresh',
      '/auth/google/check',
      '/auth/google',
      '/auth/verify-email',
      '/auth/resend-verification',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/assistant/translate-error',
    ];
    
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      config.url?.includes(endpoint)
    );
    
    const token = getToken();
    if (token && config.headers && !isPublicEndpoint) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Only set Content-Type for non-FormData requests
    // FormData needs axios to set multipart/form-data with the correct boundary automatically
    if (config.data && !(config.data instanceof FormData) && config.headers) {
      if (!config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // For public endpoints, NEVER try to refresh token - just reject immediately
      const publicEndpoints = [
        '/subscriptions/tokenize-card',
        '/auth/register',
        '/auth/login',
        '/auth/refresh',
        '/auth/verify-email',
        '/auth/resend-verification',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/assistant/translate-error',
      ];
      
      const isPublicEndpoint = publicEndpoints.some(endpoint => 
        originalRequest.url?.includes(endpoint)
      );
      
      // For public endpoints, don't try to refresh - just reject
      if (isPublicEndpoint) {
        const errorData = error.response?.data as { message?: string; code?: string } | undefined;
        return Promise.reject({
          message: errorData?.message || 'Not authenticated',
          status: 401,
          code: errorData?.code || 'NOT_AUTHENTICATED',
        });
      }
      
      // For /auth/me endpoint, if there's no token, this is expected - don't try to refresh
      const isAuthMeEndpoint = originalRequest.url?.includes('/auth/me');
      const token = getToken();
      
      if (isAuthMeEndpoint && !token) {
        // Expected 401 when checking auth status without token - just reject silently
        return Promise.reject({
          message: 'Not authenticated',
          status: 401,
          code: 'NOT_AUTHENTICATED',
        });
      }

      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token: newToken, refreshToken: newRefreshToken } = response.data;
          setToken(newToken);
          if (newRefreshToken) {
            setRefreshToken(newRefreshToken);
          }

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        } catch (refreshError) {
          // Refresh failed - clear tokens
          clearTokens();
          // Only redirect if not already on login page and not checking auth status
          if (!isAuthMeEndpoint && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token - clear tokens
        clearTokens();
        // Only redirect if not already on login page and not checking auth status
        if (!isAuthMeEndpoint && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    // Extract error message
    const errorMessage = 
      (error.response?.data as { message?: string })?.message || 
      error.message || 
      'An unexpected error occurred';

    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      code: (error.response?.data as { code?: string })?.code,
    });
  }
);

export default apiClient;
