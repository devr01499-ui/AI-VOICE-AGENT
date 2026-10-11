import React, { useEffect, useState } from 'react';
import { Search, User, Phone, LayoutDashboard, CreditCard, Shield, Settings, Activity, ArrowRight, X } from 'lucide-react';
import { adminFetch } from '../lib/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : undefined;
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await adminFetch<{ success: boolean; data: any[] }>(
          `/api/v2/admin/customers?q=${encodeURIComponent(query.trim())}&limit=5`
        ).catch(() => ({ success: false, data: [] }));

        if (res.success && Array.isArray(res.data)) {
          setCustomerResults(res.data);
        }
      } catch {
        // Ignore search errors in palette
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const quickNav = [
    { title: 'Overview & Daily Metrics', path: '/overview', icon: LayoutDashboard },
    { title: 'Customers Directory', path: '/customers', icon: User },
    { title: 'Telephony & Live Calls', path: '/calls', icon: Phone },
    { title: 'Plans & Payment Links', path: '/plans', icon: CreditCard },
    { title: 'Staff Governance & Access', path: '/staff', icon: Shield },
    { title: 'System Health & Integrations', path: '/health', icon: Activity },
    { title: 'Platform Settings & Caps', path: '/settings', icon: Settings },
  ].filter((item) => !query.trim() || item.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-800 gap-3">
          {searching ? (
            <div className="h-4 w-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shrink-0" />
          ) : (
            <Search className="h-5 w-5 text-slate-400 shrink-0" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers by email, name, phone, or jump to page... (ESC to close)"
            autoFocus
            className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm font-sans"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-md"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {/* Customers matches */}
          {customerResults.length > 0 && (
            <div className="p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-2 font-mono">
                Matching Customers
              </p>
              <div className="space-y-1">
                {customerResults.map((cust) => (
                  <button
                    key={cust.id}
                    onClick={() => {
                      onNavigate(`/customers/${cust.id}`);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800/60 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white flex items-center gap-2">
                          <span>{cust.fullName || 'Anonymous'}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase ${
                              cust.accountStatus === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {cust.accountStatus}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">{cust.email}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation matches */}
          <div className="p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-2 font-mono">
              Console Navigation
            </p>
            <div className="space-y-1">
              {quickNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      onNavigate(item.path);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800/60 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {item.title}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-300 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span>Claritiy Voice Command Bar</span>
          <span>Press ↑↓ to navigate, Enter to select</span>
        </div>
      </div>
    </div>
  );
};
