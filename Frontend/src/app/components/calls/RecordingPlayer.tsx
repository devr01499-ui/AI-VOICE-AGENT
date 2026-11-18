import React, { useState } from 'react';
import { Play, Download, Loader2 } from 'lucide-react';
import { API_BASE, apiClient } from '../../api';

/**
 * Call recording player. The recording is never linked directly: on "Play" it asks the server
 * for a short-lived signed link (owner-checked) and plays our own stream, which supports seeking.
 * Speed control and download included. Links expire after 5 minutes — opening again fetches a
 * fresh one.
 */
export function RecordingPlayer({ callId, durationLabel }: { callId: string; durationLabel?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [downloadHref, setDownloadHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const open = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/v2/calls/${encodeURIComponent(callId)}/recording-link`);
      const link = res.data?.data as { url: string; downloadUrl: string } | undefined;
      if (!link?.url) throw new Error('No recording for this call.');
      setSrc(`${API_BASE}${link.url}`);
      setDownloadHref(`${API_BASE}${link.downloadUrl}`);
    } catch (err: any) {
      setError(err?.message || 'The recording could not be opened.');
    } finally {
      setLoading(false);
    }
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  };

  return (
    <div className="space-y-2" data-testid="recording-player">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Call recording{durationLabel ? ` · ${durationLabel}` : ''}
        </span>
        {!src && (
          <button
            type="button"
            onClick={open}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Play recording
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      {src && (
        <div className="flex flex-wrap items-center gap-2">
          <audio
            ref={audioRef}
            controls
            autoPlay
            src={src}
            className="w-full h-10 min-w-0"
            onLoadedMetadata={() => { if (audioRef.current) audioRef.current.playbackRate = speed; }}
            onError={() => setError('The recording could not be played. It may have expired — open it again.')}
          />
          <label className="text-xs text-slate-500 flex items-center gap-1">
            Speed
            <select
              value={speed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              aria-label="Playback speed"
            >
              {[0.75, 1, 1.25, 1.5, 2].map((v) => <option key={v} value={v}>{v}x</option>)}
            </select>
          </label>
          {downloadHref && (
            <a href={downloadHref} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline" download>
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          )}
        </div>
      )}
    </div>
  );
}
