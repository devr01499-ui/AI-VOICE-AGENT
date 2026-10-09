import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, ShieldCheck, Zap, Loader2, Sparkles, Sliders, DollarSign, Lock, HelpCircle, PhoneCall } from "lucide-react";
import RoiCalculator from "../components/calculator/RoiCalculator";
import { API_BASE } from "../api";
import { supabase } from "../lib/supabaseClient";

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

// ── SVG Geometric Background Accent ─────────────────────────────────────────────
function GeometricGridBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="grid-pricing" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="2,2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pricing)" />
      </svg>
    </div>
  );
}

// ── Interactive Call Volume Cost Estimator Slider ──────────────────────────────
function UsageCostEstimatorSlider() {
  const [minutes, setMinutes] = useState(1500);

  const bundledRate = minutes >= 10000 ? 2.99 : minutes >= 2500 ? 3.49 : 3.99;
  const estimatedPlanCost = Math.round(minutes * bundledRate);
  const manualStaffCost = Math.round((minutes / 180) * 22000); // ~180 mins per agent/day
  const savings = Math.max(0, manualStaffCost - estimatedPlanCost);

  return (
    <div className="bg-[#0B132B] text-white rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-800 space-y-8 relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4" /> INTERACTIVE USAGE ESTIMATOR
          </div>
          <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Estimate Your Monthly Calling Investment & Savings
          </h3>
        </div>
        <div className="px-4 py-2 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-xl font-mono text-xs font-bold">
          PAY-AS-YOU-GO: ₹3.99/MIN (BUNDLED AT ₹2.99/MIN)
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
          <p className="text-slate-400 text-xs font-plus-jakarta">All-inclusive audio, LLM & telephony</p>
        </div>

        <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-2">
          <span className="text-slate-400 text-xs font-mono font-bold block uppercase">MANUAL CALL CENTER COST</span>
          <p className="text-3xl font-extrabold text-slate-300 font-mono">₹{manualStaffCost.toLocaleString()}</p>
          <p className="text-slate-400 text-xs font-plus-jakarta">Salary, seats, telephony & overhead</p>
        </div>

        <div className="bg-emerald-950/80 p-6 rounded-2xl border border-emerald-500/50 space-y-2">
          <span className="text-emerald-400 text-xs font-mono font-bold block uppercase">YOUR NET SAVINGS</span>
          <p className="text-3xl font-extrabold text-emerald-300 font-mono">₹{savings.toLocaleString()}</p>
          <p className="text-emerald-200 text-xs font-semibold font-plus-jakarta">Saved monthly with Claritiy Voice</p>
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('selected_plan_tier', planName);
        localStorage.setItem('pending_plan_purchase', JSON.stringify({ planName, price }));
      }
      alert(`Please sign in or create an account to complete your ${planName} Plan purchase. We'll return you straight to checkout.`);
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
          'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
        },
        body: JSON.stringify({ planName, price })
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

      let profileEmail = '';
      try {
        const userRes = await supabase.auth.getUser();
        profileEmail = userRes.data?.user?.email || '';
      } catch {}

      if (!profileEmail) {
        try {
          const userStr = localStorage.getItem('user');
          if (userStr) {
            const parsed = JSON.parse(userStr);
            profileEmail = parsed.email || '';
          }
        } catch {}
      }

      const options = {
        key: orderData.data.keyId,
        amount: orderData.data.amount,
        currency: orderData.data.currency || 'INR',
        name: 'Claritiy Voice',
        description: `${planName} Plan Subscription`,
        order_id: orderData.data.orderId,
        prefill: {
          email: profileEmail || '',
        },
        theme: {
          color: '#059669',
        },
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/v2/billing/verify-plan-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planName,
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              alert(`Success! Your account has been upgraded to the ${planName} Plan.`);
              if (setPage) setPage('dashboard');
              else window.location.reload();
            } else {
              alert('Payment verification failed: ' + (verifyData.error || 'Unknown error'));
            }
          } catch (err: any) {
            alert('Error verifying payment: ' + err.message);
          } finally {
            setPurchasingPlan(null);
          }
        },
        modal: {
          ondismiss: function () {
            setPurchasingPlan(null);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        alert('Payment failed: ' + (response.error.description || 'Unknown reason'));
        setPurchasingPlan(null);
      });
      rzp.open();
    } catch (err: any) {
      alert(err.message || 'Error initiating payment');
      setPurchasingPlan(null);
    }
  };

  useEffect(() => {
    const pending = typeof window !== 'undefined' ? localStorage.getItem('pending_plan_purchase') : null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (pending && token) {
      try {
        const { planName, price } = JSON.parse(pending);
        localStorage.removeItem('pending_plan_purchase');
        handlePurchase(planName, price);
      } catch (err) {
        localStorage.removeItem('pending_plan_purchase');
      }
    }
  }, []);

  return (
    <div className={`${isDashboard ? "space-y-12 pb-12 pt-4 bg-transparent font-plus-jakarta" : "space-y-24 pb-32 pt-28 bg-[#FFFDF9] min-h-screen relative font-plus-jakarta"}`}>
      {!isDashboard && <GeometricGridBackground />}

      {!isDashboard && (
        <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold tracking-wider uppercase shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            TRANSPARENT ENTERPRISE PRICING
          </div>

          <motion.h1 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
            style={{ fontFamily: "'Clash Display', 'Plus Jakarta Sans', sans-serif" }}
          >
            Predictable Bundled Plans & Flat-Rate Economics
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 25 }}
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
        <section className="px-6 max-w-7xl mx-auto relative z-10">
          <UsageCostEstimatorSlider />
        </section>
      )}

      {/* ── 3 Main Plan Cards Grid ───────────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-widest">
            PLANS & BUNDLED MINUTES
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            Choose The Capacity That Fits Your Operations
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Startup Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-[#E8E2D9] rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-slate-300 transition-all"
          >
            <div>
              <h3 className="font-bold text-xl text-slate-900 mb-1" style={{ fontFamily: "'Clash Display', sans-serif" }}>Startup Plan</h3>
              <p className="text-xs text-slate-500 mb-6 font-plus-jakarta">For growing businesses testing AI voice automation.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900 font-mono">₹3,799</span>
                <span className="text-xs text-slate-500 font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-emerald-700 mt-1">1,000 Bundled Mins (₹3.79/min effective)</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-slate-700 font-semibold font-plus-jakarta">
                {[
                  '1,000 Bundled Calling Minutes (₹3.79/min overage)',
                  'Access to All 15 Pre-Built Templates',
                  'Visual Flow Builder & Single Prompt Studio',
                  'Standard Bidirectional Webhooks',
                  '10 Concurrent Call Channels',
                  'Email & Community Support'
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Startup", 3799)} 
              disabled={purchasingPlan === "Startup"}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors w-full flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {purchasingPlan === "Startup" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Purchase Startup Plan"}
            </button>
          </motion.div>

          {/* Growth Plan */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl ring-2 ring-emerald-500/20"
          >
            <div className="absolute -top-3 right-6 bg-emerald-500 text-black text-[10px] font-mono font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
              MOST POPULAR
            </div>
            <div>
              <h3 className="font-bold text-xl text-white mb-1" style={{ fontFamily: "'Clash Display', sans-serif" }}>Growth Plan</h3>
              <p className="text-xs text-slate-400 mb-6 font-plus-jakarta">For high-volume operations scaling phone queues.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white font-mono">₹10,799</span>
                <span className="text-xs text-slate-400 font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-emerald-400 mt-1">2,865 Mins + 1 Free Phone Number Included</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-slate-200 font-semibold font-plus-jakarta">
                {[
                  '2,865 Bundled Mins (₹3.49/min overage)',
                  '1 Free Local / National Phone Number',
                  '50 Concurrent Call Channels',
                  '1 Custom Brand Voice Clone (Zero-Shot 5s)',
                  'Priority SIP Carrier Routing',
                  'Edge PII Pattern Redaction Pipeline',
                  'Priority WhatsApp & Engineering Support'
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Growth", 10799)} 
              disabled={purchasingPlan === "Growth"}
              className="py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition-colors w-full flex items-center justify-center gap-2 shadow-lg cursor-pointer"
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white border border-[#E8E2D9] rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-slate-300 transition-all"
          >
            <div>
              <h3 className="font-bold text-xl text-slate-900 mb-1" style={{ fontFamily: "'Clash Display', sans-serif" }}>Enterprise Plan</h3>
              <p className="text-xs text-slate-500 mb-6 font-plus-jakarta">For regulated enterprise centers requiring SLAs.</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-slate-900 font-mono">₹30,799</span>
                <span className="text-xs text-slate-500 font-bold"> / month</span>
                <p className="text-xs font-mono font-bold text-emerald-700 mt-1">10,000 Mins + 1 Free Phone Number Included</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-slate-700 font-semibold font-plus-jakarta">
                {[
                  '10,000 Bundled Mins (₹2.99/min overage)',
                  '200+ Unlimited Concurrent Channels',
                  'Dedicated SIP IP Trunking & IP Whitelisting',
                  'MSME Registered Enterprise Verification',
                  'Custom On-Prem / VPC Proxy Egress',
                  'Dedicated Solutions Architect & 99.99% SLA'
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Enterprise", 30799)} 
              disabled={purchasingPlan === "Enterprise"}
              className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors w-full flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {purchasingPlan === "Enterprise" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Purchase Enterprise Plan"}
            </button>
          </motion.div>
        </div>

        {/* Custom Enterprise Banner */}
        <div className="mt-12 bg-[#0B132B] text-white rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between shadow-2xl border border-slate-800 relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="mb-6 md:mb-0 md:mr-8 text-center md:text-left relative z-10">
            <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              Need a Custom Enterprise Contract or On-Premise Gateway?
            </h3>
            <p className="text-slate-300 text-sm font-plus-jakarta max-w-2xl">
              For volume discounts above 30,000 minutes, dedicated telecom SIP trunks, or custom SLA contracts, our solution engineers can build a tailored deployment package.
            </p>
          </div>
          <button 
            onClick={() => setPage ? setPage("contact") : window.location.href = "/contact"}
            className="py-3.5 px-8 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-xl transition-colors whitespace-nowrap cursor-pointer shadow-md relative z-10"
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
        <section className="px-6 max-w-5xl mx-auto relative z-10">
          <div className="bg-white border border-[#E8E2D9] rounded-3xl p-8 md:p-12 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <DollarSign className="w-5 h-5" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Pay-As-You-Go Base Rate: Flat ₹3.99 / Minute
              </h2>
            </div>
            <div className="text-slate-600 font-plus-jakarta text-sm md:text-base leading-relaxed space-y-4">
              <p>
                If your call volume fluctuates seasonally, you can utilize our standalone Pay-As-You-Go rate at a flat <strong>₹3.99 per minute</strong> with zero monthly platform fees.
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
