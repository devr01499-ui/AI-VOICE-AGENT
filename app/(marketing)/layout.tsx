'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Menu, X, PhoneCall, Bot, Shield, Globe, Award } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600/30 selection:text-blue-200">
      {/* Dynamic Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white animate-pulse" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-400 bg-clip-text text-transparent font-sans">
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
                    isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/dashboard">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md hover:shadow-blue-500/20">
                Go to Console
              </Button>
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-200"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-900 bg-slate-950 px-6 py-4 space-y-4 animate-in slide-in-from-top duration-200">
            <nav className="flex flex-col gap-3">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider py-1.5 transition-colors',
                    pathname === link.href ? 'text-blue-400' : 'text-slate-400'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="pt-2 border-t border-slate-900">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full bg-blue-600 text-white font-bold text-xs h-9">
                  Go to Console
                </Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Page Content viewport */}
      <main className="flex-1 w-full relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />
        {children}
      </main>

      {/* Premium Dark Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950 py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand block */}
          <div className="space-y-4 col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-blue-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-base text-white">Clarity AI</span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed">
              Enterprise-grade real-time conversational Voice AI platforms. Build, deploy, and scale human-like voice agents natively integrated into telephony carriers.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold uppercase tracking-wider">
              <Shield className="h-3 w-3 text-blue-500" /> ISO 27001 Certified
            </div>
          </div>

          {/* Links columns */}
          <div>
            <h4 className="text-xs font-bold uppercase text-white tracking-widest mb-4">Industries</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><Link href="/industries" className="hover:text-blue-400 transition-colors">Healthcare & Patient Intake</Link></li>
              <li><Link href="/industries" className="hover:text-blue-400 transition-colors">Retail & E-commerce qualification</Link></li>
              <li><Link href="/industries" className="hover:text-blue-400 transition-colors">Real Estate Lead Screening</Link></li>
              <li><Link href="/industries" className="hover:text-blue-400 transition-colors">Logistics & Supply chain routing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase text-white tracking-widest mb-4">Resources</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><Link href="/blog" className="hover:text-blue-400 transition-colors">Technical Articles & Insights</Link></li>
              <li><a href="https://docs.bolna.ai" target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors font-semibold flex items-center gap-1">Developer API Docs <Globe className="h-3 w-3" /></a></li>
              <li><Link href="/subscription" className="hover:text-blue-400 transition-colors">Subscription Pricing Plans</Link></li>
              <li><Link href="/contact" className="hover:text-blue-400 transition-colors">Book a Live Telephony Demo</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase text-white tracking-widest mb-4">Compliance & Geo-presence</h4>
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Global Edge voice clusters routed locally in USA (Oregon/Virginia), EU (Frankfurt), and APAC (Mumbai/Singapore) to reduce turn-taking audio latency under 200ms.
              </p>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase">
                  <Award className="h-3 w-3 text-amber-500" /> HIPAA Compliant
                </span>
                <span className="flex items-center gap-1 text-[9px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase">
                  <Bot className="h-3 w-3 text-blue-500" /> GDPR Aligned
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-slate-600">
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
