import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check, Copy, Terminal, Code2, Sparkles, ArrowRight, Webhook,
  Cpu, ShieldCheck, Layers, ExternalLink, Zap, CheckCircle2,
  Workflow, BookOpen, AlertCircle, RefreshCw
} from "lucide-react";

type PlatformKey = "n8n" | "make" | "zapier" | "custom_rest" | "webhook_receiver";
type RestLang = "curl" | "node" | "python" | "go";

export default function Docs() {
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("n8n");
  const [activeRestLang, setActiveRestLang] = useState<RestLang>("curl");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  // ── Production Code Snippets for Integrations ──────────────────────────────
  const n8nWorkflowJson = `{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.claritiyvoice.com/api/v2/calls/outbound",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.CLARITIY_API_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\\n  \\"agentId\\": \\"tpl-1-receptionist\\",\\n  \\"phoneNumber\\": \\"{{ $json.phoneNumber }}\\",\\n  \\"variables\\": {\\n    \\"customerName\\": \\"{{ $json.name }}\\",\\n    \\"orderId\\": \\"{{ $json.orderId }}\\",\\n    \\"amount\\": {{ $json.amount }}\\n  }\\n}"
      },
      "id": "claritiy-call-trigger",
      "name": "Claritiy Voice Outbound Dispatch",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [460, 300]
    }
  ]
}`;

  const makeConfigSnippet = `// Make (Integromat) HTTP "Make a request" Configuration
Module: HTTP (Make a request)
URL: https://api.claritiyvoice.com/api/v2/calls/outbound
Method: POST

Headers:
  Item 1:
    Name: Authorization
    Value: Bearer YOUR_CLARITIY_API_KEY
  Item 2:
    Name: Content-Type
    Value: application/json

Body type: Raw
Content type: JSON (application/json)
Request content:
{
  "agentId": "tpl-1-receptionist",
  "phoneNumber": "{{1.customer_phone}}",
  "variables": {
    "customerName": "{{1.customer_name}}",
    "orderId": "{{1.order_id}}",
    "amount": {{1.total_amount}}
  }
}

Parse response: Yes
Timeout: 30000 ms`;

  const zapierConfigSnippet = `// Zapier "Webhooks by Zapier" Configuration
Action App: Webhooks by Zapier
Action Event: Custom Request (or POST)

Method: POST
URL: https://api.claritiyvoice.com/api/v2/calls/outbound

Data (JSON):
{
  "agentId": "tpl-1-receptionist",
  "phoneNumber": "{{step1__phone_number}}",
  "variables": {
    "customerName": "{{step1__first_name}}",
    "orderId": "{{step1__order_id}}",
    "amount": {{step1__amount}}
  }
}

Headers:
  Authorization: Bearer YOUR_CLARITIY_API_KEY
  Content-Type: application/json
  Accept: application/json`;

  const restSnippets: Record<RestLang, string> = {
    curl: `curl -X POST https://api.claritiyvoice.com/api/v2/calls/outbound \\
  -H "Authorization: Bearer claritiy_live_sec_99a81f" \\
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

const initiateOutboundCall = async () => {
  try {
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
          'Authorization': \`Bearer \${process.env.CLARITIY_API_KEY}\`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('Call Session Queued:', response.data.data.callId);
    return response.data;
  } catch (error) {
    console.error('Call Dispatch Error:', error.response?.data || error.message);
    throw error;
  }
};`,
    python: `import os
import requests

def trigger_voice_call(phone: str, customer_name: str, order_id: str, amount: float):
    url = "https://api.claritiyvoice.com/api/v2/calls/outbound"
    headers = {
        "Authorization": f"Bearer {os.environ.get('CLARITIY_API_KEY')}",
        "Content-Type": "application/json"
    }
    payload = {
        "agentId": "tpl-1-receptionist",
        "phoneNumber": phone,
        "variables": {
            "customerName": customer_name,
            "orderId": order_id,
            "amount": amount
        }
    }
    
    resp = requests.post(url, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    print("Queued Call Session:", data["data"]["callId"])
    return data`,
    go: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type OutboundPayload struct {
	AgentID     string            \`json:"agentId"\`
	PhoneNumber string            \`json:"phoneNumber"\`
	Variables   map[string]any    \`json:"variables"\`
}

func main() {
	payload := OutboundPayload{
		AgentID:     "tpl-1-receptionist",
		PhoneNumber: "+919876543210",
		Variables: map[string]any{
			"customerName": "Rahul Sharma",
			"orderId":      "ORD-9912",
			"amount":        2499,
		},
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.claritiyvoice.com/api/v2/calls/outbound", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+os.Getenv("CLARITIY_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	fmt.Println("HTTP Status:", resp.Status)
}`
  };

  const webhookReceiverSnippet = `// Node.js (Express) Webhook Signature Verification
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.CLARITIY_WEBHOOK_SECRET;

app.post('/api/webhooks/claritiy', (req, res) => {
  const signature = req.headers['x-claritiy-signature'];
  const timestamp = req.headers['x-claritiy-timestamp'];
  
  // 1. Verify HMAC SHA-256 signature
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(\`\${timestamp}.\${JSON.stringify(req.body)}\`).digest('hex');
  
  if (signature !== digest) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  // 2. Handle call events
  const { event, callId, disposition, transcript, customData } = req.body;
  
  switch (event) {
    case 'call.completed':
      console.log(\`Call \${callId} resolved with disposition: \${disposition}\`);
      // Update CRM or database
      break;
    case 'call.failed':
      console.warn(\`Call \${callId} failed. Reason: \${req.body.failureReason}\`);
      break;
    default:
      console.log('Event received:', event);
  }

  return res.status(200).json({ received: true });
});

app.listen(4000, () => console.log('Webhook server active on port 4000'));`;

  const responseJson = `{
  "success": true,
  "data": {
    "callId": "call_98a21f8b1",
    "status": "queued",
    "recipient": "+919876543210",
    "latencyQueueMs": 28,
    "timestamp": "2026-10-10T12:00:00Z"
  }
}`;

  return (
    <div className="pb-32 pt-28 text-[#0D1117] max-w-6xl mx-auto px-6 bg-[#FFFDF9] min-h-screen font-plus-jakarta">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="text-center space-y-4 mb-16">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase">
          <Terminal className="w-3.5 h-3.5 text-emerald-600" />
          DEVELOPER INTEGRATION HUB & REFERENCE
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-[#0D1117] tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
          Connect Claritiy Voice To Any Platform
        </h1>
        <p className="text-slate-500 text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-plus-jakarta">
          Production code snippets, exact HTTP configurations, and copy-paste nodes for n8n, Make, Zapier, and custom REST applications.
        </p>
      </section>

      {/* ── Platform Selection Tabs ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200 mb-8 overflow-x-auto">
        {[
          { id: "n8n", label: "n8n Workflow Node", icon: Workflow },
          { id: "make", label: "Make (Integromat)", icon: Zap },
          { id: "zapier", label: "Zapier Webhooks", icon: ExternalLink },
          { id: "custom_rest", label: "Custom REST APIs", icon: Code2 },
          { id: "webhook_receiver", label: "Webhook Receiver", icon: Webhook }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activePlatform === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActivePlatform(tab.id as PlatformKey)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap ${
                isActive 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <TabIcon className="w-4 h-4 text-emerald-400" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-12">
        {/* ── PLATFORM 1: n8n Integration ──────────────────────────────────── */}
        {activePlatform === "n8n" && (
          <div className="bg-white rounded-3xl p-8 border border-[#E8E2D9] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 font-mono text-xs font-bold">
                    n8n HTTP Node
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-800">
                    POST /api/v2/calls/outbound
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Copy and paste this JSON snippet directly into your n8n workflow canvas using <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border text-[10px]">Ctrl+V</kbd>.
                </p>
              </div>

              <button
                onClick={() => handleCopy(n8nWorkflowJson, "n8n")}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
              >
                {copiedSnippet === "n8n" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet === "n8n" ? "Copied n8n Node" : "Copy n8n Node JSON"}</span>
              </button>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">STEP 1: METHOD & URL</span>
                <p className="text-xs text-slate-600 font-plus-jakarta">
                  Set Method to <strong>POST</strong> and URL to <code>https://api.claritiyvoice.com/api/v2/calls/outbound</code>.
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">STEP 2: AUTHENTICATION</span>
                <p className="text-xs text-slate-600 font-plus-jakarta">
                  Add Header: <code>Authorization</code> with value <code>Bearer {"{{ $env.CLARITIY_API_KEY }}"}</code>.
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">STEP 3: BODY MAPPING</span>
                <p className="text-xs text-slate-600 font-plus-jakarta">
                  Map dynamic incoming payload properties like <code>{"{{ $json.phoneNumber }}"}</code> into JSON body.
                </p>
              </div>
            </div>

            {/* Code Box */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto shadow-inner">
              <pre className="leading-relaxed">{n8nWorkflowJson}</pre>
            </div>
          </div>
        )}

        {/* ── PLATFORM 2: Make (Integromat) ────────────────────────────────── */}
        {activePlatform === "make" && (
          <div className="bg-white rounded-3xl p-8 border border-[#E8E2D9] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-md bg-purple-100 text-purple-800 font-mono text-xs font-bold">
                    Make (Integromat)
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-800">
                    HTTP Module Setup
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Configure the native HTTP "Make a request" module in your Make scenario with these exact fields.
                </p>
              </div>

              <button
                onClick={() => handleCopy(makeConfigSnippet, "make")}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
              >
                {copiedSnippet === "make" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet === "make" ? "Copied Make Config" : "Copy Configuration"}</span>
              </button>
            </div>

            {/* Code Box */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto shadow-inner">
              <pre className="leading-relaxed">{makeConfigSnippet}</pre>
            </div>
          </div>
        )}

        {/* ── PLATFORM 3: Zapier Webhooks ─────────────────────────────────── */}
        {activePlatform === "zapier" && (
          <div className="bg-white rounded-3xl p-8 border border-[#E8E2D9] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-mono text-xs font-bold">
                    Zapier Action
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-800">
                    Webhooks by Zapier (Custom Request)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Use "Webhooks by Zapier" with Custom Request method to pass structured customer variables.
                </p>
              </div>

              <button
                onClick={() => handleCopy(zapierConfigSnippet, "zapier")}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
              >
                {copiedSnippet === "zapier" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet === "zapier" ? "Copied Zapier Config" : "Copy Configuration"}</span>
              </button>
            </div>

            {/* Code Box */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto shadow-inner">
              <pre className="leading-relaxed">{zapierConfigSnippet}</pre>
            </div>
          </div>
        )}

        {/* ── PLATFORM 4: Custom REST API (cURL / Node / Python / Go) ─────── */}
        {activePlatform === "custom_rest" && (
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
                {(["curl", "node", "python", "go"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveRestLang(lang)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      activeRestLang === lang
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {lang === "curl" ? "cURL" : lang === "node" ? "Node.js" : lang === "python" ? "Python" : "Go"}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Box with Copy Button */}
            <div className="relative bg-slate-900 rounded-2xl p-5 border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto shadow-inner">
              <button
                onClick={() => handleCopy(restSnippets[activeRestLang], "rest")}
                className="absolute right-4 top-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors flex items-center gap-1.5 border border-slate-700"
              >
                {copiedSnippet === "rest" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet === "rest" ? "Copied" : "Copy"}</span>
              </button>
              <pre className="leading-relaxed">{restSnippets[activeRestLang]}</pre>
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
        )}

        {/* ── PLATFORM 5: Webhook Signature Verification Receiver ─────────── */}
        {activePlatform === "webhook_receiver" && (
          <div className="bg-white rounded-3xl p-8 border border-[#E8E2D9] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-mono text-xs font-bold">
                    WEBHOOK RECEIVER
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-800">
                    HMAC SHA-256 Verification
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Authenticate incoming <code>call.completed</code>, <code>call.answered</code>, and disposition events securely.
                </p>
              </div>

              <button
                onClick={() => handleCopy(webhookReceiverSnippet, "wh")}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto"
              >
                {copiedSnippet === "wh" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet === "wh" ? "Copied Server Code" : "Copy Express Server"}</span>
              </button>
            </div>

            {/* Code Box */}
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto shadow-inner">
              <pre className="leading-relaxed">{webhookReceiverSnippet}</pre>
            </div>
          </div>
        )}

        {/* ── Status Codes Matrix ────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl p-8 border border-[#E8E2D9] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900 font-mono">
              HTTP STATUS CODE & ERROR SPECIFICATION
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs font-mono font-bold text-emerald-700 block">200 OK / 202 ACCEPTED</span>
              <p className="text-xs text-slate-600 font-plus-jakarta">Call session queued successfully. Webhook will dispatch upon termination.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs font-mono font-bold text-amber-700 block">400 BAD REQUEST</span>
              <p className="text-xs text-slate-600 font-plus-jakarta">Malformed phone number or missing required agentId template in payload.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs font-mono font-bold text-rose-700 block">401 UNAUTHORIZED</span>
              <p className="text-xs text-slate-600 font-plus-jakarta">Missing or expired API key. Ensure <code>Authorization: Bearer</code> header is set.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs font-mono font-bold text-purple-700 block">429 RATE LIMIT EXCEEDED</span>
              <p className="text-xs text-slate-600 font-plus-jakarta">Concurrent dialing threshold reached. Upgrade plan or space batch requests.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
