import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { notificationsService, settingsService } from "@/api/services";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  LayoutDashboard,
  FileText,
  Building2,
  Bell,
  LogOut,
  Menu,
  X,
  Sparkles,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import CompanySelector from "@/components/layout/CompanySelector";
import UserMenu from "@/components/layout/UserMenu";
import SubscriptionBadge from "@/components/layout/SubscriptionBadge";

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const { user, logout } = useAuth();
  const previousNotificationIds = useRef(new Set());
  const isFirstLoad = useRef(true);
  const previousUnreadCount = useRef(0);
  
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.listUnread(),
    refetchInterval: 20000,
    refetchIntervalInBackground: true,
    staleTime: 10000,
  });

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsService.get(),
  });

  useEffect(() => {
    if (settings?.active_company_id) {
      setActiveCompanyId(settings.active_company_id);
    }
  }, [settings]);

  useEffect(() => {
    if (isFirstLoad.current) {
      notifications.forEach(n => previousNotificationIds.current.add(n.id));
      previousUnreadCount.current = notifications.length;
      isFirstLoad.current = false;
      return;
    }

    const newNotifications = notifications.filter(
      n => !previousNotificationIds.current.has(n.id)
    );

    newNotifications.forEach(notification => {
      previousNotificationIds.current.add(notification.id);
      
      const toastConfig = {
        sucesso: { icon: <CheckCircle className="w-5 h-5 text-green-400" />, duration: 3000 },
        erro: { icon: <XCircle className="w-5 h-5 text-red-400" />, duration: 4000 },
        alerta: { icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />, duration: 3500 },
        info: { icon: <Info className="w-5 h-5 text-blue-400" />, duration: 3000 },
      };

      const config = toastConfig[notification.tipo] || toastConfig.info;

      const toastId = toast(notification.titulo, {
        description: notification.mensagem,
        icon: config.icon,
        duration: config.duration,
        action: {
          label: (
            <span className="flex items-center gap-1 text-xs font-medium">
              <X className="w-3 h-3" />
              Fechar
            </span>
          ),
          onClick: () => toast.dismiss(toastId),
        },
        style: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          color: '#fff',
        },
      });
    });

    previousUnreadCount.current = notifications.length;
  }, [notifications]);

  const unreadCount = notifications.length;

  const navigation = [
    { name: "Assistente IA", page: "Assistant", icon: MessageSquare },
    { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
    { name: "Notas Fiscais", page: "Documents", icon: FileText },
    { name: "Impostos (DAS)", page: "Taxes", icon: Receipt },
    { name: "Minha Empresa", page: "CompanySetup", icon: Building2 },
    { name: "Notificações", page: "Notifications", icon: Bell, badge: unreadCount },
    ...(user?.isAdmin ? [{ name: "Admin", page: "Admin", icon: Shield }] : []),
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <style>{`
        :root {
          --gradient-start: #1a1a2e;
          --gradient-end: #0a0a0f;
          --accent-orange: #f97316;
          --accent-blue: #3b82f6;
          --accent-purple: #8b5cf6;
        }
        
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .gradient-border {
          position: relative;
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(139, 92, 246, 0.1));
        }
        
        .gradient-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.5), rgba(139, 92, 246, 0.5));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
        
        .glow-orange {
          box-shadow: 0 0 40px rgba(249, 115, 22, 0.15);
        }
        
        .text-gradient {
          background: linear-gradient(135deg, #f97316, #fb923c);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .nav-item-active {
          background: linear-gradient(135deg, rgba(249, 115, 22, 0.15), rgba(139, 92, 246, 0.1));
          border-left: 2px solid #f97316;
        }
        
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      {/* Background gradient effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-orange-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 transform transition-all duration-300 lg:translate-x-0",
        "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95",
        "backdrop-blur-xl border-r border-white/10",
        "shadow-2xl shadow-black/50",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none",
        sidebarCollapsed ? 'w-20' : 'w-72',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex flex-col h-full relative z-10">
          {/* Logo & Collapse Button */}
          <div className={cn(
            "flex items-center justify-between px-6 py-6",
            "border-b border-white/10",
            "bg-gradient-to-r from-white/5 via-transparent to-transparent",
            "backdrop-blur-sm"
          )}>
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
                "shadow-lg shadow-orange-500/30",
                "border border-orange-400/30"
              )}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-white tracking-tight mb-0.5">
                    M<span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">AY</span>
                  </h1>
                  <p className="text-xs text-gray-400 font-medium">Assistente Fiscal IA</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "hidden lg:flex flex-shrink-0",
                "text-gray-400 hover:text-white",
                "hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5",
                "border border-transparent hover:border-white/10",
                "rounded-xl transition-all duration-200",
                "shadow-sm hover:shadow-md"
              )}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>

          {/* Company Selector */}
          {!sidebarCollapsed && (
            <div className={cn(
              "px-4 py-4 border-b border-white/10",
              "bg-gradient-to-r from-white/3 via-transparent to-transparent"
            )}>
              <CompanySelector 
                activeCompanyId={activeCompanyId}
                onCompanyChange={setActiveCompanyId}
              />
            </div>
          )}

          {/* Subscription Status */}
          {!sidebarCollapsed && (
            <div className={cn(
              "px-4 py-3 border-b border-white/10 flex justify-center",
              "bg-gradient-to-r from-white/3 via-transparent to-transparent"
            )}>
              <SubscriptionBadge />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                    "backdrop-blur-sm",
                    isActive 
                      ? cn(
                          "bg-gradient-to-r from-orange-500/20 via-orange-600/15 to-orange-500/20",
                          "border-l-2 border-orange-500",
                          "text-white shadow-lg shadow-orange-500/10",
                          "before:absolute before:inset-0 before:bg-gradient-to-r before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none before:rounded-xl"
                        )
                      : cn(
                          "text-gray-300",
                          "hover:text-white",
                          "hover:bg-gradient-to-r hover:from-white/10 hover:via-white/5 hover:to-white/10",
                          "hover:border-l-2 hover:border-orange-500/50",
                          "hover:shadow-md hover:shadow-orange-500/5",
                          "border-l-2 border-transparent"
                        )
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-colors duration-200",
                    isActive 
                      ? "text-orange-400" 
                      : "text-gray-400 group-hover:text-orange-400"
                  )} />
                  {!sidebarCollapsed && (
                    <>
                      <span className={cn(
                        "font-semibold flex-1",
                        isActive ? "text-white" : "text-gray-300 group-hover:text-white"
                      )}>
                        {item.name}
                      </span>
                      {item.badge > 0 && (
                        <motion.div
                          key={item.badge}
                          initial={{ scale: 1.3, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ 
                            type: "spring",
                            stiffness: 500,
                            damping: 30
                          }}
                        >
                          <Badge className={cn(
                            "ml-auto",
                            "bg-gradient-to-br from-orange-500/30 to-orange-600/20",
                            "text-orange-300 border border-orange-500/40",
                            "shadow-md shadow-orange-500/20",
                            "font-semibold"
                          )}>
                            {item.badge}
                          </Badge>
                        </motion.div>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className={cn(
            "p-4 border-t border-white/10",
            "bg-gradient-to-r from-white/3 via-transparent to-transparent",
            "backdrop-blur-sm"
          )}>
            {sidebarCollapsed ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className={cn(
                  "w-full text-gray-400 hover:text-white",
                  "hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5",
                  "border border-transparent hover:border-white/10",
                  "rounded-xl transition-all duration-200",
                  "shadow-sm hover:shadow-md"
                )}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            ) : (
              <UserMenu user={user} />
            )}
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className={cn(
        "lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between",
        "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95",
        "backdrop-blur-xl border-b border-white/10",
        "shadow-xl shadow-black/50"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={cn(
            "text-white",
            "hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5",
            "border border-transparent hover:border-white/10",
            "rounded-xl transition-all duration-200"
          )}
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg",
            "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
            "flex items-center justify-center",
            "shadow-lg shadow-orange-500/30",
            "border border-orange-400/30"
          )}>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white">
            Fiscal<span className="bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">AI</span>
          </span>
        </div>
        <div className="w-10" />
      </header>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className={`min-h-screen pt-16 lg:pt-0 transition-all duration-300 ${
        sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'
      }`}>
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
