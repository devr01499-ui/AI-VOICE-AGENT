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

interface BlogFintechProps {
  setPage: (p: Page) => void;
}

export default function BlogFintech({ setPage }: BlogFintechProps) {
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
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#121212]" /> 8 min read</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#121212] leading-tight">
              Polite EMI Reminders With AI Voice Agents: A Practical Guide for Lenders
            </h1>
          </div>

          <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-6 font-medium text-[#262523] leading-relaxed">
            <p className="text-xs font-bold text-[#121212] font-mono uppercase tracking-wider mb-2">Direct Answer Summary</p>
            Lenders use AI voice agents to remind borrowers before an EMI is due. The agent confirms it is speaking to the borrower, states the amount and due date, asks when they will pay and records the answer, without pressure or threats. The promised date reaches your loan system automatically.
          </div>

          <div className="space-y-6 text-[#262523] leading-relaxed">
            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Why a courtesy reminder works</h2>
            <p>
              Many missed EMIs are simply forgotten. A friendly call a few days before the due date gives borrowers time to arrange funds, and it is far gentler than a recovery call after the date has passed.
            </p>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Rules every reminder call should follow</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Identity first:</strong> confirm you are speaking to the borrower before mentioning any amount. If not, end the call politely.</li>
              <li><strong>Be clear:</strong> say who is calling, that it is an automated call, and why.</li>
              <li><strong>No pressure:</strong> never threaten, shame or use words like "default" in a courtesy reminder.</li>
              <li><strong>Permitted hours:</strong> keep recovery calls within the hours RBI expects (8 am to 7 pm). Claritiy Voice campaigns never dial outside 9 am to 9 pm IST.</li>
              <li><strong>Respect opt-outs:</strong> anyone on your opt-out list is skipped automatically.</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">How to set it up in Claritiy Voice</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Start from the EMI Due-Date Reminder template and add your lender's name and helpline.</li>
              <li>In Post-Call Data Extraction, add fields for the promised payment date and any hardship mentioned.</li>
              <li>Upload the list of upcoming dues as a batch campaign, or send each loan through the API.</li>
              <li>Add a webhook so each result reaches your loan system, signed so you can verify it.</li>
            </ol>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div className="border border-[#CBC8BE] rounded-[2px] p-5 bg-[#DFDCD4]">
                <h4 className="font-bold text-[#121212] mb-2">Q: Can the agent take a payment on the call?</h4>
                <p className="text-xs text-[#262523]">A: No. It reminds and records the borrower's answer. Borrowers pay through your usual app, bank or payment link from your own system.</p>
              </div>
              <div className="border border-[#CBC8BE] rounded-[2px] p-5 bg-[#DFDCD4]">
                <h4 className="font-bold text-[#121212] mb-2">Q: What if the borrower says they are in difficulty?</h4>
                <p className="text-xs text-[#262523]">A: The agent records it and offers a call-back from your team, so a person handles the conversation about options.</p>
              </div>
            </div>
          </div>
        
</motion.article>
      </div>
    </div>
  );
}
