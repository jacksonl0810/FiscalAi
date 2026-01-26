import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function UserMenu({ user }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [avatarError, setAvatarError] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState(null);

  // Cache avatar URL to prevent repeated requests
  useEffect(() => {
    if (user?.avatar && !avatarError) {
      setAvatarSrc(user.avatar);
    }
  }, [user?.avatar, avatarError]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAvatarError = () => {
    console.log('[UserMenu] Avatar load failed, using fallback');
    setAvatarError(true);
    setAvatarSrc(null);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start px-3 py-2.5 h-auto text-left",
            "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
            "border border-white/10",
            "hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10",
            "hover:border-orange-500/30",
            "transition-all duration-200",
            "shadow-md hover:shadow-lg hover:shadow-orange-500/10",
            "backdrop-blur-sm rounded-xl"
          )}
        >
          <div className="flex items-center gap-3">
            <Avatar className={cn(
              "w-10 h-10",
              "border-2 border-orange-500/30",
              "shadow-md shadow-orange-500/20"
            )}>
              {!avatarError && avatarSrc && (
                <AvatarImage 
                  src={avatarSrc} 
                  onError={handleAvatarError}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback className={cn(
                "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
                "text-white text-sm font-semibold",
                "shadow-md shadow-orange-500/30"
              )}>
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || 'Usuário'}
              </p>
              <p className="text-xs text-gray-400 truncate font-medium">
                {user?.email || ''}
              </p>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn(
        "w-56",
        "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95",
        "backdrop-blur-xl border border-white/10",
        "shadow-2xl shadow-black/50"
      )} align="end" side="top">
        <DropdownMenuItem
          onClick={() => navigate(createPageUrl("Settings"))}
          className={cn(
            "text-white cursor-pointer",
            "hover:bg-gradient-to-r hover:from-white/10 hover:to-white/5",
            "hover:text-white",
            "transition-all duration-200"
          )}
        >
          <Settings className="w-4 h-4 mr-2" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={handleLogout}
          className={cn(
            "text-red-300 cursor-pointer",
            "hover:bg-gradient-to-r hover:from-red-500/20 hover:to-red-600/10",
            "hover:text-red-200",
            "transition-all duration-200"
          )}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
