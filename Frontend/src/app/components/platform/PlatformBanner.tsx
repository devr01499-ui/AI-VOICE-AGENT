import { useEffect, useState } from 'react';
import { API_BASE } from '../../api';
import { loadLivePlatform, usePlatformState } from '../../lib/plans';

const LEVEL_CLASS: Record<string, string> = {
  info: 'bg-[#121212] text-[#E5E3DC]',
  warning: 'bg-amber-400 text-[#121212]',
  critical: 'bg-red-600 text-white',
};

/**
 * Notices the owner sets in the admin Control Panel: a maintenance banner, and a note when outgoing
 * calls are paused. Shown at the top of the dashboard; each can be hidden for the current visit.
 * The server enforces the pause either way; this only explains it.
 */
export default function PlatformBanner() {
  const state = usePlatformState();
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadLivePlatform(API_BASE);
    // Re-check every 2 minutes while the dashboard is open (the server caches for 30 s).
    const t = setInterval(() => { if (document.visibilityState === 'visible') loadLivePlatform(API_BASE); }, 120_000);
    return () => clearInterval(t);
  }, []);

  const items: Array<{ id: string; text: string; level: string }> = [];
  if (state.callingPaused) {
    items.push({ id: `calling:${state.callingPausedMessage}`, text: state.callingPausedMessage || 'Outgoing calls are paused for maintenance. Please try again shortly.', level: 'critical' });
  }
  if (state.banner) {
    items.push({ id: `banner:${state.banner.message}`, text: state.banner.message, level: state.banner.level });
  }
  const visible = items.filter((i) => !hidden[i.id]);
  if (visible.length === 0) return null;

  return (
    <div className="relative z-[60]" role="region" aria-label="Service notices">
      {visible.map((i) => (
        <div key={i.id} role={i.level === 'critical' ? 'alert' : 'status'} className={`${LEVEL_CLASS[i.level] || LEVEL_CLASS.info} px-4 py-2 text-sm flex items-start justify-between gap-3`}>
          <span className="min-w-0 break-words">{i.text}</span>
          <button
            type="button"
            onClick={() => setHidden({ ...hidden, [i.id]: true })}
            className="shrink-0 underline opacity-80 hover:opacity-100 text-xs"
            aria-label="Hide this notice"
          >
            Hide
          </button>
        </div>
      ))}
    </div>
  );
}
