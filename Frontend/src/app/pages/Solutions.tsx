import { motion } from "motion/react";
import IndustryShowroomGrid from "../components/showroom/IndustryShowroomGrid";
import { ArrowRight, Building2, Landmark, ShieldCheck, Home as HomeIcon, ShoppingBag, Truck } from "lucide-react";

type Page = any;

interface SolutionsProps {
  setPage: (p: Page) => void;
}

export default function Solutions({ setPage }: SolutionsProps) {
  return (
    <div className="space-y-28 pb-32 pt-32 bg-cream-bg min-h-screen">
      <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
        <span className="text-caption font-bold text-mint-primary uppercase tracking-widest bg-mint-soft px-4 py-1.5 rounded-full font-mono">
          ENTERPRISE INDUSTRY SOLUTIONS
        </span>
        <motion.h1 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-display text-ink leading-tight"
        >
          Industry-Tailored AI Voice Calling Solutions
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-body text-ink-muted max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
        >
          Deploy pre-configured, domain-specific AI voice agents designed for real-world compliance, CRM workflows, and measurable ROI across 12 core verticals.
        </motion.p>
      </section>

      {/* 12 Industry Cards Showroom Grid */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <IndustryShowroomGrid />
      </section>

      {/* OPERATIONAL DEEP DIVE 1: Healthcare & Clinics */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-8">
          <div className="flex items-center gap-4">
            <Building2 className="w-10 h-10 text-mint-primary" />
            <h2 className="font-sora text-3xl font-extrabold text-ink">
              Operational Guide: Healthcare Patient Intake & Reception Automation
            </h2>
          </div>
          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
            <p>
              Medical clinic reception desks are under non-stop pressure. Front-desk staff spend hours answering repetitive phone calls regarding clinic hours, doctor availability, appointment scheduling, and pre-procedure preparation guidelines. This administrative bottleneck creates long telephone hold times for sick patients and pulls staff away from in-person patient care.
            </p>
            <p>
              <strong>Clarity Voice AI Healthcare Agents</strong> automate patient outreach while remaining strictly HIPAA-compliant. Incoming patient calls are answered instantly. The voice agent verifies patient identity using DOB and phone numbers, queries the clinic management system for open doctor slots, and confirms bookings directly into the calendar.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 font-mono text-xs">
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-mint-primary block text-sm">Call Triggers</span>
                <span>Inbound Patient Calls, Appointment Booking Requests, Post-Op Reminders</span>
              </div>
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-amber-cta block text-sm">EHR/CRM Sync</span>
                <span>Epic, Cerner, AthenaHealth, Kareo, Custom REST APIs</span>
              </div>
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-mint-primary block text-sm">Target Metric</span>
                <span>85% Reduction in Phone Queue Wait Times</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OPERATIONAL DEEP DIVE 2: E-Commerce COD & RTO Prevention */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-8">
          <div className="flex items-center gap-4">
            <ShoppingBag className="w-10 h-10 text-amber-cta" />
            <h2 className="font-sora text-3xl font-extrabold text-ink">
              Operational Guide: E-Commerce Cash-on-Delivery (COD) Order Verification
            </h2>
          </div>
          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
            <p>
              In emerging markets across Asia and the Middle East, Cash-on-Delivery (COD) accounts for up to 70% of total online transactions. However, unverified COD orders suffer from a devastating 25% to 35% Return-to-Origin (RTO) rate. When buyers enter incorrect pin codes, fake phone numbers, or simply change their minds during the 3-day transit window, merchants bear reverse shipping charges, product damage, and inventory lock-up.
            </p>
            <p>
              <strong>Clarity Voice COD Confirmation Agents</strong> place automated verification calls within 60 seconds of order placement. Speaking in the buyer's regional dialect (e.g. Hindi, Gujarati, Marathi, Arabic), the agent confirms the order items, verifies delivery landmarks, and allows buyers to cancel or convert to prepaid before dispatch.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 font-mono text-xs">
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-mint-primary block text-sm">Call Triggers</span>
                <span>New Checkout Webhook, High-Risk Order Flags</span>
              </div>
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-amber-cta block text-sm">Store Sync</span>
                <span>Shopify, WooCommerce, Magento, Custom Carts</span>
              </div>
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-mint-primary block text-sm">Target Metric</span>
                <span>Up to 40% Reduction in Total RTO Losses</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OPERATIONAL DEEP DIVE 3: Banking & Finance Debt Recovery */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="bg-surface-white border border-[#EADEC9] rounded-3xl p-10 md:p-16 shadow-level-2 space-y-8">
          <div className="flex items-center gap-4">
            <Landmark className="w-10 h-10 text-mint-primary" />
            <h2 className="font-sora text-3xl font-extrabold text-ink">
              Operational Guide: Banking, Credit & Ethical Debt Recovery Calling
            </h2>
          </div>
          <div className="prose prose-lg text-ink-muted font-plus-jakarta text-body leading-relaxed space-y-6">
            <p>
              Traditional collection calls are fraught with high agent attrition, inconsistent script adherence, and regulatory compliance risks. Borrowers frequently block calls from unknown collection centers due to hostile human agent interactions.
            </p>
            <p>
              <strong>Clarity Voice Ethical Financial Recovery Agents</strong> maintain a calm, polite, non-judgmental tone. The voice agent calls borrowers prior to or immediately following an EMI due date, reminds them of payment schedules, offers pre-approved settlement arrangements, and dispatches secure payment links via SMS while on the call.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 font-mono text-xs">
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-mint-primary block text-sm">Call Triggers</span>
                <span>3-Day Pre-Due Reminders, 1-30 DPD Batch Queues</span>
              </div>
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-amber-cta block text-sm">Core Banking Sync</span>
                <span>Finacle, T24, Custom Credit Databases</span>
              </div>
              <div className="bg-cream-bg p-4 rounded-xl border border-border-soft">
                <span className="font-bold text-mint-primary block text-sm">Target Metric</span>
                <span>42% Increase in Early-Stage Resolution</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 max-w-4xl mx-auto text-center py-10">
        <button onClick={() => setPage("dashboard")} className="btn-cta bg-amber-cta text-white hover:bg-[#d4742e]">
          Build Your Industry Voice Agent Now
          <ArrowRight className="w-5 h-5 ml-2 inline" />
        </button>
      </section>
    </div>
  );
}
