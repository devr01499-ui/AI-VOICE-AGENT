import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Mail, MessageSquare, Send, CheckCircle2, AlertCircle, Phone, 
  Building2, Sparkles, ShieldCheck, Clock, MessageCircle, ArrowRight 
} from "lucide-react";
import { API_BASE } from "../api";

export default function ContactUs() {
  const [formData, setFormData] = useState({ 
    name: "", 
    email: "", 
    phone: "", 
    company: "",
    templateInterest: "ecommerce",
    volumeEstimate: "growth",
    message: "" 
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/v2/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: `[Company: ${formData.company || "N/A"} | Phone: ${formData.phone || "N/A"} | Vertical: ${formData.templateInterest} | Volume: ${formData.volumeEstimate}]\n\n${formData.message}`,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }
      
      setStatus("success");
      setFormData({ 
        name: "", 
        email: "", 
        phone: "", 
        company: "",
        templateInterest: "ecommerce",
        volumeEstimate: "growth",
        message: "" 
      });
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again or reach out on WhatsApp.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] pt-32 pb-24 px-6 relative font-plus-jakarta">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full font-mono bg-[#D1FAE5] text-[#059669] border border-[#059669]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
          ENTERPRISE PILOT & CONSULTATION
        </span>
        <h1 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          Speak With an AI Voice Solutions Architect
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed max-w-xl mx-auto">
          Whether you need to slash COD courier returns, automate clinic appointment intakes, or deploy RBI-compliant EMI outreach, our engineering team will design your deployment roadmap.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* ── Left Column: Inquiry Form ──────────────────────────────────── */}
        <motion.div 
          className="lg:col-span-7 bg-white rounded-3xl p-8 md:p-10 border border-[#E8E2D9] shadow-xl relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#059669] to-[#34D399]" />
          
          {status === "success" ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center space-y-4"
            >
              <div className="w-16 h-16 bg-[#D1FAE5] rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8 text-[#059669]" />
              </div>
              <h3 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Request Received!
              </h3>
              <p className="text-slate-500 max-w-md text-sm leading-relaxed">
                Thank you for detailing your voice automation requirements. A Claritiy Voice solutions architect will review your stack and contact you within 1 business day.
              </p>
              <button 
                onClick={() => setStatus("idle")}
                className="mt-6 px-6 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Submit Another Inquiry
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wider">Full Name *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Vikram Singhania"
                    className="w-full bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wider">Work Email *</label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vikram@company.com"
                    className="w-full bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wider">Phone / Mobile</label>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wider">Company / Organization</label>
                  <input 
                    type="text" 
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Acme Enterprises"
                    className="w-full bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all"
                  />
                </div>
              </div>

              {/* Primary Template Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wider">
                  Primary Solution / Template of Interest
                </label>
                <select
                  value={formData.templateInterest}
                  onChange={(e) => setFormData({ ...formData, templateInterest: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all font-medium text-slate-700"
                >
                  <option value="ecommerce">E-Commerce COD Verification & RTO Defense (Shopify/Shiprocket)</option>
                  <option value="bfsi">BFSI & Lending (EMI Pre-Due, 1–30 DPD Collections, KYC)</option>
                  <option value="healthcare">Healthcare & Dental Intake (24/7 Receptionist, FHIR EHR)</option>
                  <option value="realestate">Real Estate Speed-to-Lead (3-second qualification & site visits)</option>
                  <option value="frontdesk">Front Desk & Incident Response (Alex & P1 Outage Triage)</option>
                  <option value="custom">Custom Enterprise Telephony & White-Label API</option>
                </select>
              </div>

              {/* Monthly Calling Volume */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wider">
                  Estimated Monthly Call Volume
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "pilot", label: "< 2,500 mins/mo", desc: "Pilot / Testing" },
                    { id: "growth", label: "2,500 – 15,000 mins/mo", desc: "Growth Tier" },
                    { id: "enterprise", label: "15,000+ mins/mo", desc: "High Volume" },
                  ].map((vol) => (
                    <button
                      type="button"
                      key={vol.id}
                      onClick={() => setFormData({ ...formData, volumeEstimate: vol.id })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        formData.volumeEstimate === vol.id
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500"
                          : "bg-[#FAF8F5] border-[#E8E2D9] text-slate-600 hover:bg-white"
                      }`}
                    >
                      <span className="block font-bold text-xs font-mono">{vol.label}</span>
                      <span className="block text-[10px] text-slate-500 mt-0.5">{vol.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] uppercase font-mono tracking-wider">
                  Operational Context / Existing Software Stack
                </label>
                <textarea 
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Share details regarding your current phone system (e.g., Twilio, Exotel), CRM (Salesforce, HubSpot, Zoho), or specific dialect requirements..."
                  className="w-full bg-[#FAF8F5] border border-[#E8E2D9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all resize-none"
                />
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={status === "loading"}
                className="w-full py-4 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
              >
                {status === "loading" ? "Submitting Inquiry..." : "Submit Pilot Request"}
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </motion.div>

        {/* ── Right Column: Trust & Direct Channels ──────────────────────── */}
        <div className="lg:col-span-5 space-y-6">
          {/* Direct Instant Channels Card */}
          <div className="bg-white rounded-3xl p-7 border border-[#E8E2D9] shadow-sm space-y-5">
            <h3 className="font-extrabold text-lg text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Immediate Contact Channels
            </h3>
            
            <a
              href="https://wa.me/919707337259?text=Hello%20Claritiy%20Voice%20Team%2C%20I%20would%20like%20to%20learn%20more%20about%20enterprise%20voice%20agents"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/70 transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-emerald-950 block">WhatsApp Enterprise Desk</span>
                <span className="text-xs text-emerald-700 block mt-0.5">+91 97073 37259</span>
                <span className="text-[11px] text-slate-500 block mt-1">Average response time: &lt; 15 minutes</span>
              </div>
            </a>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8E2D9]">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 block">Solutions Engineering Email</span>
                <span className="text-xs text-slate-600 block mt-0.5">support@claritiyvoice.com</span>
                <span className="text-[11px] text-slate-500 block mt-1">Detailed RFP and architecture questions</span>
              </div>
            </div>
          </div>

          {/* Operational Guarantees Card */}
          <div className="bg-slate-900 text-white rounded-3xl p-7 border border-slate-800 space-y-4">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block">
              ENTERPRISE STANDARDS
            </span>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Zero-copy WebRTC audio with strict PII edge redaction</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Full alignment with India's DPDP Act & Ministry of MSME guidelines</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Pre-built templates verified against RBI Fair Practices Code</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Dedicated SIP trunking & 99.9% uptime SLA for high-volume accounts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
