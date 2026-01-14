import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isLoadingAuth, authError, clearError } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

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
        navigate("/");
      } catch (error) {
        toast.error(error.message || "Erro ao criar conta");
      }
    } else {
      try {
        await login(formData.email, formData.password);
        toast.success("Login realizado com sucesso!");
        navigate("/");
      } catch (error) {
        toast.error(error.message || "Email ou senha inválidos");
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

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background gradient effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-orange-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20"
          >
            <Sparkles className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white">
            Fiscal<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">AI</span>
          </h1>
          <p className="text-gray-500 mt-2">Automação fiscal inteligente</p>
        </div>

        {/* Form Card */}
        <div className="glass-card rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {isRegister ? "Criar conta" : "Entrar"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="space-y-2">
                <Label className="text-gray-400">Nome completo</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Seu nome"
                  className="bg-white/5 border-white/10 text-white h-12"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-400">Email</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-12 bg-white/5 border-white/10 text-white h-12"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-400">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  placeholder="••••••••"
                  className="pl-12 pr-12 bg-white/5 border-white/10 text-white h-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isRegister && (
              <div className="space-y-2">
                <Label className="text-gray-400">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    placeholder="••••••••"
                    className="pl-12 bg-white/5 border-white/10 text-white h-12"
                    required
                  />
                </div>
              </div>
            )}

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {authError.message}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 font-medium"
            >
              {isLoadingAuth ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRegister ? (
                "Criar conta"
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              {isRegister ? (
                <>Já tem uma conta? <span className="text-orange-400">Entrar</span></>
              ) : (
                <>Não tem uma conta? <span className="text-orange-400">Criar conta</span></>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-8">
          © 2025 FiscalAI. Todos os direitos reservados.
        </p>
      </motion.div>

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
