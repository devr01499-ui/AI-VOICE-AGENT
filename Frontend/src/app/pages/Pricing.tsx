import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Check, ArrowRight, ShieldCheck, Zap, Loader2, Sparkles, Lock, HelpCircle, PhoneCall } from "lucide-react";
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

      const razorpayKey =
        orderData.data?.keyId ||
        orderData.data?.key ||
        (import.meta as any).env?.VITE_RAZORPAY_KEY_ID ||
        'rzp_test_TO7mXkVkl4AFCy';

      const razorpayOrderId =
        orderData.data?.orderId ||
        orderData.data?.id;

      const options = {
        key: razorpayKey,
        amount: orderData.data.amount,
        currency: orderData.data.currency || 'INR',
        name: 'Claritiy Voice',
        description: `${planName} Plan Subscription`,
        order_id: razorpayOrderId,
        prefill: {
          email: profileEmail || '',
        },
        theme: {
          color: '#121212',
        },
        handler: async function (response: any) {
          try {
            const verifyPayload = {
              plan: planName,
              planName,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            };

            const verifyRes = await fetch(`${API_BASE}/api/v2/billing/verify-plan`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
              },
              body: JSON.stringify(verifyPayload)
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
    <div className={`${isDashboard ? "space-y-12 pb-12 pt-4 bg-transparent font-sans" : "space-y-20 pb-32 pt-28 bg-[#E5E3DC] min-h-screen relative font-sans text-[#121212]"}`}>
      
      {!isDashboard && (
        <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="hatched-strip h-10 w-full mb-8" />
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono uppercase tracking-wider">
            <span>|</span>
            <span>Transparent Flat-Rate Economics</span>
          </div>

          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-normal md:font-medium text-[#121212] tracking-tight leading-[1.08] font-sans"
          >
            Predictable Bundled Plans & Flat-Rate Economics
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[#262523] text-base md:text-lg max-w-3xl mx-auto font-sans leading-relaxed"
          >
            One unified price per minute. No stacked line-item fees for speech recognition, LLM reasoning, or neural voice synthesis.
          </motion.p>
        </section>
      )}

      {/* ── 3 Main Plan Cards Grid ───────────────────────────────────────── */}
      <section className="px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="text-xs font-mono text-[#121212] uppercase tracking-widest">
            | PLANS & BUNDLED MINUTES
          </span>
          <h2 className="text-3xl md:text-4xl font-normal md:font-medium text-[#121212] font-sans tracking-tight">
            Choose The Capacity That Fits Your Operations
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Startup Plan */}
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 flex flex-col justify-between hover:border-[#9C998F] transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-xl text-[#121212] font-sans">Startup Plan</h3>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#262523] bg-[#DFDCD4] border border-[#CBC8BE] px-2 py-0.5 rounded-[1px]">Entry</span>
              </div>
              <p className="text-xs text-[#262523] mb-6 font-sans">For growing businesses testing AI voice automation.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#121212] font-mono">₹3,799</span>
                <span className="text-xs text-[#262523] font-mono"> / month</span>
                <p className="text-xs font-mono font-medium text-[#121212] mt-1">1,000 Bundled Mins (₹3.79/min effective)</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-[#121212] font-sans">
                {[
                  '1,000 Bundled Calling Minutes (₹3.79/min overage)',
                  'Access to All 15 Pre-Built Templates',
                  'Visual Flow Builder & Single Prompt Studio',
                  'Standard Bidirectional Webhooks',
                  '10 Concurrent Call Channels',
                  'Email & Community Support'
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#121212] flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Startup", 3799)} 
              disabled={purchasingPlan === "Startup"}
              className="py-3 px-4 bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider text-xs rounded-[2px] transition-colors w-full flex items-center justify-center gap-2 cursor-pointer font-medium"
            >
              {purchasingPlan === "Startup" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Purchase Startup Plan"}
            </button>
          </div>

          {/* Growth Plan */}
          <div className="bg-[#DFDCD4] border-2 border-[#121212] rounded-[2px] p-8 flex flex-col justify-between relative shadow-sm">
            <div className="absolute -top-3 right-6 bg-[#121212] text-white text-[10px] font-mono font-bold px-3 py-1 rounded-[1px] uppercase tracking-wider">
              MOST POPULAR
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-xl text-[#121212] font-sans">Growth Plan</h3>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#121212] bg-[#EBE9E2] border border-[#CBC8BE] px-2 py-0.5 rounded-[1px]">Recommended</span>
              </div>
              <p className="text-xs text-[#262523] mb-6 font-sans">For high-volume operations scaling phone queues.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#121212] font-mono">₹10,799</span>
                <span className="text-xs text-[#262523] font-mono"> / month</span>
                <p className="text-xs font-mono font-medium text-[#121212] mt-1">2,865 Mins + 1 Free Phone Number Included</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-[#121212] font-sans">
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
                    <Check className="w-4 h-4 text-[#121212] flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Growth", 10799)} 
              disabled={purchasingPlan === "Growth"}
              className="py-3.5 px-4 bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider text-xs rounded-[2px] transition-colors w-full flex items-center justify-center gap-2 cursor-pointer font-medium"
            >
              {purchasingPlan === "Growth" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Purchase Growth Plan <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 flex flex-col justify-between hover:border-[#9C998F] transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-xl text-[#121212] font-sans">Enterprise Plan</h3>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#262523] bg-[#DFDCD4] border border-[#CBC8BE] px-2 py-0.5 rounded-[1px]">Scale</span>
              </div>
              <p className="text-xs text-[#262523] mb-6 font-sans">For regulated enterprise centers requiring SLAs.</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#121212] font-mono">₹30,799</span>
                <span className="text-xs text-[#262523] font-mono"> / month</span>
                <p className="text-xs font-mono font-medium text-[#121212] mt-1">10,000 Mins + 1 Free Phone Number Included</p>
              </div>
              <ul className="space-y-3 mb-8 text-xs text-[#121212] font-sans">
                {[
                  '10,000 Bundled Mins (₹2.99/min overage)',
                  '200+ Unlimited Concurrent Channels',
                  'Dedicated SIP IP Trunking & IP Whitelisting',
                  'MSME Registered Enterprise Verification',
                  'Custom On-Prem / VPC Proxy Egress',
                  'Dedicated Solutions Architect & 99.99% SLA'
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#121212] flex-shrink-0" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => handlePurchase("Enterprise", 30799)} 
              disabled={purchasingPlan === "Enterprise"}
              className="py-3 px-4 bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider text-xs rounded-[2px] transition-colors w-full flex items-center justify-center gap-2 cursor-pointer font-medium"
            >
              {purchasingPlan === "Enterprise" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Purchase Enterprise Plan"}
            </button>
          </div>
        </div>

        {/* Custom Enterprise Banner */}
        <div className="mt-12 bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between text-[#121212]">
          <div className="mb-6 md:mb-0 md:mr-8 text-center md:text-left">
            <h3 className="text-2xl font-medium mb-2 font-sans tracking-tight text-[#121212]">
              Need a Custom Enterprise Contract or On-Premise Gateway?
            </h3>
            <p className="text-[#262523] text-sm font-sans max-w-2xl leading-relaxed">
              For volume discounts above 30,000 minutes, dedicated telecom SIP trunks, or custom SLA contracts, our solution engineers can build a tailored deployment package.
            </p>
          </div>
          <button 
            onClick={() => setPage ? setPage("contact") : window.location.href = "/contact"}
            className="py-3.5 px-8 bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider text-xs rounded-[2px] transition-colors whitespace-nowrap cursor-pointer font-medium"
          >
            Contact Sales Team
          </button>
        </div>
      </section>

    </div>
  );
}
