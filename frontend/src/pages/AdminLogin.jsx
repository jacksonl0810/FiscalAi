// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { adminService } from "@/api/services/admin";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, 
  Mail, 
  Lock, 
  Loader2, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  AlertTriangle,
  ShieldCheck,
  KeyRound,
  Sparkles,
  Server,
  Database,
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login, logout, user, isAuthenticated, isLoadingAuth, authError, clearError } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [loginError, setLoginError] = useState(null);
  const [showNonAdminWarning, setShowNonAdminWarning] = useState(false);
  const [showAdminReauth, setShowAdminReauth] = useState(false);

  // Check admin session and authentication status
  useEffect(() => {
    if (isAuthenticated && user?.isAdmin) {
      // Check if admin has a valid session
      const adminSession = sessionStorage.getItem('adminAuthenticated');
      if (adminSession) {
        try {
          const session = JSON.parse(adminSession);
          // Check if session is valid (same user, within 4 hours)
          const sessionAge = Date.now() - session.timestamp;
          const maxAge = 4 * 60 * 60 * 1000; // 4 hours
          if (session.authenticated && session.userId === user.id && sessionAge < maxAge) {
            // Valid admin session - redirect to admin panel
            navigate('/Admin', { replace: true });
            return;
          }
        } catch (e) {
          // Invalid session data, clear it
          sessionStorage.removeItem('adminAuthenticated');
        }
      }
      // Admin user but no valid session - need to re-authenticate
      setShowAdminReauth(true);
    }
    // If authenticated but not admin, show warning
    if (isAuthenticated && user && !user.isAdmin) {
      setShowNonAdminWarning(true);
    }
  }, [isAuthenticated, user, navigate]);

  // Clear errors when form changes
  useEffect(() => {
    if (loginError) setLoginError(null);
    if (authError) clearError();
  }, [formData]);

  // Pre-fill email for admin re-authentication
  useEffect(() => {
    if (showAdminReauth && user?.email) {
      setFormData(prev => ({ ...prev, email: user.email }));
    }
  }, [showAdminReauth, user]);

  // Handle logout for non-admin users
  const handleLogoutAndRetry = async () => {
    try {
      await logout();
      setShowNonAdminWarning(false);
      setFormData({ email: "", password: "" });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.password) {
      setLoginError("Por favor, informe sua senha");
      return;
    }

    // For re-authentication, email is optional (pre-filled)
    if (!showAdminReauth && !formData.email) {
      setLoginError("Por favor, preencha todos os campos");
      return;
    }

    setIsLoading(true);
    setLoginError(null);

    try {
      let userId;

      // For re-authentication (admin already logged in), verify password only
      if (showAdminReauth && user?.isAdmin) {
        // Use admin password verification endpoint (doesn't create new session)
        await adminService.verifyPassword(formData.password);
        userId = user.id;
      } else {
        // Normal login flow (user not logged in or not admin)
        const userData = await login(formData.email, formData.password);
        
        // Check if user is admin
        if (!userData?.user?.isAdmin) {
          setLoginError("Acesso negado. Esta área é restrita a administradores.");
          setIsLoading(false);
          return;
        }
        userId = userData.user.id;
      }

      // Set admin session flag with timestamp (valid for this browser session)
      sessionStorage.setItem('adminAuthenticated', JSON.stringify({
        authenticated: true,
        timestamp: Date.now(),
        userId: userId
      }));

      toast.success("Login administrativo realizado com sucesso!");
      navigate('/Admin', { replace: true });
    } catch (error) {
      console.error('[AdminLogin] Error:', error);
      const message = error?.response?.data?.message || error?.message || "Credenciais inválidas";
      setLoginError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Gradient orbs */}
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1]
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-violet-600/20 via-purple-500/5 to-transparent blur-3xl"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.08, 0.12, 0.08]
          }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
          className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-radial from-indigo-600/15 via-blue-500/5 to-transparent blur-3xl"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.05, 0.1, 0.05]
          }}
          transition={{ duration: 12, repeat: Infinity, delay: 4 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-radial from-purple-500/10 to-transparent blur-3xl"
        />

        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-violet-400/30 rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0
            }}
            animate={{ 
              y: [null, Math.random() * -200],
              opacity: [0, 0.5, 0]
            }}
            transition={{
              duration: 5 + Math.random() * 5,
              repeat: Infinity,
              delay: Math.random() * 5
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="relative inline-block mb-6"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl blur-xl opacity-50" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-white mb-2"
          >
            Painel Administrativo
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-400"
          >
            Acesso restrito a administradores
          </motion.p>
        </div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative"
        >
          {/* Card glow */}
          <div className="absolute -inset-[1px] bg-gradient-to-b from-violet-500/30 via-purple-500/10 to-transparent rounded-3xl" />
          
          <div className="relative bg-[#0f0f1a]/90 backdrop-blur-2xl rounded-3xl border border-white/10 overflow-hidden">
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            
            <div className="p-8">
              {/* Security badge */}
              <div className="flex items-center justify-center gap-2 mb-6 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <ShieldCheck className="w-5 h-5 text-violet-400" />
                <span className="text-violet-300 text-sm font-medium">Conexão Segura • SSL Ativo</span>
              </div>

              {/* Admin re-authentication notice */}
              <AnimatePresence>
                {showAdminReauth && !showNonAdminWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20"
                  >
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-violet-300 text-sm font-medium mb-1">Verificação de Segurança</p>
                        <p className="text-violet-200/70 text-xs mb-2">
                          Olá, <span className="text-white font-medium">{user?.name || user?.email}</span>
                        </p>
                        <p className="text-gray-400 text-xs">
                          Por segurança, confirme sua senha para acessar o painel administrativo.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Non-admin user warning */}
              <AnimatePresence>
                {showNonAdminWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-amber-300 text-sm font-medium mb-1">Você não é um administrador</p>
                        <p className="text-amber-200/70 text-xs mb-3">
                          Logado como: <span className="text-white">{user?.email}</span>
                        </p>
                        <button
                          type="button"
                          onClick={handleLogoutAndRetry}
                          className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Lock className="w-4 h-4" />
                          Sair e fazer login como admin
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error message */}
              <AnimatePresence>
                {(loginError || authError) && !showNonAdminWarning && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <p className="text-red-300 text-sm">{loginError || authError?.message}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form - Hidden when showing non-admin warning */}
              {!showNonAdminWarning && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email - disabled when re-authenticating */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-violet-400" />
                    {showAdminReauth ? 'Email (verificado)' : 'Email do Administrador'}
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={formData.email}
                      disabled={showAdminReauth}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="admin@exemplo.com"
                      className={`w-full px-4 py-3.5 bg-white/5 border rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:outline-none ${
                        showAdminReauth 
                          ? "border-violet-500/30 bg-violet-500/10 cursor-not-allowed opacity-80"
                          : focusedField === "email" 
                            ? "border-violet-500 bg-violet-500/5 shadow-lg shadow-violet-500/10" 
                            : "border-white/10 hover:border-white/20"
                      }`}
                    />
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 opacity-0 transition-opacity pointer-events-none ${
                      focusedField === "email" ? "opacity-100" : ""
                    }`} style={{ filter: "blur(20px)" }} />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-violet-400" />
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="••••••••"
                      className={`w-full px-4 py-3.5 pr-12 bg-white/5 border rounded-xl text-white placeholder-gray-500 transition-all duration-300 focus:outline-none ${
                        focusedField === "password" 
                          ? "border-violet-500 bg-violet-500/5 shadow-lg shadow-violet-500/10" 
                          : "border-white/10 hover:border-white/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-violet-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={isLoading || isLoadingAuth}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="relative w-full py-4 rounded-xl font-semibold text-white overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 transition-all duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </div>
                  <span className="relative flex items-center justify-center gap-2">
                    {isLoading || isLoadingAuth ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verificando credenciais...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Acessar Painel Administrativo
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                </motion.button>
              </form>
              )}

              {/* Divider - Only show when form is visible */}
              {!showNonAdminWarning && (
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-[#0f0f1a] text-gray-500 text-sm">Acesso Seguro</span>
                </div>
              </div>
              )}

              {/* Features */}
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/5">
                  <Server className="w-5 h-5 text-violet-400 mb-2" />
                  <span className="text-gray-400 text-xs text-center">Controle Total</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/5">
                  <Database className="w-5 h-5 text-purple-400 mb-2" />
                  <span className="text-gray-400 text-xs text-center">Dados Seguros</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/5">
                  <Activity className="w-5 h-5 text-indigo-400 mb-2" />
                  <span className="text-gray-400 text-xs text-center">Monitoramento</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5">
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => {
                    if (isAuthenticated) {
                      navigate(createPageUrl("Dashboard"));
                    } else {
                      navigate('/login');
                    }
                  }}
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  {isAuthenticated ? 'Voltar ao Dashboard' : 'Voltar ao login normal'}
                </button>
                <span className="text-gray-600 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  MAY Admin
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom warning */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-gray-500 text-xs mt-6 flex items-center justify-center gap-2"
        >
          <Lock className="w-3 h-3" />
          Tentativas de acesso não autorizado são registradas e monitoradas
        </motion.p>
      </motion.div>
    </div>
  );
}
