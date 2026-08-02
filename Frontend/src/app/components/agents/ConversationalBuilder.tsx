import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, CheckCircle, ArrowRight } from "lucide-react";
import { buildAgentConversation } from "../../api";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface DraftConfig {
  systemPrompt: string;
  systemVoice: string;
  temperature: number;
  languageMode: string;
}

interface ConversationalBuilderProps {
  onApply: (config: DraftConfig) => void;
}

export default function ConversationalBuilder({ onApply }: ConversationalBuilderProps) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftConfig, setDraftConfig] = useState<DraftConfig | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, loading, draftConfig]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newHistory = [...history, { role: "user" as const, content: userMessage }];
    setHistory(newHistory);
    setLoading(true);

    try {
      const result = await buildAgentConversation(userMessage, history);
      
      if (result.isFinal && result.config) {
        setDraftConfig(result.config);
      } else if (result.response) {
        setHistory([...newHistory, { role: "model" as const, content: result.response }]);
      }
    } catch (err) {
      console.error("Failed to build agent via AI", err);
      setHistory([...newHistory, { role: "model" as const, content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nm-card flex flex-col h-[600px]">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--nm-bg-dark)]">
        <div className="w-10 h-10 nm-pressed rounded-xl flex items-center justify-center">
          <Bot className="w-5 h-5 text-[var(--nm-accent)]" />
        </div>
        <div>
          <p className="text-base font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            AI Agent Builder
          </p>
          <p className="text-xs font-bold text-[var(--nm-text)] opacity-70" style={{ fontFamily: "'Figtree', sans-serif" }}>
            Describe what you need, and I'll build the agent for you.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-70 space-y-3">
            <Bot className="w-12 h-12 text-[var(--nm-text)]" />
            <p className="text-sm font-bold" style={{ fontFamily: "'Figtree', sans-serif" }}>
              What kind of agent would you like to build?
            </p>
            <p className="text-xs" style={{ fontFamily: "'Figtree', sans-serif" }}>
              e.g. "An outbound sales agent for a dental clinic that speaks Spanish and is energetic."
            </p>
          </div>
        )}

        {history.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 nm-pressed rounded-full flex-shrink-0 flex items-center justify-center mt-1">
                <Bot className="w-4 h-4 text-[var(--nm-accent)]" />
              </div>
            )}
            <div className={`p-4 rounded-2xl max-w-[80%] text-sm font-bold ${
              msg.role === 'user' ? 'nm-raised text-[var(--nm-text)]' : 'nm-pressed text-[var(--nm-text)]'
            }`} style={{ fontFamily: "'Figtree', sans-serif" }}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 nm-pressed rounded-full flex-shrink-0 flex items-center justify-center mt-1">
                <User className="w-4 h-4 text-[var(--nm-text)]" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 nm-pressed rounded-full flex-shrink-0 flex items-center justify-center mt-1">
              <Bot className="w-4 h-4 text-[var(--nm-accent)]" />
            </div>
            <div className="p-4 rounded-2xl max-w-[80%] nm-pressed text-sm font-bold flex gap-1 items-center">
              <span className="animate-bounce inline-block w-1.5 h-1.5 nm-raised rounded-full bg-[var(--nm-accent)]"></span>
              <span className="animate-bounce inline-block w-1.5 h-1.5 nm-raised rounded-full bg-[var(--nm-accent)]" style={{ animationDelay: '0.2s' }}></span>
              <span className="animate-bounce inline-block w-1.5 h-1.5 nm-raised rounded-full bg-[var(--nm-accent)]" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}

        {draftConfig && (
          <div className="flex gap-3 justify-start mt-6">
             <div className="w-8 h-8 nm-pressed rounded-full flex-shrink-0 flex items-center justify-center mt-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="p-5 rounded-2xl nm-raised w-full text-sm space-y-4">
              <p className="font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
                Agent configuration is ready!
              </p>
              
              <div className="space-y-2 text-xs nm-pressed p-4 rounded-xl" style={{ fontFamily: "'DM Mono', monospace" }}>
                <p><span className="opacity-50">Voice:</span> {draftConfig.systemVoice}</p>
                <p><span className="opacity-50">Language Mode:</span> {draftConfig.languageMode}</p>
                <p><span className="opacity-50">Temperature:</span> {draftConfig.temperature}</p>
                <p className="opacity-50 mt-2">System Prompt Preview:</p>
                <p className="line-clamp-3 overflow-hidden text-ellipsis">{draftConfig.systemPrompt}</p>
              </div>

              <button
                onClick={() => onApply(draftConfig)}
                className="w-full nm-raised hover:nm-pressed transition-all rounded-xl py-3 flex items-center justify-center gap-2 font-bold text-[var(--nm-text)]"
                style={{ fontFamily: "'Figtree', sans-serif" }}
              >
                Apply Configuration <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex gap-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type your requirements here..."
          className="flex-1 nm-input px-5 py-3 text-sm focus:outline-none rounded-xl"
          style={{ fontFamily: "'Figtree', sans-serif" }}
          disabled={loading || !!draftConfig}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading || !!draftConfig}
          className="w-12 h-12 nm-raised hover:nm-pressed disabled:opacity-50 transition-all rounded-xl flex items-center justify-center flex-shrink-0"
        >
          <Send className="w-5 h-5 text-[var(--nm-accent)]" />
        </button>
      </div>
    </div>
  );
}
