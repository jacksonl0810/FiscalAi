import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { setToken, setRefreshToken } from "@/api/services";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Google OAuth Callback Page
 * Handles the redirect from Google OAuth and processes the tokens
 */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [errorMessage, setErrorMessage] = useState("");
  
  // Prevent double execution (React Strict Mode calls useEffect twice)
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Guard against multiple executions
    if (hasProcessed.current) {
      console.log("[Google Callback] Already processed, skipping...");
      return;
    }
    hasProcessed.current = true;
    
    handleCallback();
  }, []);

  const handleCallback = async () => {
    console.log("[Google Callback] Starting callback processing...");
    
    try {
      // Check for error from backend
      const error = searchParams.get("error");
      if (error) {
        const message = searchParams.get("message") || "Erro na autenticação com Google";
        throw new Error(message);
      }

      // Get tokens from URL
      const token = searchParams.get("token");
      const refreshToken = searchParams.get("refreshToken");
      const isNewUser = searchParams.get("isNewUser") === "true";

      console.log("[Google Callback] Tokens received:", { hasToken: !!token, hasRefreshToken: !!refreshToken, isNewUser });

      if (!token || !refreshToken) {
        throw new Error("Tokens não encontrados na resposta");
      }

      // Store tokens
      setToken(token);
      setRefreshToken(refreshToken);

      // Refresh user data
      console.log("[Google Callback] Refreshing user data...");
      await refreshUser();

      setStatus("success");
      console.log("[Google Callback] Success! Showing toast notification...");
      
      // Show success message (only once) - toast.success has internal deduplication
      if (isNewUser) {
        toast.success("Conta criada com sucesso! Bem-vindo à MAY!", {
          id: "google-login-success", // Prevent duplicates
          duration: 3000
        });
      } else {
        toast.success("Login com Google realizado com sucesso!", {
          id: "google-login-success", // Prevent duplicates
          duration: 3000
        });
      }

      // Redirect after a short delay
      console.log("[Google Callback] Redirecting to dashboard in 1.5s...");
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);
    } catch (error) {
      const { handleApiError } = await import('@/utils/errorHandler');
      await handleApiError(error, { operation: 'google_callback' });
      setStatus("error");
      setErrorMessage("Erro ao processar autenticação");

      // Redirect to login after a delay
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3000);
    }
  };

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
