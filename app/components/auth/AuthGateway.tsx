'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, ShieldAlert, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';

interface AuthGatewayProps {
  onSuccess?: () => void;
}

export function AuthGateway({ onSuccess }: AuthGatewayProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        if (onSuccess) onSuccess();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
            data: { full_name: fullName },
          },
        });
        if (signUpError) throw signUpError;
        setMessage('A verification link has been sent to your email. Please confirm to activate your workspace.');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 text-sm bg-[#FAF8F5] border border-[#EADEC9] rounded-2xl text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/40 focus:border-[#059669]/50 transition-all font-medium";
  const labelClass = "text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5 font-mono";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FAF8F5] px-6 py-10">
      <div className="w-full max-w-md bg-white rounded-[28px] border border-[#EADEC9] shadow-xl overflow-hidden">
        <div className="px-8 py-6 text-center bg-emerald-50/50 border-b border-emerald-100">
          <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">
            {mode === 'signin' ? 'Welcome Back to Claritiy Voice' : 'Create Your Workspace'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {mode === 'signin' ? 'Sign in to access your AI voice agent dashboard' : 'Start building human-like voice agents'}
          </p>
        </div>

        <div className="p-7 space-y-5">
          <div className="flex bg-[#FAF8F5] p-1 rounded-2xl border border-[#EADEC9]">
            <button
              onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'signin' ? 'bg-white text-[#059669] shadow-sm border border-[#EADEC9]' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'signup' ? 'bg-white text-[#059669] shadow-sm border border-[#EADEC9]' : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Sign Up
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-3.5 text-xs flex items-start gap-2.5 font-medium">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {message && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-3.5 text-xs font-semibold leading-relaxed">
              ✅ {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className={labelClass}>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pl-10 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
            >
              {loading ? 'Authenticating…' : mode === 'signin' ? 'Sign In to Dashboard' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
