import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { 
  ArrowRight, ShieldCheck, Cpu, Terminal, Database, CheckCircle2,
  PhoneCall, RefreshCw, Activity} from "lucide-react";

type Page = any;

interface HowItWorksProps {
  setPage: (p: Page) => void;
}

// ── Interactive Architecture Pipeline Engine Component ────────────────────────
function ArchitecturePipelineCanvas() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [inspectorTab, setInspectorTab] = useState<"outcome" | "protocol">("outcome");

  const pipelineSteps = [
    {
      id: "carrier",
      stepNum: "01",
      badge: "TELEPHONY GATEWAY",
      name: "Carrier Audio Ingestion",
      humanizedSummary: "When a customer dials or receives an outbound call, the carrier opens a direct bidirectional audio stream to our servers.",
      techSummary: "16 kHz 16-bit PCM streamed over a secure WebSocket in 20 ms frames, with no transcoding hops.",
      businessHighlights: [
        "Instant call pickup without IVR waiting",
        "Clear wideband voice transmission",
        "Integrated carrier network (no SIP setup needed)"
      ],
      outcomeSnippet: "Call connected. Bi-directional audio stream established.",
      protocolSpec: "Carrier call -> bidirectional audio stream -> AudioStreamSession(16kHz, PCM-L16)"
    },
    {
      id: "vad",
      stepNum: "02",
      badge: "MEDIA PROCESSING",
      name: "Listening, With Interruptions Allowed",
      humanizedSummary: "Older voice bots make callers wait until they finish talking. Claritiy Voice keeps listening the whole time, so when a customer cuts in mid-sentence the agent stops and hears them out.",
      techSummary: "Voice activity detection runs on the incoming audio throughout the call; when the caller starts speaking, the agent's pending audio is dropped.",
      businessHighlights: [
        "Conversations flow like a normal phone call",
        "Callers can interrupt at any time",
        "The agent answers the new question, not the old one"
      ],
      outcomeSnippet: "Caller speaks mid-sentence -> the agent stops and listens.",
      protocolSpec: "speech detected while agent is talking -> pending agent audio cleared"
    },
    {
      id: "reasoning",
      stepNum: "03",
      badge: "REASONING ENGINE",
      name: "Understanding and Answering From Your Data",
      humanizedSummary: "The agent follows your instructions and looks up the answer in your knowledge base. If you connected Functions or Google Calendar, it can check your systems or free slots while the caller waits.",
      techSummary: "Retrieval from your uploaded documents, plus function calls to your own APIs and the calendar during the conversation.",
      businessHighlights: [
        "Answers from your documents, not guesses",
        "Your APIs called during the call (Functions)",
        "Appointment booking on Google Calendar"
      ],
      outcomeSnippet: "Caller asks for the cleaning price -> answer taken from the clinic's price list.",
      protocolSpec: "knowledge lookup + function call (your API) -> reply"
    },
    {
      id: "synthesis",
      stepNum: "04",
      badge: "VOICE REPLY",
      name: "Speaking Back, Then Writing It Down",
      humanizedSummary: "The reply is spoken back in the voice you picked, in the caller's language. When the call ends, the transcript, summary and outcome appear in your dashboard.",
      techSummary: "Streaming speech output: audio is sent to the caller as it is generated, without waiting for the full reply. After the call, analysis runs and signed webhooks deliver the results.",
      businessHighlights: [
        "30 voices, male and female",
        "7 Indian languages plus auto-detect",
        "Transcript, summary and outcome for every call"
      ],
      outcomeSnippet: "First audio chunk streamed to the caller as soon as it is generated.",
      protocolSpec: "streamed reply audio -> call ends -> transcript + outcome -> signed webhook"
    }
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % pipelineSteps.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying, pipelineSteps.length]);

  const current = pipelineSteps[activeStep];

  return (
    <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-6 md:p-10 border border-[#CBC8BE] relative overflow-hidden font-sans">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#CBC8BE] relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#121212] animate-pulse" />
          <span className="font-mono text-xs font-bold tracking-wider text-[#121212] uppercase">
            HOW A CALL FLOWS · STAGE {current.stepNum} OF 04
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3.5 py-1.5 rounded-[2px] text-xs font-mono bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] transition-colors flex items-center gap-2 border border-[#CBC8BE] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPlaying ? "animate-spin text-[#121212]" : ""}`} />
            {isPlaying ? "Auto-Advancing" : "Paused"}
          </button>
        </div>
      </div>

      {/* 4 Steps Nav Selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-6 relative z-10">
        {pipelineSteps.map((s, idx) => {
          const isActive = idx === activeStep;
          return (
            <button
              key={s.id}
              onClick={() => {
                setActiveStep(idx);
                setIsPlaying(false);
              }}
              className={`p-4 rounded-[2px] border text-left transition-all relative overflow-hidden cursor-pointer ${
                isActive
                  ? "bg-[#DFDCD4] border-2 border-[#121212] text-[#121212] shadow-sm"
                  : "bg-[#DFDCD4] border-[#CBC8BE] text-[#262523] hover:border-[#9C998F]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-[#121212]">{s.stepNum}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-[1px] ${isActive ? "bg-[#121212] text-white font-medium" : "bg-[#EBE9E2] border border-[#CBC8BE] text-[#262523]"}`}>
                  {s.badge}
                </span>
              </div>
              <p className="font-medium text-sm text-[#121212] truncate font-sans">{s.name}</p>
            </button>
          );
        })}
      </div>

      {/* Active Stage Inspector Canvas */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10"
        >
          {/* Left Column: Humanized Context & Details */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-[2px] bg-[#EBE9E2] text-[#121212] border border-[#CBC8BE] flex items-center justify-center font-mono font-bold text-xs">
                {current.stepNum}
              </span>
              <h3 className="text-xl md:text-2xl font-medium text-[#121212] font-sans tracking-tight">
                {current.name}
              </h3>
            </div>
            
            <p className="text-[#262523] text-sm md:text-base leading-relaxed font-sans">
              {current.humanizedSummary}
            </p>

            <div className="p-3.5 bg-[#EBE9E2] rounded-[2px] border border-[#CBC8BE] font-mono text-xs text-[#262523]">
              <span className="text-[#121212] font-bold block mb-1">UNDER THE HOOD:</span>
              {current.techSummary}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {current.businessHighlights.map((hl, i) => (
                <div key={i} className="flex items-start gap-2 bg-[#EBE9E2] p-2.5 rounded-[2px] border border-[#CBC8BE] text-xs text-[#121212] font-sans">
                  <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0 mt-0.5" />
                  <span className="leading-tight">{hl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Interactive Inspector (Outcome vs Protocol) */}
          <div className="lg:col-span-5 bg-[#EBE9E2] rounded-[2px] p-6 border border-[#CBC8BE] flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-[#CBC8BE] pb-3">
              <div className="flex items-center gap-1.5 bg-[#DFDCD4] p-1 rounded-[2px] border border-[#CBC8BE]">
                <button
                  onClick={() => setInspectorTab("outcome")}
                  className={`px-3 py-1 text-xs font-mono rounded-[1px] transition-colors cursor-pointer ${
                    inspectorTab === "outcome"
                      ? "bg-[#121212] text-white"
                      : "text-[#262523] hover:text-[#121212]"
                  }`}
                >
                  Outcome
                </button>
                <button
                  onClick={() => setInspectorTab("protocol")}
                  className={`px-3 py-1 text-xs font-mono rounded-[1px] transition-colors cursor-pointer ${
                    inspectorTab === "protocol"
                      ? "bg-[#121212] text-white"
                      : "text-[#262523] hover:text-[#121212]"
                  }`}
                >
                  Protocol
                </button>
              </div>
              <span className="text-[10px] font-mono text-[#121212] bg-[#DFDCD4] px-2 py-0.5 rounded-[1px] border border-[#CBC8BE]">
                LIVE INSPECT
              </span>
            </div>

            <div className="min-h-[110px] flex items-center justify-center p-4 bg-[#DFDCD4] rounded-[2px] border border-[#CBC8BE] font-mono text-xs">
              {inspectorTab === "outcome" ? (
                <div className="space-y-2 w-full">
                  <span className="text-[10px] text-[#262523] uppercase tracking-wider block">STATE OUTCOME</span>
                  <p className="text-[#121212] font-medium leading-relaxed font-sans">{current.outcomeSnippet}</p>
                </div>
              ) : (
                <div className="space-y-2 w-full">
                  <span className="text-[10px] text-[#262523] uppercase tracking-wider block">RAW WIRE SPEC</span>
                  <p className="text-[#121212] font-mono break-all">{current.protocolSpec}</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#CBC8BE] flex items-center justify-between text-xs font-mono text-[#262523]">
              <span>STATUS:</span>
              <span className="text-[#121212] font-bold">STAGE READY</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function HowItWorks({ setPage }: HowItWorksProps) {
  const threeSteps = [
    {
      step: "01",
      title: "Call Initiated or Answered",
      desc: "Inbound call rings or outbound campaign dials. Call connected over the carrier with no IVR menus.",
      icon: PhoneCall
    },
    {
      step: "02",
      title: "Live Conversational Intelligence",
      desc: "The customer speaks naturally, in their own language or in Hinglish. The agent listens, lets them interrupt, and answers from your instructions and documents.",
      icon: Activity
    },
    {
      step: "03",
      title: "Outcome Recorded",
      desc: "Appointment booked, order confirmed or reminder delivered. The transcript, summary and outcome land in your dashboard and, if you set one up, in your own system by signed webhook.",
      icon: CheckCircle2
    }
  ];

  // How each stage works. No millisecond figures: none are published until measured on live calls
  // (docs/COMPLIANCE_NOTES.md, "Marketing claims").
  const latencyBreakdown = [
    { phase: "Call audio in and out", target: "Streamed", tech: "Two-way audio stream between the phone network and our servers" },
    { phase: "Hearing the caller", target: "Continuous", tech: "Voice activity detection lets the caller interrupt at any time" },
    { phase: "Understanding and replying", target: "One model", tech: "A single speech-to-speech model, with knowledge lookups and functions" },
    { phase: "Speaking the reply", target: "Streamed", tech: "Audio is sent while it is generated, not after the whole reply" }
  ];

  return (
    <div className="space-y-20 pb-32 pt-28 bg-[#E5E3DC] min-h-screen relative font-sans text-[#121212]">
      
      {/* ── Hero Header ────────────────────────────────────────────────── */}
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
        <div className="hatched-strip h-10 w-full mb-8" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono uppercase tracking-wider">
          <span>|</span>
          <span>Full-Duplex Real-Time Voice Architecture</span>
        </div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl lg:text-6xl font-normal md:font-medium text-[#121212] tracking-tight leading-[1.08] font-sans"
        >
          How Claritiy Voice Keeps Conversations Real-Time
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-[#262523] text-base md:text-lg max-w-3xl mx-auto font-sans leading-relaxed"
        >
          What happens between "hello" and the call summary in your dashboard: how the agent hears your caller, lets them interrupt, answers from your data, and records the outcome.
        </motion.p>
      </section>

      {/* ── Interactive Architecture Pipeline Visualizer ────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <ArchitecturePipelineCanvas />
      </section>

      {/* ── 3-Step Simple Conversational Journey ─────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 md:p-12 space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
              | THE CALLER EXPERIENCE
            </span>
            <h2 className="text-3xl font-medium text-[#121212] font-sans tracking-tight">
              How a Live Phone Call Flows from Start to Finish
            </h2>
            <p className="text-[#262523] text-sm font-sans">
              No robotic touchtone menus or robotic delay. Here is how your customers experience Claritiy Voice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {threeSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-6 space-y-4 hover:border-[#9C998F] transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="w-10 h-10 rounded-[2px] bg-[#EBE9E2] border border-[#CBC8BE] text-[#121212] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-2xl font-bold text-[#121212]">{step.step}</span>
                  </div>
                  <h3 className="text-base font-medium text-[#121212] font-sans">
                    {step.title}
                  </h3>
                  <p className="text-[#262523] text-xs sm:text-sm leading-relaxed font-sans">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Latency Budget & Protocol Telemetry ──────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-[#EBE9E2] text-[#121212] border border-[#CBC8BE] rounded-[2px] p-8 md:p-12 space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
              | WHAT HAPPENS DURING A CALL
            </span>
            <h2 className="text-3xl font-medium text-[#121212] font-sans tracking-tight">
              The Real-Time Audio Pipeline
            </h2>
            <p className="text-[#262523] text-sm font-sans">
              Each stage streams into the next, so the agent starts answering without waiting for whole sentences to be passed between separate services.
            </p>
          </div>

          <div className="space-y-3 pt-2 max-w-4xl mx-auto">
            {latencyBreakdown.map((item, i) => (
              <div key={i} className="bg-[#DFDCD4] p-4 rounded-[2px] border border-[#CBC8BE] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
                <div className="space-y-0.5">
                  <span className="text-xs sm:text-sm font-bold text-[#121212] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#121212]" /> {item.phase}
                  </span>
                  <p className="text-xs text-[#262523] font-sans">{item.tech}</p>
                </div>
                <div className="px-4 py-1.5 bg-[#EBE9E2] text-[#121212] border border-[#CBC8BE] rounded-[2px] font-bold text-xs font-mono text-right whitespace-nowrap">
                  {item.target}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] max-w-4xl mx-auto text-center font-mono text-xs text-[#121212]">
            SINGLE SPEECH-TO-SPEECH MODEL: no chained REST API hops
          </div>
        </div>
      </section>

      {/* ── 4 Core Architectural Pillars ─────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
            | FOUR ARCHITECTURAL PILLARS
          </span>
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
            Engineered for Production Telephony
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Cpu,
              num: "01",
              title: "Real-Time Speech Engine",
              desc: "Direct carrier audio streaming to one speech-to-speech model avoids chained REST API bottlenecks for natural response speeds."
            },
            {
              icon: Terminal,
              num: "02",
              title: "Prompt & Tool Calling",
              desc: "With Functions, the agent calls your own APIs during the call, for example to look up an order or a customer record, and it books appointments on Google Calendar."
            },
            {
              icon: Database,
              num: "03",
              title: "Knowledge Base",
              desc: "Your price lists, policies and FAQs are indexed so the agent answers from them. The Retrieval Inspector shows exactly what it would find for any question."
            },
            {
              icon: ShieldCheck,
              num: "04",
              title: "Privacy Controls",
              desc: "Optional redaction of personal details in transcripts, recording off by default with a spoken notice when on, and automatic deletion after your retention period."
            }
          ].map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-6 hover:border-[#9C998F] transition-colors"
              >
                <div className="flex justify-between items-center mb-5">
                  <div className="w-10 h-10 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] flex items-center justify-center text-[#121212]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-[#121212]">{pillar.num}</span>
                </div>
                <h3 className="font-medium text-base text-[#121212] mb-2 font-sans">
                  {pillar.title}
                </h3>
                <p className="text-[#262523] text-xs leading-relaxed font-sans">
                  {pillar.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Bottom Callout ──────────────────────────────────────────────── */}
      <section className="px-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-8 md:p-12 text-center space-y-6 border border-[#CBC8BE]">
          <h2 className="text-3xl md:text-4xl font-medium font-sans tracking-tight text-[#121212]">
            Try It With Your Own Agent
          </h2>
          <p className="text-[#262523] max-w-2xl mx-auto text-sm sm:text-base font-sans leading-relaxed">
            Create a free account, start from a template and chat with your agent in Test LLM. Talk to it out loud and place real calls once you pick a plan.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <button
              onClick={() => setPage("dashboard")}
              className="py-3 px-8 text-xs font-mono uppercase tracking-wider bg-[#121212] hover:bg-black text-white font-medium rounded-[2px] inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              Create Free Account <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage("guide")}
              className="py-3 px-8 text-xs font-mono uppercase tracking-wider bg-[#DFDCD4] hover:bg-[#D5D1C7] text-[#121212] font-medium rounded-[2px] inline-flex items-center gap-2 border border-[#CBC8BE] cursor-pointer transition-colors"
            >
              Read the Product Guide
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
