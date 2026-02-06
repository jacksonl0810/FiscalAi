// @ts-nocheck
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { handleApiError } from "@/utils/errorHandler";
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
  X
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

const adminService = {
  getStats: () => apiClient.get('/admin/stats').then(r => r.data?.data || r.data),
  getChartData: () => apiClient.get('/admin/stats/chart').then(r => r.data?.data || r.data),
  getUsers: (params) => apiClient.get('/admin/users', { params }).then(r => r.data?.data || r.data),
  getUser: (id) => apiClient.get(`/admin/users/${id}`).then(r => r.data?.data || r.data),
  updateUser: (id, data) => apiClient.put(`/admin/users/${id}`, data).then(r => r.data),
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`).then(r => r.data),
  resetPassword: (id, newPassword) => apiClient.post(`/admin/users/${id}/reset-password`, { newPassword }).then(r => r.data),
  getSubscriptions: (params) => apiClient.get('/admin/subscriptions', { params }).then(r => r.data?.data || r.data),
  updateSubscription: (id, data) => apiClient.put(`/admin/subscriptions/${id}`, data).then(r => r.data),
  getCompanies: (params) => apiClient.get('/admin/companies', { params }).then(r => r.data?.data || r.data),
  getInvoices: (params) => apiClient.get('/admin/invoices', { params }).then(r => r.data?.data || r.data),
  getSettings: () => apiClient.get('/admin/settings').then(r => r.data?.data || r.data),
};

const StatCard = ({ title, value, change, icon: Icon, color = "orange", subtitle }) => {
  const colorMap = {
    orange: { bg: "from-orange-500 to-amber-600", glow: "shadow-orange-500/20" },
    green: { bg: "from-emerald-500 to-green-600", glow: "shadow-emerald-500/20" },
    blue: { bg: "from-blue-500 to-indigo-600", glow: "shadow-blue-500/20" },
    purple: { bg: "from-purple-500 to-violet-600", glow: "shadow-purple-500/20" },
    pink: { bg: "from-pink-500 to-rose-600", glow: "shadow-pink-500/20" },
    cyan: { bg: "from-cyan-500 to-teal-600", glow: "shadow-cyan-500/20" }
  };

  const colors = colorMap[color] || colorMap.orange;

  return (
    <div className="relative group">
      <div className={`absolute inset-0 bg-gradient-to-r ${colors.bg} rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity`} />
      <div className="relative glass-card rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
            {change !== undefined && (
              <div className="flex items-center gap-1">
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
            )}
            {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
          </div>
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${colors.bg} flex items-center justify-center shadow-lg ${colors.glow}`}>
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    ativo: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle, label: 'Ativo' },
    inadimplente: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: AlertCircle, label: 'Inadimplente' },
    cancelado: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: XCircle, label: 'Cancelado' },
    pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock, label: 'Pendente' },
    autorizada: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle, label: 'Autorizada' },
    rejeitada: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle, label: 'Rejeitada' },
    processando: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', icon: RefreshCw, label: 'Processando' },
    no_subscription: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', icon: Clock, label: 'Sem Assinatura' },
  };

  const config = statusConfig[status] || statusConfig.no_subscription;
  const IconComponent = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bg} ${config.text} ${config.border}`}>
      <IconComponent className="w-3 h-3" />
      {config.label}
    </span>
  );
};

const UserDetailModal = ({ user, open, onClose, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: user?.name || '', email: user?.email || '', isAdmin: user?.isAdmin || false });
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => adminService.updateUser(user.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Usuário atualizado com sucesso');
      setIsEditing(false);
      onUpdate?.();
    },
    onError: async (error) => await handleApiError(error, { operation: 'update_user', userId: user.id })
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => adminService.resetPassword(user.id, newPassword),
    onSuccess: () => {
      toast.success('Senha redefinida com sucesso');
      setNewPassword('');
      setShowResetPassword(false);
    },
    onError: async (error) => await handleApiError(error, { operation: 'reset_password', userId: user.id })
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
            <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="space-y-2">
                <Label className="text-gray-400">Nome</Label>
                <Input value={editData.name} onChange={(e) => setEditData(p => ({ ...p, name: e.target.value }))} className="bg-white/5 border-white/10" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400">Email</Label>
                <Input value={editData.email} onChange={(e) => setEditData(p => ({ ...p, email: e.target.value }))} className="bg-white/5 border-white/10" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isAdmin" checked={editData.isAdmin} onChange={(e) => setEditData(p => ({ ...p, isAdmin: e.target.checked }))} className="rounded" />
                <Label htmlFor="isAdmin" className="text-gray-400 cursor-pointer">Administrador</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => updateMutation.mutate(editData)} disabled={updateMutation.isPending} className="bg-gradient-to-r from-orange-500 to-orange-600">
                  {updateMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="border-white/10">Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <InfoCard icon={Mail} label="Email" value={user.email} />
              <InfoCard icon={Calendar} label="Cadastrado em" value={new Date(user.createdAt).toLocaleDateString('pt-BR')} />
              <InfoCard icon={Building2} label="Empresas" value={user._count?.companies || user.companies?.length || 0} />
              <InfoCard icon={CreditCard} label="Plano" value={user.subscription?.planId || 'Pay per Use'} />
              <InfoCard icon={Activity} label="Status" value={<StatusBadge status={user.subscription?.status || 'no_subscription'} />} />
              <InfoCard icon={Crown} label="Tipo" value={user.isAdmin ? 'Administrador' : 'Usuário'} />
            </div>
          )}

          {user.companies && user.companies.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2"><Building2 className="w-4 h-4" /> Empresas</h4>
              <div className="space-y-2">
                {user.companies.map((company) => (
                  <div key={company.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-white font-medium">{company.razaoSocial || company.nomeFantasia}</p>
                    <p className="text-gray-500 text-sm">CNPJ: {company.cnpj || 'Não informado'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showResetPassword && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3">
              <h4 className="text-sm font-medium text-red-400 flex items-center gap-2"><Key className="w-4 h-4" /> Redefinir Senha</h4>
              <Input type="password" placeholder="Nova senha (mín. 6 caracteres)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-white/5 border-white/10" />
              <div className="flex gap-2">
                <Button onClick={() => resetPasswordMutation.mutate()} disabled={newPassword.length < 6 || resetPasswordMutation.isPending} size="sm" className="bg-red-500 hover:bg-red-600">
                  Confirmar
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setShowResetPassword(false); setNewPassword(''); }} className="border-white/10">Cancelar</Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex gap-2">
          {!isEditing && (
            <>
              <Button variant="outline" onClick={() => { setIsEditing(true); setEditData({ name: user.name, email: user.email, isAdmin: user.isAdmin }); }} className="border-white/10">
                <Edit className="w-4 h-4 mr-2" /> Editar
              </Button>
              <Button variant="outline" onClick={() => setShowResetPassword(!showResetPassword)} className="border-white/10">
                <Key className="w-4 h-4 mr-2" /> Redefinir Senha
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
    <div className="text-white font-medium">{value}</div>
  </div>
);

const UsersTab = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminService.getUsers({ page, limit: 10, search }),
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
    onError: async (error) => await handleApiError(error, { operation: 'delete_user', userId: user.id })
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nome ou email..." className="pl-10 bg-white/5 border-white/10 h-11" />
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-white/10 h-11">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-white/5 to-white/[0.02]">
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
                <tr><td colSpan={6} className="p-12 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-orange-500" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-gray-500">Nenhum usuário encontrado</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium">{user.name}</p>
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
                  <td className="p-4 text-gray-300">{user.subscription?.planId || 'Pay per Use'}</td>
                  <td className="p-4"><StatusBadge status={user.subscription?.status || 'no_subscription'} /></td>
                  <td className="p-4 text-gray-400 text-sm">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-white/10"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-white/10 min-w-[180px]">
                        <DropdownMenuItem onClick={() => { setSelectedUser(user); setUserDetailOpen(true); }} className="text-white hover:bg-white/10">
                          <Eye className="w-4 h-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleAdminMutation.mutate({ id: user.id, isAdmin: !user.isAdmin })} className="text-white hover:bg-white/10">
                          {user.isAdmin ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                          {user.isAdmin ? 'Remover Admin' : 'Tornar Admin'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={() => { if (confirm('Excluir este usuário?')) deleteMutation.mutate(user.id); }} className="text-red-400 hover:bg-red-500/10">
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

        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
          <p className="text-gray-500 text-sm">{pagination.total} usuários • Página {pagination.page} de {pagination.totalPages}</p>
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

      <UserDetailModal user={userData?.user || selectedUser} open={userDetailOpen} onClose={() => setUserDetailOpen(false)} onUpdate={refetch} />
    </div>
  );
};

const SubscriptionsTab = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-subscriptions', page, statusFilter],
    queryFn: () => adminService.getSubscriptions({ page, limit: 10, status: statusFilter }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => adminService.updateSubscription(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      toast.success('Status atualizado com sucesso');
    }
  });

  const subscriptions = data?.subscriptions || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  const statusOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'ativo', label: 'Ativos' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'inadimplente', label: 'Inadimplentes' },
    { value: 'cancelado', label: 'Cancelados' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {statusOptions.map(opt => (
            <Button key={opt.value} variant={statusFilter === opt.value ? "default" : "outline"} size="sm" onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={statusFilter === opt.value ? "bg-gradient-to-r from-orange-500 to-orange-600" : "border-white/10"}>
              {opt.label}
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-white/10">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-white/5 to-white/[0.02]">
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
                <tr><td colSpan={6} className="p-12 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-orange-500" /></td></tr>
              ) : subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div>
                      <p className="text-white font-medium">{sub.user?.name}</p>
                      <p className="text-gray-500 text-sm">{sub.user?.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 rounded-lg bg-gradient-to-r from-orange-500/20 to-purple-500/20 text-orange-300 text-sm font-medium border border-orange-500/20">
                      {sub.pagarMePlanId || sub.planId || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4"><StatusBadge status={sub.status} /></td>
                  <td className="p-4 text-gray-300">
                    {sub.payments?.[0] ? `R$ ${parseFloat(sub.payments[0].amount || 0).toFixed(2)}` : '---'}
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR') : '---'}
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-white/10"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-white/10 min-w-[200px]">
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: sub.id, status: 'ativo' })} className="text-emerald-400 hover:bg-emerald-500/10">
                          <CheckCircle className="w-4 h-4 mr-2" /> Ativar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: sub.id, status: 'pending' })} className="text-blue-400 hover:bg-blue-500/10">
                          <Clock className="w-4 h-4 mr-2" /> Pendente
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: sub.id, status: 'inadimplente' })} className="text-amber-400 hover:bg-amber-500/10">
                          <AlertCircle className="w-4 h-4 mr-2" /> Inadimplente
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: sub.id, status: 'cancelado' })} className="text-red-400 hover:bg-red-500/10">
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-white/10"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="border-white/10"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CompaniesTab = () => {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-companies', page, search],
    queryFn: () => adminService.getCompanies({ page, limit: 10, search }),
  });

  const companies = data?.companies || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por razão social, nome fantasia ou CNPJ..." className="pl-10 bg-white/5 border-white/10 h-11" />
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-white/10 h-11">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
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
                <tr><td colSpan={6} className="p-12 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-orange-500" /></td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-gray-500">Nenhuma empresa encontrada</td></tr>
              ) : companies.map((company) => (
                <tr key={company.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{company.razaoSocial || company.nomeFantasia || 'Sem nome'}</p>
                        {company.nomeFantasia && company.razaoSocial && <p className="text-gray-500 text-sm">{company.nomeFantasia}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 font-mono text-sm">{company.cnpj || '---'}</td>
                  <td className="p-4">
                    <div>
                      <p className="text-white text-sm">{company.user?.name}</p>
                      <p className="text-gray-500 text-xs">{company.user?.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 text-gray-300 text-sm">
                      <FileText className="w-3.5 h-3.5" /> {company._count?.invoices || 0}
                    </span>
                  </td>
                  <td className="p-4">
                    {company.fiscalIntegrationStatus?.status === 'ativo' ? (
                      <StatusBadge status="ativo" />
                    ) : (
                      <StatusBadge status="pending" />
                    )}
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{new Date(company.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
          <p className="text-gray-500 text-sm">{pagination.total} empresas</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-white/10"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="border-white/10"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const InvoicesTab = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-invoices', page, statusFilter],
    queryFn: () => adminService.getInvoices({ page, limit: 10, status: statusFilter }),
  });

  const invoices = data?.invoices || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {['all', 'autorizada', 'processando', 'rejeitada'].map(status => (
            <Button key={status} variant={statusFilter === status ? "default" : "outline"} size="sm" onClick={() => { setStatusFilter(status); setPage(1); }}
              className={statusFilter === status ? "bg-gradient-to-r from-orange-500 to-orange-600" : "border-white/10"}>
              {status === 'all' ? 'Todas' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
        <Button variant="outline" onClick={() => refetch()} className="border-white/10">
          <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
        </Button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
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
                <tr><td colSpan={6} className="p-12 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-orange-500" /></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-gray-500">Nenhuma nota encontrada</td></tr>
              ) : invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <span className="font-mono text-orange-400">#{invoice.numero || '---'}</span>
                  </td>
                  <td className="p-4 text-white">{invoice.clienteNome || '---'}</td>
                  <td className="p-4">
                    <div>
                      <p className="text-white text-sm">{invoice.company?.razaoSocial || invoice.company?.nomeFantasia}</p>
                      <p className="text-gray-500 text-xs">{invoice.company?.user?.email}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-emerald-400 font-semibold">R$ {parseFloat(invoice.valor || 0).toFixed(2)}</span>
                  </td>
                  <td className="p-4"><StatusBadge status={invoice.status} /></td>
                  <td className="p-4 text-gray-400 text-sm">
                    {invoice.dataEmissao ? new Date(invoice.dataEmissao).toLocaleDateString('pt-BR') : '---'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-white/5 bg-white/[0.02]">
          <p className="text-gray-500 text-sm">{pagination.total} notas fiscais</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="border-white/10"><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="border-white/10"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsTab = () => {
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminService.getSettings,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-orange-500" /></div>;
  }

  const integrations = [
    { name: 'Nuvem Fiscal', icon: Globe, configured: settings?.settings?.nuvemFiscalConfigured, env: settings?.settings?.nuvemFiscalEnvironment, desc: 'Integração para emissão de NFS-e' },
    { name: 'Pagar.me', icon: CreditCard, configured: settings?.settings?.pagarMeConfigured, desc: 'Gateway de pagamentos' },
    { name: 'Email', icon: Mail, configured: settings?.settings?.emailConfigured, desc: 'Envio de emails transacionais' },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 border border-white/10">
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
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-white/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2"><Zap className="w-4 h-4" /> Ambiente</div>
            <p className="text-white font-semibold capitalize">{settings?.settings?.environment || 'development'}</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2"><Database className="w-4 h-4" /> Versão</div>
            <p className="text-white font-semibold">{settings?.settings?.version || '1.0.0'}</p>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2"><Activity className="w-4 h-4" /> Status</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-emerald-400 font-semibold">Online</p>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-orange-500" /> Integrações
        </h3>
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div key={integration.name} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-white/5 to-transparent border border-white/10 hover:border-white/20 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${integration.configured ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-gray-500 to-gray-600'}`}>
                  <integration.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium">{integration.name}</p>
                    {integration.env && <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">{integration.env}</span>}
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
      </div>
    </div>
  );
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getStats,
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-3xl opacity-20" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center mb-6">
            <Shield className="w-12 h-12 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-gray-400 mb-6 text-center max-w-md">Esta área é exclusiva para administradores do sistema.</p>
        <Button onClick={() => navigate('/')} className="bg-gradient-to-r from-orange-500 to-orange-600">
          Voltar ao Dashboard
        </Button>
      </div>
    );
  }

  const overview = stats?.overview || {};
  const subscriptionBreakdown = stats?.subscriptionBreakdown || {};

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">Sistema Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Usuários" value={statsLoading ? '...' : overview.totalUsers || 0} change={overview.userGrowth} icon={Users} color="blue" subtitle={`+${overview.newUsersThisMonth || 0} este mês`} />
        <StatCard title="Assinaturas Ativas" value={statsLoading ? '...' : overview.activeSubscriptions || 0} icon={CreditCard} color="green" subtitle={`${overview.totalSubscriptions || 0} total`} />
        <StatCard title="Notas Emitidas" value={statsLoading ? '...' : overview.invoicesThisMonth || 0} icon={FileText} color="purple" subtitle="Este mês" />
        <StatCard title="Receita do Mês" value={statsLoading ? '...' : `R$ ${parseFloat(overview.revenueThisMonth || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="orange" subtitle={`R$ ${parseFloat(overview.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} total`} />
      </div>

      {stats?.recentUsers && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> Usuários Recentes
            </h3>
            <div className="space-y-3">
              {stats.recentUsers.slice(0, 5).map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {u.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{u.name}</p>
                      <p className="text-gray-500 text-xs">{u.email}</p>
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-500" /> Assinaturas por Status
            </h3>
            <div className="space-y-3">
              {Object.entries(subscriptionBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <StatusBadge status={status} />
                  <span className="text-white font-semibold">{count}</span>
                </div>
              ))}
              {Object.keys(subscriptionBreakdown).length === 0 && (
                <p className="text-gray-500 text-center py-4">Nenhuma assinatura ainda</p>
              )}
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
          <TabsTrigger value="users" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4">
            <Users className="w-4 h-4 mr-2" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4">
            <CreditCard className="w-4 h-4 mr-2" /> Assinaturas
          </TabsTrigger>
          <TabsTrigger value="companies" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4">
            <Building2 className="w-4 h-4 mr-2" /> Empresas
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4">
            <FileText className="w-4 h-4 mr-2" /> Notas Fiscais
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 rounded-lg px-4">
            <Settings className="w-4 h-4 mr-2" /> Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="companies"><CompaniesTab /></TabsContent>
        <TabsContent value="invoices"><InvoicesTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
