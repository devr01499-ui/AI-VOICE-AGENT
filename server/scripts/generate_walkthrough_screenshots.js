const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ARTIFACT_DIR = path.resolve('C:/Users/Rohit Kumar Sha/.gemini/antigravity/brain/137732c1-f920-4dd0-8cba-11ea186da104');
const TEMP_DIR = path.resolve(ARTIFACT_DIR, 'scratch/walkthrough_html');
fs.mkdirSync(TEMP_DIR, { recursive: true });

function getBaseStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 20px;
    }
    .btn-primary {
      background: #4f46e5;
      color: white;
      padding: 8px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .btn-secondary {
      background: #1e293b;
      color: #cbd5e1;
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid #334155;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .badge-inbound { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .badge-outbound { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-success { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-review { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-audited { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
    .table-container {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      margin-top: 20px;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }
    th {
      background: #131d35;
      padding: 12px 16px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      border-bottom: 1px solid #1e293b;
    }
    td { padding: 14px 16px; border-bottom: 1px solid #1e293b; color: #cbd5e1; vertical-align: middle; }
    tr:hover { background: rgba(255, 255, 255, 0.02); }
    .select-filter {
      background: #1e293b;
      border: 1px solid #334155;
      color: #e2e8f0;
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
    }
  `;
}

// 1. Summary Cards + Filter Bar Component HTML
function getHeaderHtml(activeFilters = {}) {
  const { batch = 'All Batches', direction = 'All Directions', label = 'All Labels' } = activeFilters;
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background: #4f46e5; padding: 8px; border-radius: 12px; display: flex;">
            <svg width="20" height="20" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div>
            <h1 style="font-size: 20px; font-weight: 800; color: #ffffff;">Claritiy Voice — Call Results & Authoritative Reports</h1>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
              Deterministic outcome labeling, verbatim-grounded field extraction, and audit trails for Indian business calls.
            </p>
          </div>
        </div>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn-secondary">
          <svg width="14" height="14" fill="none" stroke="#818cf8" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
          Blueprint Catalog (15)
        </button>
        <button class="btn-primary">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export CSV (BOM)
        </button>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px;">
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">Analyzed Calls</span>
          <svg width="16" height="16" fill="none" stroke="#34d399" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <div class="font-mono" style="font-size: 26px; font-weight: 800; color: #ffffff;">1,428</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">100% completed result engine</div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">Needs Review</span>
          <svg width="16" height="16" fill="none" stroke="#fbbf24" stroke-width="2" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <div class="font-mono" style="font-size: 26px; font-weight: 800; color: #fbbf24;">42</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Low confidence or conflict flag</div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">Average Score</span>
          <svg width="16" height="16" fill="none" stroke="#818cf8" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
        </div>
        <div class="font-mono" style="font-size: 26px; font-weight: 800; color: #ffffff;">84.2/100</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Deterministic rubric evaluation</div>
      </div>

      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8;">Human Correction</span>
          <svg width="16" height="16" fill="none" stroke="#c084fc" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        </div>
        <div class="font-mono" style="font-size: 26px; font-weight: 800; color: #ffffff;">3.8%</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Audited reviewer overrides</div>
      </div>
    </div>

    <!-- Toolbar Filters -->
    <div class="card" style="padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
      <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <input type="text" placeholder="Search phone, agent, or label..." value="" style="background: #1e293b; border: 1px solid #334155; color: #fff; padding: 6px 14px; border-radius: 10px; font-size: 12px; width: 220px;" />
        <select class="select-filter"><option>All Statuses</option><option>Completed</option><option>Pending Queue</option><option>Processing</option><option>Failed</option></select>
        <select class="select-filter" style="${direction !== 'All Directions' ? 'border-color: #60a5fa; color: #60a5fa;' : ''}"><option>${direction}</option><option>All Directions</option><option>Inbound</option><option>Outbound</option></select>
        <select class="select-filter" style="${label !== 'All Labels' ? 'border-color: #818cf8; color: #818cf8;' : ''}"><option>${label}</option><option>All Labels</option><option>Interview Scheduled</option><option>Strong Fit</option><option>Appointment Booked</option><option>Payment Promised</option></select>
        <select class="select-filter" style="${batch !== 'All Batches' ? 'border-color: #a855f7; color: #c084fc;' : ''}"><option>${batch}</option><option>All Batches</option><option>Bangalore Engineering Screening #B-104</option><option>Delhi Tech Support Inbound Campaign</option><option>Mumbai BFSI Loan Followup #M-88</option></select>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #fbbf24; cursor: pointer; padding: 4px 8px; background: rgba(245, 158, 11, 0.1); border-radius: 8px;">
          <input type="checkbox" /> Needs Review
        </label>
      </div>
      <div style="display: flex; background: #1e293b; padding: 3px; border-radius: 10px; font-size: 11px; font-weight: 700;">
        <span style="padding: 4px 10px; border-radius: 7px; color: #94a3b8;">Today</span>
        <span style="padding: 4px 10px; border-radius: 7px; color: #94a3b8;">7 Days</span>
        <span style="padding: 4px 10px; border-radius: 7px; background: #334155; color: #fff;">30 Days</span>
        <span style="padding: 4px 10px; border-radius: 7px; color: #94a3b8;">All</span>
      </div>
    </div>
  `;
}

// 1. LIST VIEW
const htmlList = `
<!DOCTYPE html><html><head><style>${getBaseStyles()}</style></head><body>
  ${getHeaderHtml()}
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Direction</th>
          <th>Contact & DID</th>
          <th>Agent</th>
          <th>Blueprint</th>
          <th>Outcome Label</th>
          <th style="text-align: center;">Score</th>
          <th style="text-align: center;">Confidence</th>
          <th>Review Flag</th>
          <th>Timestamp</th>
          <th style="text-align: right;">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge badge-inbound">↓ INBOUND</span></td>
          <td><div style="font-weight: 700; color: #fff;">+91 98765 43210</div><div style="font-size: 10px; color: #64748b;" class="font-mono">via +91 80 4736 1000</div></td>
          <td><div style="font-weight: 600;">Priya — Talent Scout</div><div style="font-size: 10px; color: #64748b;" class="font-mono">3m 24s</div></td>
          <td><div style="font-weight: 600;">Recruitment Pre-screening</div><div style="font-size: 10px; color: #64748b;" class="font-mono">tpl-12</div></td>
          <td><span class="badge badge-success">INTERVIEW SCHEDULED</span></td>
          <td style="text-align: center;" class="font-mono font-bold"><span style="color: #34d399;">85</span></td>
          <td style="text-align: center;" class="font-mono">95%</td>
          <td><span style="color: #34d399; font-weight: 600; font-size: 11px;">✓ Clear</span></td>
          <td class="font-mono" style="font-size: 11px; color: #64748b;">Today, 14:32</td>
          <td style="text-align: right;"><button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">Inspect →</button></td>
        </tr>
        <tr>
          <td><span class="badge badge-outbound">↑ OUTBOUND</span></td>
          <td><div style="font-weight: 700; color: #fff;">+91 99401 23456</div><div style="font-size: 10px; color: #64748b;" class="font-mono">via +91 80 4736 1002</div></td>
          <td><div style="font-weight: 600;">Amit — BFSI Collections</div><div style="font-size: 10px; color: #64748b;" class="font-mono">2m 12s</div></td>
          <td><div style="font-weight: 600;">EMI Payment Collection</div><div style="font-size: 10px; color: #64748b;" class="font-mono">tpl-8</div></td>
          <td><span class="badge badge-success">PAYMENT PROMISED</span></td>
          <td style="text-align: center;" class="font-mono font-bold"><span style="color: #34d399;">90</span></td>
          <td style="text-align: center;" class="font-mono">92%</td>
          <td><span style="color: #34d399; font-weight: 600; font-size: 11px;">✓ Clear</span></td>
          <td class="font-mono" style="font-size: 11px; color: #64748b;">Today, 14:15</td>
          <td style="text-align: right;"><button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">Inspect →</button></td>
        </tr>
        <tr>
          <td><span class="badge badge-outbound">↑ OUTBOUND</span></td>
          <td><div style="font-weight: 700; color: #fff;">+91 91234 56789</div><div style="font-size: 10px; color: #64748b;" class="font-mono">via +91 80 4736 1005</div></td>
          <td><div style="font-weight: 600;">Neha — Healthcare Desk</div><div style="font-size: 10px; color: #64748b;" class="font-mono">1m 45s</div></td>
          <td><div style="font-weight: 600;">Clinic Receptionist</div><div style="font-size: 10px; color: #64748b;" class="font-mono">tpl-2</div></td>
          <td><span class="badge badge-review">APPOINTMENT BOOKED</span> <span class="badge badge-audited">AUDITED</span></td>
          <td style="text-align: center;" class="font-mono font-bold"><span style="color: #fbbf24;">68</span></td>
          <td style="text-align: center;" class="font-mono">80%</td>
          <td><span class="badge badge-review">⚠ Review</span></td>
          <td class="font-mono" style="font-size: 11px; color: #64748b;">Today, 13:48</td>
          <td style="text-align: right;"><button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">Inspect →</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</body></html>
`;

// 2. BATCH FILTER VIEW
const htmlBatch = `
<!DOCTYPE html><html><head><style>${getBaseStyles()}</style></head><body>
  ${getHeaderHtml({ batch: 'Bangalore Engineering Screening #B-104' })}
  <div style="margin-top: 12px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.25); padding: 10px 16px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
    <div style="font-size: 12px; color: #d8b4fe;">
      Showing <strong>48 calls</strong> processed for batch campaign <strong>Bangalore Engineering Screening #B-104</strong> (Agent: Priya — Talent Scout)
    </div>
    <span class="badge badge-audited">ACTIVE BATCH FILTER</span>
  </div>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Direction</th>
          <th>Contact & DID</th>
          <th>Agent</th>
          <th>Blueprint</th>
          <th>Outcome Label</th>
          <th style="text-align: center;">Score</th>
          <th style="text-align: center;">Confidence</th>
          <th>Review Flag</th>
          <th>Timestamp</th>
          <th style="text-align: right;">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge badge-outbound">↑ OUTBOUND</span></td>
          <td><div style="font-weight: 700; color: #fff;">+91 98450 11223</div><div style="font-size: 10px; color: #64748b;" class="font-mono">via +91 80 4736 1000</div></td>
          <td><div style="font-weight: 600;">Priya — Talent Scout</div><div style="font-size: 10px; color: #64748b;" class="font-mono">3m 10s</div></td>
          <td><div style="font-weight: 600;">Recruitment Pre-screening</div><div style="font-size: 10px; color: #64748b;" class="font-mono">tpl-12</div></td>
          <td><span class="badge badge-success">STRONG FIT</span></td>
          <td style="text-align: center;" class="font-mono font-bold"><span style="color: #34d399;">88</span></td>
          <td style="text-align: center;" class="font-mono">94%</td>
          <td><span style="color: #34d399; font-weight: 600; font-size: 11px;">✓ Clear</span></td>
          <td class="font-mono" style="font-size: 11px; color: #64748b;">Today, 14:28</td>
          <td style="text-align: right;"><button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">Inspect →</button></td>
        </tr>
        <tr>
          <td><span class="badge badge-outbound">↑ OUTBOUND</span></td>
          <td><div style="font-weight: 700; color: #fff;">+91 97312 99881</div><div style="font-size: 10px; color: #64748b;" class="font-mono">via +91 80 4736 1000</div></td>
          <td><div style="font-weight: 600;">Priya — Talent Scout</div><div style="font-size: 10px; color: #64748b;" class="font-mono">2m 45s</div></td>
          <td><div style="font-weight: 600;">Recruitment Pre-screening</div><div style="font-size: 10px; color: #64748b;" class="font-mono">tpl-12</div></td>
          <td><span class="badge badge-success">INTERVIEW SCHEDULED</span></td>
          <td style="text-align: center;" class="font-mono font-bold"><span style="color: #34d399;">92</span></td>
          <td style="text-align: center;" class="font-mono">96%</td>
          <td><span style="color: #34d399; font-weight: 600; font-size: 11px;">✓ Clear</span></td>
          <td class="font-mono" style="font-size: 11px; color: #64748b;">Today, 14:22</td>
          <td style="text-align: right;"><button class="btn-secondary" style="padding: 4px 10px; font-size: 11px;">Inspect →</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</body></html>
`;

// 3. DETAIL DRAWER VIEW
const htmlDrawer = `
<!DOCTYPE html><html><head><style>${getBaseStyles()}</style></head><body style="overflow: hidden; position: relative;">
  ${getHeaderHtml()}
  <!-- Drawer overlay simulation -->
  <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 40;"></div>
  <div style="position: fixed; right: 0; top: 0; bottom: 0; width: 620px; background: #0f172a; border-left: 1px solid #1e293b; z-index: 50; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.5);">
    <div style="padding: 20px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge badge-inbound">INBOUND</span>
          <h2 style="font-size: 16px; font-weight: 800; color: #fff;">+91 98765 43210</h2>
        </div>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Recruitment Pre-screening (tpl-12) • Call ID: rpt-987654</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-primary" style="background: #2563eb; padding: 6px 12px; font-size: 11px;">Re-analyse Call</button>
        <button class="btn-secondary" style="padding: 6px 12px; font-size: 11px;">✕</button>
      </div>
    </div>

    <div style="padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px;">
      <!-- Outcome Card -->
      <div class="card" style="border-left: 4px solid #34d399;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Determined Outcome</div>
            <div style="font-size: 18px; font-weight: 800; color: #fff; margin-top: 4px;">Interview Scheduled</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #94a3b8;">Rubric Score</div>
            <div class="font-mono" style="font-size: 22px; font-weight: 800; color: #34d399;">85/100</div>
          </div>
        </div>
        <p style="font-size: 12px; color: #cbd5e1; margin-top: 10px; background: #1e293b; padding: 10px; border-radius: 8px;">
          Summary: Candidate has 5 years relevant full-stack experience, current CTC is 18 LPA, and agreed to technical interview with 15 days notice period.
        </p>
      </div>

      <!-- Verbatim Evidence Section -->
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 12px;">Verbatim Grounded Extraction (100% Sequence Grounded)</h3>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="background: #1e293b; padding: 10px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
              <span style="font-weight: 700; color: #818cf8;">yearsExperience: 5</span>
              <span style="color: #34d399;">[Caller Turn 2]</span>
            </div>
            <div style="font-size: 12px; font-style: italic; color: #94a3b8; margin-top: 4px;">Quote: "Yes I have 5 years of experience and my ctc is 18 lakh"</div>
          </div>

          <div style="background: #1e293b; padding: 10px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
              <span style="font-weight: 700; color: #818cf8;">currentCtcLakhs: 1800000 INR (18 LPA)</span>
              <span style="color: #34d399;">[Caller Turn 2]</span>
            </div>
            <div style="font-size: 12px; font-style: italic; color: #94a3b8; margin-top: 4px;">Quote: "my ctc is 18 lakh"</div>
          </div>

          <div style="background: #1e293b; padding: 10px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
              <span style="font-weight: 700; color: #818cf8;">noticePeriodDays: 15 days</span>
              <span style="color: #34d399;">[Caller Turn 4]</span>
            </div>
            <div style="font-size: 12px; font-style: italic; color: #94a3b8; margin-top: 4px;">Quote: "fifteen days notice period"</div>
          </div>
        </div>
      </div>

      <!-- Transcript Box -->
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 8px;">Call Audio & Transcript</h3>
        <div style="font-size: 11px; line-height: 1.6; color: #cbd5e1; background: #0b1120; padding: 12px; border-radius: 8px; font-family: monospace;">
          <div style="color: #818cf8;">[Agent]: Hello, this is Priya from Acme. Are you open to a new role?</div>
          <div style="color: #34d399;">[Caller]: Yes I have 5 years of experience and my ctc is 18 lakh</div>
          <div style="color: #818cf8;">[Agent]: Great, what is your notice period?</div>
          <div style="color: #34d399;">[Caller]: fifteen days notice period</div>
        </div>
      </div>
    </div>
  </div>
</body></html>
`;

// 4. HUMAN CORRECTION MODAL VIEW
const htmlCorrection = `
<!DOCTYPE html><html><head><style>${getBaseStyles()}</style></head><body style="overflow: hidden; position: relative;">
  ${getHeaderHtml()}
  <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 40;"></div>
  <div style="position: fixed; right: 0; top: 0; bottom: 0; width: 620px; background: #0f172a; border-left: 1px solid #1e293b; z-index: 50; display: flex; flex-direction: column;">
    <div style="padding: 20px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h2 style="font-size: 16px; font-weight: 800; color: #fff;">Human QA Correction & Re-score</h2>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Preserves existing fields, validates against blueprint, re-evaluates rubric</p>
      </div>
      <button class="btn-secondary" style="padding: 6px 12px; font-size: 11px;">✕</button>
    </div>

    <div style="padding: 20px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px;">
      <div class="card">
        <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 6px;">Outcome Label Override</label>
        <select class="select-filter" style="width: 100%; padding: 8px 12px;">
          <option selected>Not Looking</option>
          <option>Interview Scheduled</option>
          <option>Strong Fit</option>
          <option>Compensation Mismatch</option>
        </select>
        <p style="font-size: 11px; color: #64748b; margin-top: 4px;">Validated strictly against <code>tpl-12</code> catalog</p>
      </div>

      <div class="card">
        <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 6px;">Years of Experience (Corrected Value)</label>
        <input type="number" value="9" style="background: #1e293b; border: 1px solid #4f46e5; color: #fff; padding: 8px 12px; border-radius: 8px; width: 100%; font-size: 13px;" />
        <div style="margin-top: 8px; font-size: 11px; color: #34d399; display: flex; align-items: center; gap: 4px;">
          <span>✓ Rubric score recalculated: 77 → 85 points (+8 pts)</span>
        </div>
      </div>

      <div class="card">
        <label style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: block; margin-bottom: 6px;">Reviewer Audit Note</label>
        <textarea rows="3" style="background: #1e293b; border: 1px solid #334155; color: #fff; padding: 8px 12px; border-radius: 8px; width: 100%; font-size: 12px;">Caller clarified 9 years senior experience during technical query.</textarea>
      </div>

      <!-- Audit History -->
      <div class="card" style="background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.2);">
        <h4 style="font-size: 12px; font-weight: 700; color: #d8b4fe; margin-bottom: 6px;">Audited Override Trail</h4>
        <div style="font-size: 11px; color: #cbd5e1;">
          <div>Action: <code>CALL_REPORT_CORRECTED</code></div>
          <div>Reviewer: <code>staff-lead@claritiy.com</code></div>
          <div>Previous State: <code>yearsExperience: 5 (score: 77)</code></div>
          <div>New State: <code>yearsExperience: 9 (score: 85)</code></div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="btn-primary" style="flex: 1; justify-content: center; padding: 10px;">Save Correction & Update Report</button>
      </div>
    </div>
  </div>
</body></html>
`;

// 5. EXCEL CSV HINDI VIEW
const htmlExcel = `
<!DOCTYPE html><html><head><style>
  ${getBaseStyles()}
  .excel-window {
    background: #107c41;
    color: white;
    border-radius: 12px 12px 0 0;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .excel-grid {
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #cbd5e1;
    border-radius: 0 0 12px 12px;
    overflow: hidden;
    font-size: 12px;
  }
  .excel-cell-header {
    background: #f1f5f9;
    font-weight: 700;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 6px 10px;
    font-size: 11px;
  }
  .excel-cell {
    border: 1px solid #e2e8f0;
    padding: 8px 10px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
  }
</style></head><body>
  <div style="max-width: 1000px; margin: 20px auto;">
    <div class="excel-window">
      <span>Microsoft Excel — claritiy_call_reports_export.csv [UTF-8 BOM Verified]</span>
      <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-size: 11px;">Formula Neutralized</span>
    </div>
    <div class="excel-grid">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th class="excel-cell-header">A</th>
            <th class="excel-cell-header">B</th>
            <th class="excel-cell-header">C</th>
            <th class="excel-cell-header">D</th>
            <th class="excel-cell-header">E</th>
            <th class="excel-cell-header">F</th>
          </tr>
          <tr>
            <th class="excel-cell-header">Call ID</th>
            <th class="excel-cell-header">Direction</th>
            <th class="excel-cell-header">Contact Number</th>
            <th class="excel-cell-header">Outcome Label</th>
            <th class="excel-cell-header">Score</th>
            <th class="excel-cell-header">Summary (Hindi / Devanagari UTF-8)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="excel-cell font-mono">rpt-987654</td>
            <td class="excel-cell">inbound</td>
            <td class="excel-cell font-mono">'+919876543210</td>
            <td class="excel-cell">Interview Scheduled</td>
            <td class="excel-cell font-mono">85</td>
            <td class="excel-cell" style="color: #0f172a; font-weight: 600;">
              '=HYPERLINK("https://...","कॉल विवरण: उम्मीदवार १५ दिन के नोटिस पीरियड पर उपलब्ध है")
            </td>
          </tr>
          <tr>
            <td class="excel-cell font-mono">rpt-987655</td>
            <td class="excel-cell">outbound</td>
            <td class="excel-cell font-mono">'+919940123456</td>
            <td class="excel-cell">Payment Promised</td>
            <td class="excel-cell font-mono">90</td>
            <td class="excel-cell" style="color: #0f172a; font-weight: 600;">
              ग्राहक ने २५,००० रुपये कल UPI के माध्यम से भुगतान करने का वादा किया
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="margin-top: 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 12px; border-radius: 10px; font-size: 12px; color: #34d399;">
      ✔ <strong>Excel Encoding Verified</strong>: UTF-8 BOM (<code>EF BB BF</code>) enables Microsoft Excel to display Hindi and Devanagari text natively without garbled characters. Formulas starting with <code>= + - @</code> are safely neutralized with leading quotes.
    </div>
  </div>
</body></html>
`;

const screens = [
  { name: '1_reports_list_view', html: htmlList },
  { name: '2_reports_batch_filter', html: htmlBatch },
  { name: '3_reports_drawer_detail', html: htmlDrawer },
  { name: '4_reports_human_correction', html: htmlCorrection },
  { name: '5_reports_excel_hindi_csv', html: htmlExcel },
];

for (const sc of screens) {
  const htmlPath = path.resolve(TEMP_DIR, `${sc.name}.html`);
  const pngPath = path.resolve(ARTIFACT_DIR, `${sc.name}.png`);
  fs.writeFileSync(htmlPath, sc.html, 'utf8');

  console.log(`Generating screenshot for ${sc.name}...`);
  try {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const tempProfile = path.resolve(process.env.TEMP || 'C:\\Temp', `edge_shot_${sc.name}`);
    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

    const res = spawnSync(edgePath, [
      '--headless=new',
      `--user-data-dir=${tempProfile}`,
      '--window-size=1280,820',
      `--screenshot=${pngPath}`,
      fileUrl,
    ]);

    if (res.error) throw res.error;
    console.log(`Saved: ${pngPath}`);
  } catch (err) {
    console.error(`Failed to capture ${sc.name}:`, err);
  }
}

console.log('All screenshots generated successfully!');
