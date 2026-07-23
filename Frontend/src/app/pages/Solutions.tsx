import { motion } from "motion/react";
import { ShoppingBag, Landmark, HeartPulse, Building2, Hotel, Truck, ShieldCheck } from "lucide-react";

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

interface SolutionsProps {
  setPage: (p: Page) => void;
}

export default function Solutions({ setPage }: SolutionsProps) {
  const industries = [
    {
      icon: ShoppingBag,
      title: "D2C & E-Commerce Retail",
      sub: "Turn Undelivered Packages into Confirmed Revenue",
      desc: "Cash-On-Delivery is a double-edged sword for Indian e-commerce. High order volumes often translate to massive Return-To-Origin (RTO) losses when customers reject parcels at the doorstep. Clarity Voice integrates natively with Shopify, WooCommerce, and Shiprocket. The moment an order hits your store, our AI voice agent calls the buyer, speaks in their preferred regional language (Hindi, English, Marathi, Bengali, Tamil), verifies address landmarks, and updates order tags automatically."
    },
    {
      icon: Landmark,
      title: "Financial Services, Insurance & Collections",
      sub: "Automate Sensitive Outreach with Empathy at Scale",
      desc: "Financial outreach requires balance—you need to recover funds or verify transactions while protecting customer goodwill. Clarity Voice handles debt collection reminders, fraud alerts, loan application follow-ups, and insurance renewal notices with professional, calm, and conversational tone options. Every call is logged, transcribed, and scored for regulatory compliance."
    },
    {
      icon: HeartPulse,
      title: "Healthcare & Telemedicine",
      sub: "Eliminate No-Shows and Reduce Front-Desk Burnout",
      desc: "Medical receptionists spend up to 4 hours daily making routine confirmation calls. Clarity Voice automates appointment booking, pre-treatment instructions, lab test result notifications, and prescription refill follow-ups. Built with strict privacy controls, our agents maintain patient trust while freeing clinical staff to focus on in-person care."
    },
    {
      icon: Building2,
      title: "Real Estate & Property Developers",
      sub: "Instant Inbound Lead Qualification 24/7/365",
      desc: "In real estate, response time determines conversion. When a lead submits a form on Meta, Google, or your website, Clarity Voice triggers an outbound call within 30 seconds. The agent asks screening questions regarding budget, preferred location, and purchasing timeline, instantly booking site visits on your sales team's calendar."
    },
    {
      icon: Hotel,
      title: "Hospitality & Booking Management",
      sub: "Deliver Seamless Guest Experience Automatically",
      desc: "Autonomously coordinate check-in timings, dietary preferences, room service feedback, and late checkout approvals. Multi-lingual support ensures global travelers feel welcomed in their native accent."
    },
    {
      icon: Truck,
      title: "Logistics & Dispatch Coordination",
      sub: "Optimize Last-Mile Delivery Efficiency",
      desc: "Confirm recipient availability before delivery vehicles leave the hub. Auto-schedule re-delivery windows dynamically if a customer isn't home, reducing shipping overheads by up to 35%."
    }
  ];

  return (
    <div className="space-y-20 pb-20 pt-10 text-slate-600">
      <section className="px-6 max-w-5xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs font-semibold text-cyan-600 tracking-widest uppercase mb-4 font-mono">
            Platform Solutions
          </p>
          <h1 className="font-sora text-5xl lg:text-6xl font-extrabold leading-tight text-[#0F172A] tracking-tight">
            Enterprise Voice Workflows Built for Your Industry's Exact Nuances
          </h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto mt-6 leading-relaxed font-plus-jakarta font-semibold">
            Deploy tailored agent flows with built-in compliance, platform connections, and industry-specific context rules.
          </p>
        </motion.div>
      </section>

      {/* Solutions Cards Grid */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {industries.map((ind, idx) => {
            const Icon = ind.icon;
            return (
              <div key={idx} className="bg-white border border-[#EADEC9] rounded-3xl p-8 hover:shadow-md transition-shadow text-left space-y-6">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                  <div className="w-12 h-12 bg-emerald-50 text-[#059669] rounded-2xl flex items-center justify-center shadow-sm">
                    <Icon className="w-6 h-6" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="font-sora text-xl font-bold text-slate-900">{ind.title}</h3>
                    <p className="text-xs text-[#059669] font-bold font-mono uppercase mt-0.5">{ind.sub}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-plus-jakarta font-semibold">
                  {ind.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security & Compliance Banner */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="bg-gradient-to-tr from-emerald-50 to-white border border-[#EADEC9] rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
          <div className="space-y-4 text-left max-w-2xl">
            <div className="flex items-center gap-2 text-[#059669]">
              <ShieldCheck className="w-6 h-6" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Enterprise Security Guardrails</span>
            </div>
            <h3 className="font-sora text-2xl font-extrabold text-slate-900">
              HIPAA, SOC 2 Type II, ISO 27001, &amp; GDPR Audited Telephony
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed font-plus-jakarta font-semibold">
              Every phone session is encrypted end-to-end. We offer zero-retention call logging, granular access controls, and dedicated Virtual Private Cloud (VPC) hosting capabilities.
            </p>
          </div>
          <button 
            onClick={() => setPage("dashboard")}
            className="bg-slate-900 text-white font-bold text-sm px-6 py-3 rounded-full hover:bg-slate-800 transition-colors shadow-sm"
          >
            Review Security Specifications
          </button>
        </div>
      </section>
    </div>
  );
}
