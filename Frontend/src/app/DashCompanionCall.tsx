import React, { useState, useEffect, useRef, useCallback } from "react";
import { chatWithAgent } from "./api";
import { PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";

export function DashCompanionCall({ agentId, onEnd }: { agentId: string; onEnd: () => void }) {
  const [callState, setCallState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [transcript, setTranscript] = useState("");
  const [history, setHistory] = useState<Array<{role: 'user'|'model', text: string}>>([]);
  const [error, setError] = useState("");
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Your browser does not support Speech Recognition. Please use Chrome or Edge.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setCallState("listening");
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      setTranscript(finalTranscript || interimTranscript);
      
      if (finalTranscript) {
        handleUserSpeech(finalTranscript);
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        setError("Microphone access denied. Please allow microphone permissions.");
      }
      // If it fails because of silence, just restart if we are still active
      if (callState === "listening" && event.error !== 'not-allowed') {
        setTimeout(() => startListening(), 1000);
      }
    };

    recognition.onend = () => {
      // If it ended naturally without final transcript and we are still "listening", restart
      // (This handles natural pauses in the speech API)
      setCallState((current) => {
        if (current === "listening") {
          setTimeout(() => startListening(), 100);
        }
        return current;
      });
    };

    recognitionRef.current = recognition;
    
    return () => {
      recognition.stop();
      synthRef.current.cancel();
    };
  }, []);

  const startListening = useCallback(() => {
    try {
      if (recognitionRef.current) recognitionRef.current.start();
    } catch (e) {
      // Ignore start errors (like already started)
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      if (recognitionRef.current) recognitionRef.current.stop();
    } catch (e) {}
  }, []);

  const handleUserSpeech = async (text: string) => {
    stopListening();
    setCallState("thinking");
    setHistory(p => [...p, { role: 'user', text }]);
    
    try {
      const response = await chatWithAgent(agentId, text, history);
      setHistory(p => [...p, { role: 'model', text: response.text }]);
      speakResponse(response.text);
    } catch (err: any) {
      if (err.message && err.message.includes("Gemini API key is not configured")) {
        setError("Gemini API key is missing! Please configure it in the server's .env file as GEMINI_API_KEY, or add it to your user Profile settings.");
      } else {
        setError(err.message || "Failed to communicate with Companion.");
      }
      setCallState("idle");
    }
  };

  const speakResponse = (text: string) => {
    if (!synthRef.current) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    // You could select a specific voice here based on the agent's systemVoice
    
    utterance.onstart = () => {
      setCallState("speaking");
    };
    
    utterance.onend = () => {
      setCallState("idle");
      // Auto-resume listening after AI finishes speaking
      startListening();
    };
    
    utterance.onerror = () => {
      setCallState("idle");
      startListening();
    };

    synthRef.current.speak(utterance);
  };

  const handleStartCall = () => {
    setError("");
    startListening();
  };
  
  const handleEndCall = () => {
    stopListening();
    synthRef.current.cancel();
    onEnd();
  };

  // ── Avatar Visualization ──
  const avatarColors = {
    idle: "border-gray-200 bg-gray-50",
    listening: "border-emerald-200 bg-emerald-50",
    thinking: "border-blue-200 bg-blue-50",
    speaking: "border-purple-200 bg-purple-50"
  };

  const ringAnimation = callState === "speaking" ? "animate-ping" : 
                        callState === "listening" ? "animate-pulse" : "";

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-12">
      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm border border-red-100 max-w-md text-center">
          {error}
        </div>
      )}

      {/* The Avatar */}
      <div className="relative group flex items-center justify-center">
        {/* Animated aura */}
        <div className={`absolute inset-0 rounded-full bg-current opacity-20 ${ringAnimation} ${
          callState==="speaking" ? "text-purple-400" : callState==="listening" ? "text-emerald-400" : "text-transparent"
        }`} style={{ transform: 'scale(1.5)' }} />
        
        {/* Core Avatar */}
        <div className={`relative z-10 w-48 h-48 rounded-full border-4 flex items-center justify-center transition-all duration-500 shadow-xl overflow-hidden ${avatarColors[callState]}`}>
          <img 
            src="/tom_holland_avatar.png" 
            alt="AI Avatar" 
            className={`w-full h-full object-cover transition-transform duration-300 ${callState === "speaking" ? "scale-105 opacity-90" : "scale-100 opacity-100"}`}
            style={callState === "speaking" ? { animation: 'pulse 1s infinite' } : {}}
          />
          {callState === "thinking" && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Transcript Status */}
      <div className="h-16 flex items-center justify-center">
        <p className="text-xl font-medium text-center max-w-lg text-gray-700" style={{fontFamily:"'Figtree',sans-serif"}}>
          {callState === "listening" && !transcript && <span className="text-emerald-600 animate-pulse">Listening to you...</span>}
          {callState === "listening" && transcript && `"${transcript}"`}
          {callState === "thinking" && <span className="text-blue-500">Thinking...</span>}
          {callState === "speaking" && <span className="text-purple-600">Speaking...</span>}
          {callState === "idle" && <span className="text-gray-400">Ready to talk</span>}
        </p>
      </div>

      {/* Call Controls */}
      <div className="flex items-center gap-6">
        {callState === "idle" ? (
          <button onClick={handleStartCall} className="w-16 h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            <Mic className="w-6 h-6" />
          </button>
        ) : (
          <>
            <button onClick={() => { stopListening(); setCallState("idle"); }} className="w-12 h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full flex items-center justify-center shadow transition-transform hover:scale-105">
              <MicOff className="w-5 h-5" />
            </button>
            <button onClick={handleEndCall} className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105">
              <PhoneOff className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
