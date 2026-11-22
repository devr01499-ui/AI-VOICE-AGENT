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
              <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-[#121212]" /> Claritiy Voice Team</span>
              <span>·</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#121212]" /> 5 min read</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#121212] leading-tight">
              How Clinics Use AI Voice Agents for Appointments and Reminders
            </h1>
          </div>

          <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-6 font-medium text-[#262523] leading-relaxed">
            <p className="text-xs font-bold text-[#121212] font-mono uppercase tracking-wider mb-2">Direct Answer Summary</p>
            Clinics use AI voice agents to answer every call, share timings and fees from their own documents, book appointments on the doctor's Google Calendar and remind patients the day before. The agent never gives medical advice; it offers a call-back from the doctor instead.
          </div>

          <div className="space-y-6 text-[#262523] leading-relaxed">
            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">The problem: one receptionist, two queues</h2>
            <p>
              A receptionist has to look after the patients at the counter and the phone at the same time. In the morning rush, calls go unanswered and appointment requests are lost.
            </p>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">What the AI receptionist handles</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Every incoming call:</strong> answered in Hindi, English or the caller's language, including after hours.</li>
              <li><strong>Questions:</strong> timings, fees and preparation instructions, read from your clinic's documents.</li>
              <li><strong>Bookings:</strong> free slots checked and appointments booked on Google Calendar, within your working hours and gaps.</li>
              <li><strong>Reminders:</strong> a call the day before to confirm the patient is coming.</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Safety rules to write into the instructions</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Never diagnose or give medical advice; offer a call-back from the doctor.</li>
              <li>For chest pain or other emergencies, tell the caller to call 112 or go to the nearest hospital.</li>
              <li>Say it is an AI assistant at the start of the call.</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Patient privacy</h2>
            <p>
              Call audio travels over encrypted connections. Recording is off by default; if you switch it on, patients hear a notice, and recordings are deleted after 90 days at the latest. You can mask personal details in transcripts and choose how long call data is kept.
            </p>
          </div>
        
</motion.article>
      </div>
    </div>
  );
}
