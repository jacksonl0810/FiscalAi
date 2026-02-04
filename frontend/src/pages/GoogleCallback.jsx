import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { setToken, setRefreshToken } from "@/api/services";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

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
    console.log("[Google Callback] Starting callback processing...");
    
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

      console.log("[Google Callback] Data received:", { 
        hasToken: !!token, 
        hasRefreshToken: !!refreshTokenValue, 
        hasUserData: !!(userId && userEmail),
        isNewUser 
      });

      if (!token || !refreshTokenValue) {
        throw new Error("Tokens não encontrados na resposta");
      }

      // Store tokens in localStorage
      setToken(token);
      setRefreshToken(refreshTokenValue);

      // Set user data directly if available (avoids extra API call)
      if (userId && userEmail && setUserDirectly) {
        console.log("[Google Callback] Setting user directly from URL params...");
        setUserDirectly({
          id: userId,
          email: userEmail,
          name: userName || userEmail.split('@')[0],
          avatar: userAvatar || null,
        });
      } else {
        // Fallback: refresh user data via API if not provided in URL
        console.log("[Google Callback] Falling back to refreshUser API call...");
        await refreshUser();
      }

      setStatus("success");
      console.log("[Google Callback] Success!");
      
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

      // Redirect to dashboard
      console.log("[Google Callback] Redirecting to dashboard...");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1000);
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
