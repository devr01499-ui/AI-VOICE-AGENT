import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Volume2,
  Sparkles,
  Settings,
  BookOpen,
  Clock,
  Copy,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  Code,
  Wrench,
  FileText,
  Sliders,
  PhoneCall,
  Shield,
  Globe,
  Plus,
  Trash2,
  Check,
  X,
  Send,
  MoreHorizontal,
  HelpCircle,
  Download,
  Mic,
  Radio,
} from 'lucide-react';
import {
  apiClient,
  getSandboxTestWsUrl,
  getValidAuthToken,
  DEFAULT_AGENT_ID,
  testAgentPrompt,
  exportAgentAsJson,
  type ApiAgent,
  type ApiKnowledgeBase,
} from '../../api';

export const GEMINI_VOICES = [
  { name: 'Puck', desc: 'Puck (Male • Warm, Professional)' },
  { name: 'Aoede', desc: 'Aoede (Female • Smooth, Energetic)' },
  { name: 'Charon', desc: 'Charon (Male • Deep, Executive)' },
  { name: 'Fenrir', desc: 'Fenrir (Male • Direct, Clear)' },
  { name: 'Kore', desc: 'Kore (Female • Calming, Focused)' },
  { name: 'Leda', desc: 'Leda (Female • Clear, Authoritative)' },
  { name: 'Orus', desc: 'Orus (Male • Resonant, Warm)' },
  { name: 'Zephyr', desc: 'Zephyr (Female • Bright, Conversational)' },
  { name: 'Callirhoe', desc: 'Callirhoe (Female • Gentle, Friendly)' },
  { name: 'Autonoe', desc: 'Autonoe (Female • Crisp, Professional)' },
  { name: 'Enceladus', desc: 'Enceladus (Male • Expressive, Dynamic)' },
  { name: 'Iapetus', desc: 'Iapetus (Male • Confident, Grounded)' },
  { name: 'Umbriel', desc: 'Umbriel (Male • Smooth, Technical)' },
  { name: 'Algieba', desc: 'Algieba (Female • Warm, Natural)' },
  { name: 'Despina', desc: 'Despina (Female • Cheerful, Clear)' },
  { name: 'Erinome', desc: 'Erinome (Female • Precise, Friendly)' },
  { name: 'Algenib', desc: 'Algenib (Male • Bold, Engaging)' },
  { name: 'Rasalgethi', desc: 'Rasalgethi (Male • Calm, Thoughtful)' },
  { name: 'Laomedeia', desc: 'Laomedeia (Female • Silky, Warm)' },
  { name: 'Achernar', desc: 'Achernar (Male • Crisp, Articulate)' },
  { name: 'Alnilam', desc: 'Alnilam (Male • Formal, Clear)' },
  { name: 'Schedar', desc: 'Schedar (Female • Radiant, Energetic)' },
  { name: 'Gacrux', desc: 'Gacrux (Male • Steady, Warm)' },
  { name: 'Pulcherrima', desc: 'Pulcherrima (Female • Elegant, Melodious)' },
  { name: 'Achird', desc: 'Achird (Male • Friendly, Conversational)' },
  { name: 'Adara', desc: 'Adara (Female • Vibrant, Warm)' },
  { name: 'Castor', desc: 'Castor (Male • Bright, Youthful)' },
  { name: 'Deneb', desc: 'Deneb (Male • Authoritative, Crisp)' },
  { name: 'Eltanin', desc: 'Eltanin (Male • Rich, Measured)' },
  { name: 'Mizar', desc: 'Mizar (Male • Direct, Smooth)' },
];

export const LANGUAGE_OPTIONS = [
  { code: 'auto', label: 'Automatic / Multilingual' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ta', label: 'Tamil' },
];

export const HANDBOOK_PRESETS = [
  {
    id: 'ai_disclosure',
    label: 'AI Disclosure',
    defaultOn: true,
    instruction: "If asked whether you are an AI, respond honestly, e.g. 'Yes — I'm an AI assistant here to help.'",
  },
  {
    id: 'restrict_kb',
    label: 'Restrict to Knowledge Base',
    defaultOn: false,
    instruction: "Only answer using information in your prompt and knowledge base. If you don't know, say so rather than guessing, and offer to connect the caller to someone who can help.",
  },
  {
    id: 'speech_norm',
    label: 'Speech Normalization',
    defaultOn: false,
    instruction: "Read numbers, currency, dates, and times in natural spoken form, e.g. 'seventy dollars and eighty-four cents' rather than '$70.84'.",
  },
  {
    id: 'echo_verify',
    label: 'Echo Verification',
    defaultOn: false,
    instruction: "When the caller provides a phone number, email, or account number, repeat it back to confirm before proceeding.",
  },
  {
    id: 'filler_words',
    label: 'Natural Filler Words',
    defaultOn: false,
    instruction: "Use brief, natural filler words occasionally (e.g. 'okay', 'got it') to sound more conversational, without overusing them.",
  },
];

export function compilePromptWithHandbook(prompt: string, enabledPresets: string[]): string {
  const active = HANDBOOK_PRESETS.filter(p => enabledPresets.includes(p.id));
  if (active.length === 0) return prompt;
  return `${prompt}\n\n[AGENT HANDBOOK INSTRUCTIONS]\n` + active.map(p => `- ${p.instruction}`).join('\n');
}

const normalizeLangCode = (code?: string): string => {
  if (!code) return 'auto';
  const map: Record<string, string> = {
    'English (US)': 'en',
    'English (UK)': 'en',
    'English': 'en',
    'Hindi': 'hi',
    'Hindi (India)': 'hi',
    'Bengali': 'bn',
    'Kannada': 'kn',
    'Malayalam': 'ml',
    'Gujarati': 'gu',
    'Tamil': 'ta',
    'Spanish': 'en',
  };
  return map[code] || (['auto', 'en', 'hi', 'bn', 'kn', 'ml', 'gu', 'ta', 'zh', 'ar'].includes(code) ? code : 'auto');
};

interface SinglePromptStudioProps {
  initialAgent?: ApiAgent | null;
  agentName?: string;
  onSave: (agentData: Record<string, any>) => void;
  onEnsureSaved?: (agentData: Record<string, any>) => Promise<string>;
  onBack: () => void;
  onViewCallLogs?: (agentId?: string) => void;
  onDeleteAgent?: (agentId?: string) => Promise<void>;
  onDuplicateAgent?: (agent?: any) => void;
  kbList?: ApiKnowledgeBase[];
}

export default function SinglePromptStudio({
  initialAgent,
  agentName: initialAgentName = 'Single-Prompt Agent',
  onSave,
  onEnsureSaved,
  onBack,
  onViewCallLogs,
  onDeleteAgent,
  onDuplicateAgent,
  kbList: initialKbList = [],
}: SinglePromptStudioProps) {
  const [currentAgentId, setCurrentAgentId] = useState<string | undefined>(initialAgent?.id);

  useEffect(() => {
    if (initialAgent?.id) {
      setCurrentAgentId(initialAgent.id);
    }
  }, [initialAgent?.id]);
  const [agentName, setAgentName] = useState(initialAgent?.name || initialAgentName);
  const [model] = useState('gemini-2.5-flash');
  const [voice, setVoice] = useState(initialAgent?.voiceName || initialAgent?.systemVoice || 'Puck');
  const [language, setLanguage] = useState(normalizeLangCode(initialAgent?.languageMode || undefined));
  const [systemPrompt, setSystemPrompt] = useState(
    initialAgent?.systemPrompt ||
      'You are an energetic and friendly outbound sales agent for a dental clinic. Your primary goal is to engage potential new patients, inform them about the clinic\'s services, and schedule a consultation.'
  );
  const [welcomeMessageMode, setWelcomeMessageMode] = useState<'user_first' | 'agent_first'>('user_first');
  const [customWelcomeText, setCustomWelcomeText] = useState('Hello! Thank you for calling Claritiy Voice.');
  const [silenceStartEnabled, setSilenceStartEnabled] = useState(false);

  const [handbookPresets, setHandbookPresets] = useState<string[]>(
    initialAgent?.agentConfig && Array.isArray((initialAgent.agentConfig as any).handbookPresets)
      ? (initialAgent.agentConfig as any).handbookPresets
      : ['ai_disclosure']
  );
  const [showHandbookPopover, setShowHandbookPopover] = useState(false);
  const [showPromptHistoryPopover, setShowPromptHistoryPopover] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copiedAgentId, setCopiedAgentId] = useState(false);

  const [testTab, setTestTab] = useState<'audio' | 'llm'>('audio');

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

  const [isTestActive, setIsTestActive] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [transcriptTurns, setTranscriptTurns] = useState<Array<{ speaker: 'user' | 'agent'; text: string; finalized?: boolean }>>([]);
  const [latency, setLatency] = useState<number | null>(null);

  const [llmQuery, setLlmQuery] = useState('');
  const [llmResponses, setLlmResponses] = useState<Array<{ sender: 'user' | 'agent'; text: string }>>([]);
  const [isLlmLoading, setIsLlmLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextPlaybackTimeRef = useRef<number>(0);

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

  function playPcmAudioChunk(base64Pcm: string) {
    try {
      if (!playbackContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        playbackContextRef.current = new AudioCtx({ sampleRate: 24000 });
      }
      const ctx = playbackContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const float32Data = base64ToFloat32(base64Pcm);
      if (float32Data.length === 0) return;

      const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      if (nextPlaybackTimeRef.current < currentTime) {
        nextPlaybackTimeRef.current = currentTime;
      }

      source.start(nextPlaybackTimeRef.current);
      nextPlaybackTimeRef.current += audioBuffer.duration;
    } catch (err) {
      console.error('PCM playback error:', err);
    }
  }

  async function startWebsocketsTestCall() {
    try {
      setIsTestActive(true);
      setTestStatus('connecting');
      setTestError(null);
      setTranscriptTurns([]);

      let targetAgentId = currentAgentId;
      if (!targetAgentId || targetAgentId.startsWith('a') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetAgentId)) {
        if (onEnsureSaved) {
          targetAgentId = await onEnsureSaved({
            name: agentName,
            agentType: 'prompt',
            model,
            voiceName: voice,
            systemVoice: voice,
            languageMode: language,
            systemPrompt: compilePromptWithHandbook(systemPrompt, handbookPresets),
            welcomeMessageMode,
            customWelcomeText,
            silenceStartEnabled,
            agentConfig: { handbookPresets },
          });
          setCurrentAgentId(targetAgentId);
        } else {
          targetAgentId = DEFAULT_AGENT_ID;
        }
      }

      const rawToken = (await getValidAuthToken()) || undefined;
      const wsUrl = getSandboxTestWsUrl(targetAgentId, rawToken);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setTestStatus('connected');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;

          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioCtx({ sampleRate: 16000 });
          audioContextRef.current = audioCtx;

          const sourceNode = audioCtx.createMediaStreamSource(stream);
          const processorNode = audioCtx.createScriptProcessor(4096, 1, 1);
          processorNodeRef.current = processorNode;

          processorNode.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16Buffer = floatTo16BitPCM(inputData);
            const base64Audio = arrayBufferToBase64(pcm16Buffer);

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  event: 'media',
                  media: { payload: base64Audio },
                })
              );
            }
          };

          sourceNode.connect(processorNode);
          processorNode.connect(audioCtx.destination);
        } catch (micErr: any) {
          setTestError('Microphone permission denied or audio device failure.');
          stopWebsocketsTestCall();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if ((msg.event === 'audio' && msg.data) || (msg.event === 'media' && msg.media?.payload)) {
            playPcmAudioChunk(msg.data || msg.media?.payload);
          } else if (msg.event === 'transcript' || msg.event === 'user_transcript' || msg.event === 'agent_transcript') {
            const deltaText = msg.text || msg.transcript || '';
            if (deltaText) {
              const isUserSpeaker = msg.isUser !== undefined ? msg.isUser : msg.event !== 'agent_transcript';
              const speaker: 'user' | 'agent' = isUserSpeaker ? 'user' : 'agent';
              const isFinal = Boolean(msg.isFinal);

              setTranscriptTurns((prev) => {
                if (prev.length === 0) {
                  return [{ speaker, text: deltaText, finalized: isFinal }];
                }
                const lastIndex = prev.length - 1;
                const lastTurn = prev[lastIndex];

                if (lastTurn.speaker === speaker && !lastTurn.finalized) {
                  const updatedTurns = [...prev];
                  updatedTurns[lastIndex] = {
                    ...lastTurn,
                    text: lastTurn.text + deltaText,
                    finalized: isFinal,
                  };
                  return updatedTurns;
                } else {
                  return [...prev, { speaker, text: deltaText, finalized: isFinal }];
                }
              });
            }
          } else if (msg.event === 'interrupted') {
            setTranscriptTurns((prev) => {
              if (prev.length === 0) return prev;
              const lastIndex = prev.length - 1;
              const lastTurn = prev[lastIndex];
              if (lastTurn.speaker === 'agent' && !lastTurn.finalized) {
                const updatedTurns = [...prev];
                updatedTurns[lastIndex] = {
                  ...lastTurn,
                  text: lastTurn.text + ' [interrupted]',
                  finalized: true,
                };
                return updatedTurns;
              }
              return prev;
            });
          } else if (msg.event === 'error' && msg.message) {
            setTestError(msg.message);
          } else if (msg.event === 'latency' && typeof msg.latencyMs === 'number') {
            setLatency(msg.latencyMs);
          }
        } catch (err) {
          console.error('Error parsing sandbox WS message', err);
        }
      };

      ws.onerror = () => {
        setTestStatus('error');
        setTestError('WebSocket sandbox connection error.');
      };

      ws.onclose = () => {
        setTestStatus('idle');
        setIsTestActive(false);
      };
    } catch (err: any) {
      setTestStatus('error');
      setTestError(err?.message || 'Failed to start sandbox test call.');
      setIsTestActive(false);
    }
  }

  function stopWebsocketsTestCall() {
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
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
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
    const history = llmResponses.map((r) => ({
      role: r.sender === 'user' ? ('user' as const) : ('model' as const),
      content: r.text,
    }));

    setLlmResponses((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setLlmQuery('');
    setIsLlmLoading(true);

    try {
      const finalPrompt = compilePromptWithHandbook(systemPrompt, handbookPresets);
      const res = await testAgentPrompt(finalPrompt, userMsg, history);
      const agentReply = res?.reply || 'No response generated.';
      setLlmResponses((prev) => [...prev, { sender: 'agent', text: agentReply }]);
    } catch {
      setLlmResponses((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: "Couldn't reach the test assistant — please try again.",
        },
      ]);
    } finally {
      setIsLlmLoading(false);
    }
  }

  const toggleHandbookPreset = (id: string) => {
    setHandbookPresets((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handlePublish = () => {
    onSave({
      name: agentName,
      agentType: 'prompt',
      model,
      voiceName: voice,
      systemVoice: voice,
      languageMode: language,
      systemPrompt: compilePromptWithHandbook(systemPrompt, handbookPresets),
      welcomeMessageMode,
      customWelcomeText,
      silenceStartEnabled,
      agentConfig: { handbookPresets },
    });
  };

  const rawJsonConfig = JSON.stringify(
    {
      agent_name: agentName,
      agent_type: 'single_prompt',
      model: model,
      voice_id: voice,
      language: language,
      system_prompt: compilePromptWithHandbook(systemPrompt, handbookPresets),
      handbook_presets: handbookPresets,
      welcome_message: welcomeMessageMode === 'user_first' ? 'User speaks first' : customWelcomeText,
      silence_start: silenceStartEnabled,
    },
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-900 dark:text-slate-100">
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

        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              title="More Options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 text-xs">
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    const studioPayload = {
                      ...(initialAgent || {}),
                      name: agentName,
                      agentType: 'prompt',
                      model,
                      voiceName: voice,
                      systemVoice: voice,
                      languageMode: language,
                      systemPrompt: compilePromptWithHandbook(systemPrompt, handbookPresets),
                      welcomeMessageMode,
                      customWelcomeText,
                      silenceStartEnabled,
                      agentConfig: {
                        ...(typeof initialAgent?.agentConfig === 'object' && initialAgent?.agentConfig ? initialAgent.agentConfig : {}),
                        handbookPresets,
                      },
                    };
                    if (onDuplicateAgent) {
                      onDuplicateAgent(studioPayload);
                    } else {
                      onSave({
                        ...studioPayload,
                        name: `${agentName} (Copy)`,
                      });
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-500" /> Duplicate Agent
                </button>
                <button
                  onClick={async () => {
                    setShowMoreMenu(false);
                    if (currentAgentId) {
                      await exportAgentAsJson(currentAgentId);
                    } else {
                      const blob = new Blob([rawJsonConfig], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${agentName.toLowerCase().replace(/\s+/g, '_')}_config.json`;
                      a.click();
                    }
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" /> Export as JSON
                </button>
                {onViewCallLogs && (
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onViewCallLogs(currentAgentId);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-sky-500" /> View Call Logs
                  </button>
                )}
                <button
                  onClick={async () => {
                    setShowMoreMenu(false);
                    if (currentAgentId && window.confirm('Are you sure you want to delete this agent?')) {
                      if (onDeleteAgent) {
                        await onDeleteAgent(currentAgentId);
                        onBack();
                      }
                    }
                  }}
                  disabled={!currentAgentId}
                  className="w-full text-left px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium border-t border-slate-100 dark:border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Agent
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handlePublish}
            className="px-5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all"
          >
            Publish
          </button>
        </div>
      </header>

      {/* ── 2. MAIN 3-COLUMN SPLIT STUDIO LAYOUT ──────────────────────────── */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden relative bg-slate-100/40 dark:bg-slate-950">
        {/* ── COLUMN 1: UNIVERSAL PROMPT EDITOR (LEFT 6 COLS = 50%) ──────────────────────────── */}
        <div className="col-span-6 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
          {/* Metadata Ribbon Header (Item 1: Cost/Latency/Tokens removed; Item 7: Copy Agent ID) */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-end text-[11px] text-slate-500 bg-slate-50/30 dark:bg-slate-900/30">
            <button
              onClick={() => {
                if (currentAgentId) {
                  navigator.clipboard.writeText(currentAgentId);
                  setCopiedAgentId(true);
                  setTimeout(() => setCopiedAgentId(false), 1500);
                }
              }}
              disabled={!currentAgentId}
              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              title="Copy Agent ID"
            >
              {copiedAgentId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedAgentId ? 'Copied ID' : 'Copy Agent ID'}
            </button>
          </div>

          {/* Voice, Language & Handbook Toolbar (Item 2: Model selector removed) */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap bg-slate-50/50 dark:bg-slate-900 relative">
            <div className="flex items-center gap-2">
              {/* Voice Selector (Item 4: All 30 canonical Gemini voices) */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 gap-1.5">
                <div className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 font-bold text-[9px] flex items-center justify-center">
                  {voice.charAt(0)}
                </div>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none max-w-[210px] truncate"
                >
                  {GEMINI_VOICES.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.desc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Selector (Item 3: 2-letter codes) */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Agent Handbook Button & Prompt History */}
            <div className="flex items-center gap-1 relative">
              <button
                onClick={() => setShowHandbookPopover(!showHandbookPopover)}
                className={`px-2.5 py-1 text-xs font-semibold border rounded-lg flex items-center gap-1.5 transition-all ${
                  handbookPresets.length > 0
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                Agent Handbook
                <span className="px-1.5 py-0.2 bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 rounded-full text-[10px] font-bold">
                  {handbookPresets.length}
                </span>
              </button>

              {/* Handbook Popover Panel (Item 5) */}
              {showHandbookPopover && (
                <div className="absolute right-0 top-9 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-500" />
                      <span className="font-bold text-xs">Agent Handbook Presets</span>
                    </div>
                    <button
                      onClick={() => setShowHandbookPopover(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    One-click best practice instructions appended to your system prompt at save time.
                  </p>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {HANDBOOK_PRESETS.map((preset) => {
                      const active = handbookPresets.includes(preset.id);
                      return (
                        <div
                          key={preset.id}
                          onClick={() => toggleHandbookPreset(preset.id)}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                            active
                              ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                              : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                              {preset.label}
                            </span>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border ${
                                active
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {active && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                            {preset.instruction}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Prompt History Clock Button (Item 6) */}
              <button
                onClick={() => setShowPromptHistoryPopover(!showPromptHistoryPopover)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors relative"
                title="Prompt History"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>

              {showPromptHistoryPopover && (
                <div className="absolute right-0 top-9 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 p-3 space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      <span className="font-bold text-xs">Prompt Version History</span>
                    </div>
                    <button
                      onClick={() => setShowPromptHistoryPopover(false)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 py-4 text-center space-y-1">
                    <p className="font-medium text-slate-700 dark:text-slate-300">Version 1 (Current)</p>
                    <p className="text-[10px]">No past snapshots saved in DB yet.</p>
                  </div>
                </div>
              )}
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
                    onClick={startWebsocketsTestCall}
                    className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
                  >
                    <Play className="w-4 h-4 text-indigo-600" /> Run Test
                  </button>
                ) : (
                  <button
                    onClick={stopWebsocketsTestCall}
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
          </div>
        </div>
      </div>
    </div>
  );
}
