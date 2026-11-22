import { useEffect, useState } from 'react';
import { MessageCircle, PhoneForwarded, UserCheck } from 'lucide-react';
import { fetchCallHandoffs, type CallTransferInfo, type WhatsAppMessageInfo } from '../../api';
import { formatTime } from '../../lib/dateFormat';

const TRANSFER_STATUS: Record<string, string> = {
  requested: 'Starting',
  dialing: 'Ringing your team',
  connected: 'Connected',
  completed: 'Completed',
  no_answer: 'Nobody answered',
  busy: 'Line busy',
  failed: 'Could not connect',
};
const WHATSAPP_STATUS: Record<string, string> = {
  queued: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Not delivered',
  received: 'Reply received',
};

/** Live transfers and WhatsApp messages of one call. Renders nothing when there are none. */
export function CallHandoffsPanel({ callId, className = '' }: { callId: string; className?: string }) {
  const [data, setData] = useState<{ transfers: CallTransferInfo[]; whatsapp: WhatsAppMessageInfo[] } | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    if (!callId) return;
    // Any unexpected answer (older backend during a deploy, proxy error) means "nothing to show",
    // never a crash of Call History.
    fetchCallHandoffs(callId)
      .then((d: any) => {
        if (!alive) return;
        setData({ transfers: Array.isArray(d?.transfers) ? d.transfers : [], whatsapp: Array.isArray(d?.whatsapp) ? d.whatsapp : [] });
      })
      .catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [callId]);

  if (!data || (data.transfers.length === 0 && data.whatsapp.length === 0)) return null;
  return (
    <div data-testid="call-handoffs" className={`space-y-2 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transfers &amp; WhatsApp</p>
      <ul className="space-y-1.5">
        {data.transfers.map((t) => (
          <li key={t.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs flex items-start gap-2 min-w-0">
            {t.kind === 'human' ? <PhoneForwarded className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200 break-words">
                {t.kind === 'human' ? `Transferred to ${t.destinationLabel || 'your team'}` : `Handed to ${t.toAgentName || t.destinationLabel || 'another agent'}`}
                {t.destinationNumber ? <span className="font-mono font-normal text-slate-500"> ({t.destinationNumber})</span> : null}
              </p>
              <p className="text-[11px] text-slate-500">{TRANSFER_STATUS[t.status] || t.status} · {formatTime(t.createdAt, { hour: '2-digit', minute: '2-digit' })}</p>
              {(t.summary || t.reason) && <p className="text-[11px] text-slate-500 break-words mt-0.5">{t.summary || t.reason}</p>}
            </div>
          </li>
        ))}
        {data.whatsapp.map((m) => (
          <li key={m.id} className="p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs flex items-start gap-2 min-w-0">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200 break-words">
                {m.direction === 'inbound' ? 'WhatsApp reply' : `WhatsApp: ${m.templateName || 'message'}`} <span className="font-normal text-slate-500">· {WHATSAPP_STATUS[m.status] || m.status}</span>
              </p>
              {m.body && <p className="text-[11px] text-slate-600 dark:text-slate-300 break-words line-clamp-3">{m.body}</p>}
              {m.status === 'failed' && m.errorMessage && <p className="text-[11px] text-rose-600 break-words">{m.errorMessage}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
