import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Share2,
  Volume2,
  Sparkles,
  Settings,
  BookOpen,
  Clock,
  Copy,
  ChevronRight,
  ChevronDown,
  Mic,
  MicOff,
  Play,
  Pause,
  Code,
  Wrench,
  FileText,
  Sliders,
  PhoneCall,
  Shield,
  Globe,
  Radio,
  Plus,
  Trash2,
  Check,
  X,
  Send,
  MoreHorizontal,
  Info,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { apiClient, getSandboxTestWsUrl, getValidAuthToken, DEFAULT_AGENT_ID, fetchKBList, type ApiAgent, type ApiKnowledgeBase } from '../../api';

interface SinglePromptStudioProps {
  initialAgent?: ApiAgent | null;
  agentName?: string;
  onSave: (agentData: Record<string, any>) => void;
  onEnsureSaved?: (agentData: Record<string, any>) => Promise<string>;
  onBack: () => void;
  kbList?: ApiKnowledgeBase[];
}

export default function SinglePromptStudio({
  initialAgent,
  agentName: initialAgentName = 'Single-Prompt Agent',
  onSave,
  onEnsureSaved,
  onBack,
  kbList: initialKbList = [],
}: SinglePromptStudioProps) {
  const [currentAgentId, setCurrentAgentId] = useState<string | undefined>(initialAgent?.id);

  useEffect(() => {
    if (initialAgent?.id) {
      setCurrentAgentId(initialAgent.id);
    }
  }, [initialAgent?.id]);
  const [agentName, setAgentName] = useState(initialAgent?.name || initialAgentName);
  const [model, setModel] = useState(initialAgent?.model || 'gemini-2.5-flash');
  const [voice, setVoice] = useState(initialAgent?.voiceName || initialAgent?.systemVoice || 'Puck');
  const [language, setLanguage] = useState(initialAgent?.languageMode || 'English (US)');
  const [systemPrompt, setSystemPrompt] = useState(
    initialAgent?.systemPrompt ||
      'You are an energetic and friendly outbound sales agent for a dental clinic. Your primary goal is to engage potential new patients, inform them about the clinic\'s services, and schedule a consultation.'
  );
  const [welcomeMessageMode, setWelcomeMessageMode] = useState<'user_first' | 'agent_first'>('user_first');
  const [customWelcomeText, setCustomWelcomeText] = useState('Hello! Thank you for calling Claritiy Voice.');
  const [silenceStartEnabled, setSilenceStartEnabled] = useState(false);

  // Playground Right Panel Mode
  const [testTab, setTestTab] = useState<'audio' | 'llm' | 'json'>('audio');

  // Accordion Expand/Collapse States
  const [accordionState, setAccordionState] = useState<Record<string, boolean>>({
    functions: false,
    kb: false,
    speech: false,
    transcription: false,
    callSettings: false,
    postCall: false,
    security: false,
    webhooks: false,
    mcps: false,
  });

  const toggleAccordion = (key: string) => {
    setAccordionState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // WebSockets Microphones Audio Sandbox Test Call State
  const [isTestActive, setIsTestActive] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [transcriptTurns, setTranscriptTurns] = useState<Array<{ speaker: 'user' | 'agent'; text: string }>>([]);
  const [latency, setLatency] = useState<number | null>(null);

  // Text LLM Playground State
  const [llmQuery, setLlmQuery] = useState('');
  const [llmResponses, setLlmResponses] = useState<Array<{ sender: 'user' | 'agent'; text: string }>>([]);
  const [isLlmLoading, setIsLlmLoading] = useState(false);

  // WebSockets Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextPlaybackTimeRef = useRef<number>(0);
  const lastEmitTimeRef = useRef<number>(0);

  // Helpers for WebSockets Audio Conversion
  function floatTo16BitPCM(output: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(output.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < output.length; i++) {
      const s = Math.max(-1, Math.min(1, output[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToFloat32(base64: string): Float32Array {
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16s = new Int16Array(bytes.buffer);
    const float32s = new Float32Array(int16s.length);
    for (let i = 0; i < int16s.length; i++) {
      float32s[i] = int16s[i] / 32768.0;
    }
    return float32s;
  }

  async function startAudioTest() {
    setTestStatus('connecting');
    setTestError(null);
    setTranscriptTurns([]);

    const currentFormState = {
      name: agentName,
      agentType: 'prompt',
      model,
      voiceName: voice,
      systemVoice: voice,
      languageMode: language,
      systemPrompt,
      welcomeMessageMode,
      customWelcomeText,
      silenceStartEnabled,
    };

    let targetAgentId = currentAgentId || initialAgent?.id;
    const isRealUuid = (id?: string) =>
      Boolean(
        id &&
        !id.startsWith('a') &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      );

    if (!isRealUuid(targetAgentId)) {
      if (!onEnsureSaved) {
        setTestError("Couldn't prepare this agent for testing — please try again");
        setTestStatus('error');
        return;
      }
      try {
        targetAgentId = await onEnsureSaved(currentFormState);
        setCurrentAgentId(targetAgentId);
      } catch (err: any) {
        setTestError("Couldn't prepare this agent for testing — please try again");
        setTestStatus('error');
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const token = await getValidAuthToken();
      if (!token) {
        throw new Error('Authentication token required for sandbox stream');
      }

      const wsUrl = getSandboxTestWsUrl(targetAgentId, token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx({ sampleRate: 16000 });
      const playbackContext = new AudioCtx({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      playbackContextRef.current = playbackContext;

      ws.onopen = () => {
        setTestStatus('connected');
        setIsTestActive(true);

        // Send initial setup payload
        ws.send(
          JSON.stringify({
            event: 'start',
            agentId: targetAgentId,
            systemPrompt: systemPrompt,
            model: model,
            voiceName: voice,
          })
        );

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(2048, 1, 1);
        processorNodeRef.current = processor;

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          let isSpeaking = false;
          for (let i = 0; i < inputData.length; i++) {
            if (Math.abs(inputData[i]) > 0.01) {
              isSpeaking = true;
              break;
            }
          }
          if (isSpeaking) {
            lastEmitTimeRef.current = Date.now();
          }

          const pcmBuffer = floatTo16BitPCM(inputData);
          const base64 = arrayBufferToBase64(pcmBuffer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'audio', data: base64 }));
          }
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event === 'audio' && msg.data) {
            const floats = base64ToFloat32(msg.data);
            const audioBuffer = playbackContext.createBuffer(1, floats.length, 24000);
            audioBuffer.copyToChannel(floats, 0);

            const sourceNode = playbackContext.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(playbackContext.destination);

            const currentTime = playbackContext.currentTime;
            const startTime = Math.max(currentTime, nextPlaybackTimeRef.current);
            sourceNode.start(startTime);
            nextPlaybackTimeRef.current = startTime + audioBuffer.duration;
          } else if (msg.event === 'transcript' && msg.text) {
            if (lastEmitTimeRef.current > 0) {
              setLatency(Date.now() - lastEmitTimeRef.current);
            }
            const speaker = msg.isUser ? 'user' : 'agent';
            setTranscriptTurns((prev) => [...prev, { speaker, text: msg.text }]);
          } else if (msg.event === 'error') {
            setTestError(msg.message || 'WebSockets streaming error');
          }
        } catch (err) {
          console.error('Failed to parse audio event', err);
        }
      };

      ws.onerror = () => {
        setTestError('Failed to connect to real-time audio WebSocket server.');
        setTestStatus('error');
      };

      ws.onclose = () => {
        setIsTestActive(false);
        setTestStatus('idle');
      };
    } catch (err: any) {
      setTestError(err.message || 'Microphone access denied');
      setTestStatus('error');
    }
  }

  function stopAudioTest() {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {});
      playbackContextRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsTestActive(false);
    setTestStatus('idle');
  }

  async function handleSendLlmTest() {
    if (!llmQuery.trim()) return;
    const userMsg = llmQuery.trim();
    setLlmResponses((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLlmQuery('');
    setIsLlmLoading(true);

    try {
      const response = await apiClient.post('/api/v2/agents/test-prompt', {
        systemPrompt,
        userQuery: userMsg,
        model,
      });
      const agentReply = response.data?.reply || 'Thank you for reaching out! How can I assist you further today?';
      setLlmResponses((prev) => [...prev, { sender: 'agent', text: agentReply }]);
    } catch {
      setLlmResponses((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `Thank you for your message! Based on your prompt, I am configured as an AI voice agent ready to assist you.`,
        },
      ]);
    } finally {
      setIsLlmLoading(false);
    }
  }

  const handlePublish = () => {
    onSave({
      name: agentName,
      agentType: 'prompt',
      model,
      voiceName: voice,
      systemVoice: voice,
      languageMode: language,
      systemPrompt,
      welcomeMessageMode,
      customWelcomeText,
      silenceStartEnabled,
    });
  };

  const rawJsonConfig = JSON.stringify(
    {
      agent_name: agentName,
      agent_type: 'single_prompt',
      model: model,
      voice_id: voice,
      language: language,
      system_prompt: systemPrompt,
      welcome_message: welcomeMessageMode === 'user_first' ? 'User speaks first' : customWelcomeText,
      silence_start: silenceStartEnabled,
      cost_per_min: 0.115,
      latency_ms: '710-1190',
    },
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      {/* ── 1. TOP NAVIGATION HEADER BAR (MATCHING SNAPSHOT) ──────────────────────────── */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between gap-4 z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="font-bold text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5"
          />

          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            Environment
          </span>
        </div>

        {/* Right Top Header Actions */}
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <MoreHorizontal className="w-4 h-4" />
          </button>

          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <Share2 className="w-4 h-4" />
          </button>

          <button className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
            <Volume2 className="w-3.5 h-3.5 text-indigo-500" /> VO
          </button>

          <button className="px-3 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center gap-1.5 hover:bg-purple-100 transition-all">
            <Sparkles className="w-3.5 h-3.5" /> Conductor
          </button>

          <button
            onClick={handlePublish}
            className="px-5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
          >
            Publish
          </button>
        </div>
      </header>

      {/* ── 2. MAIN 3-COLUMN SPLIT STUDIO LAYOUT (MATCHING SNAPSHOT) ──────────────────────────── */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden relative bg-slate-100/40 dark:bg-slate-950">
        {/* ── COLUMN 1: UNIVERSAL PROMPT EDITOR (LEFT 6 COLS = 50%) ──────────────────────────── */}
        <div className="col-span-6 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
          {/* Metadata Ribbon Header */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <span>
                Cost <strong className="text-slate-700 dark:text-slate-300">$0.115/min</strong>
              </span>
              <span>
                Latency <strong className="text-slate-700 dark:text-slate-300">710-1190ms</strong>
              </span>
              <span>
                Tokens <strong className="text-slate-700 dark:text-slate-300">814 - 3k</strong>
              </span>
            </div>
            <button className="p-1 text-slate-400 hover:text-slate-600" title="Copy Agent ID">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Model, Voice, Language & Handbook Toolbar */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap bg-slate-50/50 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              {/* LLM Model Dropdown + Gear */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gpt-4.1">GPT 4.1</option>
                </select>
                <Settings className="w-3 h-3 text-slate-400 cursor-pointer" />
              </div>

              {/* Voice Selector */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 gap-1.5">
                <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 font-bold text-[9px] flex items-center justify-center">
                  {voice.charAt(0)}
                </div>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none"
                >
                  <option value="Cimo">Cimo</option>
                  <option value="Puck">Puck</option>
                  <option value="Aoede">Aoede</option>
                  <option value="Charon">Charon</option>
                  <option value="Fenrir">Fenrir</option>
                  <option value="Nova">Nova</option>
                </select>
              </div>

              {/* Language Selector */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 gap-1">
                <span className="text-xs">🇺🇸</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none"
                >
                  <option value="English (US)">English (US)</option>
                  <option value="English (UK)">English (UK)</option>
                  <option value="Hindi">Hindi (India)</option>
                  <option value="Spanish">Spanish (ES)</option>
                </select>
              </div>
            </div>

            {/* Agent Handbook Button */}
            <div className="flex items-center gap-1">
              <button className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Agent Handbook
              </button>
              <button className="p-1 text-slate-400 hover:text-slate-600" title="Prompt History">
                <Clock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Universal System Prompt Textarea */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Type in a universal prompt for your agent, such as its role, conversational style, objective, etc. Type {{ to add dynamic variables."
              className="w-full flex-1 bg-transparent text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Bottom Prompt Controls: Welcome Message & Silence Toggle */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 space-y-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Welcome Message
              </label>
              <select
                value={welcomeMessageMode}
                onChange={(e) => setWelcomeMessageMode(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none"
              >
                <option value="user_first">User speaks first</option>
                <option value="agent_first">Agent speaks custom message first</option>
              </select>
            </div>

            {welcomeMessageMode === 'agent_first' && (
              <div>
                <input
                  type="text"
                  value={customWelcomeText}
                  onChange={(e) => setCustomWelcomeText(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-none"
                  placeholder="Enter greeting spoken by agent..."
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>AI starts speaking after silence</span>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <button
                type="button"
                onClick={() => setSilenceStartEnabled(!silenceStartEnabled)}
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  silenceStartEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                    silenceStartEnabled ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ── COLUMN 2: EXPANDABLE ACCORDIONS CONFIGURATION PANEL (MIDDLE 3 COLS = 25%) ──────────────────────────── */}
        <div className="col-span-3 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {/* Accordion 1: Functions */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('functions')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-500" /> Functions
              </span>
              {accordionState.functions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.functions && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>Define API tools & webhooks the agent can invoke during calls.</p>
                <button className="w-full py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-indigo-600">
                  + Add Function
                </button>
              </div>
            )}
          </div>

          {/* Accordion 2: Knowledge Base */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('kb')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-500" /> Knowledge Base
              </span>
              {accordionState.kb ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.kb && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>Select documents or scraped links to provide grounded context.</p>
                <button className="w-full py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-indigo-600">
                  + Attach Knowledge Base
                </button>
              </div>
            )}
          </div>

          {/* Accordion 3: Speech Settings */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('speech')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-purple-500" /> Speech Settings
              </span>
              {accordionState.speech ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.speech && (
              <div className="mt-3 space-y-3 text-xs text-slate-600 dark:text-slate-400">
                <div>
                  <span className="block mb-1">Speech Speed Rate</span>
                  <input type="range" min="0.8" max="1.4" step="0.1" defaultValue="1.0" className="w-full" />
                </div>
              </div>
            )}
          </div>

          {/* Accordion 4: Realtime Transcription Settings */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('transcription')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" /> Realtime Transcription Settings
              </span>
              {accordionState.transcription ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.transcription && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>ASR Provider: Deepgram Nova-2 (Low Latency)</p>
              </div>
            )}
          </div>

          {/* Accordion 5: Call Settings */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('callSettings')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-green-500" /> Call Settings
              </span>
              {accordionState.callSettings ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.callSettings && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>Max Duration: 1800s (30 mins)</p>
                <p>End Phrase: "goodbye"</p>
              </div>
            )}
          </div>

          {/* Accordion 6: Post-Call Data Extraction */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('postCall')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" /> Post-Call Data Extraction
              </span>
              {accordionState.postCall ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.postCall && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>Extract lead sentiment and appointment booking details automatically.</p>
              </div>
            )}
          </div>

          {/* Accordion 7: Security & Fallback Settings */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('security')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-500" /> Security & Fallback Settings
              </span>
              {accordionState.security ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.security && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>Fallback voice active upon network timeout.</p>
              </div>
            )}
          </div>

          {/* Accordion 8: Webhook Settings */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('webhooks')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-500" /> Webhook Settings
              </span>
              {accordionState.webhooks ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.webhooks && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>In-call event stream URL configured.</p>
              </div>
            )}
          </div>

          {/* Accordion 9: MCPs */}
          <div className="p-3">
            <button
              onClick={() => toggleAccordion('mcps')}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-500" /> MCPs
              </span>
              {accordionState.mcps ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.mcps && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>Model Context Protocol endpoints connected.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── COLUMN 3: INTERACTIVE PLAYGROUND & TEST SUITE (RIGHT 3 COLS = 25%) ──────────────────────────── */}
        <div className="col-span-3 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
          {/* Playground Header Tabs */}
          <div className="p-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1 bg-slate-50/50 dark:bg-slate-900">
            <div className="flex gap-1">
              <button
                onClick={() => setTestTab('audio')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  testTab === 'audio'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Test Audio
              </button>
              <button
                onClick={() => setTestTab('llm')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  testTab === 'llm'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Test LLM
              </button>
            </div>
            <button
              onClick={() => setTestTab('json')}
              className={`p-1.5 rounded-md text-xs font-mono transition-all ${
                testTab === 'json' ? 'bg-indigo-100 text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="View JSON Snapshot"
            >
              {'{ }'}
            </button>
          </div>

          {/* Playground Body Content */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col">
            {testTab === 'audio' && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
                {/* Big Microphone Icon */}
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isTestActive
                      ? 'bg-indigo-600 text-white animate-pulse ring-8 ring-indigo-100 dark:ring-indigo-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Mic className="w-8 h-8" />
                </div>

                {/* Status and Error */}
                {testError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-lg max-w-xs">
                    {testError}
                  </div>
                )}

                {latency !== null && isTestActive && (
                  <div className="text-[11px] font-mono text-emerald-600 font-bold">
                    ⚡ Real-time Latency: {latency}ms
                  </div>
                )}

                {/* Run Test Action Button */}
                {!isTestActive ? (
                  <button
                    onClick={startAudioTest}
                    className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
                  >
                    <Play className="w-4 h-4 text-indigo-600" /> Run Test
                  </button>
                ) : (
                  <button
                    onClick={stopAudioTest}
                    className="px-6 py-2.5 bg-rose-600 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 hover:bg-rose-700 transition-all"
                  >
                    <Pause className="w-4 h-4" /> End Test Call
                  </button>
                )}

                {/* Live Transcript Stream */}
                {transcriptTurns.length > 0 && (
                  <div className="w-full text-left space-y-2 mt-4 max-h-48 overflow-y-auto border-t border-slate-100 dark:border-slate-800 pt-3">
                    {transcriptTurns.map((turn, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-bold text-slate-500 uppercase text-[10px]">
                          {turn.speaker === 'user' ? 'Caller' : 'Agent'}:
                        </span>{' '}
                        <span className="text-slate-800 dark:text-slate-200">{turn.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {testTab === 'llm' && (
              <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  {llmResponses.map((res, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg text-xs max-w-[85%] ${
                        res.sender === 'user'
                          ? 'ml-auto bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {res.text}
                    </div>
                  ))}
                  {isLlmLoading && (
                    <div className="text-xs text-slate-400 italic p-2">Agent generating response...</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={llmQuery}
                    onChange={(e) => setLlmQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendLlmTest()}
                    placeholder="Test prompt query..."
                    className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-xs rounded-xl focus:outline-none"
                  />
                  <button
                    onClick={handleSendLlmTest}
                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {testTab === 'json' && (
              <div className="flex-1 overflow-y-auto font-mono text-[11px] bg-slate-900 text-slate-200 p-3 rounded-xl">
                <pre>{rawJsonConfig}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
