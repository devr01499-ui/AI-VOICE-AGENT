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
  BarChart3,
  Receipt,
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
    { label: 'Usage & Telemetry', path: '/usage', icon: BarChart3, perm: 'metrics:view' },
    { label: 'Phone Numbers', path: '/numbers', icon: Hash, perm: 'numbers:activate' },
    { label: 'Payments & GST', path: '/payments', icon: Receipt, perm: 'payments:view' },
    { label: 'Plans & Links', path: '/plans', icon: CreditCard, perm: 'plans:manage' },
    { label: 'Staff Governance', path: '/staff', icon: ShieldCheck, perm: 'staff:manage' },
    { label: 'System Health', path: '/health', icon: Activity, perm: 'metrics:view' },
    { label: 'Audit Logs', path: '/audit-logs', icon: FileText, perm: 'audit:view' },
    { label: 'Settings', path: '/settings', icon: Settings, perm: 'settings:manage' },
  ].filter((item) => !item.perm || hasPermission(item.perm as any));

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row antialiased font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-black border-r border-zinc-800/90 shrink-0 h-screen sticky top-0 z-30">
        {/* Brand Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white text-black flex items-center justify-center font-extrabold text-base shadow-sm">
              C
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                Claritiy Voice
              </div>
              <div className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                ADMIN CONSOLE
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 font-medium">
            LIVE
          </span>
        </div>

        {/* Quick Search Button */}
        <div className="px-4 py-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 text-xs transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-zinc-500" />
              <span>Search console...</span>
            </span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
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
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-black' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-black" />}
              </button>
            );
          })}
        </nav>

        {/* Staff Profile Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950">
          <div className="flex items-center justify-between mb-3">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-white truncate">{staff?.name || 'Staff'}</p>
              <p className="text-[11px] text-zinc-400 truncate">{staff?.email}</p>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-700 shrink-0">
              {staff?.role}
            </span>
          </div>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-black border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-white text-black flex items-center justify-center font-bold text-sm">
            C
          </div>
          <span className="font-bold text-sm text-white">Claritiy Voice Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800"
          >
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-950 border-b border-zinc-800 p-4 space-y-2 animate-in slide-in-from-top duration-150">
          {navItems.map((item) => {
            const isActive = currentPath.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  onNavigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-black font-semibold' : 'text-zinc-300 hover:bg-zinc-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-zinc-800">
            <button
              onClick={() => signOut()}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-black">
        {/* Top Navbar */}
        <header className="hidden md:flex items-center justify-between h-14 px-8 border-b border-zinc-800/80 bg-black/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>CONSOLE</span>
            <span className="text-zinc-600">/</span>
            <span className="text-white capitalize">{currentPath.replace('/', '') || 'Overview'}</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://www.claritiy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-colors"
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
