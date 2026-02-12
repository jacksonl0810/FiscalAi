import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/api/services";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { handleError } from "@/services/errorTranslationService";
import { cn } from "@/lib/utils";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  CheckCheck,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";

const typeConfig = {
  sucesso: { 
    icon: CheckCircle, 
    color: "text-green-300", 
    bg: "bg-gradient-to-br from-green-500/30 via-emerald-600/20 to-green-500/30", 
    borderColor: "border-green-500/40",
    shadow: "shadow-green-500/20"
  },
  erro: { 
    icon: XCircle, 
    color: "text-red-300", 
    bg: "bg-gradient-to-br from-red-500/30 via-red-600/20 to-red-500/30", 
    borderColor: "border-red-500/40",
    shadow: "shadow-red-500/20"
  },
  alerta: { 
    icon: AlertTriangle, 
    color: "text-yellow-300", 
    bg: "bg-gradient-to-br from-yellow-500/30 via-yellow-600/20 to-yellow-500/30", 
    borderColor: "border-yellow-500/40",
    shadow: "shadow-yellow-500/20"
  },
  info: { 
    icon: Info, 
    color: "text-blue-300", 
    bg: "bg-gradient-to-br from-blue-500/30 via-blue-600/20 to-blue-500/30", 
    borderColor: "border-blue-500/40",
    shadow: "shadow-blue-500/20"
  },
};

export default function Notifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['allNotifications'],
    queryFn: () => notificationsService.list({ sort: '-created_at' }),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    staleTime: 0, // Always consider data stale to ensure fresh notifications
    refetchOnMount: 'always', // Always refetch when page loads
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  /** @type {import('@tanstack/react-query').UseMutationResult<any, Error, string>} */
  const markAsReadMutation = useMutation({
    mutationFn: async (id) => {
      return await notificationsService.markAsRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  /** @type {import('@tanstack/react-query').UseMutationResult<any, Error, string>} */
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await notificationsService.delete(id);
    },
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
      await handleError(error, { operation: 'mark_all_as_read' }, (message) => {
        toast.error(message, {
          duration: 6000,
          style: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            color: '#fff',
            whiteSpace: 'pre-line',
          },
        });
      });
    }
  };

  const deleteAllNotifications = async () => {
    // Collect all notifications count
    const totalNotifications = notifications.length;
    
    if (totalNotifications === 0) {
      toast.info('Não há notificações para excluir');
      return;
    }

    // Show confirmation with count
    const confirmed = confirm(
      `Tem certeza que deseja excluir todas as ${totalNotifications} notificação${totalNotifications > 1 ? 'ões' : ''}?\n\nEsta ação não pode ser desfeita.`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      console.log('[Notifications] Preparing to delete all notifications...');
      console.log('[Notifications] Total notifications:', totalNotifications);
      console.log('[Notifications] Notification IDs:', notifications.map(n => n.id));
      
      // Send delete request to backend
      console.log('[Notifications] Calling deleteAll API...');
      await notificationsService.deleteAll();
      console.log('[Notifications] Delete all request completed');
      
      // Force refresh the queries immediately
      await queryClient.invalidateQueries({ queryKey: ['allNotifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      // Refetch to ensure UI is updated with empty list
      await queryClient.refetchQueries({ queryKey: ['allNotifications'] });
      await queryClient.refetchQueries({ queryKey: ['notifications'] });
      
      toast.success(`${totalNotifications} notificação${totalNotifications > 1 ? 'ões foram' : ' foi'} excluída${totalNotifications > 1 ? 's' : ''} com sucesso`);
    } catch (error) {
      await handleError(error, { operation: 'delete_all_notifications' }, (message) => {
        toast.error(message, {
          duration: 8000,
          style: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            color: '#fff',
            whiteSpace: 'pre-line',
          },
        });
      });
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
          <h1 className={cn(
            "text-4xl font-bold mb-2",
            "bg-gradient-to-r from-white via-white to-gray-300 bg-clip-text text-transparent",
            "drop-shadow-lg"
          )}>
            Notificações
          </h1>
          <p className="text-gray-400 mt-1 font-medium">
            {unreadCount > 0 
              ? `Você tem ${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}`
              : 'Todas as notificações foram lidas'}
          </p>
        </motion.div>
        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-3"
          >
            {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              variant="outline"
              className={cn(
                "relative overflow-hidden group",
                "bg-gradient-to-r from-emerald-500/10 via-green-500/5 to-emerald-500/10",
                "border border-emerald-500/30",
                "text-emerald-100 font-semibold",
                "hover:bg-gradient-to-r hover:from-emerald-500/20 hover:via-green-500/15 hover:to-emerald-500/20",
                "hover:border-emerald-400/50 hover:text-white",
                "hover:shadow-xl hover:shadow-emerald-500/25",
                "transition-all duration-300 ease-out",
                "backdrop-blur-sm",
                // Shine effect on hover
                "before:absolute before:inset-0 before:-translate-x-full",
                "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
                "hover:before:translate-x-full before:transition-transform before:duration-700"
              )}
            >
              <CheckCheck className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
              Marcar todas como lidas
              </Button>
            )}
            <Button
              onClick={deleteAllNotifications}
              variant="outline"
              className={cn(
                "relative overflow-hidden group",
                "bg-gradient-to-r from-red-500/10 via-rose-500/5 to-red-500/10",
                "border border-red-500/30",
                "text-red-200 font-semibold",
                "hover:bg-gradient-to-r hover:from-red-500/20 hover:via-rose-500/15 hover:to-red-500/20",
                "hover:border-red-400/50 hover:text-white",
                "hover:shadow-xl hover:shadow-red-500/25",
                "transition-all duration-300 ease-out",
                "backdrop-blur-sm",
                // Shine effect on hover
                "before:absolute before:inset-0 before:-translate-x-full",
                "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
                "hover:before:translate-x-full before:transition-transform before:duration-700"
              )}
            >
              <Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300" />
              Excluir todas
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
          <div className={cn(
            "relative rounded-2xl p-12 text-center overflow-hidden",
            "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
            "backdrop-blur-xl border border-white/10",
            "shadow-2xl shadow-black/50"
          )}>
            <div className={cn(
              "w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4",
              "shadow-lg shadow-orange-500/20"
            )} />
            <p className="text-gray-400 font-medium">Carregando notificações...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className={cn(
            "relative rounded-2xl p-16 text-center overflow-hidden",
            "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
            "backdrop-blur-xl border border-white/10",
            "shadow-2xl shadow-black/50"
          )}>
            <div className={cn(
              "w-20 h-20 rounded-2xl mx-auto mb-6",
              "bg-gradient-to-br from-white/10 via-white/5 to-white/10",
              "border border-white/10",
              "flex items-center justify-center",
              "shadow-xl shadow-black/30"
            )}>
              <Bell className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhuma notificação</h3>
            <p className="text-gray-400 font-medium">
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
                  className={cn(
                    "relative rounded-2xl p-6 overflow-hidden",
                    "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
                    "backdrop-blur-xl border",
                    "shadow-2xl shadow-black/50",
                    "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none",
                    notification.lida 
                      ? "border-white/10 opacity-60" 
                      : cn(config.borderColor, "shadow-lg", config.shadow),
                    "hover:opacity-100 hover:scale-[1.01] transition-all duration-200"
                  )}
                >
                  <div className="flex gap-4 relative z-10">
                    {/* Icon */}
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0",
                      config.bg,
                      "border border-white/10",
                      "shadow-lg",
                      config.shadow
                    )}>
                      <Icon className={cn("w-7 h-7", config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className={cn(
                            "font-bold text-lg mb-2",
                            notification.lida 
                              ? "text-gray-400" 
                              : "text-white"
                          )}>
                            {notification.titulo}
                          </h3>
                          <p className={cn(
                            "text-gray-300 mt-1 leading-relaxed",
                            notification.lida && "text-gray-500"
                          )}>
                            {notification.mensagem}
                          </p>
                        </div>
                        <p className={cn(
                          "text-xs flex-shrink-0 font-medium",
                          notification.lida ? "text-gray-600" : "text-gray-400"
                        )}>
                          {notification.created_at && format(
                            new Date(notification.created_at), 
                            "dd MMM, HH:mm", 
                            { locale: ptBR }
                          )}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-4">
                        {!notification.lida && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                            className={cn(
                              "group relative overflow-hidden",
                              "text-emerald-200 hover:text-white",
                              "bg-emerald-500/5 hover:bg-emerald-500/15",
                              "border border-emerald-500/20 hover:border-emerald-400/40",
                              "transition-all duration-300",
                              "shadow-sm hover:shadow-md hover:shadow-emerald-500/20",
                              "font-semibold",
                              // Subtle shine effect
                              "before:absolute before:inset-0 before:-translate-x-full",
                              "before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent",
                              "hover:before:translate-x-full before:transition-transform before:duration-500"
                            )}
                          >
                            <CheckCheck className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-300" />
                            Marcar como lida
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(notification.id)}
                          className={cn(
                            "group relative overflow-hidden ml-auto",
                            "text-red-300/80 hover:text-red-200",
                            "bg-red-500/5 hover:bg-red-500/15",
                            "border border-red-500/20 hover:border-red-400/40",
                            "transition-all duration-300",
                            "shadow-sm hover:shadow-md hover:shadow-red-500/20",
                            // Subtle shine effect
                            "before:absolute before:inset-0 before:-translate-x-full",
                            "before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent",
                            "hover:before:translate-x-full before:transition-transform before:duration-500"
                          )}
                        >
                          <Trash2 className="w-4 h-4 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300" />
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
          className={cn(
            "mt-8 p-6 rounded-2xl",
            "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
            "backdrop-blur-xl border border-white/10",
            "shadow-2xl shadow-black/50",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-purple-500/5 before:to-transparent before:pointer-events-none relative"
          )}
        >
          <h3 className="text-sm font-semibold text-gray-300 mb-5 uppercase tracking-wider relative z-10">Tipos de Eventos</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
            {Object.entries(typeConfig).map(([type, config]) => {
              const Icon = config.icon;
              const labels = {
                sucesso: "Sucesso",
                erro: "Erro",
                alerta: "Alerta",
                info: "Informação"
              };
              return (
                <div key={type} className={cn(
                  "flex items-center gap-3 p-3 rounded-xl",
                  "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                  "border border-white/10",
                  "backdrop-blur-sm",
                  "hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10",
                  "hover:border-white/20",
                  "transition-all duration-200",
                  "shadow-md hover:shadow-lg"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                    config.bg,
                    "border border-white/10",
                    "shadow-md",
                    config.shadow
                  )}>
                    <Icon className={cn("w-5 h-5", config.color)} />
                  </div>
                  <span className="text-sm font-semibold text-gray-300">{labels[type]}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
