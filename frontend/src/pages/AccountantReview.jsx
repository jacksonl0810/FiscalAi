import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Building2,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  Send,
  Calendar,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/api/client";
import { companiesService } from "@/api/services/companies";

// API service
const reviewService = {
  list: () => apiClient.get('/accountant-review').then(r => r.data?.reviews || []),
  get: (id) => apiClient.get(`/accountant-review/${id}`).then(r => r.data?.review),
  create: (data) => apiClient.post('/accountant-review/request', data).then(r => r.data),
  cancel: (id) => apiClient.put(`/accountant-review/${id}/cancel`).then(r => r.data),
};

// Status configuration
const statusConfig = {
  pending: { 
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: Clock,
    label: 'Pendente'
  },
  in_review: {
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: ClipboardCheck,
    label: 'Em Análise'
  },
  approved: {
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: CheckCircle,
    label: 'Aprovado'
  },
  rejected: {
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: XCircle,
    label: 'Rejeitado'
  },
};

const reviewTypeLabels = {
  pre_issuance: 'Pré-Emissão',
  post_issuance: 'Pós-Emissão',
  correction: 'Correção',
};

// Review Card Component
const ReviewCard = ({ review, onClick }) => {
  const config = statusConfig[review.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div 
      className="glass-card rounded-xl p-5 hover:bg-white/5 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.color.split(' ')[0]} flex items-center justify-center`}>
            <StatusIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-medium">
              {reviewTypeLabels[review.review_type] || 'Revisão'}
            </h3>
            <p className="text-gray-500 text-sm">
              {new Date(review.requested_at || review.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <span className={`px-2 py-1 text-xs rounded-full border ${config.color}`}>
          {config.label}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Building2 className="w-4 h-4" />
          <span>{review.company?.nomeFantasia || review.company?.razaoSocial || 'Empresa'}</span>
        </div>
        {review.invoice && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <FileText className="w-4 h-4" />
            <span>NFS-e #{review.invoice.numero} - R$ {review.invoice.valor?.toFixed(2)}</span>
          </div>
        )}
        {review.notes && (
          <div className="flex items-start gap-2 text-gray-400 text-sm mt-2">
            <MessageSquare className="w-4 h-4 mt-0.5" />
            <span className="line-clamp-2">{review.notes}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end mt-4 text-orange-400 text-sm group-hover:translate-x-1 transition-transform">
        Ver detalhes <ChevronRight className="w-4 h-4 ml-1" />
      </div>
    </div>
  );
};

// New Request Dialog
const NewRequestDialog = ({ open, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    company_id: '',
    review_type: 'pre_issuance',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: companiesService.getAll,
  });

  const companies = companiesData || [];

  const handleSubmit = async () => {
    if (!formData.company_id) {
      toast.error('Selecione uma empresa');
      return;
    }

    setIsSubmitting(true);
    try {
      await reviewService.create(formData);
      toast.success('Solicitação enviada com sucesso!');
      onSuccess();
      onClose();
      setFormData({ company_id: '', review_type: 'pre_issuance', notes: '' });
    } catch (error) {
      const { handleApiError } = await import('@/utils/errorHandler');
      await handleApiError(error, { operation: 'submit_review' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-orange-500" />
            Nova Revisão Contábil
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Solicite uma revisão de um contador especializado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Empresa</label>
            <Select
              value={formData.company_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, company_id: value }))}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Selecione uma empresa" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id} className="text-white">
                    {company.nome_fantasia || company.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Tipo de Revisão</label>
            <Select
              value={formData.review_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, review_type: value }))}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                <SelectItem value="pre_issuance" className="text-white">
                  Pré-Emissão - Verificar dados antes de emitir
                </SelectItem>
                <SelectItem value="post_issuance" className="text-white">
                  Pós-Emissão - Revisar nota já emitida
                </SelectItem>
                <SelectItem value="correction" className="text-white">
                  Correção - Corrigir erro em nota fiscal
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Observações (opcional)</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Descreva o que você precisa revisar..."
              className="bg-white/5 border-white/10 text-white min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isSubmitting ? (
              'Enviando...'
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Solicitar Revisão
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Review Detail Dialog
const ReviewDetailDialog = ({ review, open, onClose, onCancel }) => {
  if (!review) return null;

  const config = statusConfig[review.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a2e] border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <StatusIcon className={`w-5 h-5 ${config.color.split(' ')[1]}`} />
            {reviewTypeLabels[review.review_type] || 'Revisão Contábil'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
            <span className="text-gray-400">Status</span>
            <span className={`px-3 py-1 text-sm rounded-full border ${config.color}`}>
              {config.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <Calendar className="w-4 h-4" />
                Solicitado em
              </div>
              <p className="text-white">
                {new Date(review.requested_at || review.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
            {review.reviewed_at && (
              <div className="p-4 bg-white/5 rounded-xl">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <CheckCircle className="w-4 h-4" />
                  Revisado em
                </div>
                <p className="text-white">
                  {new Date(review.reviewed_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          <div className="p-4 bg-white/5 rounded-xl">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Building2 className="w-4 h-4" />
              Empresa
            </div>
            <p className="text-white font-medium">
              {review.company?.nomeFantasia || review.company?.razaoSocial}
            </p>
            {review.company?.cnpj && (
              <p className="text-gray-500 text-sm">{review.company.cnpj}</p>
            )}
          </div>

          {review.invoice && (
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <FileText className="w-4 h-4" />
                Nota Fiscal
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">NFS-e #{review.invoice.numero}</p>
                  <p className="text-gray-500 text-sm">{review.invoice.clienteNome}</p>
                </div>
                <span className="text-orange-400 font-bold">
                  R$ {review.invoice.valor?.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {review.notes && (
            <div className="p-4 bg-white/5 rounded-xl">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <MessageSquare className="w-4 h-4" />
                Suas observações
              </div>
              <p className="text-white">{review.notes}</p>
            </div>
          )}

          {review.accountant_notes && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
                <User className="w-4 h-4" />
                Resposta do Contador
              </div>
              <p className="text-white">{review.accountant_notes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {review.status === 'pending' && (
            <Button 
              variant="outline" 
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={() => onCancel(review.id)}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar Solicitação
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main Component
export default function AccountantReview() {
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading, error } = useQuery({
    queryKey: ['accountant-reviews'],
    queryFn: reviewService.list,
  });

  const cancelMutation = useMutation({
    mutationFn: reviewService.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountant-reviews'] });
      toast.success('Solicitação cancelada');
      setSelectedReview(null);
    },
    onError: async (error) => {
      const { handleApiError } = await import('@/utils/errorHandler');
      await handleApiError(error, { operation: 'cancel_review' });
    }
  });

  const pendingReviews = reviews.filter(r => r.status === 'pending');
  const inProgressReviews = reviews.filter(r => r.status === 'in_review');
  const completedReviews = reviews.filter(r => ['approved', 'rejected'].includes(r.status));

  if (error?.response?.status === 403) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="w-16 h-16 text-orange-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Recurso Premium</h2>
        <p className="text-gray-400 text-center max-w-md mb-4">
          A revisão contábil está disponível apenas para o plano Professional.
          Faça upgrade para ter acesso a um contador especializado.
        </p>
        <Button className="bg-orange-500 hover:bg-orange-600">
          Fazer Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-orange-500" />
            Revisão Contábil
          </h1>
          <p className="text-gray-400 mt-1">
            Solicite revisão de um contador especializado para suas notas fiscais
          </p>
        </div>
        <Button 
          onClick={() => setShowNewRequest(true)}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Clock className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Pendentes</p>
            <p className="text-2xl font-bold text-white">{pendingReviews.length}</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <ClipboardCheck className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Em Análise</p>
            <p className="text-2xl font-bold text-white">{inProgressReviews.length}</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Concluídas</p>
            <p className="text-2xl font-bold text-white">{completedReviews.length}</p>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Nenhuma solicitação</h3>
          <p className="text-gray-400 mb-6">
            Você ainda não solicitou nenhuma revisão contábil.
          </p>
          <Button 
            onClick={() => setShowNewRequest(true)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Fazer Primeira Solicitação
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onClick={() => setSelectedReview(review)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <NewRequestDialog
        open={showNewRequest}
        onClose={() => setShowNewRequest(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['accountant-reviews'] })}
      />

      <ReviewDetailDialog
        review={selectedReview}
        open={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        onCancel={(id) => cancelMutation.mutate(id)}
      />
    </div>
  );
}
