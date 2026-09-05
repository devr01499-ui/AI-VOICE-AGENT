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
  Pencil,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import {
  apiClient,
  getSandboxTestWsUrl,
  getValidAuthToken,
  DEFAULT_AGENT_ID,
  testAgentPrompt,
  exportAgentAsJson,
  fetchKBList,
  assignKBAgent,
  unassignKBAgent,
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

export function compilePromptWithHandbook(
  prompt: string,
  enabledPresets: string[] = [],
  direction: string = 'outbound'
): string {
  let directionText = '';
  if (direction === 'inbound') {
    directionText = "This is an inbound call — the caller reached out to you. Never introduce an unprompted sales pitch or reason for calling, as the caller already has a reason for reaching out. Open by identifying the business/agent and inviting them to share what they need. Listen for and directly address what they say before offering anything else. If they seem to be waiting or the greeting overlaps with hold time, keep the opening brief and get to 'how can I help' quickly.";
  } else if (direction === 'outbound') {
    directionText = "This is an outbound call you are initiating. Keep your opening brief and state who's calling and why within the first two sentences (people who didn't request the call have short patience). If the person sounds uninterested, busy, or asks to not be called again, acknowledge respectfully and offer to end the call or follow up later rather than pushing to continue. Never claim the person asked for this call. If asked 'how did you get my number', give an honest, direct answer if your context/prompt provides one, otherwise say a team member can follow up with that detail. Keep pitching proportionate — one clear value statement, not repeated re-pitching if the person has already responded neutrally or negatively.";
  } else if (direction === 'both') {
    directionText = "This agent handles both inbound and outbound calls. Rely on the agent's prompt and let context (how the call started) guide tone naturally without forced direction framing.";
  }

  const active = HANDBOOK_PRESETS.filter(p => enabledPresets.includes(p.id));
  let result = prompt;

  if (directionText) {
    result += `\n\n[CALL DIRECTION INSTRUCTION]\n${directionText}`;
  }

  if (active.length > 0) {
    result += `\n\n[AGENT HANDBOOK INSTRUCTIONS]\n` + active.map(p => `- ${p.instruction}`).join('\n');
  }

  return result;
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

export interface AgentFunction {
  id: string;
  name: string;
  description: string;
  type: 'custom_api' | 'end_call' | 'transfer_call' | 'send_sms' | 'check_calendar' | 'book_calendar' | 'press_digit' | 'agent_transfer';
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: string;
  parameters?: Record<string, any>;
  targetNumber?: string;
  messageTemplate?: string;
  calendarId?: string;
  digits?: string;
  targetAgentId?: string;
}

export interface PostCallExtractionField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  description: string;
  options?: string[];
}

export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  transport: 'sse' | 'http';
  apiKey?: string;
}

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
  const [direction, setDirection] = useState<'outbound' | 'inbound' | 'both'>(
    initialAgent?.direction === 'inbound' || initialAgent?.direction === 'both' ? initialAgent.direction : 'outbound'
  );
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

  // ── Accordion 1: Functions State & Modal Controls ──────────────────────────
  const [functions, setFunctions] = useState<AgentFunction[]>(() => {
    const rawCfg = initialAgent?.agentConfig;
    if (!rawCfg) return [];
    const parsed = typeof rawCfg === 'string' ? (() => { try { return JSON.parse(rawCfg); } catch { return {}; } })() : rawCfg;
    return Array.isArray(parsed?.functions) ? parsed.functions : [];
  });

  const [isFunctionModalOpen, setIsFunctionModalOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState<AgentFunction | null>(null);

  const [fnName, setFnName] = useState('');
  const [fnDesc, setFnDesc] = useState('');
  const [fnType, setFnType] = useState<AgentFunction['type']>('custom_api');
  const [fnUrl, setFnUrl] = useState('');
  const [fnMethod, setFnMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST');
  const [fnHeaders, setFnHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
  const [fnParamsJson, setFnParamsJson] = useState('{\n  "type": "OBJECT",\n  "properties": {\n    "query": {\n      "type": "STRING",\n      "description": "User search query"\n    }\n  },\n  "required": ["query"]\n}');
  const [fnTargetNumber, setFnTargetNumber] = useState('');
  const [fnMessageTemplate, setFnMessageTemplate] = useState('Thank you for calling. Here is your info: https://example.com');
  const [fnCalendarId, setFnCalendarId] = useState('primary');
  const [fnDigits, setFnDigits] = useState('1');
  const [fnTargetAgentId, setFnTargetAgentId] = useState('');
  const [fnFormError, setFnFormError] = useState<string | null>(null);

  const openAddFunctionModal = () => {
    setEditingFunction(null);
    setFnName('');
    setFnDesc('');
    setFnType('custom_api');
    setFnUrl('');
    setFnMethod('POST');
    setFnHeaders('{\n  "Content-Type": "application/json"\n}');
    setFnParamsJson('{\n  "type": "OBJECT",\n  "properties": {\n    "query": {\n      "type": "STRING",\n      "description": "User search query"\n    }\n  },\n  "required": ["query"]\n}');
    setFnTargetNumber('');
    setFnMessageTemplate('');
    setFnCalendarId('primary');
    setFnDigits('1');
    setFnTargetAgentId('');
    setFnFormError(null);
    setIsFunctionModalOpen(true);
  };

  const openEditFunctionModal = (fn: AgentFunction) => {
    setEditingFunction(fn);
    setFnName(fn.name);
    setFnDesc(fn.description);
    setFnType(fn.type);
    setFnUrl(fn.url || '');
    setFnMethod(fn.method || 'POST');
    setFnHeaders(fn.headers || '{\n  "Content-Type": "application/json"\n}');
    setFnParamsJson(fn.parameters ? JSON.stringify(fn.parameters, null, 2) : '{\n  "type": "OBJECT",\n  "properties": {}\n}');
    setFnTargetNumber(fn.targetNumber || '');
    setFnMessageTemplate(fn.messageTemplate || '');
    setFnCalendarId(fn.calendarId || 'primary');
    setFnDigits(fn.digits || '1');
    setFnTargetAgentId(fn.targetAgentId || '');
    setFnFormError(null);
    setIsFunctionModalOpen(true);
  };

  const handleSaveFunction = () => {
    if (!fnName.trim()) {
      setFnFormError('Function name is required.');
      return;
    }
    const cleanedName = fnName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanedName) {
      setFnFormError('Valid function name (alphanumeric & underscore) is required.');
      return;
    }
    if (!fnDesc.trim()) {
      setFnFormError('Function description for LLM is required.');
      return;
    }

    let parsedParameters: Record<string, any> | undefined = undefined;
    if (fnType === 'custom_api') {
      if (!fnUrl.trim()) {
        setFnFormError('URL is required for Custom API functions.');
        return;
      }
      try {
        parsedParameters = JSON.parse(fnParamsJson);
      } catch {
        setFnFormError('Invalid JSON schema format in parameters.');
        return;
      }
    }

    const updatedFn: AgentFunction = {
      id: editingFunction?.id || `fn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanedName,
      description: fnDesc.trim(),
      type: fnType,
      ...(fnType === 'custom_api' && {
        url: fnUrl.trim(),
        method: fnMethod,
        headers: fnHeaders,
        parameters: parsedParameters,
      }),
      ...(fnType === 'transfer_call' && { targetNumber: fnTargetNumber.trim() }),
      ...(fnType === 'send_sms' && { messageTemplate: fnMessageTemplate.trim() }),
      ...((fnType === 'check_calendar' || fnType === 'book_calendar') && { calendarId: fnCalendarId.trim() }),
      ...(fnType === 'press_digit' && { digits: fnDigits.trim() }),
      ...(fnType === 'agent_transfer' && { targetAgentId: fnTargetAgentId.trim() }),
    };

    setFunctions((prev) => {
      const idx = prev.findIndex((f) => f.id === updatedFn.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedFn;
        return next;
      }
      return [...prev, updatedFn];
    });

    setIsFunctionModalOpen(false);
  };

  const handleDeleteFunction = (id: string) => {
    setFunctions((prev) => prev.filter((f) => f.id !== id));
  };

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

  // ── Accordion 2: Knowledge Base State & Assign Handlers ──────────────────
  const [kbList, setKbList] = useState<ApiKnowledgeBase[]>(initialKbList);
  const [isLoadingKb, setIsLoadingKb] = useState(false);

  useEffect(() => {
    async function loadKBs() {
      try {
        setIsLoadingKb(true);
        const fetched = await fetchKBList();
        setKbList(fetched);
      } catch (err) {
        console.error('Failed to load KB list:', err);
      } finally {
        setIsLoadingKb(false);
      }
    }
    if (accordionState.kb) {
      loadKBs();
    }
  }, [accordionState.kb]);

  const toggleKbAssignment = async (kb: ApiKnowledgeBase) => {
    const isAssigned = (kb.agentIds && currentAgentId && kb.agentIds.includes(currentAgentId)) || (kb.agentId === currentAgentId);

    setKbList((prev) =>
      prev.map((item) => {
        if (item.id !== kb.id) return item;
        const currentIds = item.agentIds || (item.agentId ? [item.agentId] : []);
        const nextIds = isAssigned
          ? currentIds.filter((id) => id !== currentAgentId)
          : currentAgentId
          ? [...currentIds, currentAgentId]
          : currentIds;
        return {
          ...item,
          agentId: isAssigned ? '' : (currentAgentId || ''),
          agentIds: nextIds,
        };
      })
    );

    if (currentAgentId) {
      try {
        if (isAssigned) {
          await unassignKBAgent(kb.id, currentAgentId);
        } else {
          await assignKBAgent(kb.id, currentAgentId);
        }
      } catch (err) {
        console.error('Failed to toggle KB assignment:', err);
        const fresh = await fetchKBList();
        setKbList(fresh);
      }
    }
  };

  // ── Accordion 3: Speech Settings State ─────────────────────────────────────
  const initialSpeech = (() => {
    const raw = initialAgent?.agentConfig;
    const cfg = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    return cfg.speechSettings || {};
  })();

  const [speechSpeed, setSpeechSpeed] = useState<number>(initialSpeech.speed ?? 1.0);
  const [responsivenessMs, setResponsivenessMs] = useState<number>(initialSpeech.responsivenessMs ?? 600);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState<'HIGH' | 'LOW'>(initialSpeech.interruptionSensitivity ?? 'HIGH');
  const [backchannelingEnabled, setBackchannelingEnabled] = useState<boolean>(initialSpeech.backchanneling ?? false);
  const [speechVolume, setSpeechVolume] = useState<number>(initialSpeech.volume ?? 1.0);

  // ── Accordion 4: Realtime Transcription Settings State ─────────────────────
  const initialTranscription = (() => {
    const raw = initialAgent?.agentConfig;
    const cfg = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    return cfg.transcriptionSettings || {};
  })();

  const [boostedKeywords, setBoostedKeywords] = useState<string>(
    Array.isArray(initialTranscription.boostedKeywords)
      ? initialTranscription.boostedKeywords.join(', ')
      : typeof initialTranscription.boostedKeywords === 'string'
      ? initialTranscription.boostedKeywords
      : ''
  );
  // ── Accordion 5: Call Settings State ─────────────────────────────────────
  const initialCallSettings = (() => {
    const raw = initialAgent?.agentConfig;
    const cfg = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    return cfg.callSettings || {};
  })();

  const [ambientNoise, setAmbientNoise] = useState<string>(initialCallSettings.ambientNoise || 'None');
  const [endOnSilenceEnabled, setEndOnSilenceEnabled] = useState<boolean>(initialCallSettings.endCallOnSilenceSeconds ? true : false);
  const [endCallSilenceSec, setEndCallSilenceSec] = useState<number>(initialCallSettings.endCallOnSilenceSeconds || 30);
  const [maxCallDurationMins, setMaxCallDurationMins] = useState<number>(initialCallSettings.maxDurationSeconds ? Math.round(initialCallSettings.maxDurationSeconds / 60) : 15);
  const [voicemailEnabled, setVoicemailEnabled] = useState<boolean>(initialCallSettings.voicemailDetection?.enabled ?? false);
  const [voicemailAction, setVoicemailAction] = useState<'hangup' | 'leave_message' | 'ignore'>(initialCallSettings.voicemailDetection?.action || 'hangup');
  const [optOutKeywords, setOptOutKeywords] = useState<string>(
    Array.isArray(initialCallSettings.optOutKeywords)
      ? initialCallSettings.optOutKeywords.join(', ')
      : typeof initialCallSettings.optOutKeywords === 'string'
      ? initialCallSettings.optOutKeywords
      : 'stop, unsubscribe, do not call, remove me'
  );

  // ── Accordion 6: Post-Call Data Extraction State ───────────────────────────
  const initialPostCall = (() => {
    const raw = initialAgent?.agentConfig;
    const cfg = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    return cfg.postCallAnalysis || {};
  })();

  const [summaryPrompt, setSummaryPrompt] = useState<string>(
    initialPostCall.summaryPrompt || 'Concise two-sentence summary of the call conversation.'
  );
  const [postCallFields, setPostCallFields] = useState<PostCallExtractionField[]>(
    Array.isArray(initialPostCall.fields) ? initialPostCall.fields : []
  );

  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<'string' | 'number' | 'boolean' | 'enum'>('string');
  const [fieldDesc, setFieldDesc] = useState('');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const openAddFieldModal = () => {
    setEditingFieldId(null);
    setFieldName('');
    setFieldType('string');
    setFieldDesc('');
    setFieldOptions('');
    setFieldError(null);
    setIsFieldModalOpen(true);
  };

  const openEditFieldModal = (field: PostCallExtractionField) => {
    setEditingFieldId(field.id);
    setFieldName(field.name);
    setFieldType(field.type);
    setFieldDesc(field.description);
    setFieldOptions(field.options ? field.options.join(', ') : '');
    setFieldError(null);
    setIsFieldModalOpen(true);
  };

  const handleSaveField = () => {
    const cleanName = fieldName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanName) {
      setFieldError('Valid field name (alphanumeric & underscore) is required.');
      return;
    }
    if (!fieldDesc.trim()) {
      setFieldError('Field extraction description is required.');
      return;
    }

    const updatedField: PostCallExtractionField = {
      id: editingFieldId || `field_${Date.now()}`,
      name: cleanName,
      type: fieldType,
      description: fieldDesc.trim(),
      ...(fieldType === 'enum' && {
        options: fieldOptions.split(',').map((o) => o.trim()).filter((o) => o.length > 0),
      }),
    };

    setPostCallFields((prev) => {
      const idx = prev.findIndex((f) => f.id === updatedField.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedField;
        return next;
      }
      return [...prev, updatedField];
    });

    setIsFieldModalOpen(false);
  };

  const handleDeleteField = (id: string) => {
    setPostCallFields((prev) => prev.filter((f) => f.id !== id));
  };

  // ── Accordion 7: Security & Fallback Settings State ────────────────────────
  const initialSecurity = (() => {
    const raw = initialAgent?.agentConfig;
    const cfg = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    return cfg.securityFallback || {};
  })();

  const [piiCategories, setPiiCategories] = useState<string[]>(
    Array.isArray(initialSecurity.piiRedaction) ? initialSecurity.piiRedaction : []
  );
  const [fallbackModel, setFallbackModel] = useState<string>(initialSecurity.fallbackModel || 'models/gemini-2.5-flash-native-audio-latest');
  const [fallbackVoice, setFallbackVoice] = useState<string>(initialSecurity.fallbackVoice || 'Puck');
  const [maxRetries, setMaxRetries] = useState<number>(initialSecurity.maxRetries ?? 2);

  const togglePiiCategory = (category: string) => {
    setPiiCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  // ── Accordion 8: Webhook Settings State ────────────────────────────────────
  const initialWebhooks = (() => {
    const raw = initialAgent?.agentConfig;
    const cfg = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    return cfg.webhooks || {};
  })();

  const [webhookUrl, setWebhookUrl] = useState<string>(initialWebhooks.url || '');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(
    Array.isArray(initialWebhooks.events)
      ? initialWebhooks.events
      : ['call_started', 'call_ended', 'call_analyzed', 'transcript_updated']
  );
  const [webhookSecret, setWebhookSecret] = useState<string>(initialWebhooks.secret || '');
  const [webhookHeaders, setWebhookHeaders] = useState<Array<{ key: string; value: string }>>(
    initialWebhooks.headers
      ? Object.entries(initialWebhooks.headers).map(([key, value]) => ({ key, value: String(value) }))
      : []
  );

  const generateWebhookSecret = () => {
    const randomBytes = Array.from(window.crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    setWebhookSecret(`whsec_${randomBytes}`);
  };

  const toggleWebhookEvent = (eventKey: string) => {
    setWebhookEvents((prev) =>
      prev.includes(eventKey) ? prev.filter((e) => e !== eventKey) : [...prev, eventKey]
    );
  };

  const addHeaderRow = () => {
    setWebhookHeaders((prev) => [...prev, { key: '', value: '' }]);
  };

  const updateHeaderRow = (index: number, field: 'key' | 'value', val: string) => {
    setWebhookHeaders((prev) => {
      const next = [...prev];
      next[index][field] = val;
      return next;
    });
  };

  const removeHeaderRow = (index: number) => {
    setWebhookHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Accordion 9: MCPs State ────────────────────────────────────────────────
  const initialMcps = (() => {
    const raw = initialAgent?.agentConfig;
    const cfg = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : (raw || {});
    return cfg.mcpServers || [];
  })();

  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>(
    Array.isArray(initialMcps) ? initialMcps : []
  );

  const [isMcpModalOpen, setIsMcpModalOpen] = useState(false);
  const [editingMcpId, setEditingMcpId] = useState<string | null>(null);
  const [mcpName, setMcpName] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpTransport, setMcpTransport] = useState<'sse' | 'http'>('http');
  const [mcpApiKey, setMcpApiKey] = useState('');
  const [mcpError, setMcpError] = useState<string | null>(null);

  const openAddMcpModal = () => {
    setEditingMcpId(null);
    setMcpName('');
    setMcpUrl('');
    setMcpTransport('http');
    setMcpApiKey('');
    setMcpError(null);
    setIsMcpModalOpen(true);
  };

  const openEditMcpModal = (server: MCPServerConfig) => {
    setEditingMcpId(server.id);
    setMcpName(server.name);
    setMcpUrl(server.url);
    setMcpTransport(server.transport);
    setMcpApiKey(server.apiKey || '');
    setMcpError(null);
    setIsMcpModalOpen(true);
  };

  const handleSaveMcp = () => {
    if (!mcpName.trim()) {
      setMcpError('Server name is required.');
      return;
    }
    if (!mcpUrl.trim()) {
      setMcpError('Valid server endpoint URL is required.');
      return;
    }

    const updatedMcp: MCPServerConfig = {
      id: editingMcpId || `mcp_${Date.now()}`,
      name: mcpName.trim(),
      url: mcpUrl.trim(),
      transport: mcpTransport,
      apiKey: mcpApiKey.trim() || undefined,
    };

    setMcpServers((prev) => {
      const idx = prev.findIndex((m) => m.id === updatedMcp.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedMcp;
        return next;
      }
      return [...prev, updatedMcp];
    });

    setIsMcpModalOpen(false);
  };

  const handleDeleteMcp = (id: string) => {
    setMcpServers((prev) => prev.filter((m) => m.id !== id));
  };

  const [showHandbookPopover, setShowHandbookPopover] = useState(false);
  const [showPromptHistoryPopover, setShowPromptHistoryPopover] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copiedAgentId, setCopiedAgentId] = useState(false);

  const [testTab, setTestTab] = useState<'audio' | 'llm'>('audio');

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

      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0.1, Math.min(2.0, speechVolume));
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

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
          targetAgentId = await onEnsureSaved(getStudioPayload());
          setCurrentAgentId(targetAgentId);
        } else {
          targetAgentId = DEFAULT_AGENT_ID;
        }
      }

      const rawToken = (await getValidAuthToken()) || '';
      const wsUrl = getSandboxTestWsUrl(targetAgentId || DEFAULT_AGENT_ID, rawToken);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setTestStatus('connected');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          micStreamRef.current = stream;

          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioCtx({ sampleRate: 16000 });
          audioContextRef.current = audioCtx;

          const sourceNode = audioCtx.createMediaStreamSource(stream);

          let workletLoaded = false;
          if (audioCtx.audioWorklet) {
            try {
              const workletCode = `
                class PCMProcessor extends AudioWorkletProcessor {
                  process(inputs) {
                    const input = inputs[0];
                    if (input && input.length > 0) {
                      const channelData = input[0];
                      if (channelData && channelData.length > 0) {
                        this.port.postMessage(channelData);
                      }
                    }
                    return true;
                  }
                }
                registerProcessor('pcm-processor', PCMProcessor);
              `;
              const blob = new Blob([workletCode], { type: 'application/javascript' });
              const workletUrl = URL.createObjectURL(blob);
              await audioCtx.audioWorklet.addModule(workletUrl);
              const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');
              workletNode.port.onmessage = (e) => {
                const float32Data = e.data;
                const pcm16Buffer = floatTo16BitPCM(float32Data);
                const base64Audio = arrayBufferToBase64(pcm16Buffer);
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(
                    JSON.stringify({
                      event: 'audio',
                      data: base64Audio,
                    })
                  );
                }
              };
              sourceNode.connect(workletNode);
              workletNode.connect(audioCtx.destination);
              workletLoaded = true;
            } catch {
              workletLoaded = false;
            }
          }

          if (!workletLoaded) {
            const processorNode = audioCtx.createScriptProcessor(4096, 1, 1);
            processorNodeRef.current = processorNode;
            processorNode.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16Buffer = floatTo16BitPCM(inputData);
              const base64Audio = arrayBufferToBase64(pcm16Buffer);

              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                  JSON.stringify({
                    event: 'audio',
                    data: base64Audio,
                  })
                );
              }
            };
            sourceNode.connect(processorNode);
            processorNode.connect(audioCtx.destination);
          }
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

    let coldStartTimer: any = setTimeout(() => {
      setLlmResponses((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.sender === 'user') {
          return [...prev, { sender: 'agent', text: "Waking up the test assistant — this can take up to a minute on cold start..." }];
        }
        return prev;
      });
    }, 3000);

    try {
      const finalPrompt = compilePromptWithHandbook(systemPrompt, handbookPresets, direction);
      const res = await testAgentPrompt(finalPrompt, userMsg, history);
      clearTimeout(coldStartTimer);
      const agentReply = res?.reply || 'No response generated.';
      setLlmResponses((prev) => {
        const filtered = prev.filter(r => !r.text.startsWith("Waking up the test assistant"));
        return [...filtered, { sender: 'agent', text: agentReply }];
      });
    } catch (err: any) {
      clearTimeout(coldStartTimer);
      const errorText = err?.message || "Couldn't reach the test assistant — please try again.";
      setLlmResponses((prev) => {
        const filtered = prev.filter(r => !r.text.startsWith("Waking up the test assistant"));
        return [...filtered, { sender: 'agent', text: `Error: ${errorText}` }];
      });
    } finally {
      setIsLlmLoading(false);
    }
  }

  const toggleHandbookPreset = (id: string) => {
    setHandbookPresets((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  const getStudioPayload = () => {
    const rawCfg = initialAgent?.agentConfig;
    const initialConfig = typeof rawCfg === 'string' ? (() => { try { return JSON.parse(rawCfg); } catch { return {}; } })() : (rawCfg || {});

    const assignedKbIds = kbList
      .filter((k) => (k.agentIds && currentAgentId && k.agentIds.includes(currentAgentId)) || k.agentId === currentAgentId)
      .map((k) => k.id);

    return {
      name: agentName,
      agentType: 'prompt',
      model,
      voiceName: voice,
      systemVoice: voice,
      languageMode: language,
      direction,
      systemPrompt: compilePromptWithHandbook(systemPrompt, handbookPresets, direction),
      welcomeMessageMode,
      customWelcomeText,
      silenceStartEnabled,
      agentConfig: {
        ...initialConfig,
        handbookPresets,
        functions,
        knowledgeBaseIds: assignedKbIds,
        speechSettings: {
          speed: speechSpeed,
          responsivenessMs,
          interruptionSensitivity,
          backchanneling: backchannelingEnabled,
          volume: speechVolume,
        },
        transcriptionSettings: {
          asrProvider: 'gemini_native',
          boostedKeywords: boostedKeywords
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0),
        },
        callSettings: {
          ambientNoise,
          endCallOnSilenceSeconds: endOnSilenceEnabled ? endCallSilenceSec : 0,
          maxDurationSeconds: maxCallDurationMins * 60,
          voicemailDetection: {
            enabled: voicemailEnabled,
            action: voicemailAction,
          },
          optOutKeywords: optOutKeywords
            .split(',')
            .map((k) => k.trim())
            .filter((k) => k.length > 0),
        },
        postCallAnalysis: {
          summaryPrompt,
          fields: postCallFields,
        },
        securityFallback: {
          piiRedaction: piiCategories,
          fallbackModel,
          fallbackVoice,
          maxRetries,
        },
        webhooks: {
          url: webhookUrl.trim(),
          events: webhookEvents,
          secret: webhookSecret.trim(),
          headers: webhookHeaders.reduce((acc, h) => {
            if (h.key.trim()) acc[h.key.trim()] = h.value.trim();
            return acc;
          }, {} as Record<string, string>),
        },
        mcpServers,
      },
    };
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setPublishError(null);
      const payload = getStudioPayload();
      if (onEnsureSaved) {
        const savedId = await onEnsureSaved(payload);
        setCurrentAgentId(savedId);
      } else {
        await onSave(payload);
      }
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2000);
    } catch (err: any) {
      console.error('Failed to save agent state:', err);
      setPublishError(err?.message || 'Failed to save agent configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      setPublishError(null);
      await onSave(getStudioPayload());
    } catch (err: any) {
      console.error('Failed to publish agent:', err);
      setPublishError(err?.message || 'Failed to publish agent.');
    } finally {
      setIsPublishing(false);
    }
  };

  const rawJsonConfig = JSON.stringify(
    {
      agent_name: agentName,
      agent_type: 'single_prompt',
      model: model,
      voice_id: voice,
      language: language,
      direction: direction,
      system_prompt: compilePromptWithHandbook(systemPrompt, handbookPresets, direction),
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
                      direction,
                      systemPrompt: compilePromptWithHandbook(systemPrompt, handbookPresets, direction),
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

          {showSavedToast && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-md transition-all animate-pulse">
              Saved ✓
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing || isSaving}
            className="px-5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </header>

      {publishError && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2.5 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 z-30 flex-shrink-0">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span className="font-semibold">Save/Publish Error:</span>
            <span>{publishError}</span>
          </div>
          <button
            onClick={() => setPublishError(null)}
            className="p-1 hover:bg-rose-500/20 rounded text-rose-500 transition-colors flex items-center gap-1 text-[11px] font-medium"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" /> Dismiss
          </button>
        </div>
      )}

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

              {/* Call Direction Selector (Inbound / Outbound / Both) */}
              <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-indigo-500" />
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'outbound' | 'inbound' | 'both')}
                  className="bg-transparent text-xs font-semibold focus:outline-none"
                  title="Call Direction"
                >
                  <option value="outbound">Outbound Call</option>
                  <option value="inbound">Inbound Call</option>
                  <option value="both">Both Directions</option>
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
                <Wrench className="w-4 h-4 text-indigo-500" /> Functions ({functions.length})
              </span>
              {accordionState.functions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.functions && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>Define API tools & webhooks the agent can invoke during calls.</p>
                {functions.length === 0 ? (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center text-slate-400 italic">
                    No functions configured yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {functions.map((fn) => (
                      <div
                        key={fn.id}
                        className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
                              {fn.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 uppercase">
                              {fn.type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{fn.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditFunctionModal(fn)}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="Edit Function"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFunction(fn.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Delete Function"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={openAddFunctionModal}
                  className="w-full py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Function
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
                <BookOpen className="w-4 h-4 text-teal-500" /> Knowledge Base ({kbList.filter(k => (k.agentIds && currentAgentId && k.agentIds.includes(currentAgentId)) || k.agentId === currentAgentId).length})
              </span>
              {accordionState.kb ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.kb && (
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <p>Select documents or scraped links to provide grounded context.</p>

                {isLoadingKb ? (
                  <div className="p-3 text-center text-slate-400 italic">
                    Loading knowledge bases...
                  </div>
                ) : kbList.length === 0 ? (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center text-slate-400 italic">
                    No knowledge bases uploaded yet.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {kbList.map((kb) => {
                      const isAssigned = (kb.agentIds && currentAgentId && kb.agentIds.includes(currentAgentId)) || (kb.agentId === currentAgentId);
                      return (
                        <label
                          key={kb.id}
                          className={`p-2 rounded-lg border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isAssigned
                              ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                          }`}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(isAssigned)}
                              onChange={() => toggleKbAssignment(kb)}
                              className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500"
                            />
                            <div className="min-w-0">
                              <span className="font-semibold block truncate text-[11px]">{kb.name}</span>
                              <span className="text-[9px] text-slate-400 block">
                                {(kb.sizeChars / 1000).toFixed(1)}k chars
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
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
              <div className="mt-3 space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                {/* Speed Rate */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Speech Speed</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{speechSpeed.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={speechSpeed}
                    onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.8x Slow</span>
                    <span>1.0x Normal</span>
                    <span>1.4x Fast</span>
                  </div>
                </div>

                {/* Responsiveness / Silence Duration */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Responsiveness (Silence Window)</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{responsivenessMs}ms</span>
                  </div>
                  <input
                    type="range"
                    min="200"
                    max="1200"
                    step="50"
                    value={responsivenessMs}
                    onChange={(e) => setResponsivenessMs(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>200ms Fast</span>
                    <span>600ms Balanced</span>
                    <span>1200ms Relaxed</span>
                  </div>
                </div>

                {/* Interruption Sensitivity */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Interruption Sensitivity
                  </label>
                  <select
                    value={interruptionSensitivity}
                    onChange={(e) => setInterruptionSensitivity(e.target.value as 'HIGH' | 'LOW')}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="HIGH">High (Immediate response on user speech)</option>
                    <option value="LOW">Low (Allows short background noise without cutting off)</option>
                  </select>
                </div>

                {/* Backchanneling */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="block font-semibold text-slate-700 dark:text-slate-300">Natural Backchanneling</span>
                    <span className="text-[10px] text-slate-400">Agent uses brief acknowledgments ("mm-hmm", "I see")</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBackchannelingEnabled(!backchannelingEnabled)}
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      backchannelingEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                        backchannelingEnabled ? 'left-4.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Volume Gain */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Playback Volume</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{Math.round(speechVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speechVolume}
                    onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                    className="w-full accent-purple-600"
                  />
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
              <div className="mt-3 space-y-3 text-xs text-slate-600 dark:text-slate-400">
                {/* Active Provider Badge */}
                <div className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="font-semibold block text-slate-800 dark:text-slate-200">Gemini Native Audio ASR</span>
                    <span className="text-[10px] text-slate-400">Bi-directional Streaming (Sub-200ms latency)</span>
                  </div>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-[10px] font-medium">
                    Active
                  </span>
                </div>

                {/* Boosted Keywords List */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Boosted Keywords / Technical Vocabulary
                  </label>
                  <input
                    type="text"
                    value={boostedKeywords}
                    onChange={(e) => setBoostedKeywords(e.target.value)}
                    placeholder="e.g. Claritiy, Invisalign, Dr. Smith, Model-X (comma separated)"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Comma-separated proper nouns, brand names, or jargon to boost live speech recognition accuracy.
                  </p>
                </div>
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
              <div className="mt-3 space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                {/* Ambient Noise Track */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ambient Background Noise
                  </label>
                  <select
                    value={ambientNoise}
                    onChange={(e) => setAmbientNoise(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500"
                  >
                    <option value="None">None (Clean studio audio)</option>
                    <option value="Office / Corporate">Office / Corporate</option>
                    <option value="Coffee Shop">Coffee Shop / Busy Cafe</option>
                    <option value="Call Center">Call Center Background Chatter</option>
                  </select>
                </div>

                {/* Max Call Duration Limit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Max Call Duration Limit</span>
                    <span className="font-mono font-bold text-green-600 dark:text-green-400">{maxCallDurationMins} mins</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    value={maxCallDurationMins}
                    onChange={(e) => setMaxCallDurationMins(parseInt(e.target.value, 10))}
                    className="w-full accent-green-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1 min</span>
                    <span>30 mins</span>
                    <span>60 mins</span>
                  </div>
                </div>

                {/* End Call on Silence */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">End Call on Silence</span>
                    <button
                      type="button"
                      onClick={() => setEndOnSilenceEnabled(!endOnSilenceEnabled)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        endOnSilenceEnabled ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                          endOnSilenceEnabled ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  {endOnSilenceEnabled && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-500">Disconnect after</span>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={endCallSilenceSec}
                        onChange={(e) => setEndCallSilenceSec(parseInt(e.target.value, 10) || 30)}
                        className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500 font-mono"
                      />
                      <span className="text-[11px] text-slate-500">seconds of silence</span>
                    </div>
                  )}
                </div>

                {/* Voicemail Detection */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Answering Machine / Voicemail Detection</span>
                    <button
                      type="button"
                      onClick={() => setVoicemailEnabled(!voicemailEnabled)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${
                        voicemailEnabled ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${
                          voicemailEnabled ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                  {voicemailEnabled && (
                    <div className="mt-1">
                      <label className="block text-[10px] text-slate-400 mb-1">When Voicemail Tone / Machine Detected:</label>
                      <select
                        value={voicemailAction}
                        onChange={(e) => setVoicemailAction(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500"
                      >
                        <option value="hangup">Hang Up Immediately</option>
                        <option value="leave_message">Leave Pre-recorded / Custom Message</option>
                        <option value="ignore">Continue Normal Conversation</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* DNC Opt-Out Keywords */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Opt-Out / DNC Keywords
                  </label>
                  <input
                    type="text"
                    value={optOutKeywords}
                    onChange={(e) => setOptOutKeywords(e.target.value)}
                    placeholder="stop, unsubscribe, do not call, remove me"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Triggers polite acknowledgment and immediate call termination on match.
                  </p>
                </div>
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
                <Sliders className="w-4 h-4 text-amber-500" /> Post-Call Data Extraction ({postCallFields.length})
              </span>
              {accordionState.postCall ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.postCall && (
              <div className="mt-3 space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                {/* Custom Summary Prompt */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Call Summary Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={summaryPrompt}
                    onChange={(e) => setSummaryPrompt(e.target.value)}
                    placeholder="Custom prompt for generating call summaries..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs resize-y"
                  />
                </div>

                {/* Structured Extraction Fields */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Custom Extraction Schema</span>
                    <span className="text-[10px] text-slate-400">{postCallFields.length} field(s)</span>
                  </div>

                  {postCallFields.length === 0 ? (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center text-slate-400 italic">
                      No custom extraction fields configured.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {postCallFields.map((field) => (
                        <div
                          key={field.id}
                          className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="font-mono font-semibold text-amber-700 dark:text-amber-300 text-[11px]">{field.name}</span>
                              <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded text-[9px] font-mono">
                                {field.type}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{field.description}</p>
                            {field.type === 'enum' && field.options && field.options.length > 0 && (
                              <p className="text-[9px] font-mono text-slate-400 mt-0.5">Choices: [{field.options.join(', ')}]</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditFieldModal(field)}
                              className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                              title="Edit Field"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteField(field.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Delete Field"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={openAddFieldModal}
                    className="mt-2 w-full py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Extraction Field
                  </button>
                </div>
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
              <div className="mt-3 space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                {/* PII Redaction Categories */}
                <div>
                  <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    PII Redaction Categories (Logs & Storage)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'credit_card', label: 'Credit Cards' },
                      { id: 'ssn', label: 'SSNs' },
                      { id: 'phone', label: 'Phone Numbers' },
                      { id: 'email', label: 'Email Addresses' },
                    ].map((cat) => {
                      const isChecked = piiCategories.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePiiCategory(cat.id)}
                            className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span className="font-semibold text-[11px]">{cat.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Fallback Model */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fallback LLM Model (Failover)
                  </label>
                  <select
                    value={fallbackModel}
                    onChange={(e) => setFallbackModel(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="models/gemini-2.5-flash-native-audio-latest">Gemini 2.5 Flash Native (Default Backup)</option>
                    <option value="models/gemini-2.0-flash">Gemini 2.0 Flash</option>
                  </select>
                </div>

                {/* Fallback Voice */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fallback Voice Profile
                  </label>
                  <select
                    value={fallbackVoice}
                    onChange={(e) => setFallbackVoice(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {GEMINI_VOICES.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max Connection Retries */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Max Connection Retries</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{maxRetries} retries</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
                    className="w-full accent-rose-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0 (No retry)</span>
                    <span>2 (Recommended)</span>
                    <span>5 Max</span>
                  </div>
                </div>
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
              <div className="mt-3 space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                {/* Webhook Endpoint URL */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agent Endpoint Webhook URL
                  </label>
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/webhooks/voice"
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-[11px]"
                  />
                </div>

                {/* Event Subscriptions */}
                <div>
                  <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Subscribed Event Triggers
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'call_started', label: 'call_started' },
                      { id: 'call_ended', label: 'call_ended' },
                      { id: 'call_analyzed', label: 'call_analyzed' },
                      { id: 'transcript_updated', label: 'transcript_updated' },
                    ].map((evt) => {
                      const isSubscribed = webhookEvents.includes(evt.id);
                      return (
                        <label
                          key={evt.id}
                          className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                            isSubscribed
                              ? 'bg-sky-50/60 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSubscribed}
                            onChange={() => toggleWebhookEvent(evt.id)}
                            className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500"
                          />
                          <span className="font-mono font-semibold text-[10px]">{evt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Secret Signing Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      HMAC-SHA256 Secret Signing Key
                    </label>
                    <button
                      type="button"
                      onClick={generateWebhookSecret}
                      className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      Generate Secret
                    </button>
                  </div>
                  <input
                    type="text"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="whsec_..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono text-[11px]"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Used to generate HMAC-SHA256 signature passed in X-Claritiy-Signature header.
                  </p>
                </div>

                {/* Custom Headers Builder */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Custom Delivery Headers</span>
                    <button
                      type="button"
                      onClick={addHeaderRow}
                      className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Add Header
                    </button>
                  </div>

                  {webhookHeaders.length === 0 ? (
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center text-slate-400 italic text-[11px]">
                      No custom headers added.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {webhookHeaders.map((header, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Header (Authorization)"
                            value={header.key}
                            onChange={(e) => updateHeaderRow(idx, 'key', e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-mono text-[10px]"
                          />
                          <input
                            type="text"
                            placeholder="Value (Bearer token...)"
                            value={header.value}
                            onChange={(e) => updateHeaderRow(idx, 'value', e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 font-mono text-[10px]"
                          />
                          <button
                            type="button"
                            onClick={() => removeHeaderRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                <Radio className="w-4 h-4 text-cyan-500" /> MCPs ({mcpServers.length})
              </span>
              {accordionState.mcps ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {accordionState.mcps && (
              <div className="mt-3 space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                <p className="text-[11px] text-slate-500">
                  Connect external Model Context Protocol (MCP) servers for live dynamic tool discovery.
                </p>

                {mcpServers.length === 0 ? (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center text-slate-400 italic text-[11px]">
                    No external MCP endpoints connected.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mcpServers.map((server) => (
                      <div
                        key={server.id}
                        className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{server.name}</span>
                            <span className="px-1.5 py-0.2 bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 rounded text-[9px] font-mono uppercase">
                              {server.transport}
                            </span>
                          </div>
                          <p className="font-mono text-[10px] text-slate-500 truncate">{server.url}</p>
                          {server.apiKey && (
                            <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">
                              Auth token configured
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditMcpModal(server)}
                            className="p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                            title="Edit MCP Server"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMcp(server.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Delete MCP Server"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={openAddMcpModal}
                  className="w-full py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add MCP Server Endpoint
                </button>
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
      {/* ── FUNCTION CONFIGURE MODAL ────────────────────────────────────── */}
      {isFunctionModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {editingFunction ? 'Edit Function' : 'Add New Function'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFunctionModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {fnFormError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400 font-medium">
                  {fnFormError}
                </div>
              )}

              {/* Function Type */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Function Type
                </label>
                <select
                  value={fnType}
                  onChange={(e) => setFnType(e.target.value as AgentFunction['type'])}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="custom_api">Custom API (HTTP Request)</option>
                  <option value="end_call">End Call</option>
                  <option value="transfer_call">Transfer Call (PSTN) (Coming Soon)</option>
                  <option value="send_sms">Send SMS (Coming Soon)</option>
                  <option value="check_calendar">Check Calendar Availability</option>
                  <option value="book_calendar">Book Calendar Appointment</option>
                  <option value="press_digit">Press Digit / IVR Navigation (Coming Soon)</option>
                  <option value="agent_transfer">Transfer to Another Agent (Coming Soon)</option>
                </select>
              </div>

              {/* Function Name */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Function Name <span className="text-slate-400 font-normal">(snake_case)</span>
                </label>
                <input
                  type="text"
                  value={fnName}
                  onChange={(e) => setFnName(e.target.value)}
                  placeholder="e.g. check_inventory, end_call"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description <span className="text-slate-400 font-normal">(Instructs LLM when to invoke)</span>
                </label>
                <textarea
                  rows={2}
                  value={fnDesc}
                  onChange={(e) => setFnDesc(e.target.value)}
                  placeholder="e.g. Call this function when the user asks to check availability for an item or date."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Type-Specific Fields */}
              {fnType === 'custom_api' && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Method</label>
                      <select
                        value={fnMethod}
                        onChange={(e) => setFnMethod(e.target.value as any)}
                        className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Endpoint URL</label>
                      <input
                        type="url"
                        value={fnUrl}
                        onChange={(e) => setFnUrl(e.target.value)}
                        placeholder="https://api.yourdomain.com/v1/action"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      HTTP Headers <span className="text-slate-400 font-normal">(JSON string)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={fnHeaders}
                      onChange={(e) => setFnHeaders(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Arguments JSON Schema <span className="text-slate-400 font-normal">(Exposed to Gemini)</span>
                    </label>
                    <textarea
                      rows={5}
                      value={fnParamsJson}
                      onChange={(e) => setFnParamsJson(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-[11px] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </>
              )}

              {fnType === 'transfer_call' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Call Transfer is Coming Soon
                      </p>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        This function type is currently disabled. PSTN call bridging via Vobiz is undergoing maintenance and cannot be executed during live calls.
                      </p>
                    </div>
                  </div>
                  <div className="opacity-50 pointer-events-none">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Phone Number
                    </label>
                    <input
                      disabled
                      type="text"
                      value={fnTargetNumber}
                      placeholder="+1234567890"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {fnType === 'send_sms' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        SMS/WhatsApp Messaging is Coming Soon
                      </p>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        This function type is currently disabled. In-call text messaging via SMS or WhatsApp is undergoing maintenance and cannot be executed during live calls.
                      </p>
                    </div>
                  </div>
                  <div className="opacity-50 pointer-events-none">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Message Template
                    </label>
                    <textarea
                      disabled
                      rows={3}
                      value={fnMessageTemplate}
                      placeholder="Hi! Here is your requested information: {details}"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {(fnType === 'check_calendar' || fnType === 'book_calendar') && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Calendar ID
                  </label>
                  <input
                    type="text"
                    value={fnCalendarId}
                    onChange={(e) => setFnCalendarId(e.target.value)}
                    placeholder="primary"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {fnType === 'press_digit' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Press Digit / DTMF is Coming Soon
                      </p>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        This function type is currently disabled. DTMF key tone transmission via Vobiz is undergoing maintenance and cannot be executed during live calls.
                      </p>
                    </div>
                  </div>
                  <div className="opacity-50 pointer-events-none">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      DTMF Digits to Press
                    </label>
                    <input
                      disabled
                      type="text"
                      value={fnDigits}
                      placeholder="e.g. 1 or 123#"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {fnType === 'agent_transfer' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        Agent Transfer is Coming Soon
                      </p>
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        This function type is currently disabled. Context handoff to specialist agents is undergoing maintenance and cannot be executed during live calls.
                      </p>
                    </div>
                  </div>
                  <div className="opacity-50 pointer-events-none">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Target Agent ID
                    </label>
                    <input
                      disabled
                      type="text"
                      value={fnTargetAgentId}
                      placeholder="UUID of target agent"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFunctionModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFunction}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Function
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post-Call Extraction Field Modal ────────────────────────────────────── */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" />
                {editingFieldId ? 'Edit Extraction Field' : 'Add Extraction Field'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {fieldError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs">
                  {fieldError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Field Key Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. appointment_date, user_sentiment, interested"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
                <p className="mt-1 text-[10px] text-slate-400">Unique alphanumeric key (e.g. user_intent)</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Field Variable Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="string">String (Text response)</option>
                  <option value="number">Number (Numeric quantity or score)</option>
                  <option value="boolean">Boolean (True / False flag)</option>
                  <option value="enum">Enum (Predefined list of choices)</option>
                </select>
              </div>

              {fieldType === 'enum' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Enum Choice Options
                  </label>
                  <input
                    type="text"
                    placeholder="High, Medium, Low"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-[11px]"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Comma-separated list of allowed option values</p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Extraction Description for LLM <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Instructions for LLM on how to extract this value from transcript..."
                  value={fieldDesc}
                  onChange={(e) => setFieldDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MCP Server Endpoint Modal ────────────────────────────────────────── */}
      {isMcpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-500" />
                {editingMcpId ? 'Edit MCP Endpoint' : 'Add MCP Server Endpoint'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMcpModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {mcpError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 rounded-xl text-xs">
                  {mcpError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  MCP Server Identifier Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. CRM_Tools, Inventory_DB"
                  value={mcpName}
                  onChange={(e) => setMcpName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Endpoint URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://mcp.yourdomain.com/sse"
                  value={mcpUrl}
                  onChange={(e) => setMcpUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transport Protocol
                </label>
                <select
                  value={mcpTransport}
                  onChange={(e) => setMcpTransport(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="http">HTTP JSON-RPC POST</option>
                  <option value="sse">Server-Sent Events (SSE)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  API Auth Token (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Bearer token or secret key..."
                  value={mcpApiKey}
                  onChange={(e) => setMcpApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-[11px]"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsMcpModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMcp}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Endpoint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
