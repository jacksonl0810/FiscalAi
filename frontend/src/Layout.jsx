import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { notificationsService, settingsService } from "@/api/services";
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
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CompanySelector from "@/components/layout/CompanySelector";
import UserMenu from "@/components/layout/UserMenu";

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const { user, logout } = useAuth();
  
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.listUnread(),
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

  const unreadCount = notifications.length;

  const navigation = [
    { name: "Assistente IA", page: "Assistant", icon: MessageSquare },
    { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
    { name: "Notas Fiscais", page: "Documents", icon: FileText },
    { name: "Impostos (DAS)", page: "Taxes", icon: Receipt },
    { name: "Minha Empresa", page: "CompanySetup", icon: Building2 },
    { name: "Notificações", page: "Notifications", icon: Bell, badge: unreadCount },
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
      <aside className={`fixed inset-y-0 left-0 z-50 glass-card transform transition-all duration-300 lg:translate-x-0 ${
        sidebarCollapsed ? 'w-20' : 'w-72'
      } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Logo & Collapse Button */}
          <div className="flex items-center justify-between px-6 py-6 border-b border-white/5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center glow-orange flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-white tracking-tight">Fiscal<span className="text-gradient">AI</span></h1>
                  <p className="text-xs text-gray-500">Automação Inteligente</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex text-gray-400 hover:text-white hover:bg-white/5 flex-shrink-0"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>

          {/* Company Selector */}
          {!sidebarCollapsed && (
            <div className="px-4 py-4 border-b border-white/5">
              <CompanySelector 
                activeCompanyId={activeCompanyId}
                onCompanyChange={setActiveCompanyId}
              />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                    isActive 
                      ? 'nav-item-active text-white' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-orange-500' : 'group-hover:text-orange-400'}`} />
                  {!sidebarCollapsed && (
                    <>
                      <span className="font-medium">{item.name}</span>
                      {item.badge > 0 && (
                        <Badge className="ml-auto bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/20">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-white/5">
            {sidebarCollapsed ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="w-full text-gray-400 hover:text-white hover:bg-white/5"
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
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 glass-card px-4 py-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-white"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white">Fiscal<span className="text-gradient">AI</span></span>
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
