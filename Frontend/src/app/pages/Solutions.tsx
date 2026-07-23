import { motion } from "motion/react";
import { Mic, FileText, Database, Users, PhoneCall, BarChart } from "lucide-react";

type Page = 
  | "home" 
  | "solutions" 
  | "how-it-works" 
  | "voices" 
  | "pricing" 
  | "compare" 
  | "blog" 
  | "docs" 
  | "dashboard";

interface SolutionsProps {
  setPage: (p: Page) => void;
}

export default function Solutions({ setPage }: SolutionsProps) {
  return (
    <div className="space-y-32 pb-32 overflow-hidden bg-cream-bg pt-32">
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display text-ink"
        >
          Everything a real voice AI operation needs — <span className="text-forest-deep italic">not just a demo that sounds impressive once.</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-body text-ink-muted max-w-3xl mx-auto"
        >
          Built for reliability, transparency, and seamless integration into your existing workflows.
        </motion.p>
      </section>

      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            {
              icon: <Mic className="w-6 h-6" />,
              title: "Natural, multilingual voice",
              desc: "A full library of distinct, natural-sounding voices, each with its own character, selectable per agent, speaking your customer's actual language rather than forcing everyone into English."
            },
            {
              icon: <FileText className="w-6 h-6" />,
              title: "Real-time transcripts",
              desc: "Every conversation, transcribed live and stored, so nothing is a black box and every outcome is reviewable."
            },
            {
              icon: <Database className="w-6 h-6" />,
              title: "Knowledge base grounding",
              desc: "Connect your own documents, policies, and product information so your agent answers from what's actually true about your business, not generic guesses."
            },
            {
              icon: <Users className="w-6 h-6" />,
              title: "Multi-agent support",
              desc: "Build and configure as many distinct agents as your business needs, each with its own voice, language, instructions, and knowledge base."
            },
            {
              icon: <PhoneCall className="w-6 h-6" />,
              title: "Bring your own telephony",
              desc: "Connect your own SIP trunk provider of choice, or use ours to get started immediately."
            },
            {
              icon: <BarChart className="w-6 h-6" />,
              title: "Transparent usage visibility",
              desc: "See exactly how many minutes you've used and how many remain, at a glance, at any time."
            }
          ].map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="card-soft relative group overflow-hidden"
            >
              {/* Asymmetric textured accent */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-mint-soft rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700 -z-10" />
              
              <div className="w-12 h-12 bg-mint-primary text-forest-deep rounded-full flex items-center justify-center mb-6 shadow-level-1">
                {feature.icon}
              </div>
              <h3 className="text-h3 text-ink mb-3">{feature.title}</h3>
              <p className="text-body text-ink-muted leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-6 max-w-4xl mx-auto text-center py-10">
        <button onClick={() => setPage("dashboard")} className="btn-primary text-lg px-10 py-4">
          Start building your agent
        </button>
      </section>
    </div>
  );
}
