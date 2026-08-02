import { motion } from "motion/react";
import { Check } from "lucide-react";

export default function Docs() {
  const curlCode = `curl -X POST https://api.claritiy.com/v2/calls \\
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
    <div className="pb-32 pt-32 text-ink text-left max-w-4xl mx-auto px-6 bg-cream-bg min-h-screen">
      <section className="text-center space-y-6 mb-16">
        <h1 className="text-display text-ink">
          API &amp; Webhook Reference
        </h1>
        <p className="text-body text-ink-muted max-w-xl mx-auto">
          Trigger voice agent sessions programmatically from checkout flows, CRM hooks, or operational dispatch logs.
        </p>
      </section>

      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="space-y-12"
      >
        <div className="space-y-4">
          <h2 className="text-h2 text-ink">Initiate Outbound Call</h2>
          <p className="text-body text-ink-muted">
            Send a <code>POST</code> request to enqueue a full duplex outbound call session.
          </p>
        </div>

        {/* Code Blocks */}
        <div className="space-y-8">
          <div className="bg-forest-deep border border-forest-mid rounded-md p-6 font-mono text-small text-mint-primary overflow-x-auto relative shadow-level-2">
            <p className="text-caption font-bold mb-4 uppercase tracking-wider text-surface-white">Request Header &amp; Payload</p>
            <pre className="whitespace-pre">{curlCode}</pre>
          </div>

          <div className="bg-forest-deep border border-forest-mid rounded-md p-6 font-mono text-small text-success overflow-x-auto relative shadow-level-2">
            <p className="text-caption font-bold mb-4 uppercase tracking-wider text-surface-white">Queue Success Response</p>
            <pre className="whitespace-pre">{responseJson}</pre>
          </div>
        </div>

        {/* Integrations Section */}
        <div className="pt-20">
          <h2 className="text-h2 text-ink mb-8 text-center">No-Code Integrations</h2>
          <div className="space-y-6">
            <div className="card-soft">
              <h4 className="text-h3 text-ink mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FF4F00] text-white font-bold text-lg">Z</span>
                Zapier
              </h4>
              <p className="text-body text-ink-muted mb-4">You can easily trigger Claritiy Voice calls from any Zapier workflow using the <strong>Webhooks by Zapier</strong> app.</p>
              <ol className="list-decimal pl-6 space-y-2 text-body text-ink-muted">
                <li>In your Zap, add a <strong>Webhooks by Zapier</strong> action step.</li>
                <li>Set the Event to <strong>Custom Request</strong> or <strong>POST</strong>.</li>
                <li>Set the URL to <code className="bg-forest-deep/10 px-1 py-0.5 rounded text-forest-deep text-sm">https://api.claritiy.com/api/v2/calls/outbound</code>.</li>
                <li>Set the Payload Type to <strong>json</strong>.</li>
                <li>Under Data, add <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">agentId</code> and <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">phoneNumber</code> (mapped from your previous steps).</li>
                <li>Under Headers, add a key named <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">Authorization</code> and set the value to <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">Bearer YOUR_API_KEY</code>.</li>
              </ol>
            </div>

            <div className="card-soft">
              <h4 className="text-h3 text-ink mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8B237C] text-white font-bold text-lg">M</span>
                Make (Integromat)
              </h4>
              <p className="text-body text-ink-muted mb-4">Use the <strong>HTTP</strong> module in Make to initiate calls from your scenarios.</p>
              <ol className="list-decimal pl-6 space-y-2 text-body text-ink-muted">
                <li>Add the <strong>HTTP &gt; Make a request</strong> module.</li>
                <li>URL: <code className="bg-forest-deep/10 px-1 py-0.5 rounded text-forest-deep text-sm">https://api.claritiy.com/api/v2/calls/outbound</code></li>
                <li>Method: <strong>POST</strong></li>
                <li>Headers: Key <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">Authorization</code>, Value <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">Bearer YOUR_API_KEY</code></li>
                <li>Body type: <strong>Raw</strong></li>
                <li>Content type: <strong>JSON (application/json)</strong></li>
                <li>Request content: Enter your JSON payload mapping <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">{"{"}"agentId": "...", "phoneNumber": "..."{"}"}</code>.</li>
              </ol>
            </div>

            <div className="card-soft">
              <h4 className="text-h3 text-ink mb-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EA4335] text-white font-bold text-lg">n</span>
                n8n
              </h4>
              <p className="text-body text-ink-muted mb-4">In n8n, use the <strong>HTTP Request</strong> node to connect to the Claritiy API.</p>
              <ol className="list-decimal pl-6 space-y-2 text-body text-ink-muted">
                <li>Add an <strong>HTTP Request</strong> node.</li>
                <li>Method: <strong>POST</strong></li>
                <li>URL: <code className="bg-forest-deep/10 px-1 py-0.5 rounded text-forest-deep text-sm">https://api.claritiy.com/api/v2/calls/outbound</code></li>
                <li>Authentication: <strong>Header Auth</strong></li>
                <li>Create a new credential: Name it "Claritiy Voice", set Header to <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">Authorization</code>, Value to <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">Bearer YOUR_API_KEY</code>.</li>
                <li>Send Body: <strong>true</strong>, Body Content Type: <strong>JSON</strong></li>
                <li>Specify Body: Add <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">agentId</code> and <code className="text-sm bg-forest-deep/10 px-1 py-0.5 rounded">phoneNumber</code> as parameters.</li>
              </ol>
            </div>
          </div>
        </div>
        
        {/* FAQ Section */}
        <div className="pt-20">
          <h2 className="text-h2 text-ink mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "How does Claritiy Voice reduce COD RTO?",
                a: "Claritiy Voice places an automated confirmation call to every cash-on-delivery customer before their order is dispatched, verifying the order details and delivery address. This catches wrong numbers, changed minds, and unclear addresses before a courier is sent, which directly reduces return-to-origin (RTO) and failed delivery costs."
              },
              {
                q: "Do I need to hire a calling team to confirm COD orders?",
                a: "No. Claritiy Voice replaces or scales alongside a manual calling team with AI voice agents that call every order automatically, at any volume, without additional hiring."
              },
              {
                q: "What languages does Claritiy Voice support for COD confirmation calls?",
                a: "Claritiy Voice supports English and Hindi today, with additional Indian languages including Bengali, Kannada, Malayalam, and Gujarati, plus Mandarin and Arabic for international sellers."
              }
            ].map((faq, idx) => (
              <div key={idx} className="card-soft">
                <h4 className="text-h3 text-ink mb-2 flex items-start gap-3">
                  <Check className="w-5 h-5 text-mint-primary flex-shrink-0 mt-1" />
                  {faq.q}
                </h4>
                <p className="text-body text-ink-muted pl-8">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
