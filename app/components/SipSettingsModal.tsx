import React, { useState } from 'react';
import { X, Server, Shield, Key, Link as LinkIcon, CheckCircle2 } from 'lucide-react';

interface SipSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: {
    name: string;
    sipUri: string;
    username: string;
    password?: string;
    outboundProxy?: string;
  }) => Promise<void>;
}

export function SipSettingsModal({ isOpen, onClose, onSave }: SipSettingsModalProps) {
  const [name, setName] = useState('');
  const [sipUri, setSipUri] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [outboundProxy, setOutboundProxy] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sipUri || !name) return;
    
    setIsSubmitting(true);
    try {
      await onSave({ name, sipUri, username, password, outboundProxy });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        // Reset form
        setName('');
        setSipUri('');
        setUsername('');
        setPassword('');
        setOutboundProxy('');
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all duration-300">
      <div className="relative w-full max-w-lg bg-[#0F172A] border border-[#1E293B]/80 shadow-[0_0_40px_rgba(16,185,129,0.1)] rounded-2xl overflow-hidden transform transition-all">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-emerald-500/20 blur-[60px] pointer-events-none" />

        <div className="relative p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <Server className="w-6 h-6 text-emerald-400" />
                Connect SIP Trunk
              </h2>
              <p className="text-sm text-slate-400 mt-2 font-medium">
                Link your custom carrier (Twilio, Plivo, Exotel) for outbound dialing.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 p-2 rounded-full transition-colors border border-transparent hover:border-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 relative">
            
            {success && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0F172A]/90 backdrop-blur-sm rounded-xl">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
                <h3 className="text-xl font-bold text-white">Connection Secured</h3>
                <p className="text-sm text-slate-400">Credentials encrypted & saved.</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  Provider Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Server className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Twilio Production"
                    className="w-full bg-[#1E293B]/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                  SIP URI
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={sipUri}
                    onChange={(e) => setSipUri(e.target.value)}
                    required
                    placeholder="e.g. example.sip.twilio.com"
                    className="w-full bg-[#1E293B]/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                    Auth Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Shield className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full bg-[#1E293B]/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Key className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#1E293B]/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !name || !sipUri}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 focus:ring-4 focus:ring-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform active:scale-95"
              >
                {isSubmitting ? 'Authenticating...' : 'Secure & Connect'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
