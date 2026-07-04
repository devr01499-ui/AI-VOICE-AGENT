'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Menu, X, Shield, Globe, Award, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { label: 'Home', href: '/' },
    { label: 'Industries', href: '/industries' },
    { label: 'Blog', href: '/blog' },
    { label: 'Subscription', href: '/subscription' },
    { label: 'Contact Us', href: '/contact' },
  ];

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-700 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-800">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-800 font-sans">
              Clarity AI Voice
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider transition-colors',
                    isActive ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-855'
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/agents">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-555 text-white text-xs font-bold shadow-sm">
                Go to Console
              </Button>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-800"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-6 py-4 space-y-4 animate-in slide-in-from-top duration-200">
            <nav className="flex flex-col gap-3">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider py-1.5 transition-colors',
                    pathname === link.href ? 'text-emerald-700 font-bold' : 'text-slate-500'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="pt-2 border-t border-slate-200">
              <Link href="/agents" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full bg-emerald-600 text-white font-bold text-xs h-9">
                  Go to Console
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Page Content viewport */}
      <main className="flex-1 w-full relative overflow-hidden bg-[#FDFBF7]">
        {/* Ambient background light glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] rounded-full bg-slate-500/5 blur-[120px] pointer-events-none" />
        {children}
      </main>

      {/* Premium Light Footer */}
      <footer className="w-full border-t border-slate-200 bg-white py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand block */}
          <div className="space-y-4 col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-emerald-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-base text-slate-800">Clarity AI</span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed">
              Enterprise-grade real-time conversational Voice AI platforms. Build, deploy, and scale human-like voice agents natively integrated into telephony carriers.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <Shield className="h-3 w-3 text-emerald-600" /> ISO 27001 Certified
            </div>
          </div>

          {/* Links columns */}
          <div>
            <h4 className="text-xs font-bold uppercase text-slate-700 tracking-widest mb-4">Core Platform</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><Link href="/agents" className="hover:text-emerald-700 transition-colors">Design Configuration Studio</Link></li>
              <li><Link href="/agents" className="hover:text-emerald-700 transition-colors">Live Telephony Playground</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase text-slate-700 tracking-widest mb-4">Resources</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><Link href="/blog" className="hover:text-emerald-700 transition-colors">Technical Articles & Insights</Link></li>
              <li><a href="https://docs.clarityvoice.ai" target="_blank" rel="noreferrer" className="hover:text-emerald-700 transition-colors font-semibold flex items-center gap-1">Developer API Docs <Globe className="h-3 w-3" /></a></li>
              <li><Link href="/contact" className="hover:text-emerald-700 transition-colors">Book a Live Telephony Demo</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase text-slate-700 tracking-widest mb-4">Compliance & Geo-presence</h4>
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Global Edge voice clusters routed locally in USA (Oregon/Virginia), EU (Frankfurt), and APAC (Mumbai/Singapore) to reduce turn-taking audio latency under 200ms.
              </p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">
                  <Award className="h-3 w-3 text-amber-500" /> HIPAA Compliant
                </span>
                <span className="flex items-center gap-1 text-[9px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">
                  <Bot className="h-3 w-3 text-emerald-600" /> GDPR Aligned
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-slate-500">
          <span>&copy; {new Date().getFullYear()} Clarity AI Voice Systems, Inc. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="hover:underline">Privacy Policy</Link>
            <Link href="/contact" className="hover:underline">Terms of Service</Link>
            <Link href="/contact" className="hover:underline">SLA Commitments</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
