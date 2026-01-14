import React from "react";
import { Sparkles, User } from "lucide-react";
import { motion } from "framer-motion";

export default function ChatMessage({ message, isAI }) {
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
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className="text-xs text-gray-600 mt-2 px-2">
          {message.time}
        </p>
      </div>
    </motion.div>
  );
}