import { useState } from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, ShieldCheck, Zap, Loader2, Sparkles, Sliders, DollarSign } from "lucide-react";
import RoiCalculator from "../components/calculator/RoiCalculator";
import { API_BASE } from "../api";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Page = any;

interface PricingProps {
  setPage?: (p: Page) => void;
  isDashboard?: boolean;
}

// ── Interactive Call Volume Cost Estimator Slider ──────────────────────────────
function UsageCostEstimatorSlider() {
  const [minutes, setMinutes] = useState(1500);

  const flatCost = Math.round(minutes * 3.99);
  const bundledRate = minutes >= 10000 ? 2.99 : minutes >= 2500 ? 3.49 : 3.99;
  const estimatedPlanCost = Math.round(minutes * bundledRate);
  const manualStaffCost = Math.round((minutes / 180) * 22000); // ~180 mins per agent/day
  const savings = Math.max(0, manualStaffCost - estimatedPlanCost);

  return (
    <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-800 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4" /> INTERACTIVE USAGE ESTIMATOR
          </div>
          <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Estimate Your Monthly Calling Investment
          </h3>
        </div>
        <div className="px-4 py-2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl font-mono text-xs font-bold">
          FLAT RATE: ₹3.99/MIN (BUNDLED AT ₹2.99/MIN)
        </div>
      </div>

      {/* Slider Control */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm font-medium">Monthly Estimated Call Volume:</span>
          <span className="font-mono text-2xl font-extrabold text-emerald-400">
            {minutes.toLocaleString()} <span className="text-xs text-slate-400 font-normal">minutes/mo</span>
          </span>
        </div>
        <input
          type="range"
          min="200"
          max="30000"
          step="100"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between text-[11px] font-mono text-slate-400">
          <span>200 mins</span>
          <span>5,000 mins</span>
          <span>15,000 mins</span>
          <span>30,000+ mins</span>
        </div>
      </div>

      {/* Cost Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-slate-400 text-xs font-mono font-bold block uppercase">CLARITIY VOICE ESTIMATE</span>
          <p className="text-3xl font-extrabold text-emerald-400 font-mono">₹{estimatedPlanCost.toLocaleString()}</p>
          <p className="text-slate-400 text-xs">All-inclusive audio, LLM & telephony</p>
        </div>

        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-slate-400 text-xs font-mono font-bold block uppercase">MANUAL CALL CENTER COST</span>
          <p className="text-3xl font-extrabold text-slate-300 font-mono">₹{manualStaffCost.toLocaleString()}</p>
          <p className="text-slate-400 text-xs">Salary, seats, telephony & overhead</p>
        </div>

        <div className="bg-emerald-950/80 p-6 rounded-2xl border border-emerald-500/50 space-y-2">
          <span className="text-emerald-400 text-xs font-mono font-bold block uppercase">YOUR NET SAVINGS</span>
          <p className="text-3xl font-extrabold text-emerald-300 font-mono">₹{savings.toLocaleString()}</p>
          <p className="text-emerald-200 text-xs font-semibold">Saved monthly with Claritiy Voice</p>
        </div>
      </div>
    </div>
  );
}

export default function Pricing({ setPage, isDashboard }: PricingProps) {
  const [purchasingPlan, setPurchasingPlan] = useState<string | null>(null);

  const waitForRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      let retries = 0;
      const interval = setInterval(() => {
        if (window.Razorpay) {
          clearInterval(interval);
          resolve(true);
        }
        retries++;
        if (retries > 20) {
          clearInterval(interval);
          resolve(false);
        }
      }, 250);
    });
  };

  const handlePurchase = async (planName: string, price: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please sign in or create an account to purchase a plan.');
      if (setPage) setPage('dashboard');
      return;
    }

    setPurchasingPlan(planName);
    try {
      const isLoaded = await waitForRazorpay();
      if (!isLoaded) throw new Error('Payment system failed to load. Please refresh.');

      const orderRes = await fetch(`${API_BASE}/api/v2/billing/create-plan-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ price })
      });
      const orderData = await orderRes.json();
      
      if (!orderData.success) {
        const errorMsg = typeof orderData.error === 'object' && orderData.error !== null 
          ? orderData.error.message 
          : orderData.error;
        throw new Error(errorMsg || 'Order creation failed');
      }

      if (orderData.data?.mock === true || (orderData.data?.id && String(orderData.data.id).startsWith('order_mock_'))) {
        throw new Error('Payment system configuration check required.');
      }

      const options = {
        key: (import.meta as any).env?.VITE_RAZORPAY_KEY_ID,
        amount: orderData.data.amount,
        currency: orderData.data.currency,
        name: 'Claritiy Voice',
        description: `${planName} Plan`,
        order_id: orderData.data.id,
        prefill: { email: '' },
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/v2/billing/verify-plan`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({
                plan: planName,
                email: response.razorpay_customer_email || 'unknown@example.com',
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              alert(`Success! You have purchased the ${planName} Plan. Select your 1 free bundled phone number now.`);
              if (setPage) {
                setPage("numbers_buy");
              } else {
                window.location.href = "/dashboard/numbers/buy";
              }
            } else {
              alert(verifyData.error || 'Verification failed.');
              setPurchasingPlan(null);
            }
          } catch (verifyErr: any) {
             alert(verifyErr.message || 'Verification error');
             setPurchasingPlan(null);
          }
        },
        modal: {
          ondismiss: function() {
            setPurchasingPlan(null);
          }
        },
        theme: { color: '#059669' }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (err) {
      alert(err instanceof Error ? err.message : 'Provisioning failed');
      setPurchasingPlan(null);
    }
  };

  return (
    <div className={`${isDashboard ? "space-y-12 pb-12 pt-4 bg-transparent" : "space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen"}`}>

      {!isDashboard && (
        <section className="px-6 max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            TRANSPARENT ENTERPRISE PRICING
          </div>
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
          >
            Predictable Bundled Plans & Flat-Rate Economics
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-600 text-lg md:text-xl max-w-3xl mx-auto font-plus-jakarta leading-relaxed"
          >
            One unified price per minute. No stacked line-item fees for speech recognition, LLM reasoning, or neural voice synthesis.
          </motion.p>
        </section>
      )}

      {/* Interactive Estimator Slider */}
      {!isDashboard && (
        <section className="px-6 max-w-7xl mx-auto">
          <UsageCostEstimatorSlider />
        </section>
      )}

      {/* 4 Tier Pricing Cards */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8">
          
          {/* Trial Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white border border-[#EADEC9] rounded-3xl p-8 flex flex-col justify-between shadow-lg hover:shadow-xl transition-all"
          >
            <div>
              <h3 className="font-bold text-xl text-slate-900 mb-1" style={{ fontFamily: "'Clash Display', sans-serif" }}>Trial Plan</h3>
              <p className="text-xs text-slate-500 mb-6 font-plus-jakarta">Test our platform & verify outbound line setup.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900 font-mono">₹1</span>
                <span className="text-xs text-slate-500 font-bold"> / once</span>
                <p className="text-xs font-mono font-bold text-emerald-600 mt-1">Includes 20 Bundled Mins</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-slate-700 font-semibold font-plus-jakarta">
                {['20 Bundled Call Minutes', 'All Core Features Included', 'Real-Time Transcripts', 'Instant Identity Verification'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Trial", 1)} 
              disabled={purchasingPlan === "Trial"}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors w-full flex items-center justify-center gap-2"
            >
              {purchasingPlan === "Trial" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Purchase Trial"}
            </button>
          </motion.div>
          
          {/* Startup Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-[#EADEC9] rounded-3xl p-8 flex flex-col justify-between shadow-lg hover:shadow-xl transition-all"
          >
            <div>
              <h3 className="font-bold text-xl text-slate-900 mb-1" style={{ fontFamily: "'Clash Display', sans-serif" }}>Startup Plan</h3>
              <p className="text-xs text-slate-500 mb-6 font-plus-jakarta">Ideal for growing teams testing automated campaigns.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900 font-mono">₹3,799</span>
                <span className="text-xs text-slate-500 font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-emerald-600 mt-1">750 Mins + 1 Free Phone Number</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-slate-700 font-semibold font-plus-jakarta">
                {['750 Bundled Call Minutes', '1 Free Phone Number Included', '26+ HD Voice Personas', '70+ Languages & Dialects', 'Standard Webhooks & CRM Sync', 'Real-Time Transcripts'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Startup", 3799)} 
              disabled={purchasingPlan === "Startup"}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors w-full flex items-center justify-center gap-2"
            >
              {purchasingPlan === "Startup" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Purchase Startup Plan"}
            </button>
          </motion.div>

          {/* Growth Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl"
          >
            <div className="absolute -top-3 right-6 bg-emerald-500 text-black text-[10px] font-mono font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              MOST POPULAR
            </div>
            <div>
              <h3 className="font-bold text-xl text-white mb-1" style={{ fontFamily: "'Clash Display', sans-serif" }}>Growth Plan</h3>
              <p className="text-xs text-slate-400 mb-6 font-plus-jakarta">For high-volume operations scaling call volume.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white font-mono">₹10,799</span>
                <span className="text-xs text-slate-400 font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-emerald-400 mt-1">2,865 Mins + 1 Free Phone Number</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-slate-200 font-semibold font-plus-jakarta">
                {['2,865 Bundled Call Minutes', '1 Free Phone Number Included', 'Everything in Startup', 'Priority Telephony Routing', '1 Custom Voice Clone', 'Sentiment Analytics & Scoring'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Growth", 10799)} 
              disabled={purchasingPlan === "Growth"}
              className="py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition-colors w-full flex items-center justify-center gap-2"
            >
              {purchasingPlan === "Growth" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Purchase Growth Plan <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>

          {/* Enterprise Plan */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white border border-[#EADEC9] rounded-3xl p-8 flex flex-col justify-between shadow-lg hover:shadow-xl transition-all"
          >
            <div>
              <h3 className="font-bold text-xl text-slate-900 mb-1" style={{ fontFamily: "'Clash Display', sans-serif" }}>Enterprise Plan</h3>
              <p className="text-xs text-slate-500 mb-6 font-plus-jakarta">For regulated enterprise centers requiring SLAs.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900 font-mono">₹30,799</span>
                <span className="text-xs text-slate-500 font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-emerald-600 mt-1">10,000 Mins + 1 Free Phone Number</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-slate-700 font-semibold font-plus-jakarta">
                {['10,000 Bundled Call Minutes', '1 Free Phone Number Included', 'Everything in Growth', 'Dedicated SIP IP Addresses', 'HIPAA & SOC 2 BAA Agreement', '99.99% Uptime SLA'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Enterprise", 30799)} 
              disabled={purchasingPlan === "Enterprise"}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors w-full flex items-center justify-center gap-2"
            >
              {purchasingPlan === "Enterprise" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Purchase Enterprise Plan"}
            </button>
          </motion.div>

        </div>

        {/* Custom Enterprise Banner */}
        <div className="mt-12 bg-slate-900 text-white rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between shadow-xl border border-slate-800">
          <div className="mb-6 md:mb-0 md:mr-8 text-center md:text-left">
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Need a Custom Enterprise Deal or On-Premise Deployment?
            </h3>
            <p className="text-slate-300 text-sm font-plus-jakarta max-w-2xl">
              For volume pricing, dedicated SIP trunks, or custom SLA contracts, our solution engineers can build a custom deployment package.
            </p>
          </div>
          <button 
            onClick={() => setPage ? setPage("contact") : window.location.href = "/contact"}
            className="py-3.5 px-8 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-xl transition-colors whitespace-nowrap"
          >
            Contact Sales Team
          </button>
        </div>

        {/* Embedded ROI Calculator */}
        {!isDashboard && (
          <div className="mt-20">
            <RoiCalculator />
          </div>
        )}
      </section>

      {/* Flat-Rate Philosophy */}
      {!isDashboard && (
        <section className="px-6 max-w-5xl mx-auto">
          <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-12 shadow-lg space-y-6">
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Pay-As-You-Go Base Rate: Flat ₹3.99 / Minute
            </h2>
            <div className="text-slate-600 font-plus-jakarta text-base leading-relaxed space-y-4">
              <p>
                If your call volume fluctuates seasonally, you can utilize our standalone Pay-As-You-Go rate at a flat <strong>₹3.99 per minute</strong>.
              </p>
              <p>
                Unlike multi-vendor chained stacks that charge separate line items for speech recognition, LLM tokens, and neural voices, Claritiy Voice unifies the entire stack into one predictable invoice. What you see is what you pay — zero unexpected surprise fees.
              </p>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

