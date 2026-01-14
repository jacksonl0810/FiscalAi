import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authService, getToken } from '@/api/services';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // Check if we have a token
      const token = getToken();
      if (!token) {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
        return;
      }

      // Validate token by getting current user
      const currentUser = await authService.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      // 401 is expected when not authenticated - don't log as error
      if (error.status !== 401) {
        console.error('Auth check failed:', error);
      }
      setIsAuthenticated(false);
      setUser(null);

      // Handle specific error types
      if (error.status === 401) {
        // 401 is expected when not authenticated - don't set error state
        setAuthError(null);
      } else {
        setAuthError({
          type: 'unknown',
          message: error.message || 'Authentication failed',
        });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const response = await authService.login({ email, password });
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      setAuthError({
        type: 'login_failed',
        message: error.message || 'Invalid email or password',
      });
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const register = async (name, email, password) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const response = await authService.register({ name, email, password });
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      setAuthError({
        type: 'register_failed',
        message: error.message || 'Registration failed',
      });
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings: false, // For backward compatibility
    authError,
    login,
    register,
    logout,
    navigateToLogin,
    checkAuth,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
