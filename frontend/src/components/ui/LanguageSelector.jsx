import React from "react";
import { useI18n, LOCALES } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

/**
 * Language Selector Component
 * Allows users to switch between supported languages
 */
export default function LanguageSelector({ variant = "icon" }) {
  const { locale, setLocale, locales } = useI18n();

  const currentLocale = locales[locale] || locales['pt-BR'];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <Globe className="w-5 h-5" />
          </Button>
        ) : (
          <Button variant="outline" className="gap-2 text-gray-300 border-white/10 hover:bg-white/5">
            <span className="text-lg">{currentLocale.flag}</span>
            <span className="hidden md:inline">{currentLocale.name}</span>
            <Globe className="w-4 h-4 md:hidden" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-[#1a1a2e] border-white/10 min-w-[180px]"
      >
        {Object.entries(locales).map(([code, config]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            className={`flex items-center gap-3 cursor-pointer ${
              code === locale
                ? "text-orange-400 bg-orange-500/10"
                : "text-white hover:text-orange-400"
            }`}
          >
            <span className="text-xl">{config.flag}</span>
            <span>{config.name}</span>
            {code === locale && (
              <span className="ml-auto text-xs bg-orange-500/20 px-2 py-0.5 rounded">
                Ativo
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
