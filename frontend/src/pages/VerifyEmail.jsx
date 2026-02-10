import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, CheckCircle, XCircle, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");
  const { login } = useAuth();

  const [status, setStatus] = useState("loading"); // loading, success, error, expired, resend
  const [email, setEmail] = useState(emailParam || "");
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setStatus("resend");
    }
  }, [token]);

  // Update email from URL param
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const verifyEmail = async () => {
    try {
      setStatus("loading");
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message);
        
        // Auto-login the user
        if (data.token && data.refreshToken) {
          login(data.token, data.refreshToken, data.user);
          
          // Redirect to dashboard after 3 seconds
          setTimeout(() => {
            navigate("/");
          }, 3000);
        }
      } else {
        if (data.code === "TOKEN_EXPIRED") {
          setStatus("expired");
        } else if (data.code === "ALREADY_VERIFIED") {
          setStatus("success");
          setMessage("Este email já foi verificado. Você pode fazer login.");
        } else {
          setStatus("error");
        }
        setMessage(data.message || "Erro ao verificar email");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setStatus("error");
      setMessage("Erro de conexão. Tente novamente.");
    }
  };

  const handleResendVerification = async (e) => {
    e?.preventDefault();
    
    if (!email) {
      toast.error("Por favor, informe seu email");
      return;
    }

    try {
      setIsResending(true);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.alreadyVerified) {
          toast.success("Email já verificado! Redirecionando para login...");
          setTimeout(() => navigate("/login"), 2000);
        } else {
          toast.success("Email de verificação enviado! Verifique sua caixa de entrada.");
          setStatus("sent");
        }
      } else {
        toast.error(data.message || "Erro ao reenviar verificação");
      }
    } catch (error) {
      console.error("Resend error:", error);
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-orange-500/10 via-orange-500/3 to-transparent blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-radial from-purple-500/8 via-transparent to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        <div className="glass-card rounded-3xl p-8 border border-white/10">
          {/* Loading State */}
          {status === "loading" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center border border-orange-500/30">
                <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Verificando Email...</h1>
              <p className="text-gray-400">Aguarde enquanto verificamos seu email.</p>
            </div>
          )}

          {/* Success State */}
          {status === "success" && (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 flex items-center justify-center border border-emerald-500/30"
              >
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </motion.div>
              <h1 className="text-2xl font-bold text-white mb-2">Email Verificado!</h1>
              <p className="text-gray-400 mb-6">{message}</p>
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <p className="text-emerald-300 text-sm">
                  Redirecionando para o dashboard em alguns segundos...
                </p>
              </div>
              <Button
                onClick={() => navigate("/")}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold py-3 rounded-xl"
              >
                Ir para o Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center border border-red-500/30">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Erro na Verificação</h1>
              <p className="text-gray-400 mb-6">{message}</p>
              <Button
                onClick={() => setStatus("resend")}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold py-3 rounded-xl"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Solicitar Novo Link
              </Button>
            </div>
          )}

          {/* Expired State */}
          {status === "expired" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center border border-amber-500/30">
                <Mail className="w-10 h-10 text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Link Expirado</h1>
              <p className="text-gray-400 mb-6">
                O link de verificação expirou. Solicite um novo link abaixo.
              </p>
              <Button
                onClick={() => setStatus("resend")}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold py-3 rounded-xl"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Solicitar Novo Link
              </Button>
            </div>
          )}

          {/* Resend Form State */}
          {(status === "resend" || status === "sent") && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center border border-orange-500/30">
                <Mail className="w-10 h-10 text-orange-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                {status === "sent" ? "Email Enviado!" : "Verificar Email"}
              </h1>
              <p className="text-gray-400 mb-6">
                {status === "sent" 
                  ? "Verifique sua caixa de entrada e clique no link de verificação."
                  : "Informe seu email para receber um novo link de verificação."
                }
              </p>

              {status === "sent" ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-emerald-300 text-sm">
                      Email de verificação enviado para <strong>{email}</strong>
                    </p>
                  </div>
                  <Button
                    onClick={() => setStatus("resend")}
                    variant="outline"
                    className="w-full border-white/10 text-gray-300 hover:bg-white/5"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reenviar Email
                  </Button>
                  <Button
                    onClick={() => navigate("/login")}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold py-3 rounded-xl"
                  >
                    Ir para Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResendVerification} className="space-y-4">
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                    required
                  />
                  <Button
                    type="submit"
                    disabled={isResending}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold py-3 rounded-xl disabled:opacity-50"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar Link de Verificação
                      </>
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 pt-6 border-t border-white/10">
                <button
                  onClick={() => navigate("/login")}
                  className="text-gray-400 hover:text-orange-400 text-sm transition-colors"
                >
                  Voltar para o Login
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Styles */}
      <style>{`
        .glass-card {
          background: rgba(15, 15, 22, 0.8);
          backdrop-filter: blur(20px);
        }
      `}</style>
    </div>
  );
}
