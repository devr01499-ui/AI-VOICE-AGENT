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

interface BlogRTOProps {
  setPage: (p: Page) => void;
}

export default function BlogRTO({ setPage }: BlogRTOProps) {
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
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#121212]" /> 6 min read</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#121212] leading-tight">
              How Indian D2C Brands Can Cut COD RTO With Automated Confirmation Calls
            </h1>
          </div>

          <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-6 font-medium text-[#262523] leading-relaxed">
            <p className="text-xs font-bold text-[#121212] font-mono uppercase tracking-wider mb-2">Direct Answer Summary</p>
            Call every cash-on-delivery buyer before the parcel ships. A short automated call in Hindi, English or Hinglish confirms the buyer still wants the order, checks the address and landmark, and flags numbers that never answer. Orders that are cancelled or unreachable can be held back before you pay for shipping both ways.
          </div>

          <div className="space-y-6 text-[#262523] leading-relaxed">
            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Why COD orders come back</h2>
            <p>
              Cash on delivery is popular with Indian shoppers because they pay only when the parcel arrives. The flip side is RTO (return to origin): parcels refused at the door or never delivered. The usual reasons are simple. The buyer changed their mind, ordered on impulse, gave a wrong or incomplete address, or was not home.
            </p>
            <p>
              Every returned parcel costs you shipping twice, ties up stock for days and can damage packaging. Most of these returns can be spotted before dispatch, if someone asks the buyer.
            </p>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Why manual confirmation calls are hard to keep up</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li><strong>Timing:</strong> a calling team works office hours, so many orders are confirmed late or not at all.</li>
              <li><strong>Volume:</strong> order spikes during sales and festivals need more callers than you can hire for a few weeks.</li>
              <li><strong>Language:</strong> buyers across the country prefer Hindi, English or their regional language, often mixed.</li>
            </ol>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">How an automated confirmation call works</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Trigger:</strong> your store or OMS sends each new COD order to the agent through the Claritiy Voice API, or you upload the day's COD orders as a batch campaign.</li>
              <li><strong>Conversation:</strong> the agent calls from your +91 number, in the buyer's language, and confirms the order, the address and landmark, and a good delivery time.</li>
              <li><strong>Retries:</strong> busy and unanswered numbers are tried again automatically, up to 3 attempts at least 10 minutes apart, only between 9 am and 9 pm IST.</li>
              <li><strong>Result:</strong> confirmed, cancelled or unreachable, with any address note, goes back to your store or shipping tool through a signed webhook, so your team decides what to ship.</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">What to put in the agent's instructions</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Introduce your brand and say it is an automated call.</li>
              <li>Read out the product and the order value, and ask the buyer to confirm.</li>
              <li>Ask for a nearby landmark if the address looks incomplete.</li>
              <li>Ask for a good delivery time.</li>
              <li>If the buyer wants to cancel, accept it politely and record it.</li>
            </ol>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div className="border border-[#CBC8BE] rounded-[2px] p-5 bg-[#DFDCD4]">
                <h4 className="font-bold text-[#121212] mb-2">Q: How soon after an order is the confirmation call placed?</h4>
                <p className="text-xs text-[#262523]">A: You decide. Send each order through the API as it is created and the call is placed straight away within calling hours, or run one campaign a day for all of yesterday's COD orders.</p>
              </div>
              <div className="border border-[#CBC8BE] rounded-[2px] p-5 bg-[#DFDCD4]">
                <h4 className="font-bold text-[#121212] mb-2">Q: What if the buyer does not pick up?</h4>
                <p className="text-xs text-[#262523]">A: The number is retried automatically, up to 3 attempts at least 10 minutes apart. If it still does not answer, the order is marked unreachable so your team can decide whether to ship it.</p>
              </div>
              <div className="border border-[#CBC8BE] rounded-[2px] p-5 bg-[#DFDCD4]">
                <h4 className="font-bold text-[#121212] mb-2">Q: How much does it cost?</h4>
                <p className="text-xs text-[#262523]">A: Plans start at ₹3,799 for 750 minutes, and each answered call uses its started minutes; a short confirmation call usually uses one. Unanswered calls cost nothing.</p>
              </div>
            </div>
          </div>
        
</motion.article>
      </div>
    </div>
  );
}
