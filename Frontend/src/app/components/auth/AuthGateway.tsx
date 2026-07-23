import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { motion } from 'motion/react';
import { Mail, Lock, ShieldAlert, Chrome, LogIn, UserPlus } from 'lucide-react';

export default function AuthGateway() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState('Individual');
  const [contactNumber, setContactNumber] = useState('');
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
      } else {
        console.log("[Auth Gateway Process]: Initiating registration handshake with payload parameters...");
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName,
              account_type: accountType,
              contact_number: contactNumber,
            }
          }
        });
        if (signUpError) throw signUpError;
        console.log("[Auth Gateway Success]: Verification token dispatched successfully.");
        setMessage('A security verification link has been sent to your email address. Please confirm your link to activate your workspace.');
      }
    } catch (err: any) {
      console.error("[Auth Gateway Fatal Exception Captured]:", err.message || err);
      setError(err.message || "An unexpected registration configuration failure occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message || 'Google OAuth failed to initialize.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-cream-bg px-4 py-8 relative overflow-hidden">
      {/* Background ambient glowing soundwaves */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-mint-primary/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-cta/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      
      {/* Centered Transparent AI Voice Node Visualizer */}
      <div className="opacity-20 pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }} 
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="w-[600px] h-[600px] rounded-full border border-mint-primary/40 border-dashed flex items-center justify-center"
        >
          <div className="w-[450px] h-[450px] rounded-full border border-amber-cta/40 border-dashed flex items-center justify-center">
            <div className="w-[300px] h-[300px] rounded-full border border-mint-primary/40 flex items-center justify-center">
              <div className="w-20 h-20 bg-mint-primary/30 rounded-full blur-md animate-ping" />
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md bg-white/90 border border-emerald-900/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col z-10"
      >
        <div className="p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-950 tracking-tight" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Clarity Voice Platform
            </h2>
            <p className="text-sm text-slate-500 font-medium" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Secure Multi-Tenant Agent Administration Gateway
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin' 
                  ? 'bg-white text-slate-950 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup' 
                  ? 'bg-white text-slate-950 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              <UserPlus className="w-3.5 h-3.5" /> Sign Up
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="leading-normal font-medium">{error}</p>
            </div>
          )}

          {message && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl p-3.5 text-xs font-semibold leading-relaxed">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-slate-950 transition-all font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    Account Type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-slate-950 transition-all font-medium"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Company">Company</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700" style={{ fontFamily: "'Figtree', sans-serif" }}>
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +1234567890"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-slate-950 transition-all font-medium"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700" style={{ fontFamily: "'Figtree', sans-serif" }}>
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="e.g. devr01499@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-slate-950 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700" style={{ fontFamily: "'Figtree', sans-serif" }}>
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:border-slate-950 transition-all font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-mint-primary to-[#10B981] hover:from-[#10B981] hover:to-mint-primary text-white font-bold text-sm shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: "'Figtree', sans-serif" }}
            >
              {loading ? 'Processing authentication...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Social OAuth Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: "'Figtree', sans-serif" }}>
              Or Continue With
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleOAuth}
            className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200 shadow-sm transition-colors flex items-center justify-center gap-2"
            style={{ fontFamily: "'Figtree', sans-serif" }}
          >
            <Chrome className="w-4 h-4 text-red-500" /> Google Login
          </button>
        </div>
      </motion.div>
    </div>
  );
}
