import { motion } from "motion/react";

export default function Docs() {
  const curlCode = `curl -X POST https://api.insightclaritiysolution.com/v2/calls \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22",
    "phoneNumber": "+919876543210",
    "languageMode": "hi",
    "voiceId": "kore"
  }'`;

  const responseJson = `{
  "status": "queued",
  "callId": "call_f9048a12bc",
  "timestamp": "2026-07-21T16:21:00Z"
}`;

  return (
    <div className="pb-20 pt-10 text-slate-700 text-left max-w-4xl mx-auto px-6 font-plus-jakarta font-semibold">
      <section className="text-center space-y-4 mb-12">
        <span className="text-[10px] font-mono tracking-widest text-[#059669] uppercase bg-[#059669]/10 border border-[#059669]/20 px-3 py-1 rounded-full font-bold">
          Developer Portal
        </span>
        <h1 className="font-sora text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
          API &amp; Webhook Reference
        </h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
          Trigger voice agent sessions programmatically from checkout checkouts, CRM hooks, or operational dispatch logs.
        </p>
      </section>

      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        <div className="space-y-4">
          <h2 className="font-sora text-2xl font-bold text-slate-900">Initiate Outbound Call</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Send a <code>POST</code> request to enqueue a full duplex outbound call session.
          </p>
        </div>

        {/* Code Blocks */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 font-mono text-xs text-emerald-400 overflow-x-auto relative">
            <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider">Request Header &amp; Payload</p>
            <pre className="whitespace-pre">{curlCode}</pre>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 font-mono text-xs text-[#10B981] overflow-x-auto relative">
            <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider">Queue Success Response</p>
            <pre className="whitespace-pre">{responseJson}</pre>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
