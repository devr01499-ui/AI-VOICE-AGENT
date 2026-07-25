import { useState } from "react";
import { motion } from "motion/react";
import { Mail, MessageSquare, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { API_BASE } from "../api";

export default function ContactUs() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
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
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }
      
      setStatus("success");
      setFormData({ name: "", email: "", message: "" });
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pt-32 pb-24 px-6 flex flex-col items-center">
      <div className="max-w-xl w-full text-center space-y-4 mb-12">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full font-mono bg-[#D1FAE5] text-[#059669] border border-[#059669]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
          GET IN TOUCH
        </span>
        <h1 className="text-4xl lg:text-5xl font-extrabold text-[#0F172A]"
          style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}>
          Contact Our Team
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed font-plus-jakarta max-w-lg mx-auto">
          Have questions about pricing, features, or compliance? Send us a message and we'll get back to you shortly.
        </p>
      </div>

      <motion.div 
        className="w-full max-w-lg bg-white rounded-3xl p-8 border border-[#EADEC9] shadow-xl shadow-[#059669]/5 relative overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#059669] to-[#34D399]" />
        
        {status === "success" ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center space-y-4"
          >
            <div className="w-16 h-16 bg-[#D1FAE5] rounded-full flex items-center justify-center mb-2">
              <CheckCircle2 className="w-8 h-8 text-[#059669]" />
            </div>
            <h3 className="text-2xl font-bold text-[#0F172A]">Message Sent!</h3>
            <p className="text-slate-500">Thank you for reaching out. We will get back to you as soon as possible.</p>
            <button 
              onClick={() => setStatus("idle")}
              className="mt-6 px-6 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Send Another Message
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[#0F172A]">Full Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className="w-full bg-[#FAF8F5] border border-[#EADEC9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[#0F172A]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@company.com"
                  className="w-full bg-[#FAF8F5] border border-[#EADEC9] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[#0F172A]">Message</label>
              <div className="relative">
                <MessageSquare className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <textarea 
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="How can we help you?"
                  className="w-full bg-[#FAF8F5] border border-[#EADEC9] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669] transition-all resize-none"
                />
              </div>
            </div>

            {status === "error" && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={status === "loading"}
              className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[#059669] text-white font-bold hover:bg-[#047857] hover:shadow-lg hover:shadow-[#059669]/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send Message
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
