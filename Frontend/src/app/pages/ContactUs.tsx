import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Mail, Send, CheckCircle2, AlertCircle, MessageCircle 
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
    <div className="min-h-screen bg-[#E5E3DC] pt-32 pb-24 px-6 relative font-sans text-[#262523]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-[2px] font-mono bg-[#DFDCD4] text-[#121212] border border-[#CBC8BE]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#121212]" />
          ENTERPRISE PILOT & CONSULTATION
        </span>
        <h1 className="text-4xl lg:text-5xl font-extrabold text-[#121212] tracking-tight">
          Speak With an AI Voice Solutions Architect
        </h1>
        <p className="text-[#262523] text-base md:text-lg leading-relaxed max-w-xl mx-auto">
          Whether you need to slash COD courier returns, automate clinic appointment intakes, or deploy RBI-compliant EMI outreach, our engineering team will design your deployment roadmap.
        </p>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── Left Column: Inquiry Form ──────────────────────────────────── */}
        <motion.div 
          className="lg:col-span-7 bg-[#EBE9E2] rounded-[2px] p-8 md:p-10 border border-[#CBC8BE] relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {status === "success" ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-16 text-center space-y-4"
            >
              <div className="w-14 h-14 bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] flex items-center justify-center mb-2">
                <CheckCircle2 className="w-8 h-8 text-[#121212]" />
              </div>
              <h3 className="text-2xl font-bold text-[#121212]">
                Request Received!
              </h3>
              <p className="text-[#262523] max-w-md text-sm leading-relaxed">
                Thank you for detailing your voice automation requirements. A Claritiy Voice solutions architect will review your stack and contact you within 1 business day.
              </p>
              <button 
                onClick={() => setStatus("idle")}
                className="mt-6 px-6 py-2.5 rounded-[2px] bg-[#121212] text-white text-xs font-mono uppercase tracking-wider hover:bg-black transition-colors"
              >
                Submit Another Inquiry
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#121212] uppercase font-mono tracking-wider">Full Name *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Vikram Singhania"
                    className="w-full bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] px-4 py-3 text-sm text-[#121212] placeholder-[#737067] focus:outline-none focus:border-[#121212] transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#121212] uppercase font-mono tracking-wider">Work Email *</label>
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vikram@company.com"
                    className="w-full bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] px-4 py-3 text-sm text-[#121212] placeholder-[#737067] focus:outline-none focus:border-[#121212] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#121212] uppercase font-mono tracking-wider">Phone / Mobile</label>
                  <input 
                    type="tel" 
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] px-4 py-3 text-sm text-[#121212] placeholder-[#737067] focus:outline-none focus:border-[#121212] transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#121212] uppercase font-mono tracking-wider">Company / Organization</label>
                  <input 
                    type="text" 
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Acme Enterprises"
                    className="w-full bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] px-4 py-3 text-sm text-[#121212] placeholder-[#737067] focus:outline-none focus:border-[#121212] transition-colors"
                  />
                </div>
              </div>

              {/* Primary Template Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#121212] uppercase font-mono tracking-wider">
                  Primary Solution / Template of Interest
                </label>
                <select
                  value={formData.templateInterest}
                  onChange={(e) => setFormData({ ...formData, templateInterest: e.target.value })}
                  className="w-full bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] px-4 py-3 text-sm font-mono text-[#121212] focus:outline-none focus:border-[#121212] transition-colors"
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
                <label className="text-xs font-bold text-[#121212] uppercase font-mono tracking-wider">
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
                      className={`p-3 rounded-[2px] border text-left transition-colors ${
                        formData.volumeEstimate === vol.id
                          ? "bg-[#121212] text-white border-[#121212]"
                          : "bg-[#DFDCD4] border-[#CBC8BE] text-[#262523] hover:bg-[#D5D2C9]"
                      }`}
                    >
                      <span className="block font-bold text-xs font-mono">{vol.label}</span>
                      <span className={`block text-[10px] mt-0.5 ${formData.volumeEstimate === vol.id ? "text-[#CBC8BE]" : "text-[#5E5D57]"}`}>{vol.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#121212] uppercase font-mono tracking-wider">
                  Operational Context / Existing Software Stack
                </label>
                <textarea 
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Share details regarding your current phone system (e.g., Twilio, Exotel), CRM (Salesforce, HubSpot, Zoho), or specific dialect requirements..."
                  className="w-full bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] px-4 py-3 text-sm text-[#121212] placeholder-[#737067] focus:outline-none focus:border-[#121212] transition-colors resize-none"
                />
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 p-3 bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] rounded-[2px] text-xs font-mono font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={status === "loading"}
                className="w-full py-4 rounded-[2px] bg-[#121212] hover:bg-black text-white font-mono text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
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
          <div className="bg-[#EBE9E2] rounded-[2px] p-7 border border-[#CBC8BE] space-y-5">
            <h3 className="font-bold text-sm text-[#121212] font-mono uppercase tracking-wider">
              Immediate Contact Channels
            </h3>
            
            <a
              href="https://wa.me/919707337259?text=Hello%20Claritiy%20Voice%20Team%2C%20I%20would%20like%20to%20learn%20more%20about%20enterprise%20voice%20agents"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 p-4 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] hover:bg-[#D5D2C9] transition-colors group"
            >
              <div className="w-10 h-10 rounded-[2px] bg-[#121212] text-white flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-sm text-[#121212] block">WhatsApp Enterprise Desk</span>
                <span className="text-xs text-[#262523] block mt-0.5 font-mono">+91 97073 37259</span>
                <span className="text-[11px] text-[#5E5D57] block mt-1">Average response time: &lt; 15 minutes</span>
              </div>
            </a>

            <div className="flex items-start gap-4 p-4 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE]">
              <div className="w-10 h-10 rounded-[2px] bg-[#121212] text-white flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-sm text-[#121212] block">Solutions Engineering Email</span>
                <span className="text-xs text-[#262523] block mt-0.5 font-mono">support@claritiy.com</span>
                <span className="text-[11px] text-[#5E5D57] block mt-1">Detailed RFP and architecture questions</span>
              </div>
            </div>
          </div>

          {/* Operational Guarantees Card */}
          <div className="bg-[#EBE9E2] text-[#121212] rounded-[2px] p-7 border border-[#CBC8BE] space-y-4">
            <span className="text-xs font-mono font-bold text-[#121212] uppercase tracking-widest block">
              ENTERPRISE STANDARDS
            </span>
            <div className="space-y-3 text-xs text-[#262523]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0 mt-0.5" />
                <span>Zero-copy WebRTC audio with strict PII edge redaction</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0 mt-0.5" />
                <span>Full alignment with India's DPDP Act & Ministry of MSME guidelines</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0 mt-0.5" />
                <span>Pre-built templates verified against RBI Fair Practices Code</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#121212] flex-shrink-0 mt-0.5" />
                <span>Dedicated SIP trunking & 99.9% uptime SLA for high-volume accounts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
