import React, { useState, useEffect } from 'react';
import { X, Layers, CheckCircle2, Search, Sliders, ShieldCheck } from 'lucide-react';
import { reportsApi, type BlueprintSummary } from '../../api';

interface BlueprintCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BlueprintCatalogModal({ isOpen, onClose }: BlueprintCatalogModalProps) {
  const [blueprints, setBlueprints] = useState<BlueprintSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    reportsApi.getBlueprints()
      .then((data) => setBlueprints(data || []))
      .catch(() => setBlueprints([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const industries = Array.from(new Set(blueprints.map((b) => b.industry)));

  const filtered = blueprints.filter((b) => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase()) ||
      b.labels.some((l) => l.toLowerCase().includes(search.toLowerCase()));
    const matchesIndustry = selectedIndustry === 'all' || b.industry === selectedIndustry;
    return matchesSearch && matchesIndustry;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-10 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-sora text-slate-900 dark:text-white">
                Deterministic Report Blueprints (15 Verticals)
              </h2>
              <p className="text-xs text-slate-500">
                Authoritative outcome rubrics and verbatim grounding specs for Indian business workflows.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="nm-icon-btn p-2" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search blueprints, outcome labels, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Industry:</span>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="all">All Industries ({blueprints.length})</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading blueprint catalog...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No blueprints match your search filters.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((bp) => (
                <div
                  key={bp.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                        {bp.id}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {bp.industry}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{bp.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{bp.description}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                      Mutually Exclusive Outcome Labels:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {bp.labels.map((lbl) => (
                        <span
                          key={lbl}
                          className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        >
                          {lbl}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{bp.fieldCount} verified fields</span>
                    <span className="text-emerald-500 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verbatim Grounded
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
