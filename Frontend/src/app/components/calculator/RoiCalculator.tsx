import { useState } from "react";

export default function RoiCalculator() {
  const [orderVolume, setOrderVolume] = useState(5000); // monthly orders
  const [aov, setAov] = useState(1500); // average order value in INR
  const [codShare, setCodShare] = useState(70); // % COD orders
  const [rtoRate, setRtoRate] = useState(30); // % RTO rate on COD

  const codOrders = (orderVolume * codShare) / 100;
  const rtoOrders = (codOrders * rtoRate) / 100;
  // Shipping cost lost: average ₹150 per RTO order
  const shippingLoss = rtoOrders * 150;
  // Blockage/depreciation/damage: 15% of AOV per RTO order
  const productLoss = rtoOrders * aov * 0.15;
  const totalMonthlyLoss = shippingLoss + productLoss;
  // 40% reduction by Clarity Voice
  const monthlySaved = totalMonthlyLoss * 0.4;
  const annualSaved = Math.round(monthlySaved * 12);

  return (
    <div className="bg-white border border-[#EADEC9] rounded-3xl p-8 md:p-12 shadow-md">
      <div className="mb-10 text-center md:text-left">
        <span className="text-[10px] font-mono tracking-widest text-[#059669] uppercase bg-[#059669]/10 border border-[#059669]/20 px-3 py-1 rounded-full">
          Financial Calculator
        </span>
        <h2 className="font-sora text-3xl font-extrabold text-slate-900 mt-4 tracking-tight">
          Estimate your RTO Savings
        </h2>
        <p className="text-sm text-slate-500 mt-1 font-plus-jakarta">
          Adjust sliders below to see your potential returns on preventing failed shipping deliveries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
        {/* Sliders */}
        <div className="md:col-span-7 space-y-6">
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-2 font-plus-jakarta">
              <span>Monthly Order Volume</span>
              <span className="font-mono text-[#059669] font-bold">{orderVolume.toLocaleString()} orders</span>
            </div>
            <input 
              type="range" 
              min="500" 
              max="50000" 
              step="500"
              value={orderVolume} 
              onChange={(e) => setOrderVolume(Number(e.target.value))}
              className="w-full accent-[#059669] h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-2 font-plus-jakarta">
              <span>Average Order Value (AOV)</span>
              <span className="font-mono text-[#059669] font-bold">₹{aov.toLocaleString()}</span>
            </div>
            <input 
              type="range" 
              min="300" 
              max="5000" 
              step="100"
              value={aov} 
              onChange={(e) => setAov(Number(e.target.value))}
              className="w-full accent-[#059669] h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-2 font-plus-jakarta">
              <span>Cash on Delivery (COD) Share</span>
              <span className="font-mono text-[#059669] font-bold">{codShare}%</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="90" 
              step="5"
              value={codShare} 
              onChange={(e) => setCodShare(Number(e.target.value))}
              className="w-full accent-[#059669] h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-2 font-plus-jakarta">
              <span>Existing RTO Rate (on COD)</span>
              <span className="font-mono text-[#059669] font-bold">{rtoRate}%</span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="50" 
              step="1"
              value={rtoRate} 
              onChange={(e) => setRtoRate(Number(e.target.value))}
              className="w-full accent-[#059669] h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Calculations Result card */}
        <div className="md:col-span-5 bg-gradient-to-tr from-emerald-50/50 to-white border border-[#EADEC9] rounded-2xl p-6 text-center space-y-6 shadow-sm">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">Estimated Annual Savings</p>
            <p className="font-sora text-4xl lg:text-5xl font-extrabold text-[#0F172A] mt-2 tracking-tight">
              ₹{annualSaved.toLocaleString()}
            </p>
            <p className="text-xs text-[#059669] font-bold mt-1 font-mono">Based on 40% reduction in returns</p>
          </div>

          <div className="w-full h-px bg-[#EADEC9]/55" />

          <div className="space-y-2 text-xs text-left text-slate-600 font-plus-jakarta">
            <div className="flex justify-between">
              <span>Monthly COD orders:</span>
              <span className="text-slate-800 font-bold font-mono">{Math.round(codOrders).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Current monthly RTOs:</span>
              <span className="text-slate-800 font-bold font-mono">{Math.round(rtoOrders).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Estimated monthly savings:</span>
              <span className="text-[#059669] font-bold font-mono">₹{Math.round(monthlySaved).toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={() => window.location.pathname = "/dashboard"}
            className="w-full bg-gradient-to-r from-[#059669] to-[#10B981] hover:from-[#10B981] hover:to-[#059669] text-white font-bold text-xs py-3 rounded-full hover:shadow-lg transition-all"
          >
            Claim your RTO reduction
          </button>
        </div>
      </div>
    </div>
  );
}
