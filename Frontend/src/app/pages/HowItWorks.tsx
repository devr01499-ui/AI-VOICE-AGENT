import { motion } from "motion/react";
import { Network, Volume2, ShieldAlert, Cpu } from "lucide-react";

type Page = 
  | "home" 
  | "solutions" 
  | "how-it-works" 
  | "voices" 
  | "pricing" 
  | "compare" 
  | "blog" 
  | "blog-rto" 
  | "blog-healthcare" 
  | "blog-fintech" 
  | "docs" 
  | "dashboard" 
  | "industries";

interface HowItWorksProps {
  setPage: (p: Page) => void;
}

export default function HowItWorks({ setPage }: HowItWorksProps) {
  const steps = [
    {
      icon: Network,
      title: "1. Connect Phone Channels & Webhooks",
      desc: "Provision new virtual mobile numbers instantly or link your existing Twilio, Vapi, or local SIP trunks. Set up webhooks in your CRM or ERP to trigger outbound calls automatically based on user actions."
    },
    {
      icon: Volume2,
      title: "2. Select or Clone Your Voice Persona",
      desc: "Choose from 26+ ultra-realistic HD voice personas powered by Chirp 3 architecture, or upload a clean 5-second audio sample to create a custom, branded voice clone."
    },
    {
      icon: ShieldAlert,
      title: "3. Upload Knowledge & Set Guardrails",
      desc: "Upload PDFs, policy documents, FAQ lists, or product catalogs. Define strict brand guardrails, conversation boundaries, and fallback escalation rules so the agent knows when to hand off calls."
    },
    {
      icon: Cpu,
      title: "4. Launch Full-Duplex Calls at Scale",
      desc: "Go live with a single click. Your AI agent handles hundreds or thousands of simultaneous incoming and outgoing calls with zero queue times and real-time reporting."
    }
  ];

  const webhookCode = `{
  "event": "order.created",
  "orderId": "cod_984729104",
  "currency": "INR",
  "totalAmount": 1500,
  "customer": {
    "name": "Rajesh Mehta",
    "phone": "+919876543210",
    "city": "Mumbai"
  }
}`;

  return (
    <div className="space-y-20 pb-20 pt-10 text-slate-600">
      <section className="px-6 max-w-5xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs font-semibold text-cyan-600 tracking-widest uppercase mb-4 font-mono">
            Orchestration Process
          </p>
          <h1 className="font-sora text-5xl lg:text-6xl font-extrabold leading-tight text-[#0F172A] tracking-tight">
            From Zero to Live Voice AI Agents in 4 Simple Steps
          </h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto mt-6 leading-relaxed font-plus-jakarta font-semibold">
            Integrations occur directly at API levels with zero hardware friction or server overhead.
          </p>
        </motion.div>
      </section>

      {/* Step panels sequence */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div key={idx} className="bg-white border border-[#EADEC9] rounded-2xl p-6 relative flex flex-col justify-between text-left shadow-sm">
                <div>
                  <div className="w-10 h-10 bg-emerald-50 text-[#059669] rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-sora text-base font-bold text-slate-900 mb-2">{st.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-plus-jakarta font-semibold">{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Code vs Speech Sandbox layout */}
      <section className="px-6 max-w-5xl mx-auto">
        <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 shadow-sm">
          <h3 className="font-sora text-2xl font-extrabold text-slate-900 mb-6 text-center">
            Dynamic Webhook &amp; Dialogue Flow
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Left: JSON */}
            <div className="bg-slate-900 rounded-2xl p-5 text-left text-xs font-mono text-[#10B981] overflow-x-auto border border-slate-800">
              <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider">Incoming Webhook Payload</p>
              <pre className="whitespace-pre">{webhookCode}</pre>
            </div>
            {/* Right: dialogue */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-[#EADEC9]/65 flex flex-col justify-between text-left">
              <div>
                <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-wider">Natural Voice Transcription</p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <span className="text-xs font-bold text-[#059669]">AI Agent:</span>
                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                      "नमस्ते राजेश जी, मैं क्लैरिटी वॉइस से बात कर रही हूँ। आपने १५०० रुपये का ऑर्डर प्लेस किया है, क्या आप इसे कन्फर्म करना चाहते हैं?"
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs font-bold text-slate-600">Customer:</span>
                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                      "हाँ जी, बिल्कुल। ऑर्डर भेज दीजिए।"
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setPage("dashboard")}
                className="mt-6 w-full bg-gradient-to-r from-[#059669] to-[#10B981] text-white font-bold text-xs py-3 rounded-full hover:shadow-lg transition-all text-center"
              >
                Go Live With This Workflow
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
