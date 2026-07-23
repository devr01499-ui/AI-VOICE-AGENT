import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, HeartPulse, Building2, Landmark, Hotel, Truck } from "lucide-react";

export default function SolutionsTab() {
  const [activeTab, setActiveTab] = useState("ecommerce");

  const industries = [
    {
      id: "ecommerce",
      label: "E-Commerce & D2C",
      icon: ShoppingBag,
      headline: "Cut RTO by 40% with Automated Pre-Dispatch Confirmation Calls",
      description: "When a customer places a Cash-on-Delivery order, Clarity Voice calls them within 60 seconds to verify their address, landmark, and buying intent. Orders get confirmed before couriers roll out—saving millions in reverse logistics."
    },
    {
      id: "healthcare",
      label: "Healthcare & Clinics",
      icon: HeartPulse,
      headline: "Zero-Wait Patient Intake, Reminders, and Prescription Follow-ups",
      description: "Eliminate phone tag. Our HIPAA-compliant voice agents schedule appointments, explain pre-op prep, and confirm daily patient visitations without keeping anyone on hold."
    },
    {
      id: "realestate",
      label: "Real Estate & Property",
      icon: Building2,
      headline: "Qualify High-Intent Buyers While Your Competitors Sleep",
      description: "Inbound property leads cold off within minutes. Clarity Voice engages prospective buyers instantly, asks budget and timeline criteria, and syncs tour bookings straight to your CRM."
    },
    {
      id: "banking",
      label: "Banking & Fintech",
      icon: Landmark,
      headline: "Respectful, Compliant, and High-Converting Reminders",
      description: "Automate sensitive payment follow-ups and EMI collection calls with empathetic, multi-lingual AI voices that negotiate payment schedules without alienating customers."
    },
    {
      id: "hospitality",
      label: "Hospitality & Travel",
      icon: Hotel,
      headline: "Confirm Bookings and Upsell Travel Packages in Real-Time",
      description: "Automate guest check-in calls, hotel room confirmations, and localized upselling operations with high fidelity multilingual agents."
    },
    {
      id: "logistics",
      label: "Logistics & Fleet",
      icon: Truck,
      headline: "Real-Time Courier Coordination & Delivery Verification",
      description: "Autonomously verify recipient presence before courier dispatch, decreasing failed address delivery costs by up to 35%."
    }
  ];

  const current = industries.find((ind) => ind.id === activeTab) || industries[0];
  const Icon = current.icon;

  return (
    <div className="space-y-12">
      {/* Selector Tabs */}
      <div className="flex flex-wrap justify-center gap-3">
        {industries.map((ind) => {
          const TabIcon = ind.icon;
          return (
            <button
              key={ind.id}
              onClick={() => setActiveTab(ind.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold border transition-all ${
                activeTab === ind.id
                  ? "bg-[#059669]/10 text-[#059669] border-[#059669]/30 shadow-sm"
                  : "bg-white border-[#EADEC9] text-slate-600 hover:text-[#059669]"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {ind.label}
            </button>
          );
        })}
      </div>

      {/* Main Switcher Card */}
      <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-12 shadow-sm min-h-[300px] flex items-center relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute right-0 top-0 w-[30%] h-[100%] rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center w-full"
          >
            <div className="lg:col-span-8 space-y-6 text-left">
              <div className="w-12 h-12 bg-emerald-50 text-[#059669] rounded-2xl flex items-center justify-center shadow-sm">
                <Icon className="w-6 h-6" strokeWidth={2} />
              </div>
              <h3 className="font-sora text-3xl font-extrabold text-slate-900 leading-tight">
                {current.headline}
              </h3>
              <p className="text-base text-slate-600 leading-relaxed font-plus-jakarta">
                {current.description}
              </p>
            </div>
            
            <div className="lg:col-span-4 flex items-center justify-center">
              <div className="w-full max-w-[280px] bg-slate-50 border border-[#EADEC9] rounded-2xl p-6 relative">
                <p className="text-[10px] font-mono text-slate-400 font-bold mb-4 uppercase">Operational Flow</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-mono text-[10px] flex items-center justify-center font-bold">1</span>
                    <span className="text-xs text-slate-700 font-bold">Checkout Trigger</span>
                  </div>
                  <div className="w-0.5 h-4 bg-emerald-300 ml-2.5" />
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-mono text-[10px] flex items-center justify-center font-bold">2</span>
                    <span className="text-xs text-slate-700 font-bold">Duplex AI Call</span>
                  </div>
                  <div className="w-0.5 h-4 bg-emerald-300 ml-2.5" />
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-mono text-[10px] flex items-center justify-center font-bold">3</span>
                    <span className="text-xs text-slate-700 font-bold">CRM Tag Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
