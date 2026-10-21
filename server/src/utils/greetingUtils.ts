/**
 * Centralized Greeting and Persona Utility
 * 
 * Consolidates duplicated greeting logic across AudioStreamHandler, SandboxStreamHandler,
 * and CallOrchestrator. Supports agent-level verbatim "First message" and context-appropriate
 * inbound vs outbound default greetings.
 */

export interface GreetingOptions {
  languageMode?: string | null;
  direction?: 'inbound' | 'outbound' | string | null;
  agentName?: string | null;
  businessName?: string | null;
  firstMessage?: string | null;
  isRecordingEnabled?: boolean;
}

const DEFAULT_GREETINGS_INBOUND: Record<string, string> = {
  en: 'Thank you for calling. How can I help you today?',
  hi: 'कॉल करने के लिए धन्यवाद। आज मैं आपकी क्या मदद कर सकता हूँ?',
  bn: 'কল করার জন্য ধন্যবাদ। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
  kn: 'ಕರೆ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
  ml: 'വിളിച്ചതിന് നന്ദി. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?',
  gu: 'કૉલ કરવા બદલ આભાર. આજે હું તમને કેવી રીતે મદદ કરી શકું?',
  ta: 'அழைத்ததற்கு நன்றி. இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?',
  zh: '感谢您的致电。今天我能为您做些什么？',
  ar: 'شكراً لاتصالك. كيف يمكنني مساعدتك اليوم؟',
};

const DEFAULT_GREETINGS_OUTBOUND: Record<string, string> = {
  en: 'Hello, this is an automated assistant. How can I help you today?',
  hi: 'नमस्ते, मैं एक स्वचालित सहायक बोल रहा हूँ। आज मैं आपकी क्या मदद कर सकता हूँ?',
  bn: 'হ্যালো, আমি একটি স্বয়ংক্রিয় সহকারী বলছি। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
  kn: 'ಹಲೋ, ನಾನು ಸ್ವಯಂಚಾಲಿತ ಸಹಾಯಕ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ. ಇಂದು ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
  ml: 'ഹലോ, ഇതൊരു ഓട്ടോമേറ്റഡ് അസിസ്റ്റന്റാണ്. ഇന്ന് ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?',
  gu: 'નમસ્તે, હું એક સ્વચાલિત સહાયક બોલી રહ્યો છું. આજે હું તમને કેવી રીતે મદદ કરી શકું?',
  ta: 'வணக்கம், நான் ஒரு தானியங்கி உதவியாளர். இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?',
  zh: '您好，我是自动化语音助手。今天我能为您做些什么？',
  ar: 'مرحباً، أنا مساعد صوتي آلي. كيف يمكنني مساعدتك اليوم؟',
};

export function buildGreetingText(options: GreetingOptions): string {
  const {
    languageMode = 'en',
    direction = 'outbound',
    agentName,
    businessName = 'Claritiy Voice',
    firstMessage,
    isRecordingEnabled = false,
  } = options;

  let baseGreeting = '';

  // 1. If explicit verbatim firstMessage is configured on the agent, use it directly
  if (firstMessage && firstMessage.trim()) {
    baseGreeting = firstMessage.trim();
  } else {
    const lang = (languageMode || 'en').toLowerCase().trim();
    const isOutbound = direction === 'outbound';
    const dict = isOutbound ? DEFAULT_GREETINGS_OUTBOUND : DEFAULT_GREETINGS_INBOUND;
    let template = dict[lang] || dict.en;

    if (agentName) {
      if (isOutbound) {
        template = `Hello, this is ${agentName} calling from ${businessName}. How can I assist you today?`;
      } else {
        template = `Thank you for calling ${businessName}. My name is ${agentName}, how can I help you today?`;
      }
    }

    baseGreeting = template;
  }

  // 2. Append recording notice AFTER the first greeting sentence rather than prepending/blocking
  if (isRecordingEnabled) {
    baseGreeting = `${baseGreeting} Please note this call is recorded for quality and compliance.`;
  }

  return baseGreeting;
}

export interface ResolvedGreeting {
  mode: 'agent_first' | 'user_first';
  text: string;
  silenceStart: {
    enabled: boolean;
    seconds: number;
  };
}

/**
 * Single source of truth for resolving greeting behavior across all telephony channels.
 * Hydrates and prioritizes agentConfig.greeting { mode, text, silenceStart },
 * with fallback to agent.firstMessage and localized defaults.
 */
export function resolveGreeting(
  agent: any,
  direction?: string | null,
  isRecordingEnabled: boolean = false
): ResolvedGreeting {
  let mode: 'agent_first' | 'user_first' = 'user_first';
  let text = '';
  let silenceStart = { enabled: false, seconds: 4 };

  let agentConfig: any = {};
  if (agent?.agentConfig) {
    try {
      agentConfig = typeof agent.agentConfig === 'string' ? JSON.parse(agent.agentConfig) : agent.agentConfig;
    } catch {}
  }

  const greetingConfig = agentConfig?.greeting;
  if (greetingConfig) {
    if (greetingConfig.mode === 'agent_first' || greetingConfig.mode === 'user_first') {
      mode = greetingConfig.mode;
    }
    if (typeof greetingConfig.text === 'string' && greetingConfig.text.trim()) {
      text = greetingConfig.text.trim();
    }
    if (greetingConfig.silenceStart) {
      silenceStart = {
        enabled: Boolean(greetingConfig.silenceStart.enabled),
        seconds: Math.max(2, Math.min(15, Number(greetingConfig.silenceStart.seconds) || 4)),
      };
    }
  } else if (agent?.firstMessage && agent.firstMessage.trim()) {
    mode = 'agent_first';
    text = agent.firstMessage.trim();
  }

  if (!text) {
    text = buildGreetingText({
      languageMode: agent?.languageMode,
      direction: direction || agent?.direction || 'outbound',
      agentName: agent?.name,
      businessName: 'Claritiy Voice',
      firstMessage: agent?.firstMessage,
      isRecordingEnabled: false,
    });
  }

  if (isRecordingEnabled && !text.includes('recorded for quality')) {
    text = `${text} Please note this call is recorded for quality and compliance.`;
  }

  return { mode, text, silenceStart };
}

/**
 * Returns exact model steering instruction so Gemini native-audio outputs
 * the greeting verbatim without conversational improvisation or pretending to be the user.
 */
export function formatGreetingTurnPrompt(greetingText: string): string {
  return `Please greet the caller now. Say verbatim: "${greetingText}". Do not add, change, or omit any words.`;
}

/**
 * Legacy compatibility export for SandboxStreamHandler and existing callers
 */
export function getGreetingTextForLanguage(languageMode: string | null | undefined): string {
  return buildGreetingText({ languageMode, direction: 'outbound' });
}
