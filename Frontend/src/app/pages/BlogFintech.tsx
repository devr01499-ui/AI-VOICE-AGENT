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
            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-[#059669]" /> Fintech Recovery Team</span>
            <span>·</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 8 min read</span>
          </div>
          <h1 className="font-sora text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
            Negotiating EMIs Empathetically: AI Voice Agents in Financial Payment Recovery
          </h1>
        </div>

        <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 font-semibold text-slate-700 leading-relaxed font-plus-jakarta">
          <p className="text-xs font-bold text-[#059669] font-mono uppercase mb-2">Direct Answer Summary</p>
          Financial institutions automate EMI outreach and payment collections by deploying warm, empathetic AI voice agents. By offering natural language interactions and negotiating payment schedules respectfully, companies recover outstanding collection balances up to 25% faster while ensuring regulatory call logging compliance.
        </div>

        <div className="space-y-6 font-plus-jakarta font-semibold text-slate-600 leading-relaxed">
          <h2 className="font-sora text-2xl font-bold text-slate-900 mt-8 mb-4">Balancing Customer Respect and Payment Collections</h2>
          <p>
            Traditional collection calling methods often stress consumers, resulting in call avoidance. AI voice agents present a calm, non-judgmental, and highly compliant voice option.
          </p>
          <p>
            Clarity Voice enables agents to dynamically select local languages, parsing EMI installment options, loan details, and payment gateway coordinates securely.
          </p>
        </div>
      </motion.article>
    </div>
  );
}
