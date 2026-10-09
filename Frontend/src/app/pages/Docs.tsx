import { useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, Terminal, Code2, Sparkles, ArrowRight, Webhook, Cpu, ShieldCheck } from "lucide-react";

export default function Docs() {
  const [activeLang, setActiveLang] = useState<"curl" | "node" | "python">("curl");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const codeSnippets = {
    curl: `curl -X POST https://api.claritiyvoice.com/api/v2/calls/outbound \\
  -H "Authorization: Bearer claritiy_live_98a2..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "tpl-1-receptionist",
    "phoneNumber": "+919876543210",
    "variables": {
      "customerName": "Rahul Sharma",
      "orderId": "ORD-9912",
      "amount": 2499
    }
  }'`,
    node: `import axios from 'axios';

const response = await axios.post(
  'https://api.claritiyvoice.com/api/v2/calls/outbound',
  {
    agentId: 'tpl-1-receptionist',
    phoneNumber: '+919876543210',
    variables: {
      customerName: 'Rahul Sharma',
      orderId: 'ORD-9912',
      amount: 2499
    }
  },
  {
    headers: {
      'Authorization': 'Bearer ' + process.env.CLARITIY_API_KEY,
      'Content-Type': 'application/json'
    }
  }
);

console.log('Call Session Queued:', response.data.data.callId);`,
    python: `import os
import requests

url = "https://api.claritiyvoice.com/api/v2/calls/outbound"
headers = {
    "Authorization": f"Bearer {os.getenv('CLARITIY_API_KEY')}",
    "Content-Type": "application/json"
}
payload = {
    "agentId": "tpl-1-receptionist",
    "phoneNumber": "+919876543210",
    "variables": {
        "customerName": "Rahul Sharma",
        "orderId": "ORD-9912",
        "amount": 2499
    }
}

response = requests.post(url, json=payload, headers=headers)
print("Call Queued:", response.json()["data"]["callId"])`
  };

  const responseJson = `{
  "success": true,
  "data": {
    "callId": "call_98a21f8b1",
    "status": "queued",
    "recipient": "+919876543210",
    "latencyQueueMs": 28,
    "timestamp": "2026-10-09T18:24:00Z"
  }
}`;

  return (
    <div className="pb-32 pt-28 text-[#0D1117] max-w-5xl mx-auto px-6 bg-[#FFFDF9] min-h-screen font-plus-jakarta">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="text-center space-y-4 mb-16">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase">
          <Terminal className="w-3.5 h-3.5 text-emerald-600" />
          DEVELOPER API & WEBHOOK REFERENCE
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-[#0D1117] tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          REST APIs & Webhook Subscriptions
        </h1>
        <p className="text-slate-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          Trigger voice agent sessions programmatically from checkout flows, CRM automation hooks, or operational dispatch logs in under 5 lines of code.
        </p>
      </section>

      <div className="space-y-12">
        {/* ── Section: Outbound Call Placement ────────────────────────────── */}
        <div className="bg-white rounded-3xl p-8 border border-[#E8E2D9] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-mono text-xs font-bold">
                  POST
                </span>
                <span className="font-mono text-sm font-bold text-slate-800">
                  /api/v2/calls/outbound
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Initiate a full-duplex outbound telephony session targeting an E.164 phone number.
              </p>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-[#E8E2D9]">
              {(["curl", "node", "python"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    activeLang === lang
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {lang === "curl" ? "cURL" : lang === "node" ? "Node.js" : "Python"}
                </button>
              ))}
            </div>
          </div>

          {/* Code Box with Copy Button */}
          <div className="relative bg-slate-900 rounded-2xl p-5 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto shadow-inner">
            <button
              onClick={() => handleCopy(codeSnippets[activeLang], "req")}
              className="absolute right-4 top-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors flex items-center gap-1.5 border border-slate-700"
            >
              {copiedSnippet === "req" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSnippet === "req" ? "Copied" : "Copy"}</span>
            </button>
            <pre className="leading-relaxed">{codeSnippets[activeLang]}</pre>
          </div>

          {/* Success Response */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider block">
              QUEUE SUCCESS RESPONSE (200 OK)
            </span>
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto">
              <pre className="leading-relaxed">{responseJson}</pre>
            </div>
          </div>
        </div>

        {/* ── Section: Post-Call Disposition Webhook ──────────────────────── */}
        <div className="bg-white rounded-3xl p-8 border border-[#E8E2D9] shadow-sm space-y-6">
          <div className="space-y-1 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-mono text-xs font-bold">
                WEBHOOK
              </span>
              <span className="font-mono text-sm font-bold text-slate-800">
                call.completed
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Dispatched to your registered webhook URL upon call termination with full audit telemetry.
            </p>
          </div>

          <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto shadow-inner">
            <pre className="leading-relaxed">{`// Received by your webhook receiver
POST /your-endpoint/call-disposition
Headers: {
  "x-claritiy-signature": "sha256=9f821a...",
  "Content-Type": "application/json"
}
Body: {
  "event": "call.completed",
  "callId": "call_98a21f8b1",
  "agentId": "tpl-1-receptionist",
  "durationSeconds": 72,
  "disposition": "VERIFIED_CONFIRMED",
  "sentiment": "POSITIVE",
  "transcript": "Buyer verified delivery [REDACTED_ADDRESS].",
  "customData": {
    "orderId": "ORD-9912",
    "landmarkAdded": "Near Gate 2"
  }
}`}</pre>
          </div>
        </div>

        {/* ── Section: No-Code Automation Connectors ──────────────────────── */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              No-Code Connectors & Integrations
            </h2>
            <p className="text-slate-500 text-xs md:text-sm">
              Connect Claritiy Voice to your existing marketing, e-commerce, and CRM platforms with zero custom code.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-[#E8E2D9] shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF4F00] text-white flex items-center justify-center font-bold text-lg">
                Z
              </div>
              <h3 className="font-bold text-base text-slate-900">Zapier Webhooks</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-plus-jakarta">
                Trigger outbound verification calls directly when a new lead enters HubSpot, Facebook Lead Ads, or Google Sheets.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E8E2D9] shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B237C] text-white flex items-center justify-center font-bold text-lg">
                M
              </div>
              <h3 className="font-bold text-base text-slate-900">Make (Integromat)</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-plus-jakarta">
                Use the HTTP module to enqueue calls, parse returned appointment slots, and update Google Calendar automatically.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E8E2D9] shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#96BF48] text-white flex items-center justify-center font-bold text-lg">
                S
              </div>
              <h3 className="font-bold text-base text-slate-900">Shopify Webhooks</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-plus-jakarta">
                Subscribe to <code>orders/create</code> events to trigger Cash-on-Delivery confirmation calls within 60 seconds of checkout.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
