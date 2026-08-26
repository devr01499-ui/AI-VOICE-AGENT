import React, { useState, useEffect, useRef } from "react";
import { Sliders, Sparkles, MessageSquare, Bot, Settings2, Calendar } from "lucide-react";
import { updateAgent, getCalendarStatus, getAuthToken, API_BASE } from "../../api";
import ConversationalBuilder from "./ConversationalBuilder";
import VisualFlowCanvas from "./VisualFlowCanvas";

interface AgentConfigPanelProps {
  agent: any;
  onUpdate: (updatedFields: Record<string, any>) => void;
  onSaveStatus: (status: 'idle' | 'saving' | 'done' | 'error') => void;
}

export default function AgentConfigPanel({ agent, onUpdate, onSaveStatus }: AgentConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  const [prompt, setPrompt] = useState(agent.systemPrompt || "");
  const [voice, setVoice] = useState(agent.systemVoice || agent.voice || "Puck");
  const [temp, setTemp] = useState(agent.temperature ?? 0.7);
  const [languageMode, setLanguageMode] = useState(agent.languageMode || "auto");
  const [calendarConnected, setCalendarConnected] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    getCalendarStatus()
      .then(d => {
        setCalendarConnected(!!d?.connected);
      })
      .catch(() => {});
  }, []);

  // Sync state if selected agent changes
  useEffect(() => {
    setPrompt(agent.systemPrompt || "");
    setVoice(agent.systemVoice || agent.voice || "Puck");
    setTemp(agent.temperature ?? 0.7);
    setLanguageMode(agent.languageMode || "auto");
  }, [agent.id]);

  const triggerDebouncedSave = (updatedFields: Record<string, any>) => {
    // Notify parent view immediately for responsive display update
    onUpdate(updatedFields);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    onSaveStatus('saving');
    debounceTimerRef.current = setTimeout(() => {
      const payload = {
        systemPrompt: updatedFields.systemPrompt !== undefined ? updatedFields.systemPrompt : prompt,
        systemVoice: updatedFields.systemVoice !== undefined ? updatedFields.systemVoice : voice,
        temperature: updatedFields.temperature !== undefined ? Number(updatedFields.temperature) : Number(temp),
        languageMode: updatedFields.languageMode !== undefined ? updatedFields.languageMode : languageMode,
      };

      updateAgent(agent.id, payload)
        .then(() => {
          onSaveStatus('done');
          setTimeout(() => onSaveStatus('idle'), 2000);
        })
        .catch((err) => {
          console.error("AgentConfigPanel: Auto-save failed", err);
          onSaveStatus('error');
          setTimeout(() => onSaveStatus('idle'), 2000);
        });
    }, 800); // 800ms debounce gate
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-4 border-b border-[var(--nm-bg-dark)] pb-4">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'manual' 
              ? 'nm-pressed text-[var(--nm-text)]' 
              : 'text-[var(--nm-text)] opacity-70 hover:opacity-100 hover:nm-raised'
          }`}
          style={{ fontFamily: "'Figtree', sans-serif" }}
        >
          <Settings2 className="w-4 h-4" />
          Manual Configuration
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'ai' 
              ? 'nm-pressed text-[var(--nm-accent)]' 
              : 'text-[var(--nm-text)] opacity-70 hover:opacity-100 hover:nm-raised'
          }`}
          style={{ fontFamily: "'Figtree', sans-serif" }}
        >
          <Bot className="w-4 h-4" />
          AI Builder
        </button>
      </div>

      {activeTab === 'ai' ? (
        <ConversationalBuilder
          onApply={(config) => {
            setPrompt(config.systemPrompt);
            setVoice(config.systemVoice);
            setTemp(config.temperature);
            setLanguageMode(config.languageMode);
            setActiveTab('manual');
            triggerDebouncedSave(config);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CARD 1: Persona & Instructions or Visual Flow Canvas */}
      <div className="nm-card flex flex-col justify-between h-full">
        {(agent.agentType === 'conversational' || agent.type === 'conversational') ? (
          <VisualFlowCanvas
            agentName={agent.name}
            initialGraph={agent.flowGraph}
            legacySystemPrompt={prompt}
            onSave={(compiledPrompt, flowGraph) => {
              setPrompt(compiledPrompt);
              triggerDebouncedSave({ systemPrompt: compiledPrompt, flowGraph });
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 nm-pressed rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[var(--nm-accent)]" />
              </div>
              <p className="text-base font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
                Agent Instructions & Persona
              </p>
            </div>
            <p className="text-sm font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Define how the agent greets callers, answers questions, handles intent, and completes calls.
            </p>
            <textarea
              rows={12}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                triggerDebouncedSave({ systemPrompt: e.target.value });
              }}
              placeholder="You are a professional voice AI assistant..."
              className="nm-input w-full p-5 text-sm resize-none h-64"
              style={{ fontFamily: "'Figtree', sans-serif" }}
            />
          </div>
        )}
        <p className="text-[11px] font-bold text-[var(--nm-text)] italic mt-4" style={{ fontFamily: "'Figtree', sans-serif" }}>
          * Changes apply instantly to the next incoming/outbound call stream session.
        </p>
      </div>

      {/* CARD 2: LLM Configuration parameters */}
      <div className="nm-card space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 nm-pressed rounded-xl flex items-center justify-center">
            <Sliders className="w-5 h-5 text-[var(--nm-accent)]" />
          </div>
          <p className="text-base font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            LLM & Voice Parameters
          </p>
        </div>

        {/* Voice dropdown selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-[var(--nm-text)] block" style={{ fontFamily: "'DM Mono', monospace" }}>
            SYSTEM NATIVE VOICE PROFILE
          </label>
          <div className="relative">
            <select
              value={voice}
              onChange={(e) => {
                setVoice(e.target.value);
                triggerDebouncedSave({ systemVoice: e.target.value, voice: e.target.value });
              }}
              className="nm-input w-full px-5 py-3 text-sm focus:outline-none"
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              {/* All 30 Gemini built-in voices — single select, one voice per agent */}
              <option value="Puck">Puck — Upbeat, lively, energetic</option>
              <option value="Aoede">Aoede — Breezy, natural, conversational</option>
              <option value="Charon">Charon — Calm, informative, professional</option>
              <option value="Fenrir">Fenrir — Excitable, dynamic, passionate</option>
              <option value="Kore">Kore — Firm, confident, warm</option>
              <option value="Leda">Leda — Youthful, energetic, friendly</option>
              <option value="Orus">Orus — Calm, firm, authoritative</option>
              <option value="Zephyr">Zephyr — Bright, clear, melodic</option>
              <option value="Callirhoe">Callirhoe — Melodic, soft, clear</option>
              <option value="Autonoe">Autonoe — Warm, expressive, natural</option>
              <option value="Enceladus">Enceladus — Deep, resonant, professional</option>
              <option value="Iapetus">Iapetus — Warm, engaging, mature</option>
              <option value="Umbriel">Umbriel — Calm, smooth, low-pitched</option>
              <option value="Algieba">Algieba — Smooth, polished, professional</option>
              <option value="Despina">Despina — Clear, energetic, bright</option>
              <option value="Erinome">Erinome — Gentle, friendly, conversational</option>
              <option value="Algenib">Algenib — Strong, confident, clear</option>
              <option value="Rasalgethi">Rasalgethi — Deep, calm, informative</option>
              <option value="Laomedeia">Laomedeia — Melodious, bright, friendly</option>
              <option value="Achernar">Achernar — Crisp, articulate, professional</option>
              <option value="Alnilam">Alnilam — Smooth, conversational, warm</option>
              <option value="Schedar">Schedar — Warm, authoritative, polished</option>
              <option value="Gacrux">Gacrux — Resonant, smooth, friendly</option>
              <option value="Pulcherrima">Pulcherrima — Clear, expressive, bright</option>
              <option value="Achird">Achird — Bright, friendly, conversational</option>
              <option value="Adara">Adara — Clear, soft, melodic</option>
              <option value="Castor">Castor — Dynamic, friendly, active</option>
              <option value="Deneb">Deneb — Crisp, precise, clear</option>
              <option value="Eltanin">Eltanin — Smooth, calm, comforting</option>
              <option value="Mizar">Mizar — Warm, rich, professional</option>
            </select>
          </div>
        </div>

        {/* Language Mode dropdown selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-[var(--nm-text)] block" style={{ fontFamily: "'DM Mono', monospace" }}>
            CONVERSATIONAL LANGUAGE MODE
          </label>
          <div className="relative">
            <select
              value={languageMode}
              onChange={(e) => {
                setLanguageMode(e.target.value);
                triggerDebouncedSave({ languageMode: e.target.value });
              }}
              className="nm-input w-full px-5 py-3 text-sm focus:outline-none"
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              <option value="auto">Auto-detect (multilingual)</option>
              <option value="en">English only</option>
              <option value="hi">Hindi only</option>
              <option value="bn">Bengali only</option>
              <option value="kn">Kannada only</option>
              <option value="ml">Malayalam only</option>
              <option value="gu">Gujarati only</option>
              <option value="zh">Mandarin Chinese only</option>
              <option value="ar">Arabic only</option>
            </select>
          </div>
        </div>

        {/* Temperature slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-[var(--nm-text)]" style={{ fontFamily: "'DM Mono', monospace" }}>
              CREATIVE TEMPERATURE
            </label>
            <span className="text-sm font-bold text-[var(--nm-text)] px-3 py-1 nm-raised rounded-lg" style={{ fontFamily: "'DM Mono', monospace" }}>
              {temp.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={temp}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setTemp(val);
              triggerDebouncedSave({ temperature: val });
            }}
            className="w-full accent-[var(--nm-accent)] cursor-pointer"
          />
          <div className="flex justify-between text-xs font-bold text-[var(--nm-text)]" style={{ fontFamily: "'Figtree', sans-serif" }}>
            <span>Factual (0.0)</span>
            <span>Creative (1.0)</span>
          </div>
        </div>

        <div className="pt-6 border-t border-transparent space-y-4">
          <p className="text-xs font-bold text-[var(--nm-text)]" style={{ fontFamily: "'DM Mono', monospace" }}>
            ACTIVE MODEL
          </p>
          <div className="flex items-center gap-3 text-sm font-bold p-4 nm-pressed rounded-xl text-[var(--nm-text)]">
            <Sparkles className="w-5 h-5 text-[var(--nm-accent)]" />
            <span>Gemini 2.5 Flash Native Multimodal Audio</span>
          </div>
        </div>
        <div className="pt-6 border-t border-transparent space-y-4">
          <p className="text-xs font-bold text-[var(--nm-text)]" style={{ fontFamily: "'DM Mono', monospace" }}>
            INTEGRATIONS
          </p>
          <div className="flex items-center justify-between p-4 nm-inset rounded-xl">
            <div className="flex items-center gap-3 text-[var(--nm-text)]">
              <Calendar className="w-5 h-5 text-[var(--nm-accent)]" />
              <div>
                <p className="text-sm font-bold" style={{ fontFamily: "'Figtree', sans-serif" }}>Google Calendar</p>
                <p className="text-xs opacity-70">Allow agent to check availability & schedule events.</p>
              </div>
            </div>
            {calendarConnected ? (
              <span className="text-sm font-bold text-green-500">Connected</span>
            ) : (
              <a 
                href={`${API_BASE}/api/v2/calendar/auth?token=${getAuthToken() || ''}`}
                className="nm-button px-4 py-2 text-sm font-bold text-[var(--nm-text)] hover:text-[var(--nm-accent)]"
              >
                Connect
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
      )}
    </div>
  );
}
