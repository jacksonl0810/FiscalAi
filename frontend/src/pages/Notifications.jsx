import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/api/services";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  CheckCheck,
  Trash2,
  FileText,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";

const typeConfig = {
  sucesso: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/20", borderColor: "border-green-500/30" },
  erro: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/20", borderColor: "border-red-500/30" },
  alerta: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/20", borderColor: "border-yellow-500/30" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/20", borderColor: "border-blue-500/30" },
};

export default function Notifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['allNotifications'],
    queryFn: () => notificationsService.list({ sort: '-created_at' }),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => notificationsService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => notificationsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllAsRead = async () => {
    try {
      await notificationsService.markAllAsRead();
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.lida).length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-white">Notificações</h1>
          <p className="text-gray-400 mt-1">
            {unreadCount > 0 
              ? `Você tem ${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}`
              : 'Todas as notificações foram lidas'}
          </p>
        </motion.div>
        {unreadCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Button
              onClick={markAllAsRead}
              variant="outline"
              className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Marcar todas como lidas
            </Button>
          </motion.div>
        )}
      </div>

      {/* Notifications List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {isLoading ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Carregando notificações...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma notificação</h3>
            <p className="text-gray-500">
              Você será notificado quando houver atualizações importantes
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {notifications.map((notification, index) => {
              const config = typeConfig[notification.tipo] || typeConfig.info;
              const Icon = config.icon;

              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={`glass-card rounded-2xl p-6 border ${
                    notification.lida ? 'border-white/5 opacity-60' : config.borderColor
                  } hover:opacity-100 transition-opacity`}
                >
                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className={`font-semibold ${notification.lida ? 'text-gray-400' : 'text-white'}`}>
                            {notification.titulo}
                          </h3>
                          <p className="text-gray-500 mt-1">
                            {notification.mensagem}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600 flex-shrink-0">
                          {notification.created_at && format(
                            new Date(notification.created_at), 
                            "dd MMM, HH:mm", 
                            { locale: ptBR }
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-4">
                        {notification.invoice_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Ver nota fiscal
                          </Button>
                        )}
                        {notification.tipo === 'sucesso' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Baixar PDF
                          </Button>
                        )}
                        {!notification.lida && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                          >
                            <CheckCheck className="w-4 h-4 mr-2" />
                            Marcar como lida
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(notification.id)}
                          className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 ml-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </motion.div>

      {/* Timeline Events Info */}
      {notifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-orange-500/5 to-purple-500/5 border border-white/5"
        >
          <h3 className="text-sm font-medium text-gray-400 mb-4">Tipos de Eventos</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(typeConfig).map(([type, config]) => {
              const Icon = config.icon;
              const labels = {
                sucesso: "Sucesso",
                erro: "Erro",
                alerta: "Alerta",
                info: "Informação"
              };
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <span className="text-sm text-gray-400">{labels[type]}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
