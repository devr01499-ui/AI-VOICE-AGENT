import { AlertCircle } from "lucide-react";

export default function CompareTable() {
  const comparisonData = [
    {
      feature: "Per-Minute Cost (India)",
      clarity: "₹3.99/min (Flat Rate)",
      vapi: "~₹26.50/min (Stacked provider fees)",
      retell: "~₹31.00/min (Higher for India PSTN)",
      bolna: "~₹15.00/min (Variable STT/TTS Surcharges)"
    },
    {
      feature: "End-to-End Latency",
      clarity: "< 180ms (Native Multimodal)",
      vapi: "800ms - 1,500ms (API pipeline lag)",
      retell: "800ms - 1,200ms (API pipeline lag)",
      bolna: "900ms - 1,800ms (API pipeline lag)"
    },
    {
      feature: "Native Indian Languages",
      clarity: "✅ Native (Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Malayalam, English-IN)",
      vapi: "⚠️ Limited / English-focused",
      retell: "⚠️ Limited / English-focused",
      bolna: "⚠️ Restricted regional capability"
    },
    {
      feature: "Pre-Built Workflows",
      clarity: "✅ Yes (Shopify, Healthcare, Real Estate ready)",
      vapi: "❌ Requires building from scratch",
      retell: "❌ Requires building from scratch",
      bolna: "❌ Requires building from scratch"
    },
    {
      feature: "Full-Duplex Interruption",
      clarity: "✅ Instant Pauses (<120ms response)",
      vapi: "⚠️ Lagged interruption threshold",
      retell: "⚠️ Configurable but latency-prone",
      bolna: "⚠️ Prone to voice collision overlaps"
    },
    {
      feature: "Transparent Billing",
      clarity: "✅ Single Invoice in INR (₹)",
      vapi: "❌ Stacked keys (OpenAI + ElevenLabs + Deepgram)",
      retell: "❌ Stacked keys (OpenAI + ElevenLabs + Deepgram)",
      bolna: "❌ Stacked keys (OpenAI + ElevenLabs + Deepgram)"
    }
  ];

  return (
    <div className="space-y-10">
      <div className="overflow-x-auto border border-[#EADEC9] rounded-2xl bg-white shadow-sm">
        <table className="w-full border-collapse text-left text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <thead>
            <tr className="border-b border-[#EADEC9] bg-[#FFFDF9] text-slate-700 font-mono text-xs uppercase tracking-wider">
              <th className="p-5 font-bold">Capability / Spec</th>
              <th className="p-5 font-bold text-[#059669]">Clarity Voice</th>
              <th className="p-5 font-semibold text-slate-500">Vapi</th>
              <th className="p-5 font-semibold text-slate-500">Retell AI</th>
              <th className="p-5 font-semibold text-slate-500">Bolna</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EADEC9]/55 text-slate-700">
            {comparisonData.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-5 font-bold text-slate-900">{row.feature}</td>
                <td className="p-5 text-[#059669] bg-emerald-50/20 font-bold">{row.clarity}</td>
                <td className="p-5 text-slate-600 font-semibold">{row.vapi}</td>
                <td className="p-5 text-slate-600 font-semibold">{row.retell}</td>
                <td className="p-5 text-slate-600 font-semibold">{row.bolna}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked fees breakdown alert card */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
        <AlertCircle className="w-6 h-6 text-[#D97706] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-sora text-sm font-bold text-[#D97706]">Understanding "Stacked API Pricing"</h4>
          <p className="text-xs text-slate-600 leading-relaxed font-plus-jakarta">
            Standard voice agents (Vapi, Retell, Bolna) charge a platform orchestration fee (usually $0.15/min) and require you to connect your own API keys. You pay separately for Speech-to-Text (Deepgram), LLM reasoning (OpenAI), and Text-to-Speech (ElevenLabs). This often inflates costs above ₹25.00/min. Clarity Voice provides a flat, all-inclusive rate of ₹3.99/min out of the box.
          </p>
        </div>
      </div>
    </div>
  );
}
