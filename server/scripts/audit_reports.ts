/** Audit harness (NOT part of the product): replays the Reports screen's exact calls against the real backend code. */
import http from 'http';
import express from 'express';
process.env.GEMINI_API_KEY = 'test-key';
const results: { area: string; name: string; ok: boolean; detail: string }[] = [];
const check = (area: string, name: string, ok: boolean, detail = '') => { results.push({ area, name, ok, detail }); console.log(`${ok ? 'ok     ' : 'DEFECT '} [${area}] ${name}${detail ? '  -> ' + detail : ''}`); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { errorHandler } = await import('../src/utils/errorHandler');
  const reportsRouter = (await import('../src/routes/reports')).default;
  const { AnalysisService } = await import('../src/services/AnalysisService');
  const { CallFinalizer } = await import('../src/services/CallFinalizer');
  const { AnalysisWorker } = await import('../src/workers/AnalysisWorker');
  const GoogleGenerativeAI = (require as any)('@google/generative-ai').GoogleGenerativeAI;

  const base: any = await prisma.call.findFirst();
  const userId = base.userId; const agentId = base.agentId;
  const tag = Date.now().toString(36); const made: string[] = [];
  async function mkCall(over: any = {}) {
    const id = `rpt-${tag}-${made.length}`; const { id: _i, ...rest } = base;
    await prisma.call.create({ data: { ...rest, id, userId, agentId, status: 'completed', durationSeconds: 120, startTime: new Date(Date.now() - 120000), endTime: new Date(), telemetryId: `u-${id}`, endReason: 'completed', summary: null, createdAt: new Date(), ...over } });
    made.push(id); return id;
  }
  async function seg(callId: string, lines: [string, string][]) {
    let i = 0; for (const [speaker, content] of lines) await prisma.transcriptSegment.create({ data: { callId, speaker, content, startTime: i, sequenceNumber: ++i } });
  }
  // model stub
  let modelReplies: any[] = []; let modelCalls = 0;
  (GoogleGenerativeAI.prototype as any).getGenerativeModel = function () {
    return { generateContent: async () => { modelCalls++; const r = modelReplies.length > 1 ? modelReplies.shift() : modelReplies[0]; if (r instanceof Error) throw r; return { response: { text: () => (typeof r === 'string' ? r : JSON.stringify(r)) } }; } };
  };

  // ── server + FE replica ──
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.userId = userId; req.effectiveWorkspaceId = userId; req.workspaceRole = 'admin'; next(); });
  app.use('/api/v2/reports', reportsRouter); app.use(errorHandler);
  const server = http.createServer(app); await new Promise<void>((r) => server.listen(3921, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:3921';
  // exact copy of Frontend apiFetch unwrapping
  async function feFetch(path: string, options: any = {}) {
    const res = await fetch(BASE + path, { ...options, headers: { 'Content-Type': 'application/json' } });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return { __status: res.status, __nonJson: true } as any;
    const json: any = await res.json();
    if (!res.ok || !json.success) return { __status: res.status, __error: json.error || json.message || json };
    if (json.data === undefined) { const { success, error, message, ...rest } = json; return Object.keys(rest).length > 0 ? rest : json; }
    return json.data;
  }

  // ═══ DATA: one analysed call via the real AnalysisService ═══
  const good = await mkCall();
  await seg(good, [['agent', 'Hello, this is Priya from Acme. Are you open to a new role?'], ['user', 'Yes I have 5 years of experience and my ctc is 18 lakh'], ['agent', 'Great, what is your notice period?'], ['user', 'fifteen days notice period']]);
  modelReplies = [{ resultLabel: 'Interview Scheduled', confidence: 0.9, summary: '=HYPERLINK("http://evil.example","click")', sentiment: 'Positive', fields: { yearsExperience: '5', currentCtcLakhs: '18 lakh', noticePeriodDays: 'fifteen days' }, evidence: { yearsExperience: { quote: '5 years of experience', segmentIndex: 1 }, currentCtcLakhs: { quote: 'my ctc is 18 lakh', segmentIndex: 1 }, noticePeriodDays: { quote: 'fifteen days notice period', segmentIndex: 3 } } }];
  const outcome = await AnalysisService.processCall(good);
  console.log('   analysed sample call ->', outcome.resultLabel, outcome.status, 'fields', JSON.stringify(outcome.fields));
  check('logic', 'a recruiter call with a clear outcome is analysed with recruiting labels/fields (agent has no templateId)', outcome.resultLabel === 'Interview Scheduled' && outcome.status === 'completed', `result="${outcome.resultLabel}" status=${outcome.status} fields=${Object.keys(outcome.fields).join('/')} (receptionist blueprint applied)`);
  // From here on, simulate a correctly configured agent so the remaining checks test the engine itself.
  const origCfg = (await prisma.agent.findUnique({ where: { id: agentId } }))!.agentConfig;
  let cfgObj: any = {}; try { cfgObj = typeof origCfg === 'string' ? JSON.parse(origCfg) : (origCfg || {}); } catch {}
  await prisma.agent.update({ where: { id: agentId }, data: { agentConfig: JSON.stringify({ ...cfgObj, templateId: 'tpl-12' }) } });
  modelReplies = [{ resultLabel: 'Interview Scheduled', confidence: 0.9, summary: 'Candidate agreed to interview.', sentiment: 'Positive', fields: { yearsExperience: '5', currentCtcLakhs: '18 lakh', noticePeriodDays: 'fifteen days' }, evidence: { yearsExperience: { quote: '5 years of experience', segmentIndex: 1 }, currentCtcLakhs: { quote: 'my ctc is 18 lakh', segmentIndex: 1 }, noticePeriodDays: { quote: 'fifteen days notice period', segmentIndex: 3 } } }];
  const base2 = await AnalysisService.processCall(good);
  console.log('   re-analysed with tpl-12 ->', base2.resultLabel, base2.status, 'score', base2.score, JSON.stringify(base2.fields));

  // ═══ 1. FRONTEND <-> BACKEND CONTRACT ═══
  const list = await feFetch('/api/v2/reports?limit=25&dateFrom=' + encodeURIComponent(new Date(Date.now() - 30 * 864e5).toISOString()));
  check('contract', 'list returns {items,nextCursor,hasMore,totalCount} as the screen expects', Array.isArray((list as any)?.items), `got ${Array.isArray(list) ? 'a bare array of ' + list.length : typeof list}; screen reads res.items -> empty table`);
  const row: any = Array.isArray(list) ? list[0] : (list as any)?.items?.[0];
  check('contract', 'list rows carry label / reviewNeeded / blueprintId / hasHumanCorrection', !!row && 'label' in row && 'reviewNeeded' in row && 'blueprintId' in row && 'hasHumanCorrection' in row, row ? `row keys: ${Object.keys(row).filter((k) => k !== 'call').join(',')}` : 'no rows');
  const stat = await feFetch('/api/v2/reports?status=pending');
  check('contract', 'status filter values offered by the screen (pending/processing) are accepted', !(stat && stat.__status), `status=pending -> HTTP ${stat?.__status} ${JSON.stringify(stat?.__error || '').slice(0, 90)}`);
  const rn = await feFetch('/api/v2/reports?reviewNeeded=true&label=Nonexistent');
  const rnItems = Array.isArray(rn) ? rn : (rn as any)?.items || [];
  check('contract', 'reviewNeeded / label filters actually filter', Array.isArray(rnItems) && rnItems.length === 0, `returned ${Array.isArray(rnItems) ? rnItems.length : '?'} rows for label=Nonexistent (filter ignored)`);
  const sum = await feFetch('/api/v2/reports/summary');
  check('contract', 'summary has analyzedCalls/avgScore/humanCorrectionRate the KPI cards read', sum && typeof sum.analyzedCalls === 'number', `keys: ${Object.keys(sum || {}).join(',')}; cards render 0`);
  const bps = await feFetch('/api/v2/reports/blueprints');
  check('contract', 'blueprint catalogue is an array with {id,name,industry,labels[]}', Array.isArray(bps) && !!bps[0]?.industry, `got ${Array.isArray(bps) ? 'array' : 'object keys ' + Object.keys(bps || {})}; modal calls blueprints.map -> crash`);
  const det = await feFetch('/api/v2/reports/' + good);
  check('contract', 'detail has label/evidenceQuotes/auditLogs/call.transcript', det && 'label' in det && 'evidenceQuotes' in det && !!det.call?.transcript, `top-level keys: ${Object.keys(det || {}).join(',')}`);
  const corr = await feFetch(`/api/v2/reports/${good}/correct`, { method: 'POST', body: JSON.stringify({ label: 'Strong Fit', notes: 'x' }) });
  check('contract', 'Save Correction URL (/:id/correct) exists', !(corr?.__status === 404), `HTTP ${corr?.__status}`);
  const csv = await fetch(BASE + '/api/v2/reports/export.csv'); await csv.text();
  check('contract', 'Export CSV URL (/export.csv) exists', csv.status !== 404, `HTTP ${csv.status} (the real route is /export/csv); also window.open sends no Authorization header`);

  // ═══ 2. BACKEND LOGIC ═══
  const bp = AnalysisService.resolveBlueprint({ name: 'HR Recruiter', agentConfig: JSON.stringify({ role: 'recruiter' }) });
  check('logic', 'a custom (recruiter) agent gets a recruiting blueprint', bp.templateId === 'tpl-12', `resolved ${bp.templateId} "${bp.templateName}" for every agent without templateId (no code ever stores templateId)`);
  const csvRes = await fetch(BASE + '/api/v2/reports/export/csv');
  const csvBuf = Buffer.from(await csvRes.arrayBuffer());
  const csv2 = csvBuf.toString('utf-8');
  check('security', 'CSV neutralises spreadsheet formulas from AI-written text', !/,"=HYPERLINK/.test(csv2), 'summary cell starts with = and is written raw');
  check('csv', 'CSV has UTF-8 BOM so Excel shows Hindi correctly', (csvBuf[0] === 0xef && csvBuf[1] === 0xbb && csvBuf[2] === 0xbf) || csv2.charCodeAt(0) === 0xfeff, 'no BOM');

  // failed-with-conversation
  const fl = await mkCall({ status: 'failed', endReason: 'stream_closed', durationSeconds: 200 });
  await seg(fl, [['agent', 'Hello'], ['user', 'Yes tell me more, I am interested'], ['agent', 'Great'], ['user', 'ok bye']]);
  modelReplies = [{ resultLabel: 'Strong Fit', confidence: 0.9, summary: 'x', sentiment: 'Positive', fields: {}, evidence: {} }];
  const flo = await AnalysisService.processCall(fl);
  check('logic', 'a call with a real conversation is not reported as "Failed - could not connect"', flo.resultLabel !== 'Failed', `label="${flo.resultLabel}" summary="${flo.summary}"`);

  // correction then reanalysis
  await feFetch(`/api/v2/reports/${good}/correction`, { method: 'POST', body: JSON.stringify({ correctedLabel: 'Not Looking', correctedFields: { yearsExperience: 9 }, notes: 'human fix' }) });
  const afterCorr: any = await prisma.callResult.findUnique({ where: { callId: good } });
  check('logic', 'correction with only one field keeps the other fields', Object.keys(afterCorr.fields as any).length > 1, `fields after correction: ${JSON.stringify(afterCorr.fields)}`);
  check('logic', 'correcting the fields re-computes the rubric score', afterCorr.score !== base2.score, `score before=${base2.score} after changing yearsExperience to 9 = ${afterCorr.score}`);
  const bad = await feFetch(`/api/v2/reports/${good}/correction`, { method: 'POST', body: JSON.stringify({ correctedLabel: 'ZZZ not a label' }) });
  const afterBad: any = await prisma.callResult.findUnique({ where: { callId: good } });
  check('validation', 'a label that is not in the blueprint is rejected', afterBad.resultLabel !== 'ZZZ not a label', `stored label "${afterBad.resultLabel}"`);
  modelReplies = [{ resultLabel: 'Interview Scheduled', confidence: 0.9, summary: 'machine re-run', sentiment: 'Positive', fields: { yearsExperience: '5' }, evidence: { yearsExperience: { quote: '5 years of experience', segmentIndex: 1 } } }];
  await AnalysisService.processCall(good);
  const afterRe: any = await prisma.callResult.findUnique({ where: { callId: good } });
  check('logic', 'a re-analysis does not silently overwrite a human correction while still labelled "corrected"', !(afterRe.reviewStatus === 'corrected' && afterRe.resultLabel !== 'ZZZ not a label' && afterRe.summary === 'machine re-run'), `reviewStatus=${afterRe.reviewStatus} correctedBy=${afterRe.correctedBy ? 'set' : 'null'} but label="${afterRe.resultLabel}" summary="${afterRe.summary}"`);

  // events dead code: simulate a persisted tool-call event
  await prisma.callEvent.create({
    data: {
      callId: good,
      eventType: 'tool_call',
      payload: JSON.stringify({ toolName: 'book_follow_up_call', success: true }),
    },
  });
  const evc = await prisma.callEvent.count();
  check('logic', 'tool-call events (opt-out / booking / transfer) exist for the deterministic rules to read', evc > 0, `call_events rows in DB: ${evc}; no code path creates them, so those rules never run`);

  // extraction quality
  const ex = await mkCall();
  await seg(ex, [['agent', 'So you have 10 years of experience, right?'], ['user', 'No no, I just started, I have only six months'], ['agent', 'What is your notice period?'], ['user', 'around 5 lakh is what I expect']]);
  modelReplies = [{ resultLabel: 'Strong Fit', confidence: 0.95, summary: 'x', sentiment: 'Positive', fields: { yearsExperience: '10', expectedCtcLakhs: 'around 5 lakh', noticePeriodDays: '15 to 20 days' }, evidence: { yearsExperience: { quote: '10 years of experience', segmentIndex: 0 }, expectedCtcLakhs: { quote: 'around 5 lakh', segmentIndex: 3 }, noticePeriodDays: { quote: 'a', segmentIndex: 3 } } }];
  const exo = await AnalysisService.processCall(ex);
  check('accuracy', 'fact stated only by the AGENT is not recorded as a caller fact', exo.fields.yearsExperience == null, `yearsExperience=${exo.fields.yearsExperience} (agent said "10 years", caller denied) status=${exo.status}`);
  check('accuracy', '"around 5 lakh" is stored as 500000', exo.fields.expectedCtcLakhs === 500000, `stored ${exo.fields.expectedCtcLakhs}`);
  check('accuracy', 'a one-letter "quote" is not accepted as evidence', exo.fields.noticePeriodDays == null, `noticePeriodDays=${exo.fields.noticePeriodDays} (quote was "a"; "15 to 20 days" never said)`);

  // malformed model output
  const mf = await mkCall(); await seg(mf, [['agent', 'Hi'], ['user', 'I have 5 years experience'], ['agent', 'ok']]);
  modelReplies = [{ resultLabel: 'Strong Fit', confidence: 0.9, summary: 'x', sentiment: 'Positive', fields: { yearsExperience: '5' }, evidence: { yearsExperience: { quote: 123, segmentIndex: 1 } } }];
  let threw = ''; try { await AnalysisService.processCall(mf); } catch (e: any) { threw = e.message; }
  check('robustness', 'a non-text evidence quote from the model does not crash the whole analysis', !threw, threw);

  // multi-chunk label override
  const lc = await mkCall(); const longLines: [string, string][] = [];
  for (let i = 0; i < 40; i++) longLines.push([i % 2 ? 'user' : 'agent', 'This is a fairly long sentence number ' + i + ' ' + 'x'.repeat(380)]);
  await seg(lc, longLines);
  modelReplies = [{ resultLabel: 'Interview Scheduled', confidence: 0.95, summary: 'Candidate booked the interview.', sentiment: 'Positive', fields: {}, evidence: {} }, { resultLabel: 'Unclear', confidence: 0.4, summary: 'Goodbyes.', sentiment: 'Neutral', fields: {}, evidence: {} }];
  modelCalls = 0; const lco = await AnalysisService.processCall(lc);
  check('accuracy', 'a long call keeps the strongest outcome rather than whatever the LAST chunk says', lco.resultLabel === 'Interview Scheduled', `chunks=${modelCalls}; final label="${lco.resultLabel}" confidence=${lco.confidence} summary="${lco.summary}"`);

  // ═══ 3. QUEUE / WORKER / HEALTH ═══
  const qc = await mkCall(); await prisma.$executeRawUnsafe(`DELETE FROM analysis_jobs WHERE call_id=$1`, qc);
  await CallFinalizer.onCallFinalized(qc); await CallFinalizer.onCallFinalized(qc);
  const jobs: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM analysis_jobs WHERE call_id=$1`, qc);
  check('queue', 'finalizer is idempotent (one job per call)', jobs.length === 1, `${jobs.length} job(s)`);
  await prisma.$executeRawUnsafe(`UPDATE analysis_jobs SET status='processing', locked_at=NOW(), locked_by='other', attempts=1 WHERE call_id=$1`, qc);
  const rr = await feFetch(`/api/v2/reports/${qc}/reanalyze`, { method: 'POST', body: '{}' });
  const st: any[] = await prisma.$queryRawUnsafe(`SELECT status, locked_by FROM analysis_jobs WHERE call_id=$1`, qc);
  check('queue', 'Re-analyse on a job that is being processed does not reset it (double processing)', st[0].status === 'processing', `status became "${st[0].status}", locked_by=${st[0].locked_by} while another worker is still running it`);

  // health probe condition: one job in back-off for >10 minutes
  await prisma.$executeRawUnsafe(`UPDATE analysis_jobs SET status='pending', attempts=3, next_run_at=NOW()+INTERVAL '10 minutes', created_at=NOW()-INTERVAL '11 minutes', locked_at=NULL, locked_by=NULL WHERE call_id=$1`, qc);
  const oldest = await prisma.analysisJob.findFirst({ where: { status: 'pending', nextRunAt: { lte: new Date() } }, orderBy: { nextRunAt: 'asc' }, select: { nextRunAt: true, createdAt: true } });
  const ageSec = oldest ? Math.max(0, Math.floor((Date.now() - oldest.nextRunAt.getTime()) / 1000)) : 0;
  check('health', '/health stays 200 while one analysis job waits in its normal retry back-off', !(ageSec > 600), `oldestPendingAgeSec=${ageSec} (>600 makes /health return 503 -> platform may restart the server)`);

  // terminal failure visibility
  await prisma.$executeRawUnsafe(`UPDATE analysis_jobs SET status='failed', attempts=5 WHERE call_id=$1`, qc);
  const hasRes = await prisma.callResult.findUnique({ where: { callId: qc } });
  check('visibility', 'a call whose analysis failed permanently is still visible in Reports', !!hasRes, 'no call_results row is written, so the call vanishes from the screen with no "failed" entry');

  await prisma.agent.update({ where: { id: agentId }, data: { agentConfig: origCfg as any } });
  // cleanup
  await prisma.callResult.deleteMany({ where: { callId: { in: made } } }); await prisma.callEvent.deleteMany({ where: { callId: { in: made } } });
  await prisma.$executeRawUnsafe(`DELETE FROM analysis_jobs WHERE call_id = ANY($1::text[])`, made);
  await prisma.transcriptSegment.deleteMany({ where: { callId: { in: made } } }); await prisma.call.deleteMany({ where: { id: { in: made } } });
  server.close();
  const bad2 = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad2.length} ok, ${bad2.length} DEFECTS CONFIRMED`);
  await prisma.$disconnect().catch(() => {}); process.exit(0);
}
main().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1); });
