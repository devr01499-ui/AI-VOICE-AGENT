import { motion } from "motion/react";
import { ArrowRight, BookOpen, Clock } from "lucide-react";

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

interface BlogIndexProps {
  setPage: (p: Page) => void;
}

export default function BlogIndex({ setPage }: BlogIndexProps) {
  const posts = [
    {
      id: "blog-rto" as Page,
      title: "How Indian D2C Brands Cut COD RTO Rates by 40% Using Automated AI Voice Calls",
      excerpt: "Cash-On-Delivery is a double-edged sword. Learn how D2C brands place automated confirmation calls to verify delivery landmark and check buyer intent before dispatching parcels.",
      author: "Clarity Voice Logistics Team",
      date: "Jul 21, 2026",
      readTime: "6 min read"
    },
    {
      id: "blog-healthcare" as Page,
      title: "Zero-Wait Patient Outreach: Optimizing Clinic Intake & Appointment Schedules",
      excerpt: "Free up receptionist hours. Learn how HIPAA-compliant voice agents coordinate patient reminders, explain pre-op prep, and confirm daily patient visits automatically.",
      author: "Healthcare Operations Team",
      date: "Jul 20, 2026",
      readTime: "5 min read"
    },
    {
      id: "blog-fintech" as Page,
      title: "Negotiating EMIs Empathetically: AI Voice Agents in Financial Payment Recovery",
      excerpt: "Automate sensitive debt collection and loan follow-ups without alienating buyers. Empathy-focused tone configurations increase collection yields by up to 25%.",
      author: "Fintech Recovery Team",
      date: "Jul 19, 2026",
      readTime: "8 min read"
    }
  ];

  return (
    <div className="space-y-12 pb-20 pt-10 text-slate-600">
      <section className="px-6 max-w-5xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs font-semibold text-cyan-600 tracking-widest uppercase mb-4 font-mono">
            Content Hub
          </p>
          <h1 className="font-sora text-5xl lg:text-6xl font-extrabold leading-tight text-[#0F172A] tracking-tight">
            Operational Guides &amp; Voice AI Insights
          </h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto mt-6 leading-relaxed font-plus-jakarta font-semibold">
            Actionable guides detailing RTO reduction metrics, healthcare intake workflows, and financial recovery compliance.
          </p>
        </motion.div>
      </section>

      {/* Blog Cards Grid */}
      <section className="px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 gap-8">
          {posts.map((post, idx) => (
            <div 
              key={idx} 
              className="bg-white border border-[#EADEC9] rounded-3xl p-8 hover:shadow-md transition-shadow text-left grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
            >
              <div className="md:col-span-9 space-y-4">
                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono font-bold">
                  <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5 text-[#059669]" /> {post.author}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {post.readTime}</span>
                </div>
                <h3 className="font-sora text-2xl font-bold text-slate-900 leading-tight">
                  {post.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed font-plus-jakarta font-semibold">
                  {post.excerpt}
                </p>
              </div>

              <div className="md:col-span-3 flex justify-start md:justify-end">
                <button
                  onClick={() => setPage(post.id)}
                  className="inline-flex items-center gap-2 bg-[#059669]/10 text-[#059669] hover:bg-[#059669]/20 font-bold text-xs px-6 py-3 rounded-full transition-all group"
                >
                  Read Article
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
