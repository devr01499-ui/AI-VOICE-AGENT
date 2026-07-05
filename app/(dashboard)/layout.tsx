'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  PhoneCall,
  BarChart3,
  Settings,
  Menu,
  X,
  Search,
  Bell,
  LogOut,
  ChevronRight,
  Sparkles,
  Database,
  ChevronDown,
  History,
  MessageSquare,
  Users,
  Eye,
  CheckSquare,
  FileSpreadsheet,
  CreditCard,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    if (
      typeof window !== 'undefined' && 
      window.location.protocol === 'http:' && 
      window.location.hostname !== 'localhost'
    ) {
      console.warn('Clarity Voice Security Warning: Unencrypted connection detected. Redirecting to secure execution layer...');
      window.location.replace(window.location.href.replace(/^http:/, 'https:'));
    }
  }, []);

  const buildItems = [
    { label: 'Agents', href: '/agents', icon: Bot },
    { label: 'Knowledge Base', href: '/knowledge-base', icon: Database },
  ];

  const deployItems = [
    { label: 'Phone Numbers', href: '/phone-numbers', icon: PhoneCall },
    { label: 'Batch Call', href: '/batch-call', icon: FileSpreadsheet },
  ];

  const dataItems = [
    { label: 'Call History', href: '/call-history', icon: History },
    { label: 'Chat History', href: '/chat-history', icon: MessageSquare },
    { label: 'Contacts', href: '/contacts', icon: Users },
  ];

  const monitorItems = [
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Live Monitoring', href: '/live-monitoring', icon: Eye },
    { label: 'AI Quality Assurance', href: '/ai-qa', icon: CheckSquare },
    { label: 'Alerting', href: '/alerting', icon: Bell },
  ];

  const systemItems = [
    { label: 'Integrations', href: '/integrations', icon: Briefcase },
    { label: 'Billing', href: '/billing', icon: CreditCard },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const getBreadcrumb = () => {
    const allItems = [...buildItems, ...deployItems, ...dataItems, ...monitorItems, ...systemItems];
    const active = allItems.find((item) => pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)));
    return active ? active.label : 'Agents';
  };

  return (
    <div className="flex h-screen bg-[#FDFBF7] overflow-hidden font-sans text-slate-800">
      
      {/* GLOBAL NAVIGATION BAR (Left Column Sidebar) */}
      <aside className="bg-[#090D16] text-[#F8FAFC] border-r border-[#1E293B] w-64 h-screen fixed left-0 top-0 flex flex-col z-20">
        
        {/* Workspace Header Card */}
        <div className="h-16 flex items-center px-4 border-b border-[#1E293B]">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-xl bg-[#4F46E5] flex items-center justify-center shrink-0">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-bold text-xs text-[#F8FAFC] leading-tight">Rohit's Workspace</span>
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                  id: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
                </span>
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <div className="flex-1 px-3 py-4 space-y-4 overflow-y-auto stable-scrollbar">
          
          {/* BUILD GROUP */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              Build
            </span>
            {buildItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link key={item.label} href={item.href}>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group cursor-pointer my-0.5 border border-transparent',
                      isActive
                        ? 'bg-[#4F46E5]/10 text-[#4F46E5] border-[#4F46E5]/20 shadow-sm'
                        : 'text-slate-400 hover:text-[#F8FAFC] hover:bg-slate-800/40'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-[#4F46E5]' : 'text-slate-455')} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* DEPLOY GROUP */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              Deploy
            </span>
            {deployItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link key={item.label} href={item.href}>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group cursor-pointer my-0.5 border border-transparent',
                      isActive
                        ? 'bg-[#4F46E5]/10 text-[#4F46E5] border-[#4F46E5]/20 shadow-sm'
                        : 'text-slate-400 hover:text-[#F8FAFC] hover:bg-slate-800/40'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-[#4F46E5]' : 'text-slate-455')} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* DATA GROUP */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              Data
            </span>
            {dataItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link key={item.label} href={item.href}>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group cursor-pointer my-0.5 border border-transparent',
                      isActive
                        ? 'bg-[#4F46E5]/10 text-[#4F46E5] border-[#4F46E5]/20 shadow-sm'
                        : 'text-slate-400 hover:text-[#F8FAFC] hover:bg-slate-800/40'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-[#4F46E5]' : 'text-slate-455')} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* MONITOR GROUP */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              Monitor
            </span>
            {monitorItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link key={item.label} href={item.href}>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group cursor-pointer my-0.5 border border-transparent',
                      isActive
                        ? 'bg-[#4F46E5]/10 text-[#4F46E5] border-[#4F46E5]/20 shadow-sm'
                        : 'text-slate-400 hover:text-[#F8FAFC] hover:bg-slate-800/40'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-[#4F46E5]' : 'text-slate-455')} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* SYSTEM GROUP */}
          <div className="space-y-1">
            <span className="px-3 text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
              System
            </span>
            {systemItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link key={item.label} href={item.href}>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group cursor-pointer my-0.5 border border-transparent',
                      isActive
                        ? 'bg-[#4F46E5]/10 text-[#4F46E5] border-[#4F46E5]/20 shadow-sm'
                        : 'text-slate-400 hover:text-[#F8FAFC] hover:bg-slate-800/40'
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110', isActive ? 'text-[#4F46E5]' : 'text-slate-455')} />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

        </div>

        {/* FOOTER BLOCK: Account Info & User Profile */}
        <div className="p-3 border-t border-[#1E293B] bg-slate-900/30 space-y-2">
          <div className="px-3 py-2 rounded-xl border border-[#1E293B] bg-slate-950/45 flex items-center justify-between text-[10px]">
            <span className="font-bold text-slate-455 uppercase tracking-wider">Account Tier</span>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-0.5 rounded-full">Free Trial</span>
          </div>
          
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400">
            <div className="h-6 w-6 rounded-full bg-[#4F46E5] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              R
            </div>
            <div className="flex flex-col text-left overflow-hidden min-w-0">
              <span className="text-[11px] font-bold text-[#F8FAFC] truncate">devr01499@gmail.com</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main viewport */}
      <div className="flex-1 pl-64 flex flex-col min-w-0 bg-[#FDFBF7] overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-64 text-slate-400 focus-within:border-slate-350 focus-within:text-slate-700 transition-all">
              <Search className="h-4 w-4 mr-2" />
              <input
                type="text"
                placeholder="Search resources... (⌘K)"
                className="bg-transparent border-none text-xs focus:outline-none w-full text-slate-700 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700">
              <Database className="h-3.5 w-3.5 text-emerald-600" />
              <span>12,450 Credits</span>
            </div>

            <button className="relative p-1.5 text-slate-500 hover:text-slate-750 focus:outline-none rounded-lg bg-slate-50 border border-slate-200 transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-emerald-600 rounded-full animate-ping" />
            </button>

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 p-1.5 text-slate-500 hover:text-slate-750 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-lg transition-all focus:outline-none"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Dashboard inner content area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-[#FDFBF7] stable-scrollbar">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="hover:text-slate-600 cursor-pointer">Console</span>
            <ChevronRight className="h-3 w-3" />
            <span className="hover:text-slate-600 cursor-pointer">Rohit's Workspace</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-700 font-semibold">{getBreadcrumb()}</span>
          </div>

          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
