import React from "react";
import { Sparkles, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ChatMessage({ message, isAI }) {
  // Check if content is JSON and extract readable text
  const getDisplayContent = (content) => {
    if (!content || typeof content !== 'string') return content;

    // Check if content is JSON wrapped in markdown code blocks
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        // If it's an action JSON, return only the explanation
        if (parsed.explanation) {
          return parsed.explanation;
        }
        // Otherwise return the original content but formatted better
        return content.replace(jsonMatch[0], '').trim() || content;
      } catch (e) {
        // If parsing fails, return original
        return content;
      }
    }

    // Check if content is raw JSON (starts with {)
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.explanation) {
          return parsed.explanation;
        }
        // If it's action JSON, don't show it (will be handled by preview)
        if (parsed.action?.type === 'emitir_nfse') {
          return parsed.explanation || 'Preparando nota fiscal...';
        }
      } catch (e) {
        // Not valid JSON, return as is
      }
    }

    return content;
  };

  const displayContent = getDisplayContent(message.content);

  // Don't render if content is empty or just JSON structure
  if (!displayContent || displayContent.trim() === '' || displayContent.trim() === '{}') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${isAI ? '' : 'flex-row-reverse'}`}
    >
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
        isAI 
          ? cn(
              "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
              "shadow-lg shadow-orange-500/30",
              "border border-orange-400/30"
            )
          : cn(
              "bg-gradient-to-br from-white/10 via-white/5 to-white/10",
              "border border-white/10",
              "backdrop-blur-sm"
            )
      )}>
        {isAI ? (
          <Sparkles className="w-6 h-6 text-white" />
        ) : (
          <User className="w-6 h-6 text-gray-300" />
        )}
      </div>
      
      <div className={`flex-1 max-w-[80%] ${isAI ? '' : 'text-right'}`}>
        <div className={cn(
          "inline-block px-6 py-4 rounded-2xl",
          "backdrop-blur-xl shadow-xl",
          isAI 
            ? cn(
                "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                "border border-white/10",
                "text-gray-100",
                "shadow-black/30"
              )
            : cn(
                "bg-gradient-to-r from-orange-500/30 via-orange-600/20 to-purple-500/20",
                "border border-orange-500/30",
                "text-white",
                "shadow-orange-500/20"
              )
        )}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{displayContent}</p>
        </div>
        <p className={cn(
          "text-xs mt-2 px-2",
          isAI ? "text-gray-500" : "text-gray-400"
        )}>
          {message.time}
        </p>
      </div>
    </motion.div>
  );
}