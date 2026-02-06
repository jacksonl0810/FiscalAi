import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { setToken, setRefreshToken } from "@/api/services";
import { authService } from "@/api/services";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Determine the correct redirect path based on user subscription status.
 * Same logic as Login.jsx - ensures consistent redirect behavior.
 */
const getRedirectPath = (userData, isNewUser) => {
  // New users always go to pricing to select a plan
  if (isNewUser) {
    return '/pricing';
  }
  
  if (!userData) {
    console.warn('[Google Callback] No user data, redirecting to pricing');
    return '/pricing';
  }
  
  const status = userData?.subscription_status;
  const plan = userData?.plan;
  const isInTrial = userData?.is_in_trial;
  const trialDaysRemaining = userData?.trial_days_remaining;
  const daysRemaining = userData?.days_remaining;
  
  // ✅ PRIORITY 1: User has a plan → dashboard
  if (plan) {
    const planLower = String(plan).toLowerCase();
    if (planLower === 'pro' || planLower === 'business' || planLower === 'trial' || planLower === 'essential') {
      return '/';
    }
    return '/';
  }
  
  // ✅ PRIORITY 2: Active subscription status → dashboard
  const statusLower = status?.toLowerCase();
  if (statusLower === 'trial' || statusLower === 'ativo' || statusLower === 'active' || statusLower === 'trialing') {
    return '/';
  }
  
  // ✅ PRIORITY 3: Trial days remaining → dashboard
  if (isInTrial && trialDaysRemaining > 0) {
    return '/';
  }
  
  // ✅ PRIORITY 4: Subscription days remaining → dashboard
  if (daysRemaining > 0) {
    return '/';
  }
  
  // 🚫 REDIRECT: Pending payment
  if (statusLower === 'pending') {
    return '/subscription-pending';
  }
  
  // 🚫 REDIRECT: Payment failed or overdue
  if (statusLower === 'inadimplente' || statusLower === 'past_due') {
    return '/payment-delinquent';
  }
  
  // 🚫 REDIRECT: Subscription canceled
  if (statusLower === 'cancelado' || statusLower === 'canceled') {
    return '/subscription-blocked';
  }
  
  // 🚫 REDIRECT: No subscription → pricing page
  return '/pricing';
};

/**
 * Google OAuth Callback Page
 * Handles the redirect from Google OAuth and processes the tokens
 * 
 * Standard OAuth 2.0 flow:
 * 1. User clicks "Login with Google" -> redirected to Google
 * 2. Google authenticates -> redirects back to backend /api/auth/google/callback
 * 3. Backend validates, creates/finds user -> redirects here with tokens + user data
 * 4. This page stores tokens and sets user state directly (no extra API call)
 * 5. Redirects to dashboard
 */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUserDirectly, refreshUser } = useAuth();
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [errorMessage, setErrorMessage] = useState("");
  
  // Prevent double execution (React 18 Strict Mode calls useEffect twice in development)
  const hasProcessed = useRef(false);

  const handleCallback = useCallback(async () => {
    
    try {
      // Check for error from backend
      const error = searchParams.get("error");
      if (error) {
        const message = searchParams.get("message") || "Erro na autenticação com Google";
        throw new Error(decodeURIComponent(message));
      }

      // Get tokens from URL
      const token = searchParams.get("token");
      const refreshTokenValue = searchParams.get("refreshToken");
      const isNewUser = searchParams.get("isNewUser") === "true";

      // Get user data from URL (sent by backend to avoid extra API call)
      const userId = searchParams.get("userId");
      const userEmail = searchParams.get("userEmail");
      const userName = searchParams.get("userName");
      const userAvatar = searchParams.get("userAvatar");


      if (!token || !refreshTokenValue) {
        throw new Error("Tokens não encontrados na resposta");
      }

      // Store tokens in localStorage
      setToken(token);
      setRefreshToken(refreshTokenValue);

      // Set user data directly for immediate UI feedback
      if (userId && userEmail && setUserDirectly) {
        setUserDirectly({
          id: userId,
          email: userEmail,
          name: userName || userEmail.split('@')[0],
          avatar: userAvatar || null,
        });
      }
      
      // Always fetch full user data via /auth/me to get subscription info
      // This is needed to determine the correct redirect path
      let fullUserData;
      try {
        fullUserData = await authService.me();
      } catch (meError) {
        console.error("[Google Callback] Failed to fetch /auth/me:", meError);
        throw new Error("Falha ao obter dados do usuário");
      }
      
      // Update auth context with full user data by setting directly
      // This ensures context is immediately synchronized with the data we'll use for redirect
      if (setUserDirectly) {
        setUserDirectly(fullUserData);
      }

      setStatus("success");
      
      // Show success message with toast ID to prevent duplicates
      const toastMessage = isNewUser 
        ? "Conta criada com sucesso! Bem-vindo à MAY!"
        : "Login com Google realizado com sucesso!";
      
      toast.success(toastMessage, {
        id: "google-login-success",
        duration: 3000
      });

      // Clear URL params for security (tokens shouldn't stay in URL)
      window.history.replaceState({}, document.title, window.location.pathname);

      // Determine redirect path using the same logic as Login.jsx
      const redirectPath = getRedirectPath(fullUserData, isNewUser);
      
      // Use requestAnimationFrame to ensure state updates have flushed before navigation
      // This prevents race condition where navigation happens before context propagates to components
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      
      // Shorter delay now that we've synchronized state properly
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 300);
    } catch (err) {
      console.error("[Google Callback] Error:", err);
      const { handleApiError } = await import('@/utils/errorHandler');
      await handleApiError(err, { operation: 'google_callback' });
      setStatus("error");
      setErrorMessage(err.message || "Erro ao processar autenticação");

      // Redirect to login after a delay
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3000);
    }
  }, [searchParams, navigate, setUserDirectly, refreshUser]);

  useEffect(() => {
    // Guard against multiple executions (React 18 StrictMode protection)
    if (hasProcessed.current) {
      console.log("[Google Callback] Already processed, skipping duplicate execution...");
      return;
    }
    hasProcessed.current = true;
    
    handleCallback();
  }, [handleCallback]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background gradient effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-orange-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="glass-card rounded-3xl p-12 max-w-md w-full text-center relative z-10">
        {status === "processing" && (
          <>
            <Loader2 className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Processando login...
            </h2>
            <p className="text-gray-400">
              Estamos finalizando sua autenticação com o Google
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Login realizado!
            </h2>
            <p className="text-gray-400">
              Redirecionando para o dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Erro na autenticação
            </h2>
            <p className="text-gray-400 mb-4">
              {errorMessage}
            </p>
            <p className="text-gray-500 text-sm">
              Redirecionando para a página de login...
            </p>
          </>
        )}
      </div>

      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </div>
  );
}