import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mail, Lock, Loader2, Eye, EyeOff, User, ArrowRight, Shield, Zap, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/api/client";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register, isLoadingAuth, authError, clearError } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  // Check for error from Google OAuth redirect
  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");
    if (error) {
      toast.error(message || "Erro na autenticação com Google");
    }
  }, [searchParams]);

  // Check if Google OAuth is configured
  useEffect(() => {
    checkGoogleConfig();
  }, []);

  const checkGoogleConfig = async () => {
    try {
      const response = await apiClient.get('/auth/google/check');
      setGoogleConfigured(response.data?.configured || false);
    } catch (error) {
      setGoogleConfigured(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    // Use backend URL directly - Google OAuth requires full page redirect
    // In dev: frontend on 5173, backend on 3000
    // In prod: same origin
    const backendUrl = window.location.port === '5173' 
      ? 'http://localhost:3000'
      : window.location.origin;
    
    console.log('[Google Login] Redirecting to:', `${backendUrl}/api/auth/google`);
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (authError) clearError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isRegister) {
      if (formData.password !== formData.confirmPassword) {
        toast.error("As senhas não coincidem");
        return;
      }
      if (formData.password.length < 6) {
        toast.error("A senha deve ter pelo menos 6 caracteres");
        return;
      }
      
      try {
        await register(formData.name, formData.email, formData.password);
        toast.success("Conta criada com sucesso!");
        navigate("/pricing");
      } catch (error) {
        const { handleApiError } = await import('@/utils/errorHandler');
        await handleApiError(error, { operation: 'register' });
      }
    } else {
      try {
        await login(formData.email, formData.password);
        toast.success("Login realizado com sucesso!");
        navigate("/");
      } catch (error) {
        const { handleApiError } = await import('@/utils/errorHandler');
        await handleApiError(error, { operation: 'login' });
      }
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    clearError();
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: ""
    });
  };

  const features = [
    { icon: Zap, text: "Emissão de notas em segundos" },
    { icon: Shield, text: "100% seguro e criptografado" },
    { icon: CheckCircle, text: "7 dias grátis para testar" },
  ];

  return (
    <div className="min-h-screen bg-[#07070a] flex">
      {/* Luxury Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-gradient-radial from-orange-500/10 via-orange-500/3 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-amber-500/8 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-gradient-radial from-purple-500/5 via-transparent to-transparent blur-3xl" />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Left Side - Branding (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="relative z-10 max-w-lg">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl blur-xl opacity-50" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-orange-500/30">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white tracking-tight">MAY</h1>
                <p className="text-slate-500 text-sm font-medium tracking-wider uppercase">Fiscal AI</p>
              </div>
            </div>
            
            <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
              Emita notas fiscais
              <span className="block mt-1 bg-gradient-to-r from-orange-400 to-amber-400 text-transparent bg-clip-text">
                apenas conversando
              </span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              O assistente de IA que revoluciona a gestão fiscal do seu negócio. 
              Simples, rápido e sem burocracia.
            </p>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                className="flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-500/10 flex items-center justify-center border border-orange-500/20 group-hover:border-orange-500/40 transition-colors">
                  <feature.icon className="w-5 h-5 text-orange-400" />
                </div>
                <span className="text-slate-400 group-hover:text-slate-300 transition-colors">{feature.text}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-slate-800/30 to-slate-900/30 border border-slate-700/30"
          >
            <p className="text-slate-300 italic mb-4">
              "A MAY transformou completamente a forma como gerencio minhas notas fiscais. 
              O que levava horas agora leva segundos."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/30 to-amber-500/20 flex items-center justify-center">
                <span className="text-orange-400 font-semibold text-sm">MR</span>
              </div>
              <div>
                <p className="text-white font-medium text-sm">Maria Rodrigues</p>
                <p className="text-slate-500 text-xs">Empresária MEI</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-white">MAY</h1>
                <p className="text-slate-500 text-xs font-medium tracking-wider uppercase">Fiscal AI</p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="relative">
            {/* Card glow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-orange-500/20 via-amber-500/10 to-orange-500/20 rounded-[32px] blur-2xl opacity-40" />
            
            <div className="relative bg-gradient-to-b from-[#0f1014] via-[#0c0d10] to-[#09090c] rounded-3xl border border-slate-700/40 overflow-hidden">
              {/* Top accent line */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
              
              {/* Noise texture */}
              <div className="absolute inset-0 opacity-[0.015]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
              }} />

              <div className="relative p-8 lg:p-10">
                {/* Header */}
                <div className="text-center mb-8">
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={isRegister ? "register" : "login"}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="text-2xl font-bold text-white mb-2"
                    >
                      {isRegister ? "Criar sua conta" : "Bem-vindo de volta"}
                    </motion.h2>
                  </AnimatePresence>
                  <p className="text-slate-500 text-sm">
                    {isRegister 
                      ? "Comece sua jornada com a MAY" 
                      : "Entre para continuar sua jornada"
                    }
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <AnimatePresence mode="wait">
                    {isRegister && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                      >
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          Nome completo
                        </label>
                        <div className={`relative group rounded-2xl transition-all duration-300 ${
                          focusedField === 'name' ? 'ring-2 ring-orange-500/50' : ''
                        }`}>
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative flex items-center">
                            <User className={`absolute left-4 w-5 h-5 transition-colors ${
                              focusedField === 'name' ? 'text-orange-400' : 'text-slate-500'
                            }`} />
                            <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => handleInputChange("name", e.target.value)}
                              onFocus={() => setFocusedField('name')}
                              onBlur={() => setFocusedField(null)}
                              placeholder="Seu nome completo"
                              className="w-full px-4 py-4 pl-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none transition-all"
                              required
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Email
                    </label>
                    <div className={`relative group rounded-2xl transition-all duration-300 ${
                      focusedField === 'email' ? 'ring-2 ring-orange-500/50' : ''
                    }`}>
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-center">
                        <Mail className={`absolute left-4 w-5 h-5 transition-colors ${
                          focusedField === 'email' ? 'text-orange-400' : 'text-slate-500'
                        }`} />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="seu@email.com"
                          className="w-full px-4 py-4 pl-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Senha
                    </label>
                    <div className={`relative group rounded-2xl transition-all duration-300 ${
                      focusedField === 'password' ? 'ring-2 ring-orange-500/50' : ''
                    }`}>
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-center">
                        <Lock className={`absolute left-4 w-5 h-5 transition-colors ${
                          focusedField === 'password' ? 'text-orange-400' : 'text-slate-500'
                        }`} />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="••••••••"
                          className="w-full px-4 py-4 pl-12 pr-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 text-slate-500 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <AnimatePresence mode="wait">
                    {isRegister && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                      >
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          Confirmar senha
                        </label>
                        <div className={`relative group rounded-2xl transition-all duration-300 ${
                          focusedField === 'confirmPassword' ? 'ring-2 ring-orange-500/50' : ''
                        }`}>
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative flex items-center">
                            <Lock className={`absolute left-4 w-5 h-5 transition-colors ${
                              focusedField === 'confirmPassword' ? 'text-orange-400' : 'text-slate-500'
                            }`} />
                            <input
                              type={showPassword ? "text" : "password"}
                              value={formData.confirmPassword}
                              onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                              onFocus={() => setFocusedField('confirmPassword')}
                              onBlur={() => setFocusedField(null)}
                              placeholder="••••••••"
                              className="w-full px-4 py-4 pl-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none transition-all"
                              required
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Error Message */}
                  <AnimatePresence>
                    {authError && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                      >
                        {authError.message}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={isLoadingAuth}
                    whileHover={{ scale: isLoadingAuth ? 1 : 1.01 }}
                    whileTap={{ scale: isLoadingAuth ? 1 : 0.99 }}
                    className="w-full py-4 px-6 rounded-2xl text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-xl shadow-orange-500/25 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingAuth ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {isRegister ? "Criar conta" : "Entrar"}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700/50"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-4 bg-[#0c0d10] text-slate-600 text-sm">ou continue com</span>
                    </div>
                  </div>

                  {/* Google Sign In */}
                  <motion.button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || !googleConfigured}
                    whileHover={{ scale: googleConfigured && !googleLoading ? 1.01 : 1 }}
                    whileTap={{ scale: googleConfigured && !googleLoading ? 0.99 : 1 }}
                    className={`w-full py-4 px-6 rounded-2xl text-base font-medium flex items-center justify-center gap-3 transition-all duration-300 ${
                      googleConfigured 
                        ? 'bg-white hover:bg-gray-50 text-gray-900 shadow-lg' 
                        : 'bg-slate-800/30 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                    }`}
                  >
                    {googleLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill={googleConfigured ? "#4285F4" : "#666"}
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill={googleConfigured ? "#34A853" : "#666"}
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill={googleConfigured ? "#FBBC05" : "#666"}
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill={googleConfigured ? "#EA4335" : "#666"}
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Continuar com Google
                      </>
                    )}
                  </motion.button>
                  
                  {!googleConfigured && (
                    <p className="text-center text-slate-600 text-xs">
                      Login com Google não configurado
                    </p>
                  )}
                </form>

                {/* Toggle Mode */}
                <div className="mt-8 text-center">
                  <button
                    onClick={toggleMode}
                    className="text-slate-500 hover:text-white text-sm transition-colors"
                  >
                    {isRegister ? (
                      <>Já tem uma conta? <span className="text-orange-400 font-medium">Entrar</span></>
                    ) : (
                      <>Não tem uma conta? <span className="text-orange-400 font-medium">Criar conta</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-slate-600 text-xs">
              © {new Date().getFullYear()} MAY Fiscal AI. Todos os direitos reservados.
            </p>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-600">
              <a href="#" className="hover:text-orange-400 transition-colors">Termos</a>
              <span>•</span>
              <a href="#" className="hover:text-orange-400 transition-colors">Privacidade</a>
              <span>•</span>
              <a href="#" className="hover:text-orange-400 transition-colors">Suporte</a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
