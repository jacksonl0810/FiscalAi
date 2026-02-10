import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Lock, Loader2, Eye, EyeOff, ArrowRight, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import apiClient from "@/api/client";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: ""
  });

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setIsValidating(false);
      setIsValidToken(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await apiClient.get(`/auth/verify-reset-token?token=${token}`);
        setIsValidToken(response.data?.valid || false);
      } catch (error) {
        console.error('Token validation error:', error);
        setIsValidToken(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post('/auth/reset-password', {
        token,
        password: formData.password
      });
      
      setIsSuccess(true);
      toast.success("Senha alterada com sucesso!");
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      const message = error?.response?.data?.message || 'Erro ao redefinir senha. Tente novamente.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while validating token
  if (isValidating) {
    return (
      <div className="min-h-screen bg-[#07070a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Validando link de recuperação...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired token
  if (!isValidToken && !isSuccess) {
    return (
      <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-6">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-gradient-radial from-red-500/10 via-red-500/3 to-transparent blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-md"
        >
          <div className="absolute -inset-1 bg-gradient-to-br from-red-500/20 via-red-500/10 to-red-500/20 rounded-[32px] blur-2xl opacity-40" />
          
          <div className="relative bg-gradient-to-b from-[#0f1014] via-[#0c0d10] to-[#09090c] rounded-3xl border border-slate-700/40 overflow-hidden p-8 lg:p-10">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
            
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">Link Inválido ou Expirado</h2>
              <p className="text-slate-400 mb-8">
                O link de recuperação de senha é inválido ou já expirou. 
                Por favor, solicite um novo link de recuperação.
              </p>
              
              <div className="space-y-3">
                <motion.button
                  onClick={() => navigate('/login')}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-4 px-6 rounded-2xl text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-xl shadow-orange-500/25 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Voltar ao Login
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-6">
        {/* Background Effects */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-gradient-radial from-emerald-500/10 via-emerald-500/3 to-transparent blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-md"
        >
          <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-emerald-500/20 rounded-[32px] blur-2xl opacity-40" />
          
          <div className="relative bg-gradient-to-b from-[#0f1014] via-[#0c0d10] to-[#09090c] rounded-3xl border border-slate-700/40 overflow-hidden p-8 lg:p-10">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
            
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </motion.div>
              
              <h2 className="text-2xl font-bold text-white mb-4">Senha Alterada com Sucesso!</h2>
              <p className="text-slate-400 mb-8">
                Sua senha foi redefinida. Você será redirecionado para o login em alguns segundos...
              </p>
              
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Redirecionando...</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main reset password form
  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-6">
      {/* Luxury Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-gradient-radial from-orange-500/10 via-orange-500/3 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-amber-500/8 via-transparent to-transparent blur-3xl" />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl blur-xl opacity-50" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
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
                <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-7 h-7 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Redefinir Senha
                </h2>
                <p className="text-slate-500 text-sm">
                  Digite sua nova senha abaixo
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New Password */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Nova Senha
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
                        minLength={6}
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
                  {formData.password && formData.password.length < 6 && (
                    <p className="text-xs text-amber-400 mt-1">A senha deve ter pelo menos 6 caracteres</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Confirmar Nova Senha
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
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="••••••••"
                        className="w-full px-4 py-4 pl-12 pr-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 text-slate-500 hover:text-white transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-400 mt-1">As senhas não coincidem</p>
                  )}
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={isLoading || formData.password.length < 6 || formData.password !== formData.confirmPassword}
                  whileHover={{ scale: isLoading ? 1 : 1.01 }}
                  whileTap={{ scale: isLoading ? 1 : 0.99 }}
                  className="w-full py-4 px-6 rounded-2xl text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-xl shadow-orange-500/25 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redefinindo...
                    </>
                  ) : (
                    <>
                      Redefinir Senha
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Back to Login */}
              <div className="mt-8 text-center">
                <button
                  onClick={() => navigate('/login')}
                  className="text-slate-500 hover:text-white text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao Login
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
        </div>
      </motion.div>
    </div>
  );
}
