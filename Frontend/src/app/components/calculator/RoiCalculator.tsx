import { useState } from "react";

export default function RoiCalculator() {
  const [monthlyCalls, setMonthlyCalls] = useState(5000);
  const [avgDurationMinutes, setAvgDurationMinutes] = useState(2);

  // Constants
  const clarityCostPerMin = 3.99;
  const manualCostPerCall = 15; // Assume ₹15 per manual call (salary + overhead)

  // Calculations
  const totalMinutes = monthlyCalls * avgDurationMinutes;
  const clarityCost = totalMinutes * clarityCostPerMin;
  const manualCost = monthlyCalls * manualCostPerCall;
  const monthlySavings = manualCost - clarityCost;

  return (
    <div className="bg-surface-white border border-border-soft rounded-3xl p-8 md:p-12 shadow-level-2 mt-20">
      <div className="mb-10 text-center md:text-left">
        <span className="text-[10px] font-mono tracking-widest text-mint-primary uppercase bg-mint-soft px-3 py-1 rounded-full">
          Financial Calculator
        </span>
        <h2 className="text-h2 text-ink mt-4">
          Calculate Your Cost Savings
        </h2>
        <p className="text-body text-ink-muted mt-2">
          Compare the cost of manual call center agents vs Clarity AI Voice.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
        {/* Sliders */}
        <div className="md:col-span-7 space-y-8">
          <div>
            <div className="flex justify-between text-small font-bold text-ink mb-2">
              <span>Monthly Calls</span>
              <span className="font-mono text-mint-primary">{monthlyCalls.toLocaleString()} calls</span>
            </div>
            <input 
              type="range" 
              min="1000" 
              max="100000" 
              step="1000"
              value={monthlyCalls} 
              onChange={(e) => setMonthlyCalls(Number(e.target.value))}
              className="w-full accent-mint-primary h-2 bg-cream-bg rounded-lg appearance-none cursor-pointer border border-border-soft"
            />
          </div>

          <div>
            <div className="flex justify-between text-small font-bold text-ink mb-2">
              <span>Average Call Duration (Minutes)</span>
              <span className="font-mono text-mint-primary">{avgDurationMinutes} mins</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="10" 
              step="1"
              value={avgDurationMinutes} 
              onChange={(e) => setAvgDurationMinutes(Number(e.target.value))}
              className="w-full accent-mint-primary h-2 bg-cream-bg rounded-lg appearance-none cursor-pointer border border-border-soft"
            />
          </div>
        </div>

        {/* Calculations Result card */}
        <div className="md:col-span-5 bg-mint-soft/30 border border-mint-primary/20 rounded-2xl p-6 text-center space-y-6">
          <div>
            <p className="text-caption text-ink-muted uppercase tracking-widest font-mono font-bold">Estimated Monthly Savings</p>
            <p className="text-display text-mint-primary mt-2">
              ₹{Math.max(0, monthlySavings).toLocaleString()}
            </p>
            <p className="text-xs text-ink-muted mt-2">Versus traditional manual calling</p>
          </div>

          <div className="w-full h-px bg-border-soft" />

          <div className="space-y-3 text-small text-left text-ink font-semibold">
            <div className="flex justify-between">
              <span>Current Manual Cost:</span>
              <span className="font-mono text-error">₹{manualCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Clarity AI Cost (₹3.99/min):</span>
              <span className="font-mono text-mint-primary">₹{Math.round(clarityCost).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
