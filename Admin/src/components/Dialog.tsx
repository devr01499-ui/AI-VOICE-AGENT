import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

/** Centered modal. Escape and the backdrop close it (unless busy is handled by the caller). */
export const Dialog: React.FC<DialogProps> = ({ open, title, description, onClose, children, wide }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white break-words">{title}</h3>
            {description && <p className="text-xs text-zinc-400 mt-1">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 cursor-pointer shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const ErrorNote: React.FC<{ message: string | null | undefined }> = ({ message }) =>
  message ? (
    <div role="alert" className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/20 text-red-300 text-xs flex items-start gap-2">
      <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
      <span className="break-words">{message}</span>
    </div>
  ) : null;

export const SuccessNote: React.FC<{ message: string | null | undefined }> = ({ message }) =>
  message ? (
    <div role="status" className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2">
      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
      <span className="break-words">{message}</span>
    </div>
  ) : null;

export const fieldClass = 'w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500';
export const labelClass = 'block text-xs font-mono uppercase text-zinc-400 mb-1';
export const primaryBtn = 'px-4 py-2 bg-white hover:bg-zinc-200 text-black font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
export const secondaryBtn = 'px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs cursor-pointer border border-zinc-800 disabled:opacity-50';
export const dangerBtn = 'px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/** The mandatory written reason every change carries into the audit log. */
export const ReasonField: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <div>
    <label className={labelClass}>Reason (saved in the audit log)</label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || 'Why are you making this change?'}
      required
      minLength={3}
      maxLength={500}
      rows={3}
      className={fieldClass}
    />
  </div>
);

export const reasonOk = (r: string) => r.trim().length >= 3;
