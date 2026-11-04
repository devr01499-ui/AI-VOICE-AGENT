import { AlertCircle } from "lucide-react";

export default function CompareTable() {
  const comparisonData = [
    {
      feature: "Per-Minute Cost (India)",
      claritiy: "₹3.99/min (Flat Rate)",
      vapi: "~₹26.50/min (Stacked provider fees)",
      retell: "~₹31.00/min (Higher for India PSTN)"
    },
    {
      feature: "End-to-End Latency",
      claritiy: "Sub-Second (Native Multimodal)",
      vapi: "800ms - 1,500ms (API pipeline lag)",
      retell: "800ms - 1,200ms (API pipeline lag)"
    },
    {
      feature: "Native Indian Languages",
      claritiy: "Native (Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Malayalam, English-IN)",
      vapi: "Limited / English-focused",
      retell: "Limited / English-focused"
    },
    {
      feature: "Pre-Built Workflows",
      claritiy: "Yes (Shopify, Healthcare, Real Estate ready)",
      vapi: "Requires building from scratch",
      retell: "Requires building from scratch"
    },
    {
      feature: "Full-Duplex Interruption",
      claritiy: "Instant Pauses (Sub-Second Response)",
      vapi: "Lagged interruption threshold",
      retell: "Configurable but latency-prone"
    },
    {
      feature: "Transparent Billing",
      claritiy: "Single Invoice in INR (₹)",
      vapi: "Stacked keys (OpenAI + ElevenLabs + Deepgram)",
      retell: "Stacked keys (OpenAI + ElevenLabs + Deepgram)"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto border border-[#CBC8BE] rounded-[2px] bg-[#EBE9E2]">
        <table className="w-full border-collapse text-left text-sm font-sans">
          <thead>
            <tr className="border-b border-[#CBC8BE] bg-[#DFDCD4] text-[#121212] font-mono text-xs uppercase tracking-wider">
              <th className="p-4 font-bold">Capability / Spec</th>
              <th className="p-4 font-bold text-[#121212]">Claritiy Voice</th>
              <th className="p-4 font-normal text-[#5E5D57]">Vapi</th>
              <th className="p-4 font-normal text-[#5E5D57]">Retell AI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CBC8BE] text-[#262523]">
            {comparisonData.map((row, idx) => (
              <tr key={idx} className="hover:bg-[#DFDCD4]/40 transition-colors">
                <td className="p-4 font-semibold text-[#121212]">{row.feature}</td>
                <td className="p-4 text-[#121212] bg-[#DFDCD4]/40 font-bold">{row.claritiy}</td>
                <td className="p-4 text-[#5E5D57]">{row.vapi}</td>
                <td className="p-4 text-[#5E5D57]">{row.retell}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked fees breakdown alert card */}
      <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-5 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-[#121212] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-[#121212] font-mono uppercase tracking-wider">Understanding "Stacked API Pricing"</h4>
          <p className="text-xs text-[#262523] leading-relaxed">
            Standard voice agents (Vapi, Retell) charge a platform orchestration fee (usually $0.15/min) and require you to connect your own API keys. You pay separately for Speech-to-Text (Deepgram), LLM reasoning (OpenAI), and Text-to-Speech (ElevenLabs). This often inflates costs above ₹25.00/min. Claritiy Voice provides a flat, all-inclusive rate of ₹3.99/min out of the box.
          </p>
        </div>
      </div>
    </div>
  );
}
