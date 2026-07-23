import { motion } from "motion/react";
import { ArrowLeft, BookOpen, Clock } from "lucide-react";

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

interface BlogHealthcareProps {
  setPage: (p: Page) => void;
}

export default function BlogHealthcare({ setPage }: BlogHealthcareProps) {
  return (
    <div className="pb-20 pt-10 text-slate-700 text-left max-w-4xl mx-auto px-6">
      <button 
        onClick={() => setPage("blog")}
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#059669] mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Blog Index
      </button>

      <motion.article 
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="space-y-8"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono font-bold">
            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-[#059669]" /> Healthcare Operations Team</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 5 min read</span>
          </div>
          <h1 className="font-sora text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
            Zero-Wait Patient Outreach: Optimizing Clinic Intake &amp; Appointment Schedules
          </h1>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 font-semibold text-slate-700 leading-relaxed font-plus-jakarta">
          <p className="text-xs font-bold text-[#059669] font-mono uppercase mb-2">Direct Answer Summary</p>
          HIPAA-compliant conversational AI voice agents automate clinic scheduling and follow-up reminders with zero wait times. By placing outbound calls immediately, explaining pre-op instructions, and confirming patient visit status automatically, healthcare organizations save up to 4 hours of front-desk operations daily.
        </div>

        <div className="space-y-6 font-plus-jakarta font-semibold text-slate-600 leading-relaxed">
          <h2 className="font-sora text-2xl font-bold text-slate-900 mt-8 mb-4">Eliminating Phone Tag in Medical Settings</h2>
          <p>
            Patients often wait on hold or miss callbacks from clinic schedulers. Schedulers spend hours manually dialing patients to verify appointments or outline pre-treatment instructions.
          </p>
          <p>
            Clarity Voice automates this entire outreach cycle securely, ensuring that HIPAA-compliant parameters encrypt patient data automatically.
          </p>

          <h2 className="font-sora text-2xl font-bold text-slate-900 mt-8 mb-4">Actionable Benefits of Voice AI in Healthcare</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Reduce Patient No-Shows:</strong> Auto-reminders run 24 to 48 hours prior to visits, confirming attendance.</li>
            <li><strong>Pre-Treatment Instructions:</strong> Deliver preparation rules (e.g., fasting hours) consistently and query patient compliance before they arrive.</li>
            <li><strong>Prescription Refill Verification:</strong> Check with chronic care patients regarding refill schedules and forward confirmation coordinates to pharmacy logs.</li>
          </ul>
        </div>
      </motion.article>
    </div>
  );
}
