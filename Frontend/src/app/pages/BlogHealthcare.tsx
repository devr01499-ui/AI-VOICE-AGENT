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
    <div className="min-h-screen bg-[#E5E3DC] text-[#262523] pt-28 pb-20 px-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => setPage("blog")}
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-[#121212] mb-8 px-4 py-2 bg-[#DFDCD4] rounded-[2px] border border-[#CBC8BE] hover:bg-[#D5D2C9] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Knowledge Hub
        </button>

        <motion.article 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5 }}
          className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 md:p-12 space-y-8"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-xs text-[#5E5D57] font-mono font-bold">
              <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-[#121212]" /> Healthcare Operations Team</span>
              <span>·</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#121212]" /> 5 min read</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#121212] leading-tight">
              Zero-Wait Patient Outreach: Optimizing Clinic Intake &amp; Appointment Schedules
            </h1>
          </div>

          <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-6 font-medium text-[#262523] leading-relaxed">
            <p className="text-xs font-bold text-[#121212] font-mono uppercase tracking-wider mb-2">Direct Answer Summary</p>
            HIPAA-compliant conversational AI voice agents automate clinic scheduling and follow-up reminders with zero wait times. By placing outbound calls immediately, explaining pre-op instructions, and confirming patient visit status automatically, healthcare organizations save up to 4 hours of front-desk operations daily.
          </div>

          <div className="space-y-6 text-[#262523] leading-relaxed">
            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Eliminating Phone Tag in Medical Settings</h2>
            <p>
              Patients often wait on hold or miss callbacks from clinic schedulers. Schedulers spend hours manually dialing patients to verify appointments or outline pre-treatment instructions.
            </p>
            <p>
              Claritiy Voice automates this entire outreach cycle securely, ensuring that HIPAA-compliant parameters encrypt patient data automatically.
            </p>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Actionable Benefits of Voice AI in Healthcare</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Reduce Patient No-Shows:</strong> Auto-reminders run 24 to 48 hours prior to visits, confirming attendance.</li>
              <li><strong>Pre-Treatment Instructions:</strong> Deliver preparation rules (e.g., fasting hours) consistently and query patient compliance before they arrive.</li>
            </ul>
          </div>
        </motion.article>
      </div>
    </div>
  );
}
