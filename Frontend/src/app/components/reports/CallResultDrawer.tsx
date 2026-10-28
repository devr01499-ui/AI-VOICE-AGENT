import React, { useState, useEffect } from 'react';
import {
  X, AlertTriangle, CheckCircle2, ShieldCheck, RefreshCw,
  Clock, Phone, User, Play, Pause, FileText, Check, AlertCircle,
  HelpCircle, MessageSquare, History, Edit3, Volume2, ShieldAlert
} from 'lucide-react';
import { reportsApi, type DetailedReport, type ReportListItem } from '../../api';

interface CallResultDrawerProps {
  callId: string | null;
  onClose: () => void;
  onReportUpdated: () => void;
  userRole?: string;
}

export function CallResultDrawer({ callId, onClose, onReportUpdated, userRole = 'owner' }: CallResultDrawerProps) {
  const [report, setReport] = useState<DetailedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'fields' | 'transcript' | 'correct' | 'audit'>('overview');

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Correction form state
  const [correctionLabel, setCorrectionLabel] = useState('');
  const [correctionScore, setCorrectionScore] = useState<number | string>(0);
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    if (!callId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setCorrectionSuccess(null);

    reportsApi.getReport(callId)
      .then((data) => {
        if (!mounted) return;
        setReport(data);
        setCorrectionLabel(data.label || '');
        setCorrectionScore(data.score ?? '');
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message || 'Failed to load call report details.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [callId]);

  if (!callId) return null;

  const isViewer = userRole === 'viewer';

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleSpeedChange = () => {
    if (!audioRef.current) return;
    const speeds = [1, 1.25, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(audioSpeed) + 1) % speeds.length];
    audioRef.current.playbackRate = nextSpeed;
    setAudioSpeed(nextSpeed);
  };

  const handleReanalyze = async () => {
    if (!callId || reanalyzing) return;
    try {
      setReanalyzing(true);
      await reportsApi.reanalyze(callId);
      const updated = await reportsApi.getReport(callId);
      setReport(updated);
      onReportUpdated();
    } catch (err: any) {
      alert(`Re-analysis failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setReanalyzing(false);
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callId || submittingCorrection || isViewer) return;
    try {
      setSubmittingCorrection(true);
      setCorrectionSuccess(null);
      const res = await reportsApi.submitCorrection(callId, {
        label: correctionLabel,
        score: correctionScore !== '' ? Number(correctionScore) : undefined,
        notes: correctionNotes || undefined,
      });
      setCorrectionSuccess(res.message || 'Correction saved successfully');
      const updated = await reportsApi.getReport(callId);
      setReport(updated);
      onReportUpdated();
    } catch (err: any) {
      alert(`Correction failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const formatSeconds = (sec?: number | null) => {
    if (!sec && sec !== 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getLabelBadgeStyle = (label: string) => {
    const l = label.toUpperCase();
    if (l.includes('CONFIRM') || l.includes('BOOKED') || l.includes('QUALIFIED') || l.includes('PAID') || l.includes('RESOLVED')) {
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    }
    if (l.includes('CANCEL') || l.includes('REJECT') || l.includes('NOT_INTERESTED') || l.includes('DISPUTE') || l.includes('ESCALAT')) {
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    }
    if (l.includes('CALLBACK') || l.includes('RESCHEDULE') || l.includes('PENDING') || l.includes('PARTIAL')) {
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    }
    return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Body */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col z-10 border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/90">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Call {callId.slice(0, 8)}...
              </span>
              {report?.blueprintName && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {report.blueprintName}
                </span>
              )}
              {report?.hasHumanCorrection && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                  <Edit3 className="w-3 h-3" /> Human Verified
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold font-sora text-slate-900 dark:text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-500" />
              {report?.call?.recipientPhoneNumber || 'Unknown Recipient'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Agent: <span className="font-semibold">{report?.call?.agent?.name || 'General Agent'}</span> • Duration:{' '}
              {formatSeconds(report?.call?.durationSeconds)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing || loading}
              className="nm-icon-btn p-2 hover:text-indigo-600 transition-colors"
              title="Re-run Analysis Engine"
            >
              <RefreshCw className={`w-4 h-4 ${reanalyzing ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="nm-icon-btn p-2 hover:text-rose-500 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm font-medium">Extracting verified call report...</p>
          </div>
        ) : error || !report ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-rose-500">
            <AlertCircle className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">{error || 'Report not found for this call.'}</p>
            <button
              onClick={() => handleReanalyze()}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700"
            >
              Queue Initial Analysis
            </button>
          </div>
        ) : (
          <>
            {/* Status & Review Banners */}
            <div className="p-4 bg-slate-100/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider ${getLabelBadgeStyle(
                      report.label
                    )}`}
                  >
                    Outcome: {report.label}
                  </div>
                  {report.score !== null && (
                    <div className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-800 flex items-center gap-1.5 font-mono">
                      <span>Score:</span>
                      <span className={report.score >= 70 ? 'text-emerald-500' : 'text-amber-500'}>
                        {report.score}/100
                      </span>
                    </div>
                  )}
                  {report.confidence !== null && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Confidence: {(report.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </div>

                {report.reviewNeeded && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Review Needed</span>
                  </div>
                )}
              </div>

              {report.reviewNeeded && report.reviewReason && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold">Flagged for human review:</span> {report.reviewReason}
                </div>
              )}
            </div>

            {/* Audio Recording Player if present */}
            {report.call?.recordingUrl && (
              <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between gap-3">
                <audio
                  ref={audioRef}
                  src={report.call.recordingUrl}
                  onEnded={() => setIsPlaying(false)}
                  preload="metadata"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAudio}
                    className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center transition-transform active:scale-95"
                    aria-label={isPlaying ? 'Pause call audio' : 'Play call audio'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold block">Call Audio Recording</span>
                    <span className="text-[10px] text-slate-400">{formatSeconds(report.call.durationSeconds)}</span>
                  </div>
                </div>

                <button
                  onClick={handleSpeedChange}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  title="Cycle Playback Speed"
                >
                  {audioSpeed}x
                </button>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-4 text-xs font-semibold bg-white dark:bg-slate-900">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-3 border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('fields')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'fields'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Extracted Fields
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {Object.keys(report.fields || {}).length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('transcript')}
                className={`py-3 border-b-2 transition-colors ${
                  activeTab === 'transcript'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Grounded Transcript
              </button>
              <button
                onClick={() => setActiveTab('correct')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'correct'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Human QA & Edit
              </button>
              {report.auditLogs && report.auditLogs.length > 0 && (
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`py-3 border-b-2 transition-colors ${
                    activeTab === 'audit'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Audit History ({report.auditLogs.length})
                </button>
              )}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {report.summary && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" /> Executive Call Summary
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                        {report.summary}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">Telephony Outcome</span>
                      <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                        {report.call?.status || 'completed'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">Call Sentiment</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {report.call?.sentiment || 'Neutral'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">Started At</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {report.call?.startedAt ? new Date(report.call.startedAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-400 block mb-1">Report Generated At</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {new Date(report.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-950 bg-indigo-50/50 dark:bg-indigo-950/20">
                    <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 mb-1">
                      <ShieldCheck className="w-4 h-4" /> Grounded Verifiable Reporting
                    </h4>
                    <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 leading-relaxed">
                      All claims, dates, amounts, and statuses in this report are mathematically validated against verbatim transcript substrings. Unbacked claims are automatically nullified to prevent hallucination.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: EXTRACTED FIELDS & EVIDENCE */}
              {activeTab === 'fields' && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Business variables extracted from the call and verified with verbatim conversation evidence.
                  </div>

                  {(!report.fields || Object.keys(report.fields).length === 0) ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                      No business fields extracted for this blueprint.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(report.fields).map(([fieldName, value]) => {
                        const evidenceObj = report.evidenceQuotes?.[fieldName];
                        const quote = typeof evidenceObj === 'string' ? evidenceObj : evidenceObj?.quote;
                        const turnIndex = typeof evidenceObj === 'object' ? evidenceObj?.turnIndex : null;
                        const isNullified = value === null || value === undefined;

                        return (
                          <div
                            key={fieldName}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                {fieldName}
                              </span>
                              {isNullified ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                                  Null / Unbacked
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Grounded
                                </span>
                              )}
                            </div>

                            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                              {isNullified ? (
                                <span className="italic text-slate-400 font-normal">Not stated in call</span>
                              ) : typeof value === 'object' ? (
                                JSON.stringify(value)
                              ) : (
                                String(value)
                              )}
                            </div>

                            {quote && (
                              <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-xs">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                  Verbatim Evidence Quote {turnIndex !== null ? `(Turn #${turnIndex + 1})` : ''}
                                </span>
                                <p className="italic text-slate-700 dark:text-slate-300">
                                  "{quote}"
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: GROUNDED TRANSCRIPT */}
              {activeTab === 'transcript' && (
                <div className="space-y-3">
                  {!report.call?.transcript ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                      No transcript recorded for this call.
                    </div>
                  ) : (
                    <div className="space-y-3 font-sans text-xs">
                      {report.call.transcript.split(/\n+/).map((line, idx) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        const isAgent = trimmed.toLowerCase().startsWith('agent:') || trimmed.toLowerCase().startsWith('ai:');
                        const isUser = trimmed.toLowerCase().startsWith('user:') || trimmed.toLowerCase().startsWith('customer:');

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border ${
                              isAgent
                                ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/50'
                                : isUser
                                ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                                : 'bg-slate-100/50 dark:bg-slate-800/20 border-transparent text-slate-500'
                            }`}
                          >
                            <span className="font-bold text-[11px] block mb-1 text-slate-600 dark:text-slate-400">
                              {isAgent ? 'Claritiy AI Agent' : isUser ? 'Customer' : 'System'}
                            </span>
                            <p className="leading-relaxed text-slate-800 dark:text-slate-200">
                              {trimmed.replace(/^(agent|ai|user|customer):\s*/i, '')}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: HUMAN QA & CORRECTION */}
              {activeTab === 'correct' && (
                <div className="space-y-4">
                  {isViewer ? (
                    <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs">
                      <span className="font-bold block mb-1">Read-Only Access</span>
                      You have a Viewer role in this workspace. Human label corrections and rubric overrides require Editor or Admin permissions.
                    </div>
                  ) : (
                    <form onSubmit={handleSaveCorrection} className="space-y-4">
                      {correctionSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                          <span>{correctionSuccess}</span>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                          Outcome Label Override
                        </label>
                        <input
                          type="text"
                          value={correctionLabel}
                          onChange={(e) => setCorrectionLabel(e.target.value)}
                          placeholder="e.g. CONFIRMED, CANCELLED, CALLBACK_REQUESTED"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                          Objective Score Override (0-100)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={correctionScore}
                          onChange={(e) => setCorrectionScore(e.target.value)}
                          placeholder="0 - 100"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                          Audit Notes / Reason for Correction
                        </label>
                        <textarea
                          rows={3}
                          value={correctionNotes}
                          onChange={(e) => setCorrectionNotes(e.target.value)}
                          placeholder="Explain why the model output was adjusted (e.g. caller verbally changed mind at turn 6)..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submittingCorrection}
                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {submittingCorrection ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Audit Log...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" /> Save Correction & Audit Trail
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 5: AUDIT LOGS */}
              {activeTab === 'audit' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Timestamped audit events logged for compliance and evaluation calibration.
                  </div>
                  {report.auditLogs?.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>{log.action}</span>
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        Actor: {log.actorUserId}
                      </div>
                      {log.metadata && (
                        <pre className="mt-1.5 p-2 rounded bg-slate-100 dark:bg-slate-900 text-[10px] overflow-x-auto text-slate-600 dark:text-slate-400">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
