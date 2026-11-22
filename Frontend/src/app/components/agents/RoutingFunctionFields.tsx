import { useEffect, useState } from 'react';
import { Info, MessageCircle, PhoneForwarded, UserCheck } from 'lucide-react';
import { fetchAgents, fetchWhatsAppTemplates, type ApiAgent, type WhatsAppTemplateInfo } from '../../api';

export interface WhatsAppVariableSetting { description?: string; fixedValue?: string }

/**
 * Same rules as the server (runtime/callRouting.ts normalizeTransferNumber) so the editor explains a
 * problem before saving. The server checks again (toll-fraud policy) and on every call.
 */
export function transferNumberProblem(raw: string): string | null {
  const s = String(raw || '').trim();
  if (!s) return 'Enter the number to transfer to, with country code, for example +91 98765 43210.';
  if (s.length > 32 || /[^\d+\s\-().]/.test(s)) return 'Use digits only, with country code, for example +91 98765 43210.';
  const digits = s.replace(/\D/g, '');
  let e164 = '';
  if (s.startsWith('+')) e164 = `+${digits}`;
  else if (digits.length === 10 && /^[1-9]/.test(digits)) e164 = `+91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) e164 = `+91${digits.slice(1)}`;
  else if (digits.length === 12 && digits.startsWith('91')) e164 = `+${digits}`;
  if (!e164) return 'Enter the number with country code, for example +91 98765 43210.';
  if (e164.startsWith('+91')) {
    if (!/^\+91[1-9]\d{9}$/.test(e164)) return 'An Indian number has 10 digits after +91.';
    if (/^\+91(1900|1860)/.test(e164)) return 'Premium-rate and shared-cost numbers (1900, 1860) cannot be used.';
    return null;
  }
  return 'Only Indian numbers (+91) can be used. Contact support to enable another country.';
}

const box = 'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const label = 'block font-semibold text-slate-700 dark:text-slate-300 mb-1';
const note = 'flex items-start gap-2 p-3 rounded-xl text-[11px] leading-relaxed';

export function TransferCallFields(props: { targetNumber: string; setTargetNumber: (v: string) => void; fallbackMessage: string; setFallbackMessage: (v: string) => void }) {
  const problem = props.targetNumber.trim() ? transferNumberProblem(props.targetNumber) : null;
  return (
    <div className="space-y-3" data-testid="transfer-call-fields">
      <div className={`${note} bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800`}>
        <PhoneForwarded className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>The agent tells the caller it is connecting them, then the call rings this number with your Claritiy number as caller ID. Minutes are charged for the whole call, including the time with your team.</span>
      </div>
      <div>
        <label className={label}>Transfer to (phone number)</label>
        <input type="tel" value={props.targetNumber} onChange={(e) => props.setTargetNumber(e.target.value)} placeholder="+91 98765 43210" className={`${box} font-mono`} />
        {problem && <p className="mt-1 text-[11px] text-rose-600">{problem}</p>}
      </div>
      <div>
        <label className={label}>If nobody answers, the caller hears <span className="text-slate-400 font-normal">(optional)</span></label>
        <textarea rows={2} maxLength={300} value={props.fallbackMessage} onChange={(e) => props.setFallbackMessage(e.target.value)} placeholder="Sorry, nobody from our team could take your call right now. We will call you back soon." className={box} />
        <p className="mt-1 text-[10px] text-slate-400">You also get a "call back" notification with the caller's number.</p>
      </div>
    </div>
  );
}

export function AgentTransferFields(props: { targetAgentId: string; setTargetAgentId: (v: string) => void; currentAgentId?: string }) {
  const [agents, setAgents] = useState<ApiAgent[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAgents().then((list) => { if (alive) setAgents(Array.isArray(list) ? list : []); }).catch(() => { if (alive) setAgents([]); });
    return () => { alive = false; };
  }, []);
  const options = (agents || []).filter((a) => a.id !== props.currentAgentId && a.status !== 'inactive');
  return (
    <div className="space-y-3" data-testid="agent-transfer-fields">
      <div className={`${note} bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800`}>
        <UserCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>The call stays connected and continues with the chosen agent (its own prompt, voice and knowledge). It receives a summary and the recent conversation, so the caller is not asked again.</span>
      </div>
      <div>
        <label className={label}>Hand the call to</label>
        <select value={props.targetAgentId} onChange={(e) => props.setTargetAgentId(e.target.value)} className={box}>
          <option value="">{agents === null ? 'Loading agents…' : options.length ? 'Choose an agent' : 'Create another agent first'}</option>
          {options.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
    </div>
  );
}

export function WhatsAppFields(props: {
  template: string; setTemplate: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  variables: WhatsAppVariableSetting[]; setVariables: (v: WhatsAppVariableSetting[]) => void;
  legacyText?: string;
}) {
  const [data, setData] = useState<{ connected: boolean; businessName: string | null; templates: WhatsAppTemplateInfo[] } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchWhatsAppTemplates().then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setData({ connected: false, businessName: null, templates: [] }); });
    return () => { alive = false; };
  }, []);
  const selected = data?.templates.find((t) => t.name === props.template && (!props.language || t.language === props.language));
  const choose = (value: string) => {
    const [name, language] = value.split('|');
    props.setTemplate(name || '');
    props.setLanguage(language || '');
    const t = data?.templates.find((x) => x.name === name && x.language === language);
    props.setVariables((t?.variables || []).map((_, i) => props.variables[i] || {}));
  };
  return (
    <div className="space-y-3" data-testid="whatsapp-fields">
      <div className={`${note} bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800`}>
        <MessageCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>The agent always asks the caller first{data?.businessName ? ` ("Can ${data.businessName} send this on WhatsApp?")` : ''} and sends only after a clear yes, to the caller's own number. Only templates approved by Meta can be sent.</span>
      </div>
      {props.legacyText && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">This was an SMS step (SMS never worked and is replaced by WhatsApp). Your old text: "{props.legacyText}". Choose an approved WhatsApp template for it.</p>
      )}
      {data && !data.connected ? (
        <div className={`${note} bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800`}>
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Connect your WhatsApp Business number in Integrations first. You can save this now; it starts working once a template is chosen.</span>
        </div>
      ) : (
        <div>
          <label className={label}>Approved template</label>
          <select value={props.template ? `${props.template}|${props.language || selected?.language || ''}` : ''} onChange={(e) => choose(e.target.value)} className={box}>
            <option value="">{data === null ? 'Loading templates…' : data.templates.length ? 'Choose a template' : 'No approved templates yet'}</option>
            {(data?.templates || []).map((t) => <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language}, {t.category.toLowerCase()})</option>)}
          </select>
          {selected && <p className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 break-words whitespace-pre-wrap">{selected.bodyText}</p>}
        </div>
      )}
      {selected && selected.variables.length > 0 && (
        <div className="space-y-2">
          <p className="font-semibold text-slate-700 dark:text-slate-300">Template variables</p>
          {selected.variables.map((v, i) => (
            <div key={v.key} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={props.variables[i]?.description || ''} onChange={(e) => { const next = [...props.variables]; next[i] = { ...next[i], description: e.target.value }; props.setVariables(next); }} placeholder={`{{${v.key}}}: what the agent fills in (e.g. caller's first name)`} className={`${box} text-[11px]`} />
              <input value={props.variables[i]?.fixedValue || ''} onChange={(e) => { const next = [...props.variables]; next[i] = { ...next[i], fixedValue: e.target.value }; props.setVariables(next); }} placeholder="or a fixed value (optional)" className={`${box} text-[11px]`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
