import { motion } from "motion/react";
import CompareTable from "../components/compare/CompareTable";

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

interface CompareProps {
  setPage: (p: Page) => void;
}

export default function Compare({ setPage }: CompareProps) {
  return (
    <div className="space-y-12 pb-20 pt-10 text-slate-600">
      <section className="px-6 max-w-5xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <p className="text-xs font-semibold text-cyan-600 tracking-widest uppercase mb-4 font-mono">
            Orchestration Comparison
          </p>
          <h1 className="font-sora text-5xl lg:text-6xl font-extrabold leading-tight text-[#0F172A] tracking-tight">
            Why High-Growth Companies Switch from Retell, Vapi, and Bolna
          </h1>
          <p className="text-base text-slate-500 max-w-2xl mx-auto mt-6 leading-relaxed font-plus-jakarta font-semibold">
            Evaluate cost breakdowns, pipeline latency parameters, and regional dialect configurations side-by-side.
          </p>
        </motion.div>
      </section>

      {/* Comparison table matrix */}
      <section className="px-6 max-w-7xl mx-auto">
        <CompareTable />
      </section>
    </div>
  );
}
