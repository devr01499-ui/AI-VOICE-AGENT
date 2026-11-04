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
              <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-[#121212]" /> Claritiy Voice Logistics Team</span>
              <span>·</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#121212]" /> 6 min read</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#121212] leading-tight">
              How Indian D2C Brands Cut COD RTO Rates by 40% Using Automated AI Voice Calls
            </h1>
          </div>

          <div className="bg-[#DFDCD4] border border-[#CBC8BE] rounded-[2px] p-6 font-medium text-[#262523] leading-relaxed">
            <p className="text-xs font-bold text-[#121212] font-mono uppercase tracking-wider mb-2">Direct Answer Summary</p>
            Indian D2C brands reduce Return-to-Origin (RTO) costs on Cash-on-Delivery (COD) orders by placing automated AI voice calls within 60 seconds of checkout. By verifying address accuracy, landmark details, and buyer confirmation in the customer's regional language before dispatching couriers, brands filter out impulse purchases and invalid addresses, cutting reverse logistics expenses by up to 40%.
          </div>

          <div className="space-y-6 text-[#262523] leading-relaxed">
            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">The Real Cost of RTO for Indian E-Commerce</h2>
            <p>
              For D2C brands operating in India, Cash-on-Delivery accounts for 60% to 75% of total order volume. However, unconfirmed COD orders carry a hidden tax: an average RTO rate of 20% to 35%.
            </p>
            <p>
              Every returned parcel costs a brand double shipping fees, packaging damage, inventory lockup, and operational overhead—often wiping out net profit margins entirely.
            </p>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Why Manual Calling Teams Fail to Scale</h2>
            <p>
              Historically, brands hired manual call centers to verify COD orders. However, human calling teams face three massive structural bottlenecks:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li><strong>Delayed Outreach:</strong> Calling hours or days after checkout allows impulse buyers to change their minds.</li>
              <li><strong>High Payroll Overhead:</strong> Scaling a calling team to handle 10,000 monthly orders requires massive headcount expenses.</li>
              <li><strong>Language Barriers:</strong> Agents often struggle to converse in local regional dialects across diverse Indian tier-2 and tier-3 cities.</li>
            </ol>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">How Automated AI Voice Confirmation Solves the RTO Crisis</h2>
            <p>
              Automating confirmation call schedules transforms order verification into a zero-friction, instant workflow:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Instant Call Triggering:</strong> The moment an order is created on Shopify or WooCommerce, a webhook triggers an outbound call to the buyer's mobile number.</li>
              <li><strong>Regional Language Intelligence:</strong> The AI agent detects the customer's location or preferred language and speaks naturally in Hindi, Marathi, Bengali, Tamil, or Indian English.</li>
              <li><strong>Dynamic Address Correction:</strong> The agent asks the customer to confirm their delivery landmark and house number out loud. If the customer indicates a change of address or cancels the order, the status is updated in real time directly inside Shopify and Shiprocket.</li>
            </ul>

            <h2 className="text-2xl font-bold text-[#121212] mt-8 mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              <div className="border border-[#CBC8BE] rounded-[2px] p-5 bg-[#DFDCD4]">
                <h4 className="font-bold text-[#121212] mb-2">Q: How fast does Claritiy Voice place confirmation calls after an order is placed?</h4>
                <p className="text-xs text-[#262523]">A: Claritiy Voice triggers calls within 30 to 60 seconds of order creation, reaching buyers while their purchase intent is at its highest.</p>
              </div>
              <div className="border border-[#CBC8BE] rounded-[2px] p-5 bg-[#DFDCD4]">
                <h4 className="font-bold text-[#121212] mb-2">Q: What happens if a customer doesn't pick up the first verification call?</h4>
                <p className="text-xs text-[#262523]">A: The system automatically schedules up to 3 smart retry calls at staggered intervals throughout the day, or sends a fallback WhatsApp confirmation link if the call remains unanswered.</p>
              </div>
            </div>
          </div>
        </motion.article>
      </div>
    </div>
  );
}
