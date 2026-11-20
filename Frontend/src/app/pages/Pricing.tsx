import { savePendingPlan, readPendingPlan, clearPendingPlan } from "../lib/pendingPlan";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { API_BASE } from "../api";
import { PUBLIC_PLANS, formatInr, effectiveRate, PLAN_VALIDITY_DAYS, NUMBER_RELEASE_GRACE_DAYS } from '../lib/plans';
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
        savePendingPlan(planName, price);
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
        body: JSON.stringify({ planName })
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
        (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) throw new Error('Payments are not available right now. Please try again later.');

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
            const verifyData = await verifyRes.json().catch(() => ({}));
            // Success is shown ONLY after the server confirmed the payment with the gateway.
            if (verifyRes.ok && verifyData.success) {
              alert(verifyData.data?.alreadyActive
                ? `Your ${verifyData.data?.planName || planName} Plan is already active.`
                : `Success! Your account has been upgraded to the ${verifyData.data?.planName || planName} Plan.`);
              if (setPage) setPage('dashboard');
              else window.location.reload();
            } else if (verifyData.pending) {
              alert(verifyData.error || 'Your payment is being processed. Your plan will be activated automatically within a few minutes.');
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const pending = token ? readPendingPlan() : null;
    if (pending) {
      clearPendingPlan();
      handlePurchase(pending.planName, pending.price);
    }
  }, []);

  return (
    <div className={`${isDashboard ? "space-y-12 pb-12 pt-4 bg-transparent font-sans" : "space-y-20 pb-32 pt-28 bg-[#E5E3DC] min-h-screen relative font-sans text-[#121212]"}`}>
      
      {!isDashboard && (
        <section className="px-6 max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="hatched-strip h-10 w-full mb-8" />
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[2px] bg-[#DFDCD4] border border-[#CBC8BE] text-[#121212] text-xs font-mono uppercase tracking-wider">
            <span>|</span>
            <span>Bundled Minute Plans</span>
          </div>

          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl lg:text-6xl font-normal md:font-medium text-[#121212] tracking-tight leading-[1.08] font-sans"
          >
            Simple Plans With Everything Included
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-[#262523] text-base md:text-lg max-w-3xl mx-auto font-sans leading-relaxed"
          >
            One price per plan covers speech recognition, AI reasoning and natural voices. No separate per-service fees.
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

        {/* Plan cards: every number comes from lib/plans.ts, which mirrors the server's PLAN_CONFIG. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PUBLIC_PLANS.map((plan) => {
            const featured = plan.key === 'growth';
            const features = [
              `${plan.minutes.toLocaleString('en-IN')} calling minutes, valid ${PLAN_VALIDITY_DAYS} days (one-time, no auto-renewal)`,
              '1 local +91 phone number included (after KYC)',
              `Up to ${plan.maxConcurrentCalls} simultaneous call${plan.maxConcurrentCalls === 1 ? '' : 's'}`,
              `${plan.kbDocuments.toLocaleString('en-IN')} knowledge-base documents`,
              `${plan.calendars} connected calendar${plan.calendars === 1 ? '' : 's'} · ${plan.bookingsPerMonth.toLocaleString('en-IN')} bookings / month`,
              'Prompt studio, visual flow builder & templates',
              'Batch campaigns, call recording & analytics',
            ];
            return (
              <div
                key={plan.key}
                data-testid={`plan-card-${plan.key}`}
                className={featured
                  ? 'bg-[#DFDCD4] border-2 border-[#121212] rounded-[2px] p-8 flex flex-col justify-between relative shadow-sm'
                  : 'bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 flex flex-col justify-between hover:border-[#9C998F] transition-colors'}
              >
                {featured && (
                  <div className="absolute -top-3 right-6 bg-[#121212] text-white text-[10px] font-mono font-bold px-3 py-1 rounded-[1px] uppercase tracking-wider">
                    Recommended
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-xl text-[#121212] font-sans">{plan.name} Plan</h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#262523] bg-[#DFDCD4] border border-[#CBC8BE] px-2 py-0.5 rounded-[1px]">{plan.tag}</span>
                  </div>
                  <p className="text-xs text-[#262523] mb-6 font-sans">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-[#121212] font-mono">{formatInr(plan.price)}</span>
                    <span className="text-xs text-[#262523] font-mono"> one-time</span>
                    <p className="text-xs font-mono font-medium text-[#121212] mt-1">
                      {plan.minutes.toLocaleString('en-IN')} minutes · ₹{effectiveRate(plan)}/min effective
                    </p>
                  </div>
                  <ul className="space-y-3 mb-8 text-xs text-[#121212] font-sans">
                    {features.map((feat) => (
                      <li key={feat} className="flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-[#121212] flex-shrink-0" /> <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => handlePurchase(plan.name, plan.price)}
                  disabled={purchasingPlan === plan.name}
                  className="py-3 px-4 bg-[#121212] hover:bg-black text-white font-mono uppercase tracking-wider text-xs rounded-[2px] transition-colors w-full flex items-center justify-center gap-2 cursor-pointer font-medium"
                >
                  {purchasingPlan === plan.name ? <Loader2 className="w-4 h-4 animate-spin" /> : `Purchase ${plan.name} Plan`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-[#262523] font-sans">
          Prices in INR. Each plan is a one-time minute pack valid for {PLAN_VALIDITY_DAYS} days from purchase; unused minutes lapse at the end.
          Your plan ends when its minutes are used up or after {PLAN_VALIDITY_DAYS} days, whichever comes first. Buy any plan again to continue.
          Your phone number is released {NUMBER_RELEASE_GRACE_DAYS} days after your plan ends unless you buy a new plan.
          GST is shown on your invoice.
        </p>

        {/* Custom Enterprise Banner */}
        <div className="mt-12 bg-[#EBE9E2] border border-[#CBC8BE] rounded-[2px] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between text-[#121212]">
          <div className="mb-6 md:mb-0 md:mr-8 text-center md:text-left">
            <h3 className="text-2xl font-medium mb-2 font-sans tracking-tight text-[#121212]">
              Need a Custom Enterprise Contract or On-Premise Gateway?
            </h3>
            <p className="text-[#262523] text-sm font-sans max-w-2xl leading-relaxed">
              For volume discounts above 30,000 minutes, custom telephony requirements, or custom SLA contracts, our solution engineers can build a tailored deployment package.
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
