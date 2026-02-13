// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { handleApiError } from "@/utils/errorHandler";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Building2,
  FileText,
  CreditCard,
  Settings,
  Shield,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Crown,
  Key,
  UserCog,
  Receipt,
  Download,
  Filter,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Clock,
  Zap,
  Server,
  Database,
  Globe,
  Lock,
  Unlock,
  Star,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  X,
  Check,
  AlertTriangle,
  Heart,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  Play,
  Pause,
  RotateCcw,
  UserPlus,
  UserMinus,
  Package,
  ShieldCheck,
  ShieldOff,
  FileDown,
  ListChecks,
  LayoutDashboard,
  Bell,
  ChevronDown,
  LogOut,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/api/client";

// ==========================================
// ADMIN SERVICE
// ==========================================

const adminService = {
  // Stats
  getStats: () => apiClient.get('/admin/stats').then(r => r.data?.data || r.data),
  getChartData: () => apiClient.get('/admin/stats/chart').then(r => r.data?.data || r.data),
  getHealth: () => apiClient.get('/admin/health').then(r => r.data?.data || r.data),
  
  // Users
  getUsers: (params) => apiClient.get('/admin/users', { params }).then(r => r.data?.data || r.data),
  getUser: (id) => apiClient.get(`/admin/users/${id}`).then(r => r.data?.data || r.data),
  updateUser: (id, data) => apiClient.put(`/admin/users/${id}`, data).then(r => r.data),
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`).then(r => r.data),
  resetPassword: (id, newPassword) => apiClient.post(`/admin/users/${id}/reset-password`, { newPassword }).then(r => r.data),
  bulkUserAction: (userIds, action) => apiClient.post('/admin/users/bulk-action', { userIds, action }).then(r => r.data),
  
  // Subscriptions
  getSubscriptions: (params) => apiClient.get('/admin/subscriptions', { params }).then(r => r.data?.data || r.data),
  updateSubscription: (id, data) => apiClient.put(`/admin/subscriptions/${id}`, data).then(r => r.data),
  updateSubscriptionPlan: (id, planId, billingCycle) => apiClient.put(`/admin/subscriptions/${id}/plan`, { planId, billingCycle }).then(r => r.data),
  extendSubscription: (id, days) => apiClient.post(`/admin/subscriptions/${id}/extend`, { days }).then(r => r.data),
  bulkSubscriptionAction: (subscriptionIds, action) => apiClient.post('/admin/subscriptions/bulk-action', { subscriptionIds, action }).then(r => r.data),
  
  // Companies, Clients & Invoices
  getCompanies: (params) => apiClient.get('/admin/companies', { params }).then(r => r.data?.data || r.data),
  getClients: (params) => apiClient.get('/admin/clients', { params }).then(r => r.data?.data || r.data),
  getInvoices: (params) => apiClient.get('/admin/invoices', { params }).then(r => r.data?.data || r.data),
  
  // Activity & Settings
  getActivity: (params) => apiClient.get('/admin/activity', { params }).then(r => r.data?.data || r.data),
  getSettings: () => apiClient.get('/admin/settings').then(r => r.data?.data || r.data),
  
  // Export
  exportUsers: () => apiClient.get('/admin/export/users', { responseType: 'blob' }),
  exportSubscriptions: () => apiClient.get('/admin/export/subscriptions', { responseType: 'blob' }),
  exportInvoices: () => apiClient.get('/admin/export/invoices', { responseType: 'blob' }),
};

// ==========================================
// HELPER COMPONENTS
// ==========================================

const StatCard = ({ title, value, change, icon: Icon, color = "orange", subtitle, loading }) => {
  const colorMap = {
    orange: { bg: "from-orange-500 to-amber-600", glow: "shadow-orange-500/20", text: "text-orange-400" },
    green: { bg: "from-emerald-500 to-green-600", glow: "shadow-emerald-500/20", text: "text-emerald-400" },
    blue: { bg: "from-blue-500 to-indigo-600", glow: "shadow-blue-500/20", text: "text-blue-400" },
    purple: { bg: "from-purple-500 to-violet-600", glow: "shadow-purple-500/20", text: "text-purple-400" },
    pink: { bg: "from-pink-500 to-rose-600", glow: "shadow-pink-500/20", text: "text-pink-400" },
    cyan: { bg: "from-cyan-500 to-teal-600", glow: "shadow-cyan-500/20", text: "text-cyan-400" }
  };

  const colors = colorMap[color] || colorMap.orange;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group h-full"
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${colors.bg} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity`} />
      <div className="relative bg-[#0f0f1a]/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 h-full flex flex-col">
        <div className="flex items-start justify-between flex-1">
          <div className="space-y-1 flex-1">
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            {loading ? (
              <div className="h-9 w-24 bg-white/10 rounded animate-pulse" />
            ) : (
            <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
            )}
            {change !== undefined && !loading ? (
              <div className="flex items-center gap-1 min-h-[20px]">
                {change >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                )}
                <span className={`text-sm font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {Math.abs(change)}%
                </span>
                <span className="text-gray-500 text-sm">vs mês anterior</span>
              </div>
            ) : (
              <div className="min-h-[20px]" />
            )}
            {subtitle ? (
              <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
            ) : (
              <div className="min-h-[18px] mt-1" />
            )}
          </div>
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.bg} flex items-center justify-center shadow-lg ${colors.glow} flex-shrink-0`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    // Active statuses
    ativo: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle, label: 'Ativo' },
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle, label: 'Ativo' },
    ACTIVE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle, label: 'Ativo' },
    // Past due / Inadimplente
    inadimplente: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: AlertCircle, label: 'Inadimplente' },
    past_due: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: AlertCircle, label: 'Inadimplente' },
    PAST_DUE: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: AlertCircle, label: 'Inadimplente' },
    // Canceled
    cancelado: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: XCircle, label: 'Cancelado' },
    canceled: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: XCircle, label: 'Cancelado' },
    CANCELED: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: XCircle, label: 'Cancelado' },
    // Pending
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock, label: 'Pendente' },
    PENDING: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock, label: 'Pendente' },
    pendente: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock, label: 'Pendente' },
    // Expired
    expired: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: XCircle, label: 'Expirado' },
    EXPIRED: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: XCircle, label: 'Expirado' },
    // Invoice statuses
    autorizada: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle, label: 'Autorizada' },
    rejeitada: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle, label: 'Rejeitada' },
    cancelada: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: XCircle, label: 'Cancelada' },
    processando: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: RefreshCw, label: 'Processando' },
    rascunho: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: Clock, label: 'Rascunho' },
    // Fiscal integration statuses
    conectado: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle, label: 'Conectado' },
    configurado: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: CheckCircle, label: 'Configurado' },
    verificando: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: RefreshCw, label: 'Verificando' },
    erro: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: AlertCircle, label: 'Erro' },
    falha: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: AlertCircle, label: 'Falha' },
    certificado_ok: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: CheckCircle, label: 'Certificado OK' },
    certificado_pendente: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock, label: 'Cert. Pendente' },
    no_subscription: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: Clock, label: 'Sem Assinatura' },
  };

  const config = statusConfig[status?.toLowerCase()] || statusConfig[status] || statusConfig.no_subscription;
  const IconComponent = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bg} ${config.text} ${config.border}`}>
      <IconComponent className="w-3 h-3" />
      {config.label}
    </span>
  );
};

const PlanBadge = ({ planId }) => {
  const planConfig = {
    pay_per_use: { bg: 'from-slate-500 to-slate-600', label: 'Pay per Use' },
    essential: { bg: 'from-orange-500 to-amber-600', label: 'Essential' },
    professional: { bg: 'from-violet-500 to-purple-600', label: 'Professional' },
    accountant: { bg: 'from-emerald-500 to-teal-600', label: 'Contador' },
  };

  const config = planConfig[planId?.toLowerCase()] || planConfig.pay_per_use;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r ${config.bg} text-white shadow-sm`}>
      {config.label}
    </span>
  );
};

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
    <div className="text-white font-medium">{value}</div>
  </div>
);

const LoadingSpinner = ({ size = "default" }) => {
  const sizes = {
    small: "w-4 h-4",
    default: "w-8 h-8",
    large: "w-12 h-12"
  };
  
  return (
    <div className="flex items-center justify-center p-12">
      <RefreshCw className={`${sizes[size]} animate-spin text-orange-500`} />
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-gray-500" />
    </div>
    <h3 className="text-white font-medium mb-1">{title}</h3>
    <p className="text-gray-500 text-sm">{description}</p>
  </div>
);

// ==========================================
// USER DETAIL MODAL
// ==========================================

const UserDetailModal = ({ user, open, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', email: '', isAdmin: false });
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user) {
      setEditData({ name: user.name || '', email: user.email || '', isAdmin: user.isAdmin || false });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data) => adminService.updateUser(user.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado com sucesso');
      setIsEditing(false);
      onUpdate?.();
    },
    onError: async (error) => await handleApiError(error, { operation: 'update_user', userId: user?.id })
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => adminService.resetPassword(user.id, newPassword),
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso');
      setNewPassword('');
      setShowResetPassword(false);
    },
    onError: async (error) => await handleApiError(error, { operation: 'reset_password', userId: user?.id })
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f0f1a] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div>
              <span className="text-xl">{user.name}</span>
              {user.isAdmin && <Badge className="ml-2 bg-orange-500/20 text-orange-400 border-orange-500/30">Admin</Badge>}
              <p className="text-sm text-gray-400 font-normal">{user.email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {isEditing ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="space-y-2">
                <Label className="text-gray-400">Nome</Label>
                <Input 
                  value={editData.name} 
                  onChange={(e) => setEditData(p => ({ ...p, name: e.target.value }))} 
                  className="bg-white/5 border-white/10 focus:border-orange-500/50" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400">Email</Label>
                <Input 
                  value={editData.email} 
                  onChange={(e) => setEditData(p => ({ ...p, email: e.target.value }))} 
                  className="bg-white/5 border-white/10 focus:border-orange-500/50" 
                />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <input 
                  type="checkbox" 
                  id="isAdmin" 
                  checked={editData.isAdmin} 
                  onChange={(e) => setEditData(p => ({ ...p, isAdmin: e.target.checked }))} 
                  className="rounded border-orange-500/30 bg-white/5 text-orange-500 focus:ring-orange-500" 
                />
                <Label htmlFor="isAdmin" className="text-orange-300 cursor-pointer flex items-center gap-2">
                  <Crown className="w-4 h-4" /> Administrador do Sistema
                </Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => updateMutation.mutate(editData)} 
                  disabled={updateMutation.isPending} 
                  className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500"
                >
                  {updateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="border-white/10 hover:bg-white/5">
                  Cancelar
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <InfoCard icon={Mail} label="Email" value={user.email} />
              <InfoCard icon={Calendar} label="Cadastrado em" value={new Date(user.createdAt).toLocaleDateString('pt-BR')} />
              <InfoCard icon={Building2} label="Empresas" value={user._count?.companies || user.companies?.length || 0} />
              <InfoCard icon={CreditCard} label="Plano" value={<PlanBadge planId={user.subscription?.planId} />} />
              <InfoCard icon={Activity} label="Status" value={<StatusBadge status={user.subscription?.status || 'no_subscription'} />} />
              <InfoCard icon={Crown} label="Tipo" value={user.isAdmin ? 'Administrador' : 'Usuário'} />
            </div>
          )}

          {user.companies && user.companies.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Empresas ({user.companies.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {user.companies.map((company) => (
                  <div key={company.id} className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                    <p className="text-white font-medium">{company.razaoSocial || company.nomeFantasia}</p>
                    <p className="text-gray-500 text-sm">CNPJ: {company.cnpj || 'Não informado'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
          {showResetPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3"
              >
                <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Redefinir Senha
                </h4>
                <Input 
                  type="password" 
                  placeholder="Nova senha (mín. 6 caracteres)" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className="bg-white/5 border-white/10 focus:border-red-500/50" 
                />
              <div className="flex gap-2">
                  <Button 
                    onClick={() => resetPasswordMutation.mutate()} 
                    disabled={newPassword.length < 6 || resetPasswordMutation.isPending} 
                    size="sm" 
                    className="bg-red-500 hover:bg-red-600"
                  >
                    {resetPasswordMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : null}
                  Confirmar
                </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setShowResetPassword(false); setNewPassword(''); }} 
                    className="border-white/10"
                  >
                    Cancelar
                  </Button>
              </div>
              </motion.div>
          )}
          </AnimatePresence>
        </div>

        <DialogFooter className="mt-6 flex gap-2">
          {!isEditing && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(true)} 
                className="border-white/10 hover:bg-white/5"
              >
                <Edit className="w-4 h-4 mr-2" /> Editar
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowResetPassword(!showResetPassword)} 
                className="border-white/10 hover:bg-white/5"
              >
                <Key className="w-4 h-4 mr-2" /> Redefinir Senha
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ==========================================
// SUBSCRIPTION EDIT MODAL
// ==========================================

const SubscriptionEditModal = ({ subscription, open, onClose, onUpdate }) => {
  const [planId, setPlanId] = useState('');
  const [extendDays, setExtendDays] = useState(30);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (subscription) {
      setPlanId(subscription.planId || 'pay_per_use');
    }
  }, [subscription]);

  const updatePlanMutation = useMutation({
    mutationFn: () => adminService.updateSubscriptionPlan(subscription.id, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success('Plano atualizado com sucesso');
      onClose();
      onUpdate?.();
    },
    onError: async (error) => await handleApiError(error)
  });

  const extendMutation = useMutation({
    mutationFn: () => adminService.extendSubscription(subscription.id, extendDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success(`Assinatura estendida em ${extendDays} dias`);
      onClose();
      onUpdate?.();
    },
    onError: async (error) => await handleApiError(error)
  });

  if (!subscription) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f0f1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            Gerenciar Assinatura
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {subscription.user?.name || subscription.user?.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Change Plan */}
          <div className="space-y-3">
            <Label className="text-gray-400">Alterar Plano</Label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none"
            >
              <option value="pay_per_use">Pay per Use</option>
              <option value="essential">Essential</option>
              <option value="professional">Professional</option>
              <option value="accountant">Contador</option>
            </select>
            <Button 
              onClick={() => updatePlanMutation.mutate()} 
              disabled={updatePlanMutation.isPending || planId === subscription.planId}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600"
            >
              {updatePlanMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Atualizar Plano
            </Button>
    </div>

          {/* Extend Subscription */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <Label className="text-gray-400">Estender Assinatura</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="1"
                max="365"
                value={extendDays}
                onChange={(e) => setExtendDays(parseInt(e.target.value) || 30)}
                className="bg-white/5 border-white/10"
              />
              <span className="flex items-center text-gray-400 px-3">dias</span>
  </div>
            <Button 
              onClick={() => extendMutation.mutate()} 
              disabled={extendMutation.isPending}
              variant="outline"
              className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              {extendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
              Estender Período
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ==========================================
// USERS TAB
// ==========================================

const UsersTab = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminService.getUsers({ page, limit: 10, search }),
    staleTime: 0, // Always refetch on demand
  });

  const { data: userData } = useQuery({
    queryKey: ['admin-user-detail', selectedUser?.id],
    queryFn: () => adminService.getUser(selectedUser.id),
    enabled: !!selectedUser?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: adminService.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário excluído com sucesso');
    },
    onError: async (error) => await handleApiError(error)
  });

  const bulkActionMutation = useMutation({
    mutationFn: ({ userIds, action }) => adminService.bulkUserAction(userIds, action),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(data.message || 'Ação realizada com sucesso');
      setSelectedUsers([]);
    },
    onError: async (error) => await handleApiError(error)
  });

  const toggleAdminMutation = useMutation({
    mutationFn: ({ id, isAdmin }) => adminService.updateUser(id, { isAdmin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Permissões atualizadas');
    }
  });

  const users = data?.users || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const toggleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
            placeholder="Buscar por nome ou email..." 
            className="pl-10 bg-white/5 border-white/10 h-11 focus:border-orange-500/50" 
          />
        </div>
        <div className="flex gap-2">
          {selectedUsers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden px-5 py-2.5 h-11 rounded-xl font-medium text-sm
                    bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 backdrop-blur-sm
                    border border-orange-500/40 text-orange-300
                    hover:border-orange-500/60 hover:text-orange-200
                    hover:bg-gradient-to-br hover:from-orange-500/30 hover:via-orange-600/15 hover:to-orange-500/10
                    hover:shadow-xl hover:shadow-orange-500/30
                    transition-all duration-500 ease-out
                    flex items-center gap-2"
                >
                  {/* Animated gradient shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/40 to-transparent opacity-0 group-hover:opacity-100"
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  />
                  
                  {/* Glow effect overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/10 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  {/* Pulsing border glow */}
                  <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-orange-500/40"
                    animate={{
                      boxShadow: [
                        '0 0 0px rgba(249, 115, 22, 0.3)',
                        '0 0 20px rgba(249, 115, 22, 0.5)',
                        '0 0 0px rgba(249, 115, 22, 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  
                  <div className="relative flex items-center gap-2 z-10">
                    <ListChecks className="w-4 h-4 text-orange-400 group-hover:text-orange-300 transition-colors duration-500" />
                    <span className="group-hover:text-orange-100 transition-colors duration-500">
                  Ações em Massa ({selectedUsers.length})
                    </span>
                    <ChevronDown className="w-4 h-4 text-orange-400/70 group-hover:text-orange-300 transition-colors duration-500" />
                  </div>
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a2e] border-white/10">
                <DropdownMenuLabel className="text-gray-400">Ações em Massa</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                  onClick={() => bulkActionMutation.mutate({ userIds: selectedUsers, action: 'make_admin' })}
                  className="text-orange-400 hover:bg-orange-500/10"
                >
                  <Crown className="w-4 h-4 mr-2" /> Tornar Admin
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => bulkActionMutation.mutate({ userIds: selectedUsers, action: 'remove_admin' })}
                  className="text-gray-400 hover:bg-white/10"
                >
                  <ShieldOff className="w-4 h-4 mr-2" /> Remover Admin
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem 
                  onClick={() => {
                    if (confirm(`Excluir ${selectedUsers.length} usuários?`)) {
                      bulkActionMutation.mutate({ userIds: selectedUsers, action: 'delete' });
                    }
                  }}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir Selecionados
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        <motion.button
          onClick={() => {
            refetch();
            toast.success('Lista de usuários atualizada!');
          }}
          disabled={isFetching}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="group relative overflow-hidden px-5 py-2.5 h-11 rounded-xl font-medium text-sm
            bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm
            border border-white/10 text-gray-300
            hover:border-orange-500/60 hover:text-white
            hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-orange-600/10 hover:to-[#0f0f1a]/80
            hover:shadow-xl hover:shadow-orange-500/25
            disabled:opacity-70 disabled:cursor-not-allowed
            transition-all duration-500 ease-out"
        >
          {/* Animated gradient shimmer effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent opacity-0 group-hover:opacity-100"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Glow effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Pulsing border glow */}
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-orange-500/0 group-hover:border-orange-500/40"
            animate={{
              boxShadow: [
                '0 0 0px rgba(249, 115, 22, 0)',
                '0 0 20px rgba(249, 115, 22, 0.3)',
                '0 0 0px rgba(249, 115, 22, 0)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          <div className="relative flex items-center gap-2 z-10">
            <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors duration-500 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="group-hover:text-orange-100 transition-colors duration-500">Atualizar</span>
          </div>
        </motion.button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-white/5 to-white/[0.02]">
                <th className="w-12 p-4">
                  <input 
                    type="checkbox" 
                    checked={selectedUsers.length === users.length && users.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500"
                  />
                </th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Usuário</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Empresas</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Plano</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Status</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Criado em</th>
                <th className="text-right text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7}><LoadingSpinner /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Users} title="Nenhum usuário" description="Nenhum usuário encontrado" /></td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleSelectUser(user.id)}
                      className="rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{user.name || 'Sem nome'}</p>
                          {user.isAdmin && <Crown className="w-4 h-4 text-orange-400" />}
                        </div>
                        <p className="text-gray-500 text-sm">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-sm">
                      <Building2 className="w-3.5 h-3.5" /> {user._count?.companies || 0}
                    </span>
                  </td>
                  <td className="p-4">
                    <PlanBadge planId={user.subscription?.planId} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={user.subscription?.status || 'no_subscription'} />
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-white/10">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-white/10 min-w-[180px]">
                        <DropdownMenuItem 
                          onClick={() => { setSelectedUser(user); setUserDetailOpen(true); }} 
                          className="text-white hover:bg-white/10"
                        >
                          <Eye className="w-4 h-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => toggleAdminMutation.mutate({ id: user.id, isAdmin: !user.isAdmin })} 
                          className="text-white hover:bg-white/10"
                        >
                          {user.isAdmin ? <ShieldOff className="w-4 h-4 mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                          {user.isAdmin ? 'Remover Admin' : 'Tornar Admin'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem 
                          onClick={() => { if (confirm('Excluir este usuário?')) deleteMutation.mutate(user.id); }} 
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
          <p className="text-gray-500 text-sm">
            {pagination.total} usuários • Página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page <= 1} 
              onClick={() => setPage(p => p - 1)} 
              className="border-white/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page >= pagination.totalPages} 
              onClick={() => setPage(p => p + 1)} 
              className="border-white/10"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <UserDetailModal 
        user={userData?.user || selectedUser} 
        open={userDetailOpen} 
        onClose={() => setUserDetailOpen(false)} 
        onUpdate={refetch} 
      />
    </div>
  );
};

// ==========================================
// SUBSCRIPTIONS TAB
// ==========================================

const SubscriptionsTab = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSub, setSelectedSub] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSubs, setSelectedSubs] = useState([]);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-subscriptions', page, statusFilter],
    queryFn: () => adminService.getSubscriptions({ page, limit: 10, status: statusFilter }),
    staleTime: 0, // Always refetch on demand
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => adminService.updateSubscription(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success('Status atualizado com sucesso');
    }
  });

  const bulkActionMutation = useMutation({
    mutationFn: ({ subscriptionIds, action }) => adminService.bulkSubscriptionAction(subscriptionIds, action),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success(data.message || 'Ação realizada com sucesso');
      setSelectedSubs([]);
    },
    onError: async (error) => await handleApiError(error)
  });

  const subscriptions = data?.subscriptions || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const statusOptions = [
    { value: 'all', label: 'Todos', icon: ListChecks },
    { value: 'ACTIVE', label: 'Ativos', icon: CheckCircle },
    { value: 'PENDING', label: 'Pendentes', icon: Clock },
    { value: 'PAST_DUE', label: 'Inadimplentes', icon: AlertCircle },
    { value: 'CANCELED', label: 'Cancelados', icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          {statusOptions.map(opt => {
            const isActive = statusFilter === opt.value;
            return (
              <motion.button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm
                  transition-all duration-300 ease-out
                  ${isActive
                    ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/30 border border-orange-400/50'
                    : 'bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm text-gray-300 border border-white/10 hover:border-orange-500/30 hover:text-white hover:shadow-md hover:shadow-orange-500/10'
                  }
                `}
              >
                {/* Animated gradient overlay for active state */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                
                {/* Hover glow effect */}
                {!isActive && (
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}
                
                <div className="relative flex items-center gap-2">
                  <opt.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-orange-400'}`} />
                  <span className="relative z-10">{opt.label}</span>
                </div>
                
                {/* Bottom accent line for active state */}
                {isActive && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
        <div className="flex gap-2">
          {selectedSubs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative overflow-hidden px-4 py-2.5 rounded-xl font-medium text-sm
                    bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm
                    border border-orange-500/30 text-orange-400 hover:border-orange-500/50 hover:text-orange-300
                    hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center">
                    Ações ({selectedSubs.length})
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </div>
                </motion.button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a2e] border-white/10">
                <DropdownMenuItem 
                  onClick={() => bulkActionMutation.mutate({ subscriptionIds: selectedSubs, action: 'activate' })}
                  className="text-emerald-400 hover:bg-emerald-500/10"
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Ativar Todos
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => bulkActionMutation.mutate({ subscriptionIds: selectedSubs, action: 'suspend' })}
                  className="text-amber-400 hover:bg-amber-500/10"
                >
                  <Pause className="w-4 h-4 mr-2" /> Suspender
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => bulkActionMutation.mutate({ subscriptionIds: selectedSubs, action: 'cancel' })}
                  className="text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="w-4 h-4 mr-2" /> Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <motion.button
            onClick={() => {
              refetch();
              toast.success('Lista de assinaturas atualizada!');
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isFetching}
            className="group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm
              bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm
              border border-white/10 text-gray-300
              hover:border-orange-500/60 hover:text-white
              hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-orange-600/10 hover:to-[#0f0f1a]/80
              hover:shadow-xl hover:shadow-orange-500/25
              disabled:opacity-70 disabled:cursor-not-allowed
              transition-all duration-500 ease-out"
          >
            {/* Animated gradient shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent opacity-0 group-hover:opacity-100"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            
            {/* Glow effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Pulsing border glow */}
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-orange-500/0 group-hover:border-orange-500/40"
              animate={{
                boxShadow: [
                  '0 0 0px rgba(249, 115, 22, 0)',
                  '0 0 20px rgba(249, 115, 22, 0.3)',
                  '0 0 0px rgba(249, 115, 22, 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            
            <div className="relative flex items-center gap-2 z-10">
              <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors duration-500 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="group-hover:text-orange-100 transition-colors duration-500">Atualizar</span>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-white/5 to-white/[0.02]">
                <th className="w-12 p-4">
                  <input 
                    type="checkbox" 
                    checked={selectedSubs.length === subscriptions.length && subscriptions.length > 0}
                    onChange={() => setSelectedSubs(
                      selectedSubs.length === subscriptions.length ? [] : subscriptions.map(s => s.id)
                    )}
                    className="rounded border-white/20 bg-white/5 text-orange-500"
                  />
                </th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Usuário</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Plano</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Status</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Último Pgto</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Expira em</th>
                <th className="text-right text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7}><LoadingSpinner /></td></tr>
              ) : subscriptions.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={CreditCard} title="Nenhuma assinatura" description="Nenhuma assinatura encontrada" /></td></tr>
              ) : subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <input 
                      type="checkbox" 
                      checked={selectedSubs.includes(sub.id)}
                      onChange={() => setSelectedSubs(prev => 
                        prev.includes(sub.id) ? prev.filter(id => id !== sub.id) : [...prev, sub.id]
                      )}
                      className="rounded border-white/20 bg-white/5 text-orange-500"
                    />
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-white font-medium">{sub.user?.name || 'Sem nome'}</p>
                      <p className="text-gray-500 text-sm">{sub.user?.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <PlanBadge planId={sub.planId} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="p-4 text-gray-300">
                    {sub.payments?.[0] 
                      ? `R$ ${parseFloat(sub.payments[0].amount || 0).toFixed(2)}`
                      : '---'
                    }
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {sub.currentPeriodEnd 
                      ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')
                      : '---'
                    }
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-white/10">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-white/10 min-w-[200px]">
                        <DropdownMenuItem 
                          onClick={() => { setSelectedSub(sub); setEditModalOpen(true); }}
                          className="text-white hover:bg-white/10"
                        >
                          <Edit className="w-4 h-4 mr-2" /> Gerenciar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem 
                          onClick={() => updateMutation.mutate({ id: sub.id, status: 'ACTIVE' })} 
                          className="text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" /> Ativar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateMutation.mutate({ id: sub.id, status: 'PENDING' })} 
                          className="text-blue-400 hover:bg-blue-500/10"
                        >
                          <Clock className="w-4 h-4 mr-2" /> Pendente
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => updateMutation.mutate({ id: sub.id, status: 'PAST_DUE' })} 
                          className="text-amber-400 hover:bg-amber-500/10"
                        >
                          <AlertCircle className="w-4 h-4 mr-2" /> Inadimplente
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem 
                          onClick={() => updateMutation.mutate({ id: sub.id, status: 'CANCELED' })} 
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle className="w-4 h-4 mr-2" /> Cancelar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
          <p className="text-gray-500 text-sm">{pagination.total} assinaturas</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-white/10">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="border-white/10">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <SubscriptionEditModal
        subscription={selectedSub}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onUpdate={refetch}
      />
    </div>
  );
};

// ==========================================
// COMPANIES TAB
// ==========================================

const CompaniesTab = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-companies', page, search],
    queryFn: () => adminService.getCompanies({ page, limit: 10, search }),
    staleTime: 0, // Always refetch on demand
    refetchInterval: 30000, // Auto-refresh every 30 seconds for real-time status
  });

  const companies = data?.companies || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            value={search} 
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
            placeholder="Buscar por razão social, nome fantasia ou CNPJ..." 
            className="pl-10 bg-white/5 border-white/10 h-11" 
          />
        </div>
        <motion.button
          onClick={() => {
            refetch();
            toast.success('Lista de empresas atualizada!');
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isFetching}
          className="group relative overflow-hidden px-5 py-2.5 h-11 rounded-xl font-medium text-sm
            bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm
            border border-white/10 text-gray-300
            hover:border-orange-500/60 hover:text-white
            hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-orange-600/10 hover:to-[#0f0f1a]/80
            hover:shadow-xl hover:shadow-orange-500/25
            disabled:opacity-70 disabled:cursor-not-allowed
            transition-all duration-500 ease-out"
        >
          {/* Animated gradient shimmer effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent opacity-0 group-hover:opacity-100"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Glow effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Pulsing border glow */}
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-orange-500/0 group-hover:border-orange-500/40"
            animate={{
              boxShadow: [
                '0 0 0px rgba(249, 115, 22, 0)',
                '0 0 20px rgba(249, 115, 22, 0.3)',
                '0 0 0px rgba(249, 115, 22, 0)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          <div className="relative flex items-center gap-2 z-10">
            <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors duration-500 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="group-hover:text-orange-100 transition-colors duration-500">Atualizar</span>
          </div>
        </motion.button>
      </div>

      <div className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-white/5 to-white/[0.02]">
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Empresa</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">CNPJ</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Proprietário</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Notas</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Status Fiscal</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={6}><LoadingSpinner /></td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={Building2} title="Nenhuma empresa" description="Nenhuma empresa encontrada" /></td></tr>
              ) : companies.map((company) => (
                <tr key={company.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{company.razaoSocial || company.nomeFantasia || 'Sem nome'}</p>
                        {company.nomeFantasia && company.razaoSocial && (
                          <p className="text-gray-500 text-sm">{company.nomeFantasia}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 font-mono text-sm">{company.cnpj || '---'}</td>
                  <td className="p-4">
                    <div>
                      <p className="text-white text-sm">{company.user?.name || 'Sem nome'}</p>
                      <p className="text-gray-500 text-xs">{company.user?.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-sm">
                      <FileText className="w-3.5 h-3.5" /> {company._count?.invoices || 0}
                    </span>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={company.computedFiscalStatus || 'pendente'} />
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
          <p className="text-gray-500 text-sm">{pagination.total} empresas</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-white/10">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="border-white/10">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// CLIENTS TAB
// ==========================================

const ClientsTab = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-clients', page, searchTerm],
    queryFn: () => adminService.getClients({ page, limit: 10, search: searchTerm }),
    staleTime: 0,
  });

  const clients = data?.clients || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const formatDocument = (doc, tipo) => {
    if (!doc) return 'N/A';
    if (tipo === 'pf' || doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            type="text"
            placeholder="Buscar clientes por nome, documento ou email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-10 bg-[#0f0f1a]/60 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <motion.button
          onClick={() => {
            refetch();
            toast.success('Lista de clientes atualizada!');
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isFetching}
          className="group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm
            bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm
            border border-white/10 text-gray-300
            hover:border-orange-500/60 hover:text-white
            hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-orange-600/10 hover:to-[#0f0f1a]/80
            hover:shadow-xl hover:shadow-orange-500/25
            disabled:opacity-70 disabled:cursor-not-allowed
            transition-all duration-500 ease-out"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent opacity-0 group-hover:opacity-100"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-orange-500/0 group-hover:border-orange-500/40"
            animate={{
              boxShadow: [
                '0 0 0px rgba(249, 115, 22, 0)',
                '0 0 20px rgba(249, 115, 22, 0.3)',
                '0 0 0px rgba(249, 115, 22, 0)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative flex items-center gap-2 z-10">
            <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors duration-500 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="group-hover:text-orange-100 transition-colors duration-500">Atualizar</span>
          </div>
        </motion.button>
      </div>

      <div className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-white/5 to-white/[0.02]">
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Nome</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Documento</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Tipo</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Email</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Usuário</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Notas</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7}><LoadingSpinner /></td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={UserCheck} title="Nenhum cliente" description="Nenhum cliente encontrado" /></td></tr>
              ) : clients.map((client) => (
                <tr key={client.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div>
                      <p className="text-white font-medium">{client.nome || 'N/A'}</p>
                      {client.apelido && (
                        <p className="text-gray-500 text-xs">({client.apelido})</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-orange-400 text-sm">
                      {formatDocument(client.documento, client.tipoPessoa)}
                    </span>
                  </td>
                  <td className="p-4">
                    <Badge className={client.tipoPessoa === 'pf' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}>
                      {client.tipoPessoa === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                    </Badge>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{client.email || 'N/A'}</td>
                  <td className="p-4">
                    <div>
                      <p className="text-white text-sm">{client.user?.name || 'N/A'}</p>
                      <p className="text-gray-500 text-xs">{client.user?.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-emerald-400 font-semibold">
                      {client._count?.invoices || 0}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {client.createdAt 
                      ? new Date(client.createdAt).toLocaleDateString('pt-BR')
                      : 'N/A'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
          <p className="text-gray-500 text-sm">{pagination.total} clientes</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-white/10">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="border-white/10">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// INVOICES TAB
// ==========================================

const InvoicesTab = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-invoices', page, statusFilter],
    queryFn: () => adminService.getInvoices({ page, limit: 10, status: statusFilter }),
    staleTime: 0, // Always refetch on demand
    refetchInterval: 30000, // Auto-refresh every 30 seconds for real-time status
  });

  const invoices = data?.invoices || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const statusOptions = [
    { value: 'all', label: 'Todas' },
    { value: 'autorizada', label: 'Autorizadas' },
    { value: 'processando', label: 'Processando' },
    { value: 'rejeitada', label: 'Rejeitadas' },
    { value: 'cancelada', label: 'Canceladas' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          {statusOptions.map(opt => {
            const isActive = statusFilter === opt.value;
            return (
              <motion.button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm
                  transition-all duration-300 ease-out
                  ${isActive
                    ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/30 border border-orange-400/50'
                    : 'bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm text-gray-300 border border-white/10 hover:border-orange-500/30 hover:text-white hover:shadow-md hover:shadow-orange-500/10'
                  }
                `}
              >
                {/* Animated gradient overlay for active state */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                
                {/* Hover glow effect */}
                {!isActive && (
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}
                
                <span className="relative z-10">{opt.label}</span>
                
                {/* Bottom accent line for active state */}
                {isActive && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
        <motion.button
          onClick={() => {
            refetch();
            toast.success('Lista de notas fiscais atualizada!');
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isFetching}
          className="group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm
            bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm
            border border-white/10 text-gray-300
            hover:border-orange-500/60 hover:text-white
            hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-orange-600/10 hover:to-[#0f0f1a]/80
            hover:shadow-xl hover:shadow-orange-500/25
            disabled:opacity-70 disabled:cursor-not-allowed
            transition-all duration-500 ease-out"
        >
          {/* Animated gradient shimmer effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent opacity-0 group-hover:opacity-100"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Glow effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* Pulsing border glow */}
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-orange-500/0 group-hover:border-orange-500/40"
            animate={{
              boxShadow: [
                '0 0 0px rgba(249, 115, 22, 0)',
                '0 0 20px rgba(249, 115, 22, 0.3)',
                '0 0 0px rgba(249, 115, 22, 0)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          
          <div className="relative flex items-center gap-2 z-10">
            <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors duration-500 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="group-hover:text-orange-100 transition-colors duration-500">Atualizar</span>
          </div>
        </motion.button>
      </div>

      <div className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-white/5 to-white/[0.02]">
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Número</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Cliente</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Empresa</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Valor</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Status</th>
                <th className="text-left text-gray-400 text-xs font-semibold uppercase tracking-wider p-4">Emitida em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={6}><LoadingSpinner /></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={FileText} title="Nenhuma nota" description="Nenhuma nota fiscal encontrada" /></td></tr>
              ) : invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <span className="font-mono text-orange-400 font-semibold">#{invoice.numero || '---'}</span>
                  </td>
                  <td className="p-4 text-white">{invoice.clienteNome || '---'}</td>
                  <td className="p-4">
                    <div>
                      <p className="text-white text-sm">{invoice.company?.razaoSocial || invoice.company?.nomeFantasia || 'N/A'}</p>
                      <p className="text-gray-500 text-xs">{invoice.company?.user?.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-emerald-400 font-semibold">
                      R$ {parseFloat(invoice.valor || 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {invoice.dataEmissao 
                      ? new Date(invoice.dataEmissao).toLocaleDateString('pt-BR')
                      : '---'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
          <p className="text-gray-500 text-sm">{pagination.total} notas fiscais</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-white/10">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="border-white/10">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SETTINGS TAB
// ==========================================

const SettingsTab = () => {
  const { data: settings, isLoading: settingsLoading, isFetching: settingsFetching, refetch: refetchSettings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminService.getSettings,
    staleTime: 0, // Always refetch on demand
  });

  const { data: health, isLoading: healthLoading, isFetching: healthFetching, refetch: refetchHealth } = useQuery({
    queryKey: ['admin-health'],
    queryFn: adminService.getHealth,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 0, // Always refetch on demand
  });

  const handleExport = async (type) => {
    try {
      let response;
      let filename;
      
      switch (type) {
        case 'users':
          response = await adminService.exportUsers();
          filename = `users-export-${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'subscriptions':
          response = await adminService.exportSubscriptions();
          filename = `subscriptions-export-${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'invoices':
          response = await adminService.exportInvoices();
          filename = `invoices-export-${new Date().toISOString().split('T')[0]}.json`;
          break;
        default:
          return;
      }
      
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`${type} exportados com sucesso`);
    } catch (error) {
      toast.error('Erro ao exportar dados');
  }
  };

  const integrations = [
    { 
      name: 'Nuvem Fiscal', 
      icon: Globe, 
      configured: settings?.settings?.nuvemFiscalConfigured, 
      env: settings?.settings?.nuvemFiscalEnvironment, 
      desc: 'Integração para emissão de NFS-e' 
    },
    { 
      name: 'Stripe', 
      icon: CreditCard, 
      configured: settings?.settings?.stripeConfigured, 
      desc: 'Gateway de pagamentos' 
    },
    { 
      name: 'Email', 
      icon: Mail, 
      configured: settings?.settings?.emailConfigured, 
      desc: 'Envio de emails transacionais' 
    },
  ];

  return (
    <div className="space-y-6">
      {/* System Health */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              health?.status === 'healthy' 
                ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                : 'bg-gradient-to-br from-amber-500 to-orange-600'
            }`}>
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Saúde do Sistema</h3>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${
                  health?.status === 'healthy' ? 'bg-emerald-500' : 'bg-amber-500'
                }`} />
                <span className={`text-sm font-medium ${
                  health?.status === 'healthy' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {health?.status === 'healthy' ? 'Saudável' : 'Degradado'}
                </span>
              </div>
            </div>
          </div>
          <motion.button
            onClick={() => {
              refetchHealth();
              toast.success('Status do sistema atualizado!');
            }}
            disabled={healthFetching}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative group overflow-hidden p-2.5 rounded-xl bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/10 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <RefreshCw className={`relative w-4 h-4 text-orange-400 group-hover:text-orange-300 transition-colors duration-300 ${healthFetching ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {healthLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Database className="w-4 h-4" /> Database
              </div>
              <div className="flex items-center gap-2">
                {health?.database?.status === 'healthy' ? (
                  <Wifi className="w-5 h-5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-5 h-5 text-red-400" />
                )}
                <span className={`font-semibold ${
                  health?.database?.status === 'healthy' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {health?.database?.latency || 0}ms
                </span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Clock className="w-4 h-4" /> Uptime
              </div>
              <p className="text-white font-semibold">{health?.system?.uptimeFormatted || '0h 0m'}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Cpu className="w-4 h-4" /> Memória
              </div>
              <p className="text-white font-semibold">
                {health?.system?.memory?.heapUsed || 0} / {health?.system?.memory?.heapTotal || 0} MB
              </p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Zap className="w-4 h-4" /> Resposta
              </div>
              <p className="text-white font-semibold">{health?.responseTime || 0}ms</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* System Info */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Sistema</h3>
              <p className="text-gray-500 text-sm">Informações do servidor</p>
            </div>
          </div>
          <motion.button
            onClick={() => {
              refetchSettings();
              toast.success('Informações do sistema atualizadas!');
            }}
            disabled={settingsFetching}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative group overflow-hidden p-2.5 rounded-xl bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/10 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <RefreshCw className={`relative w-4 h-4 text-orange-400 group-hover:text-orange-300 transition-colors duration-300 ${settingsFetching ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {settingsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Zap className="w-4 h-4" /> Ambiente
              </div>
            <p className="text-white font-semibold capitalize">{settings?.settings?.environment || 'development'}</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Database className="w-4 h-4" /> Versão
              </div>
            <p className="text-white font-semibold">{settings?.settings?.version || '1.0.0'}</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Activity className="w-4 h-4" /> Status
              </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-emerald-400 font-semibold">Online</p>
            </div>
          </div>
        </div>
        )}
      </motion.div>

      {/* Integrations */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
      >
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" /> Integrações
        </h3>
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div 
              key={integration.name} 
              className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  integration.configured 
                    ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                    : 'bg-gradient-to-br from-gray-500 to-gray-600'
                }`}>
                  <integration.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{integration.name}</p>
                    {integration.env && (
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {integration.env}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-sm">{integration.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {integration.configured ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium border border-emerald-500/30">
                    <CheckCircle className="w-4 h-4" /> Configurado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-500/20 text-gray-400 text-sm font-medium border border-gray-500/30">
                    <XCircle className="w-4 h-4" /> Não configurado
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Export Data */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
      >
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <FileDown className="w-5 h-5 text-orange-500" /> Exportar Dados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Export Users Button */}
          <motion.button
            onClick={() => handleExport('users')}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm rounded-xl p-5 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-blue-500/0 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full group-hover:bg-blue-500/30 transition-colors" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center group-hover:border-blue-500/50 transition-colors">
                  <Users className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-white font-semibold text-base group-hover:text-blue-100 transition-colors">
                    Usuários
                  </h4>
                  <ArrowUpRight className="w-4 h-4 text-blue-400/0 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
                </div>
                <p className="text-gray-400 text-xs group-hover:text-gray-300 transition-colors">
                  Exportar todos os usuários
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
          </motion.button>

          {/* Export Subscriptions Button */}
          <motion.button
            onClick={() => handleExport('subscriptions')}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm rounded-xl p-5 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-purple-500/0 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full group-hover:bg-purple-500/30 transition-colors" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 flex items-center justify-center group-hover:border-purple-500/50 transition-colors">
                  <CreditCard className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-white font-semibold text-base group-hover:text-purple-100 transition-colors">
                    Assinaturas
                  </h4>
                  <ArrowUpRight className="w-4 h-4 text-purple-400/0 group-hover:text-purple-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
                </div>
                <p className="text-gray-400 text-xs group-hover:text-gray-300 transition-colors">
                  Exportar todas as assinaturas
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
          </motion.button>

          {/* Export Invoices Button */}
          <motion.button
            onClick={() => handleExport('invoices')}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="group relative overflow-hidden bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm rounded-xl p-5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-emerald-500/0 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full group-hover:bg-emerald-500/30 transition-colors" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center group-hover:border-emerald-500/50 transition-colors">
                  <FileText className="w-6 h-6 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                </div>
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-white font-semibold text-base group-hover:text-emerald-100 transition-colors">
                    Notas Fiscais
                  </h4>
                  <ArrowUpRight className="w-4 h-4 text-emerald-400/0 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />
                </div>
                <p className="text-gray-400 text-xs group-hover:text-gray-300 transition-colors">
                  Exportar todas as notas
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// MAIN ADMIN COMPONENT
// ==========================================

export default function Admin() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [hasValidAdminSession, setHasValidAdminSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  // Check for valid admin session (step-up authentication)
  useEffect(() => {
    const checkAdminSession = () => {
      if (authLoading) return;
      
      // Not authenticated at all
      if (!isAuthenticated) {
        navigate('/admin/login', { replace: true });
        return;
      }
      
      // Authenticated but not admin
      if (!user?.isAdmin) {
        navigate('/admin/login', { replace: true });
        return;
      }
      
      // Admin user - check for valid admin session
      const adminSession = sessionStorage.getItem('adminAuthenticated');
      if (adminSession) {
        try {
          const session = JSON.parse(adminSession);
          const sessionAge = Date.now() - session.timestamp;
          const maxAge = 4 * 60 * 60 * 1000; // 4 hours
          
          if (session.authenticated && session.userId === user.id && sessionAge < maxAge) {
            setHasValidAdminSession(true);
            setCheckingSession(false);
            return;
          }
        } catch (e) {
          sessionStorage.removeItem('adminAuthenticated');
        }
      }
      
      // No valid admin session - redirect to admin login for re-authentication
      navigate('/admin/login', { replace: true });
    };
    
    checkAdminSession();
  }, [authLoading, isAuthenticated, user, navigate]);

  const { data: stats, isLoading: statsLoading, isFetching: statsFetching, refetch: refetchStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getStats,
    enabled: hasValidAdminSession && !!user?.isAdmin,
    staleTime: 0, // Always refetch on demand
  });

  const { data: activity, refetch: refetchActivity } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => adminService.getActivity({ limit: 10 }),
    enabled: hasValidAdminSession && !!user?.isAdmin,
    staleTime: 0, // Always refetch on demand
  });

  // Show loading state while checking session
  if (authLoading || checkingSession || !hasValidAdminSession) {
    return (
      <div className="min-h-screen bg-[#07070a] flex items-center justify-center">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="relative mb-6 inline-block">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full blur-xl opacity-50" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Shield className="w-10 h-10 text-white animate-pulse" />
          </div>
        </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 animate-spin text-violet-400" />
              <p className="text-gray-400">Verificando credenciais de administrador...</p>
            </div>
            <p className="text-gray-600 text-sm">Redirecionando para autenticação...</p>
          </motion.div>
        </div>
      </div>
    );
  }

  const overview = stats?.overview || {};
  const subscriptionBreakdown = stats?.subscriptionBreakdown || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-purple-500 rounded-2xl blur-xl opacity-50" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Painel Administrativo</h1>
            <p className="text-gray-400">Gerencie toda a plataforma em um só lugar</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">Sistema Online</span>
        </div>
          <motion.button
            onClick={async () => {
              setIsRefreshingAll(true);
              try {
                // Invalidate ALL admin-related queries to refresh everything
                await queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-activity'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-companies'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
                await queryClient.invalidateQueries({ queryKey: ['admin-health'] });
                toast.success('Todos os dados foram atualizados!');
              } catch (error) {
                toast.error('Erro ao atualizar dados');
              } finally {
                setIsRefreshingAll(false);
              }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isRefreshingAll || statsFetching}
            className="group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm
              bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm
              border border-white/10 text-gray-300
              hover:border-orange-500/60 hover:text-white
              hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-orange-600/10 hover:to-[#0f0f1a]/80
              hover:shadow-xl hover:shadow-orange-500/25
              disabled:opacity-70 disabled:cursor-not-allowed
              transition-all duration-500 ease-out"
          >
            {/* Animated gradient shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent opacity-0 group-hover:opacity-100"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            
            {/* Glow effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-orange-500/0 to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Pulsing border glow */}
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-orange-500/0 group-hover:border-orange-500/40"
              animate={{
                boxShadow: [
                  '0 0 0px rgba(249, 115, 22, 0)',
                  '0 0 20px rgba(249, 115, 22, 0.3)',
                  '0 0 0px rgba(249, 115, 22, 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            
            <div className="relative flex items-center gap-2 z-10">
              <RefreshCw className={`w-4 h-4 text-gray-400 group-hover:text-orange-400 transition-colors duration-500 ${isRefreshingAll || statsFetching ? 'animate-spin' : ''}`} />
              <span className="group-hover:text-orange-100 transition-colors duration-500">Atualizar</span>
            </div>
          </motion.button>
          <motion.button
            onClick={() => {
              // Clear admin session only (step-up authentication)
              sessionStorage.removeItem('adminAuthenticated');
              setHasValidAdminSession(false);
              toast.success('Logout do painel administrativo realizado com sucesso');
              // Redirect to admin login page (user remains logged in to main app)
              navigate('/admin/login', { replace: true });
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group relative overflow-hidden px-5 py-2.5 rounded-xl font-medium text-sm
              bg-gradient-to-br from-[#1a1a2e]/80 to-[#0f0f1a]/80 backdrop-blur-sm
              border border-white/10 text-gray-300
              hover:border-red-500/60 hover:text-white
              hover:bg-gradient-to-br hover:from-red-500/20 hover:via-red-600/10 hover:to-[#0f0f1a]/80
              hover:shadow-xl hover:shadow-red-500/25
              transition-all duration-500 ease-out"
          >
            {/* Animated gradient shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/30 to-transparent opacity-0 group-hover:opacity-100"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
            
            {/* Glow effect overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/0 via-red-500/0 to-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Pulsing border glow */}
            <motion.div
              className="absolute inset-0 rounded-xl border-2 border-red-500/0 group-hover:border-red-500/40"
              animate={{
                boxShadow: [
                  '0 0 0px rgba(239, 68, 68, 0)',
                  '0 0 20px rgba(239, 68, 68, 0.3)',
                  '0 0 0px rgba(239, 68, 68, 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            
            <div className="relative flex items-center gap-2 z-10">
              <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-400 transition-colors duration-500" />
              <span className="group-hover:text-red-100 transition-colors duration-500">Sair</span>
            </div>
          </motion.button>
      </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        <StatCard 
          title="Total de Usuários" 
          value={overview.totalUsers || 0} 
          change={overview.userGrowth} 
          icon={Users} 
          color="blue" 
          subtitle={`+${overview.newUsersThisMonth || 0} este mês`}
          loading={statsLoading}
        />
        <StatCard 
          title="Assinaturas Ativas" 
          value={overview.activeSubscriptions || 0} 
          icon={CreditCard} 
          color="green" 
          subtitle={`${overview.totalSubscriptions || 0} total`}
          loading={statsLoading}
        />
        <StatCard 
          title="Notas Emitidas" 
          value={overview.invoicesThisMonth || 0} 
          icon={FileText} 
          color="purple" 
          subtitle="Este mês"
          loading={statsLoading}
        />
        <StatCard 
          title="Receita do Mês" 
          value={`R$ ${parseFloat(overview.revenueThisMonth || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          icon={DollarSign} 
          color="orange" 
          subtitle={`R$ ${parseFloat(overview.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} total`}
          loading={statsLoading}
        />
      </div>

      {/* Quick Stats */}
      {stats?.recentUsers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> Usuários Recentes
            </h3>
            <div className="space-y-3">
              {stats.recentUsers.slice(0, 5).map((u) => (
                <div 
                  key={u.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {u.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{u.name || 'Sem nome'}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Subscription Breakdown */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-500" /> Assinaturas por Status
            </h3>
            <div className="space-y-3">
              {Object.entries(subscriptionBreakdown).map(([status, count]) => (
                <div 
                  key={status} 
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                >
                  <StatusBadge status={status} />
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
              {Object.keys(subscriptionBreakdown).length === 0 && (
                <p className="text-gray-500 text-center py-4">Nenhuma assinatura ainda</p>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#0f0f1a]/60 backdrop-blur-xl border border-white/10 p-1.5 rounded-xl flex-wrap h-auto">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4 py-2"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4 py-2"
          >
            <Users className="w-4 h-4 mr-2" /> Usuários
          </TabsTrigger>
          <TabsTrigger 
            value="subscriptions" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4 py-2"
          >
            <CreditCard className="w-4 h-4 mr-2" /> Assinaturas
          </TabsTrigger>
          <TabsTrigger 
            value="companies" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4 py-2"
          >
            <Building2 className="w-4 h-4 mr-2" /> Empresas
          </TabsTrigger>
          <TabsTrigger 
            value="clients" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4 py-2"
          >
            <UserCheck className="w-4 h-4 mr-2" /> Clientes
          </TabsTrigger>
          <TabsTrigger 
            value="invoices" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4 py-2"
          >
            <FileText className="w-4 h-4 mr-2" /> Notas Fiscais
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4 py-2"
          >
            <Settings className="w-4 h-4 mr-2" /> Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Activity Feed on Overview */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0f0f1a]/60 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" /> Atividade Recente
            </h3>
            <div className="space-y-3">
              {activity?.activities?.slice(0, 10).map((act, idx) => (
                <div 
                  key={`${act.entityId}-${idx}`}
                  className="flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    act.entity === 'user' ? 'bg-blue-500/20 text-blue-400' :
                    act.entity === 'subscription' ? 'bg-purple-500/20 text-purple-400' :
                    act.entity === 'invoice' ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {act.entity === 'user' && <UserPlus className="w-5 h-5" />}
                    {act.entity === 'subscription' && <CreditCard className="w-5 h-5" />}
                    {act.entity === 'invoice' && <FileText className="w-5 h-5" />}
                    {act.entity === 'company' && <Building2 className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm">{act.description}</p>
                    <p className="text-gray-500 text-xs">
                      {new Date(act.timestamp).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
              {(!activity?.activities || activity.activities.length === 0) && (
                <p className="text-gray-500 text-center py-8">Nenhuma atividade recente</p>
              )}
            </div>
          </motion.div>
        </TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="companies"><CompaniesTab /></TabsContent>
        <TabsContent value="clients"><ClientsTab /></TabsContent>
        <TabsContent value="invoices"><InvoicesTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
