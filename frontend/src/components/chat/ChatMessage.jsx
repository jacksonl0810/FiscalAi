import React from "react";
import { Sparkles, User } from "lucide-react";
import { motion } from "framer-motion";

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
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isAI 
          ? 'bg-gradient-to-br from-orange-500 to-orange-600 glow-orange' 
          : 'bg-white/10 border border-white/10'
      }`}>
        {isAI ? (
          <Sparkles className="w-5 h-5 text-white" />
        ) : (
          <User className="w-5 h-5 text-gray-400" />
        )}
      </div>
      
      <div className={`flex-1 max-w-[80%] ${isAI ? '' : 'text-right'}`}>
        <div className={`inline-block px-5 py-4 rounded-2xl ${
          isAI 
            ? 'glass-card text-gray-200' 
            : 'bg-gradient-to-r from-orange-500/20 to-purple-500/20 border border-orange-500/20 text-white'
        }`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
        </div>
        <p className="text-xs text-gray-600 mt-2 px-2">
          {message.time}
        </p>
      </div>
    </motion.div>
  );
}