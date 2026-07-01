'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Layers,
  PhoneCall,
  BarChart3,
  Link2,
  Settings,
  BookOpen,
  Menu,
  X,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  Sparkles,
  User,
  HelpCircle,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Navigation config matches the required system specification
  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Agents Library', href: '/agents', icon: Bot },
    { label: 'Test HR Agent', href: '/test-hr', icon: Sparkles },
    { label: 'Templates Gallery', href: '/templates', icon: Layers },
    { label: 'Phone Numbers', href: '/phone-numbers', icon: PhoneCall },
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Integrations', href: '/integrations', icon: Link2 },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  // Helper to render current breadcrumb label based on active route
  const getBreadcrumb = () => {
    if (pathname === '/dashboard') return 'Dashboard';
    const active = navItems.find((item) => item.href !== '/dashboard' && pathname.startsWith(item.href));
    return active ? active.label : 'Dashboard';
  };

  const activeUser = session?.user as any;

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden font-sans">
      {/* Sidebar navigation */}
      <aside
        className={cn(
          'bg-slate-950 border-r border-slate-800/80 transition-all duration-300 ease-in-out z-20 flex flex-col',
          isSidebarOpen ? 'w-[280px]' : 'w-[80px]'
        )}
      >
        {/* Sidebar Header with Brand */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            {isSidebarOpen && (
              <span className="font-semibold text-sm bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent tracking-tight font-sans whitespace-nowrap">
                Clarity AI Voice
              </span>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-slate-400 hover:text-slate-200 focus:outline-none shrink-0"
          >
            {isSidebarOpen ? <X className="h-4 w-4 lg:hidden" /> : <Menu className="h-5 w-5 lg:hidden" />}
          </button>
        </div>

        {/* Tenant Header (Custom white-labeling variable) */}
        {isSidebarOpen && activeUser?.tenant_name && (
          <div className="mx-4 my-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800/50 flex flex-col space-y-1">
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Workspace</span>
            <span className="text-xs font-semibold text-slate-300 truncate">{activeUser.tenant_name}</span>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link key={item.label} href={item.href}>
                <div
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group cursor-pointer my-0.5',
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-sm shadow-blue-500/5'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-blue-400' : 'text-slate-400')} />
                  {isSidebarOpen && <span className="truncate">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Documentation links */}
        <div className="p-3 border-t border-slate-800/80">
          <a
            href="https://docs.bolna.ai"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 transition-colors',
              !isSidebarOpen && 'justify-center'
            )}
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            {isSidebarOpen && <span>Documentation</span>}
          </a>
        </div>
      </aside>

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between px-6 z-10 shrink-0">
          {/* Top navigation left tools */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-slate-400 hover:text-slate-200 focus:outline-none"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden md:flex items-center bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-1.5 w-64 text-slate-500 focus-within:border-slate-700 focus-within:text-slate-300 transition-all">
              <Search className="h-4 w-4 mr-2" />
              <input
                type="text"
                placeholder="Search resources... (⌘K)"
                className="bg-transparent border-none text-xs focus:outline-none w-full text-slate-300 placeholder-slate-600"
              />
            </div>
          </div>

          {/* Top navigation right indicators */}
          <div className="flex items-center gap-4">
            {/* API credits badge */}
            <div className="flex items-center gap-1.5 bg-blue-950/40 border border-blue-900/30 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-400 shadow-inner">
              <Database className="h-3.5 w-3.5" />
              <span>12,450 Credits</span>
            </div>

            {/* Notification bell */}
            <button className="relative p-1.5 text-slate-400 hover:text-slate-200 focus:outline-none rounded-lg bg-slate-950 border border-slate-800/80 transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-blue-500 rounded-full animate-ping" />
            </button>

            {/* Profile Dropdown & Sign out */}
            {activeUser && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
                <div className="hidden xl:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-200 leading-tight">
                    {activeUser.name || activeUser.email}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    {activeUser.role}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-2 p-1.5 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800/80 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/30 rounded-lg transition-all focus:outline-none"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Dashboard inner content area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Breadcrumbs and Page title */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="hover:text-slate-300 cursor-pointer">Platform</span>
            <ChevronRight className="h-3 w-3" />
            {activeUser?.tenant_name && (
              <>
                <span className="hover:text-slate-300 cursor-pointer max-w-[120px] truncate">{activeUser.tenant_name}</span>
                <ChevronRight className="h-3 w-3" />
              </>
            )}
            <span className="text-slate-300 font-semibold">{getBreadcrumb()}</span>
          </div>

          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
