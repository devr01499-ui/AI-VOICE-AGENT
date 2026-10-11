import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CommandPalette } from '../CommandPalette';
import {
  LayoutDashboard,
  Users,
  PhoneCall,
  Hash,
  CreditCard,
  ShieldCheck,
  Activity,
  Settings,
  FileText,
  LogOut,
  Search,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface AdminLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ currentPath, onNavigate, children }) => {
  const { staff, signOut, hasPermission } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Overview', path: '/overview', icon: LayoutDashboard },
    { label: 'Customers', path: '/customers', icon: Users, perm: 'customers:view' },
    { label: 'Calls & Telephony', path: '/calls', icon: PhoneCall },
    { label: 'Phone Numbers', path: '/numbers', icon: Hash, perm: 'numbers:activate' },
    { label: 'Plans & Links', path: '/plans', icon: CreditCard, perm: 'plans:manage' },
    { label: 'Staff Governance', path: '/staff', icon: ShieldCheck, perm: 'staff:manage' },
    { label: 'System Health', path: '/health', icon: Activity, perm: 'metrics:view' },
    { label: 'Audit Logs', path: '/audit-logs', icon: FileText, perm: 'audit:view' },
    { label: 'Settings', path: '/settings', icon: Settings, perm: 'settings:manage' },
  ].filter((item) => !item.perm || hasPermission(item.perm as any));

  const roleColors: Record<string, string> = {
    owner: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    admin: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    sales: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    support: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    finance: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900/60 border-r border-slate-800/80 backdrop-blur-xl shrink-0 h-screen sticky top-0 z-30">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 text-base">
              C
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                Claritiy Voice
              </div>
              <div className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                ADMIN CONSOLE
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            LIVE
          </span>
        </div>

        {/* Quick Search Button */}
        <div className="px-4 py-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 text-xs transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-500" />
              <span>Search console...</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />}
              </button>
            );
          })}
        </nav>

        {/* Staff Profile Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-white truncate">{staff?.name || 'Staff'}</p>
              <p className="text-[11px] text-slate-400 truncate">{staff?.email}</p>
            </div>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${
                roleColors[staff?.role || 'support'] || 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {staff?.role}
            </span>
          </div>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 text-xs transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
            C
          </div>
          <span className="font-bold text-sm text-white">Claritiy Voice Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 space-y-2 animate-in slide-in-from-top duration-150">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                onNavigate(item.path);
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => signOut()}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-950/20"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="hidden md:flex items-center justify-between h-14 px-8 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>CONSOLE</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 capitalize">{currentPath.replace('/', '') || 'Overview'}</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://www.claritiy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-900 transition-colors"
            >
              <span>Customer Portal</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </header>

        {/* Page Content Body */}
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
