import React, { useState, useEffect, useRef } from "react";
import { Sliders, Sparkles, MessageSquare } from "lucide-react";
import { updateAgent } from "../../api";

interface AgentConfigPanelProps {
  agent: any;
  onUpdate: (updatedFields: Record<string, any>) => void;
  onSaveStatus: (status: 'idle' | 'saving' | 'done' | 'error') => void;
}

export default function AgentConfigPanel({ agent, onUpdate, onSaveStatus }: AgentConfigPanelProps) {
  const [prompt, setPrompt] = useState(agent.systemPrompt || "");
  const [voice, setVoice] = useState(agent.systemVoice || agent.voice || "Puck");
  const [temp, setTemp] = useState(agent.temperature ?? 0.7);
  const [languageMode, setLanguageMode] = useState(agent.languageMode || "auto");

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CARD 1: Persona & Instructions */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-muted rounded-lg">
              <MessageSquare className="w-4 h-4 text-foreground" />
            </div>
            <p className="text-sm font-semibold" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Agent Instructions & Persona
            </p>
          </div>
          <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
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
            className="w-full p-3 border border-border rounded-xl text-xs bg-white focus:outline-none resize-none"
            style={{ fontFamily: "'Figtree', sans-serif" }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-2" style={{ fontFamily: "'Figtree', sans-serif" }}>
          * Changes apply instantly to the next incoming/outbound call stream session.
        </p>
      </div>

      {/* CARD 2: LLM Configuration parameters */}
      <div className="bg-white border border-border rounded-xl p-5 space-y-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-muted rounded-lg">
            <Sliders className="w-4 h-4 text-foreground" />
          </div>
          <p className="text-sm font-semibold" style={{ fontFamily: "'Figtree', sans-serif" }}>
            LLM & Voice Parameters
          </p>
        </div>

        {/* Voice dropdown selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-muted-foreground block" style={{ fontFamily: "'DM Mono', monospace" }}>
            SYSTEM NATIVE VOICE PROFILE
          </label>
          <div className="relative">
            <select
              value={voice}
              onChange={(e) => {
                setVoice(e.target.value);
                triggerDebouncedSave({ systemVoice: e.target.value, voice: e.target.value });
              }}
              className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-white focus:outline-none"
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
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-muted-foreground block" style={{ fontFamily: "'DM Mono', monospace" }}>
            CONVERSATIONAL LANGUAGE MODE
          </label>
          <div className="relative">
            <select
              value={languageMode}
              onChange={(e) => {
                setLanguageMode(e.target.value);
                triggerDebouncedSave({ languageMode: e.target.value });
              }}
              className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-white focus:outline-none"
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
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-semibold text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
              CREATIVE TEMPERATURE
            </label>
            <span className="text-xs font-semibold text-foreground px-2 py-0.5 bg-muted rounded-md" style={{ fontFamily: "'DM Mono', monospace" }}>
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
            className="w-full accent-foreground cursor-pointer h-1 bg-muted rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground" style={{ fontFamily: "'Figtree', sans-serif" }}>
            <span>Factual (0.0)</span>
            <span>Creative (1.0)</span>
          </div>
        </div>

        <div className="pt-2 border-t border-border space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
            ACTIVE MODEL
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold p-2.5 bg-muted/40 border border-border rounded-lg">
            <Sparkles className="w-4 h-4 text-foreground" />
            <span>Gemini 2.5 Flash Native Multimodal Audio</span>
          </div>
        </div>
      </div>
    </div>
  );
}
