import React, { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { authService, getToken, setToken, setRefreshToken } from '@/api/services';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const lastCheckRef = useRef(0);
  const isCheckingRef = useRef(false);
  const MIN_CHECK_INTERVAL = 5000;
  const MIN_FORCE_INTERVAL = 1000;

  const checkAuth = useCallback(async (skipLoading = false) => {
    if (isCheckingRef.current) return;
    
    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckRef.current;
    
    if (!skipLoading && timeSinceLastCheck < MIN_CHECK_INTERVAL) {
      return;
    }
    
    if (skipLoading && timeSinceLastCheck < MIN_FORCE_INTERVAL) {
      return;
    }
    
    isCheckingRef.current = true;
    lastCheckRef.current = now;

    try {
      // CRITICAL FIX: Only show loading spinner on initial auth check, NOT on background refresh
      // Setting isLoadingAuth causes ProtectedRoute to unmount children, destroying form state!
      if (!skipLoading) {
        setIsLoadingAuth(true);
      }
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
      if (error.status !== 401) {
        console.error('Auth check failed:', error);
      }
      setIsAuthenticated(false);
      setUser(null);

      if (error.status === 401) {
        setAuthError(null);
      } else {
        setAuthError({
          type: 'unknown',
          message: error.message || 'Authentication failed',
        });
      }
    } finally {
      setIsLoadingAuth(false);
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Refetch user when tab becomes visible (e.g. after payment in another tab / return to app)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        checkAuth(true); // skipLoading=true to avoid unmounting children
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isAuthenticated, checkAuth]);

  const login = useCallback(async (email, password) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const response = await authService.login({ email, password });
      
      // After login, fetch full user data from /auth/me to get subscription info
      // The login response only returns basic user fields (no subscription_status)
      let fullUser;
      try {
        fullUser = await authService.me();
      } catch (meError) {
        console.error('[AuthContext] Failed to fetch /auth/me, using login response user:', meError);
        // Fallback to login response user if /me fails
        fullUser = response.user;
      }
      
      setUser(fullUser);
      setIsAuthenticated(true);
      
      return { ...response, user: fullUser };
    } catch (error) {
      setAuthError({
        type: 'login_failed',
        message: error.message || 'Invalid email or password',
      });
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const response = await authService.register({ name, email, password });
      
      // After register, fetch full user data from /auth/me to get subscription info
      let fullUser;
      try {
        fullUser = await authService.me();
      } catch {
        // Fallback to register response user if /me fails
        fullUser = response.user;
      }
      
      setUser(fullUser);
      setIsAuthenticated(true);
      
      return { ...response, user: fullUser };
    } catch (error) {
      setAuthError({
        type: 'register_failed',
        message: error.message || 'Registration failed',
      });
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const response = await authService.googleLogin(credential);
      
      setToken(response.token);
      setRefreshToken(response.refreshToken);
      
      // Set user directly from response - no need for extra API call
      setUser(response.user);
      setIsAuthenticated(true);
      
      return response;
    } catch (error) {
      setAuthError({
        type: 'google_login_failed',
        message: error.message || 'Falha ao fazer login com Google',
      });
      throw error;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Expose refreshUser method for components to call after subscription changes
  const refreshUser = useCallback(async () => {
    await checkAuth(true); // Force refresh, bypass debounce
  }, [checkAuth]);

  // Set user directly without API call (used by OAuth callback)
  const setUserDirectly = useCallback((userData) => {
    if (userData) {
      setUser(userData);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthError(null);
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings: false,
    authError,
    login,
    register,
    logout,
    loginWithGoogle,
    navigateToLogin,
    checkAuth,
    clearError,
    refreshUser,
    setUserDirectly,
  }), [user, isAuthenticated, isLoadingAuth, authError, login, register, logout, loginWithGoogle, navigateToLogin, checkAuth, clearError, refreshUser, setUserDirectly]);

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
