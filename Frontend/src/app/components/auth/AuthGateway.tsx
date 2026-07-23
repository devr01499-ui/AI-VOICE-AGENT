import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, Lock, ShieldAlert, LogIn, UserPlus, Eye, EyeOff,
  Mic, Radio, Cpu, Globe, Shield, Phone, Zap, Check,
} from 'lucide-react';

// ── Animated AI Voice Visualizer (replaces Lottie) ──────────────────────────
function AIVoiceVisualizer() {
  const [bars, setBars] = useState(Array.from({ length: 28 }, () => 0.3));
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    let t = 0;
    const animate = () => {
      t += 0.06;
      setBars(prev => prev.map((_, i) => {
        const sine = Math.sin(t + i * 0.35) * 0.5 + 0.5;
        const noise = Math.sin(t * 2.1 + i * 0.8) * 0.25;
        return Math.max(0.08, Math.min(1, sine + noise));
      }));
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {bars.map((h, i) => (
        <div
          key={i}
          className="rounded-full transition-all"
          style={{
            width: '3px',
            height: `${h * 64}px`,
            background: i % 3 === 0
              ? 'linear-gradient(180deg, #34D399, #059669)'
              : i % 3 === 1
              ? 'rgba(255,255,255,0.4)'
              : 'linear-gradient(180deg, #EA580C, #D97706)',
            opacity: 0.7 + h * 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ── Orbiting feature pill ────────────────────────────────────────────────────
function FeaturePill({ icon: Icon, label, angle, radius = 160 }: {
  icon: React.ElementType; label: string; angle: number; radius?: number;
}) {
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <motion.div
      className="absolute flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3 py-1.5"
      style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%, -50%)' }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: angle / 360 + 0.5, duration: 0.5 }}
    >
      <Icon className="w-3 h-3 text-[#34D399]" />
      <span className="text-[10px] font-bold text-white/90 whitespace-nowrap font-mono">{label}</span>
    </motion.div>
  );
}

// ── Pulsing core sphere ──────────────────────────────────────────────────────
function PulsingCore() {
  return (
    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
      {[1, 1.5, 2, 2.5].map((scale, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full"
          style={{ border: `1px solid rgba(52,211,153,${0.4 - i * 0.08})` }}
          animate={{ scale: [1, scale, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        />
      ))}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_32px_rgba(5,150,105,0.6)]"
        style={{ background: 'linear-gradient(135deg, #059669, #34D399)' }}
      >
        <Mic className="w-7 h-7 text-white" />
      </div>
    </div>
  );
}

// ── Social proof ticker ──────────────────────────────────────────────────────
const FEATURES = [
  '< 180ms Voice Latency',
  'SOC 2 Type II Certified',
  '70+ Languages Supported',
  'HIPAA BAA Available',
  'Real-Time Transcription',
  'Enterprise Grade Security',
];

// ── Left panel — the AI showcase ─────────────────────────────────────────────
function LeftPanel() {
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTicker(v => (v + 1) % FEATURES.length), 2500);
    return () => clearInterval(t);
  }, []);

  const pills = [
    { icon: Zap, label: '<180ms Latency', angle: -70 },
    { icon: Globe, label: '70+ Languages', angle: -10 },
    { icon: Shield, label: 'SOC 2 / HIPAA', angle: 50 },
    { icon: Phone, label: 'Inbound + Outbound', angle: 115 },
    { icon: Cpu, label: 'Native Multimodal', angle: 175 },
    { icon: Radio, label: 'Real-Time ASR/TTS', angle: 235 },
  ];

  return (
    <div
      className="hidden lg:flex flex-col justify-between relative overflow-hidden w-[55%] p-10 text-white"
      style={{ background: 'linear-gradient(145deg, #0D2B20 0%, #1B4332 45%, #0A3622 100%)' }}
    >
      {/* Dot grid texture */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Glow blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 opacity-20 rounded-full"
        style={{ background: 'radial-gradient(circle, #34D399, transparent)' }} />
      <div className="absolute bottom-0 left-0 w-48 h-48 opacity-15 rounded-full"
        style={{ background: 'radial-gradient(circle, #EA580C, transparent)' }} />

      {/* Top: Brand */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <img src="/logo.png" alt="Clarity Voice" className="h-9 w-auto object-contain" />
          <span className="text-xl font-extrabold tracking-tight">
            Clarity<span className="text-[#34D399]">Voice</span>
          </span>
        </div>
        <p className="text-xs text-white/50 font-mono uppercase tracking-widest">
          Enterprise AI Voice Platform
        </p>
      </div>

      {/* Middle: Animated visualizer + orbiting pills */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center py-8">
        {/* Orbit ring */}
        <div className="relative w-80 h-80 flex items-center justify-center">
          {/* Outer dashed orbit rings */}
          <motion.div
            className="absolute w-72 h-72 rounded-full border border-white/10 border-dashed"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute w-52 h-52 rounded-full border border-[#34D399]/20 border-dashed"
            animate={{ rotate: -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />

          {/* Feature pills orbiting */}
          {pills.map((p, i) => (
            <FeaturePill key={i} {...p} radius={148} />
          ))}

          {/* Center: pulsing sphere + waveform */}
          <div className="flex flex-col items-center gap-4 z-10">
            <PulsingCore />
            <AIVoiceVisualizer />
          </div>
        </div>
      </div>

      {/* Bottom: Live ticker */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl px-5 py-3">
          <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse flex-shrink-0" />
          <AnimatePresence mode="wait">
            <motion.p
              key={ticker}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="text-sm font-semibold text-white/90"
            >
              {FEATURES[ticker]}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between mt-4">
          {['SOC 2', 'HIPAA', 'ISO 27001', 'GDPR', 'PCI'].map(b => (
            <span key={b} className="text-[9px] font-bold text-white/40 font-mono uppercase tracking-wider flex items-center gap-1">
              <Check className="w-2.5 h-2.5 text-[#34D399]" /> {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Auth Gateway ─────────────────────────────────────────────────────────
export default function AuthGateway() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, account_type: accountType, contact_number: contactNumber },
          },
        });
        if (signUpError) throw signUpError;
        setMessage('A verification link has been sent to your email. Please confirm to activate your workspace.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    }
  };

  const inputClass = "w-full px-4 py-3 text-sm bg-[#FAF8F5] border border-[#EADEC9] rounded-2xl text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#059669]/40 focus:border-[#059669]/50 transition-all font-medium";
  const labelClass = "text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5 font-mono";

  return (
    <div className="min-h-screen w-full flex bg-[#FAF8F5]">
      {/* LEFT: AI showcase panel */}
      <LeftPanel />

      {/* RIGHT: Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 relative overflow-hidden">
        {/* Mobile bg blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, #D1FAE5, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 translate-x-1/4 translate-y-1/4"
          style={{ background: 'radial-gradient(circle, #FEF3C7, transparent)' }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm relative z-10"
        >
          {/* Mobile: show mini visualizer */}
          <div className="lg:hidden mb-6 p-4 rounded-2xl text-center"
            style={{ background: 'linear-gradient(135deg, #1B4332, #0D2B20)' }}>
            <AIVoiceVisualizer />
            <p className="text-white/60 text-xs mt-2 font-mono">Clarity Voice — AI Voice Platform</p>
          </div>

          {/* Card */}
          <div
            className="bg-white rounded-[28px] border border-[#EADEC9] overflow-hidden"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)' }}
          >
            {/* Header stripe */}
            <div
              className="px-8 py-6 text-center"
              style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)', borderBottom: '1px solid #D1FAE5' }}
            >
              <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                {mode === 'signin' ? 'Welcome Back' : 'Create Workspace'}
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {mode === 'signin'
                  ? 'Sign in to your AI voice agent dashboard'
                  : 'Start building AI calling agents for free'}
              </p>
            </div>

            <div className="p-7 space-y-5">
              {/* Tab switcher */}
              <div className="flex bg-[#FAF8F5] p-1 rounded-2xl border border-[#EADEC9]">
                {(['signin', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(''); setMessage(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-all ${mode === m
                      ? 'bg-white text-[#059669] shadow-sm border border-[#EADEC9]'
                      : 'text-slate-400 hover:text-slate-700'
                      }`}
                  >
                    {m === 'signin' ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                    {m === 'signin' ? 'Sign In' : 'Sign Up'}
                  </button>
                ))}
              </div>

              {/* Error/success banners */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-50 border border-red-200 text-red-600 rounded-2xl p-3.5 text-xs flex items-start gap-2.5"
                  >
                    <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p className="font-medium">{error}</p>
                  </motion.div>
                )}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-3.5 text-xs font-semibold leading-relaxed"
                  >
                    ✅ {message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence>
                  {mode === 'signup' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div>
                        <label className={labelClass}>Full Name</label>
                        <input type="text" required placeholder="e.g. John Doe" value={fullName}
                          onChange={e => setFullName(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Account Type</label>
                        <select value={accountType} onChange={e => setAccountType(e.target.value)} className={inputClass}>
                          <option value="Individual">Individual</option>
                          <option value="Company">Company / Enterprise</option>
                          <option value="Agency">Agency / Partner</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Contact Number</label>
                        <input type="tel" required placeholder="+91 99999 99999" value={contactNumber}
                          onChange={e => setContactNumber(e.target.value)} className={inputClass} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input type="email" required placeholder="you@company.com" value={email}
                      onChange={e => setEmail(e.target.value)}
                      className={`${inputClass} pl-10`} />
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
                      onChange={e => setPassword(e.target.value)}
                      className={`${inputClass} pl-10 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                    boxShadow: '0 6px 20px rgba(5,150,105,0.3)',
                  }}
                >
                  {loading
                    ? '⏳ Authenticating…'
                    : mode === 'signin' ? '🔐 Sign In to Dashboard' : '🚀 Create Free Account'}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#EADEC9]" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-[#EADEC9]" />
              </div>

              {/* Google */}
              <button
                onClick={handleGoogleOAuth}
                className="w-full py-3 rounded-2xl bg-white border border-[#EADEC9] font-semibold text-sm text-[#0F172A] hover:border-[#059669]/40 hover:shadow-md transition-all flex items-center justify-center gap-2.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* Footer note */}
              <p className="text-center text-[10px] text-slate-400 leading-relaxed">
                By continuing, you agree to our{' '}
                <span className="text-[#059669] font-semibold cursor-pointer hover:underline">Terms of Service</span>{' '}
                and{' '}
                <span className="text-[#059669] font-semibold cursor-pointer hover:underline">Privacy Policy</span>
              </p>
            </div>
          </div>

          {/* Trust strip below card */}
          <div className="flex items-center justify-center gap-4 mt-5">
            {['SOC 2', 'HIPAA', 'GDPR', 'ISO 27001'].map(b => (
              <span key={b} className="text-[9px] font-bold text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
                <Check className="w-2.5 h-2.5 text-[#059669]" /> {b}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
