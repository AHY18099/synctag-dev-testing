/**
 * Synctag Custom HTML Reporter — v2 Professional Edition
 *
 * Generates a single self-contained SPA-style HTML report with:
 *   • Sidebar navigation (Dashboard / Results / Modules / Bugs / Screenshots)
 *   • Executive dashboard with KPI cards + 3 Chart.js charts
 *   • Sortable, filterable, paginated test-results table
 *   • Per-test expandable panel (error, stack, screenshot, video, trace)
 *   • Module drill-down cards
 *   • JIRA-format bug cards with screenshots + export
 *   • Screenshot masonry gallery with lightbox
 *   • Dark / Light mode toggle
 *   • CSV export
 *   • Print / Save as PDF
 */

import type {
  Reporter, FullConfig, Suite,
  TestCase, TestResult, FullResult,
} from '@playwright/test/reporter';
import * as fs   from 'node:fs';
import * as path from 'node:path';

// ─── Data types ───────────────────────────────────────────────────────────────

interface TestRecord {
  idx:         number;
  id:          string;
  testId:      string;          // extracted SM-001 / R-11-042 style
  title:       string;
  suite:       string;
  module:      string;
  file:        string;
  status:      string;          // passed | failed | timedOut | skipped
  duration:    number;
  error:       string;
  errorStack:  string;
  screenshot:  string | null;   // base64 data URI (failures only)
  videoPath:   string | null;
  tracePath:   string | null;
  retry:       number;
  startTime:   number;          // Unix ms
  annotations: Array<{ type: string; description?: string }>;
  failureClass: string;
}

// ─── Reporter class ───────────────────────────────────────────────────────────

class CustomHtmlReporter implements Reporter {
  private readonly records: TestRecord[] = [];
  private beginTime = Date.now();
  private readonly outDir: string;
  private idx = 0;

  constructor(options: Record<string, string> = {}) {
    this.outDir = options['outputDir'] || 'reports/custom';
  }

  onBegin(_c: FullConfig, _s: Suite): void {
    this.beginTime = Date.now();
    fs.mkdirSync(this.outDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const tp     = test.titlePath();           // ['', file, ...suites, title]
    const module = (tp[2] || tp[1] || 'Unknown').trim();
    const suite  = tp.slice(2, -1).join(' › ') || module;
    const file   = tp[1] || '';
    const title  = test.title;

    // Extract structured test ID: SM-001, R-11-042, SCHEMA-001, SEC-027 …
    const testId = (/^([A-Z][-A-Z0-9]+-\d+)/.exec(title)?.[1] ?? '').trim();

    const { screenshot, videoPath, tracePath } = this.parseAttachments(result);

    const esc = (s = '') =>
      s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

    const isFail       = result.status === 'failed' || result.status === 'timedOut';
    const failureClass = isFail ? this.classifyFailure(result.error?.message || '', title) : '';

    this.records.push({
      idx:         ++this.idx,
      id:          test.id,
      testId,
      title,
      suite,
      module,
      file,
      status:      result.status,
      duration:    result.duration,
      error:       esc(result.error?.message ?? ''),
      errorStack:  esc(result.error?.stack    ?? ''),
      screenshot,
      videoPath,
      tracePath,
      retry:       result.retry,
      startTime:   result.startTime.getTime(),
      annotations: test.annotations,
      failureClass,
    });
  }

  private parseAttachments(result: TestResult): {
    screenshot: string | null; videoPath: string | null; tracePath: string | null;
  } {
    const isFail = result.status === 'failed' || result.status === 'timedOut';
    let screenshot: string | null = null;
    let videoPath:  string | null = null;
    let tracePath:  string | null = null;
    for (const att of result.attachments) {
      const p = att.path;
      if (!screenshot && att.name === 'screenshot' && p && isFail && fs.existsSync(p))
        screenshot = `data:${att.contentType};base64,${fs.readFileSync(p).toString('base64')}`;
      if (!videoPath && att.name === 'video' && p) videoPath = p;
      if (!tracePath && att.name === 'trace' && p) tracePath = p;
    }
    return { screenshot, videoPath, tracePath };
  }

  async onEnd(r: FullResult): Promise<void> {
    const html = this.buildHTML(r.status);
    const out  = path.join(this.outDir, 'index.html');
    fs.writeFileSync(out, html, 'utf-8');
    const elapsed = this.ms(Date.now() - this.beginTime);
    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║  📊  Custom HTML Report  →  ${out}`);
    console.log(`║  Tests: ${this.records.length}  |  Duration: ${elapsed}`);
    console.log(`╚══════════════════════════════════════════════════════╝\n`);
  }

  printsToStdio(): boolean { return false; }

  // ─── Failure classifier ───────────────────────────────────────────────────

  private classifyFailure(errorMsg: string, title: string): string {
    const e = (errorMsg || '').toLowerCase();
    const t = title.toLowerCase();
    if (e.includes('tearing down') || e.includes('context was closed')) return 'Automation Issue';
    if (e.includes('waitforurl') || e.includes('page.waitforurl'))       return 'Automation Issue';
    if (e.includes('locator.click') && e.includes('timeout'))            return 'Automation Issue';
    if (t.includes('signup') || t.includes('new user') ||
        (t.includes('otp') && !t.includes('profile')))                   return 'External Dependency Issue';
    if (e.includes('test timeout') && (t.includes('signup') || t.includes('mailinator')))
                                                                          return 'External Dependency Issue';
    if (e.includes('profile not found') ||
        (e.includes('tobevisible') && (t.includes('dashboard') || t.includes('sidebar') || t.includes('tag library'))))
                                                                          return 'Environment Issue';
    if (e.includes('tohaveurl') && (t.includes('login') || t.includes('auth')))
                                                                          return 'Environment Issue';
    if (e.includes('tobelessthan') || (e.includes('received') && e.includes('15000')))
                                                                          return 'Performance/SLA Issue';
    if (e.includes('test timeout'))                                       return 'Automation Issue';
    return 'Product Bug';
  }

  // ─── HTML builder ─────────────────────────────────────────────────────────

  private buildHTML(overallStatus: string): string {
    const R  = this.records;
    const passed  = R.filter(r => r.status === 'passed').length;
    const failed  = R.filter(r => r.status === 'failed' || r.status === 'timedOut').length;
    const skipped = R.filter(r => r.status === 'skipped' || r.status === 'interrupted').length;
    const total   = R.length;
    const rate    = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    const elapsed = Date.now() - this.beginTime;

    const productBugs = R.filter(r => r.failureClass === 'Product Bug').length;
    const autoIssues  = R.filter(r => r.failureClass === 'Automation Issue').length;
    const envIssues   = R.filter(r => r.failureClass === 'Environment Issue').length;
    const extIssues   = R.filter(r => r.failureClass === 'External Dependency Issue').length;
    const critHigh    = R.filter(r => r.failureClass === 'Product Bug' && (r.annotations.find(a => a.type === 'priority')?.description || 'High').match(/critical|high/i)).length;
    const releaseReady = productBugs === 0 || critHigh === 0;

    // Module breakdown
    const modMap: Record<string, { p:number; f:number; s:number }> = {};
    for (const r of R) {
      if (!modMap[r.module]) modMap[r.module] = { p:0, f:0, s:0 };
      if      (r.status === 'passed')                           modMap[r.module].p++;
      else if (r.status === 'failed' || r.status === 'timedOut') modMap[r.module].f++;
      else                                                       modMap[r.module].s++;
    }

    // Timeline buckets (per-minute histogram for last 60 minutes, or per 30-s if short run)
    const bucketMs  = elapsed > 120000 ? 60000 : 30000;
    const timeMap: Record<number, number> = {};
    for (const r of R) {
      const bucket = Math.floor((r.startTime - this.beginTime) / bucketMs);
      timeMap[bucket] = (timeMap[bucket] || 0) + 1;
    }
    const maxBucket = Math.max(...Object.keys(timeMap).map(Number), 0);
    const timeLabels = Array.from({ length: maxBucket + 1 }, (_, i) =>
      `+${((i * bucketMs) / 1000).toFixed(0)}s`);
    const timeData = Array.from({ length: maxBucket + 1 }, (_, i) => timeMap[i] || 0);

    const env     = process.env.BASE_URL || 'https://devextension.synctag.com';
    const runDate = new Date(this.beginTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });
    const isPass  = overallStatus === 'passed';

    const dataJson = JSON.stringify({
      records: R.map(r => ({ ...r, screenshot: r.screenshot ? '__HAS_IMG__' : null })),
      screenshots: Object.fromEntries(R.filter(r => r.screenshot).map(r => [r.idx, r.screenshot])),
      modMap,
      stats: { passed, failed, skipped, total, rate, elapsed, productBugs, autoIssues, envIssues, extIssues, releaseReady },
      meta:  { env, runDate, overallStatus },
    });

    return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Synctag E2E Report · ${runDate}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
:root {
  --sb-bg:      #0B1120;
  --sb-surface: #111827;
  --sb-border:  #1F2937;
  --sb-text:    #9CA3AF;
  --sb-active:  #6366F1;
  --sb-hover:   #1F2937;
  --sb-width:   240px;

  --bg:         #F0F4F8;
  --surface:    #FFFFFF;
  --surface2:   #F8FAFC;
  --border:     #E2E8F0;
  --text:       #1E293B;
  --text-muted: #64748B;
  --text-faint: #94A3B8;

  --pass:       #10B981;
  --pass-bg:    #D1FAE5;
  --pass-text:  #065F46;
  --fail:       #EF4444;
  --fail-bg:    #FEE2E2;
  --fail-text:  #991B1B;
  --skip:       #F59E0B;
  --skip-bg:    #FEF3C7;
  --skip-text:  #92400E;
  --accent:     #6366F1;
  --accent-bg:  #EEF2FF;
  --accent-text:#3730A3;

  --radius-sm:  4px;
  --radius:     8px;
  --radius-lg:  12px;
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08);
  --shadow:     0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg:  0 8px 24px rgba(0,0,0,0.12);
  --transition: 150ms ease;
}
[data-theme="dark"] {
  --bg:         #0B1120;
  --surface:    #111827;
  --surface2:   #1F2937;
  --border:     #374151;
  --text:       #F9FAFB;
  --text-muted: #9CA3AF;
  --text-faint: #6B7280;
  --pass-bg:    #064E3B;
  --pass-text:  #6EE7B7;
  --fail-bg:    #7F1D1D;
  --fail-text:  #FCA5A5;
  --skip-bg:    #78350F;
  --skip-text:  #FCD34D;
  --accent-bg:  #1E1B4B;
  --accent-text:#A5B4FC;
}

/* ═══════════════════════════════════════════════════════════════
   RESET & BASE
═══════════════════════════════════════════════════════════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:14px;background:var(--bg);color:var(--text);min-height:100vh;display:flex;overflow-x:hidden}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
button{cursor:pointer;font-family:inherit;font-size:inherit}
::-webkit-scrollbar{width:6px;height:6px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════ */
.sidebar{
  width:var(--sb-width);min-width:var(--sb-width);height:100vh;position:sticky;top:0;
  background:var(--sb-bg);display:flex;flex-direction:column;overflow:hidden;
  border-right:1px solid var(--sb-border);z-index:100;
}
.sb-logo{
  padding:20px 20px 16px;border-bottom:1px solid var(--sb-border);
  display:flex;align-items:center;gap:10px;
}
.sb-logo-icon{
  width:36px;height:36px;border-radius:var(--radius);
  background:linear-gradient(135deg,#6366F1,#8B5CF6);
  display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;
}
.sb-logo-text{line-height:1.3}
.sb-logo-text strong{display:block;color:#F9FAFB;font-size:14px;font-weight:700}
.sb-logo-text span{font-size:10px;color:var(--sb-text);text-transform:uppercase;letter-spacing:0.8px}

.sb-nav{flex:1;padding:12px 8px;overflow-y:auto;display:flex;flex-direction:column;gap:2px}
.nav-item{
  display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius);
  color:var(--sb-text);font-size:13px;font-weight:500;transition:var(--transition);cursor:pointer;
  border:none;background:none;text-align:left;width:100%;
}
.nav-item:hover{background:var(--sb-hover);color:#E5E7EB}
.nav-item.active{background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.15));color:#A5B4FC;border-left:2px solid #6366F1;margin-left:-2px}
.nav-item .nav-icon{font-size:15px;width:20px;text-align:center;flex-shrink:0}
.nav-badge{margin-left:auto;background:var(--fail);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;min-width:20px;text-align:center}
.nav-badge.pass{background:var(--pass)}

.sb-section-label{padding:16px 12px 4px;font-size:10px;font-weight:700;color:#4B5563;text-transform:uppercase;letter-spacing:1px}

.sb-run-info{padding:12px 16px;border-top:1px solid var(--sb-border);font-size:11px;color:var(--sb-text);line-height:2}
.sb-run-info strong{color:#E5E7EB}
.overall-pill{
  display:inline-block;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;margin-top:4px;
}
.overall-pill.pass{background:#065F46;color:#6EE7B7}
.overall-pill.fail{background:#7F1D1D;color:#FCA5A5}

/* ═══════════════════════════════════════════════════════════════
   MAIN CONTENT
═══════════════════════════════════════════════════════════════ */
.main{flex:1;min-width:0;display:flex;flex-direction:column;height:100vh;overflow:hidden}

.top-bar{
  height:52px;min-height:52px;background:var(--surface);border-bottom:1px solid var(--border);
  padding:0 24px;display:flex;align-items:center;gap:12px;
  box-shadow:var(--shadow-sm);z-index:10;
}
.top-bar-title{font-size:15px;font-weight:700;color:var(--text);flex:1}
.top-bar-title span{color:var(--text-muted);font-weight:400;font-size:13px;margin-left:8px}
.icon-btn{
  width:36px;height:36px;border-radius:var(--radius);border:1px solid var(--border);
  background:var(--surface);display:flex;align-items:center;justify-content:center;
  font-size:16px;transition:var(--transition);
}
.icon-btn:hover{background:var(--surface2);border-color:var(--accent)}

.content-area{flex:1;overflow-y:auto;padding:24px}

/* ═══════════════════════════════════════════════════════════════
   VIEWS
═══════════════════════════════════════════════════════════════ */
.view{display:none;animation:fadeIn 200ms ease}
.view.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

.view-header{margin-bottom:20px}
.view-title{font-size:20px;font-weight:800;color:var(--text)}
.view-subtitle{font-size:13px;color:var(--text-muted);margin-top:3px}

/* ═══════════════════════════════════════════════════════════════
   CARDS / SURFACES
═══════════════════════════════════════════════════════════════ */
.card{background:var(--surface);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow);border:1px solid var(--border)}
.card-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:14px;display:flex;align-items:center;gap:6px}

/* ═══════════════════════════════════════════════════════════════
   KPI CARDS
═══════════════════════════════════════════════════════════════ */
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;margin-bottom:20px}
.kpi{
  background:var(--surface);border-radius:var(--radius-lg);padding:18px 20px;
  box-shadow:var(--shadow);border:1px solid var(--border);position:relative;overflow:hidden;
  transition:transform var(--transition),box-shadow var(--transition);
}
.kpi:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:var(--radius-lg) var(--radius-lg) 0 0}
.kpi.total::before  {background:var(--accent)}
.kpi.pass::before   {background:var(--pass)}
.kpi.fail::before   {background:var(--fail)}
.kpi.skip::before   {background:var(--skip)}
.kpi.rate::before   {background:#8B5CF6}
.kpi.dur::before    {background:#0EA5E9}
.kpi-icon{font-size:20px;margin-bottom:8px}
.kpi-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted)}
.kpi-value{font-size:34px;font-weight:900;line-height:1.1;margin-top:4px;font-variant-numeric:tabular-nums}
.kpi.total .kpi-value  {color:var(--accent)}
.kpi.pass  .kpi-value  {color:var(--pass)}
.kpi.fail  .kpi-value  {color:var(--fail)}
.kpi.skip  .kpi-value  {color:var(--skip)}
.kpi.rate  .kpi-value  {color:#8B5CF6;font-size:28px}
.kpi.dur   .kpi-value  {color:#0EA5E9;font-size:20px;margin-top:12px}
.kpi-sub{font-size:11px;color:var(--text-faint);margin-top:3px}

/* ═══════════════════════════════════════════════════════════════
   CHARTS ROW
═══════════════════════════════════════════════════════════════ */
.charts-grid{display:grid;grid-template-columns:1fr 300px 1fr;gap:16px;margin-bottom:20px}
@media(max-width:1100px){.charts-grid{grid-template-columns:1fr 1fr}}
.chart-wrap{position:relative;height:240px}
canvas{max-height:100%!important}

/* ═══════════════════════════════════════════════════════════════
   RECENT FAILURES (dashboard)
═══════════════════════════════════════════════════════════════ */
.fail-list{display:flex;flex-direction:column;gap:8px}
.fail-item{
  background:var(--surface2);border-radius:var(--radius);padding:10px 14px;
  border-left:3px solid var(--fail);cursor:pointer;transition:background var(--transition);
  display:flex;align-items:flex-start;gap:10px;
}
.fail-item:hover{background:var(--fail-bg)}
.fail-item-id{font-size:11px;font-weight:700;color:var(--fail);min-width:90px;flex-shrink:0}
.fail-item-title{font-size:13px;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fail-item-mod{font-size:11px;color:var(--text-muted);margin-left:auto;flex-shrink:0}

/* ═══════════════════════════════════════════════════════════════
   FILTER BAR
═══════════════════════════════════════════════════════════════ */
.filter-bar{
  background:var(--surface);border-radius:var(--radius-lg);padding:12px 16px;
  margin-bottom:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  box-shadow:var(--shadow-sm);border:1px solid var(--border);
}
.filter-tabs{display:flex;gap:4px;flex-wrap:wrap}
.ftab{
  padding:6px 14px;border-radius:20px;border:1.5px solid var(--border);
  background:transparent;color:var(--text-muted);font-size:12px;font-weight:600;
  transition:var(--transition);
}
.ftab:hover{border-color:var(--accent);color:var(--accent)}
.ftab.active{background:var(--accent);border-color:var(--accent);color:#fff}
.ftab.pass-tab.active{background:var(--pass);border-color:var(--pass)}
.ftab.fail-tab.active{background:var(--fail);border-color:var(--fail)}
.ftab.skip-tab.active{background:var(--skip);border-color:var(--skip)}
.filter-sep{width:1px;height:24px;background:var(--border);margin:0 4px}
.search-input{
  flex:1;min-width:200px;padding:7px 14px;border-radius:20px;
  border:1.5px solid var(--border);background:var(--surface2);color:var(--text);
  font-size:12px;outline:none;transition:border-color var(--transition);
}
.search-input:focus{border-color:var(--accent)}
.sort-select{
  padding:6px 10px;border-radius:var(--radius);border:1.5px solid var(--border);
  background:var(--surface2);color:var(--text);font-size:12px;outline:none;
}
.results-count{font-size:12px;color:var(--text-muted);margin-left:auto;white-space:nowrap}

/* ═══════════════════════════════════════════════════════════════
   RESULTS TABLE
═══════════════════════════════════════════════════════════════ */
.table-wrap{background:var(--surface);border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow);border:1px solid var(--border)}
table{width:100%;border-collapse:collapse}
thead th{
  background:var(--surface2);padding:10px 14px;text-align:left;
  font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
  color:var(--text-muted);border-bottom:2px solid var(--border);white-space:nowrap;
  cursor:pointer;user-select:none;transition:background var(--transition);
}
thead th:hover{background:var(--border)}
thead th .sort-icon{margin-left:4px;opacity:.4}
thead th.sorted .sort-icon{opacity:1;color:var(--accent)}
.t-idx    {width:44px;text-align:center}
.t-status {width:46px;text-align:center}
.t-id     {width:110px}
.t-module {width:140px}
.t-dur    {width:76px;text-align:right}
.t-retry  {width:54px;text-align:center}
.t-expand {width:36px;text-align:center}

tbody tr.t-row{transition:background var(--transition);cursor:pointer}
tbody tr.t-row td{padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:middle;font-size:13px}
tbody tr.t-row:last-child td{border-bottom:none}
tbody tr.t-row.pass:hover td{background:#F0FDF4}
tbody tr.t-row.fail:hover td{background:#FEF2F2}
tbody tr.t-row.skip:hover td{background:#FFFBEB}
[data-theme="dark"] tbody tr.t-row.pass:hover td{background:#064E3B55}
[data-theme="dark"] tbody tr.t-row.fail:hover td{background:#7F1D1D55}
[data-theme="dark"] tbody tr.t-row.skip:hover td{background:#78350F55}

.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.status-dot.pass{background:var(--pass)}
.status-dot.fail{background:var(--fail)}
.status-dot.skip{background:var(--skip)}

.id-pill{display:inline-block;font-size:11px;font-weight:700;font-family:monospace;background:var(--accent-bg);color:var(--accent-text);padding:2px 7px;border-radius:var(--radius-sm)}
.mod-pill{display:inline-block;font-size:11px;font-weight:600;background:var(--surface2);color:var(--text-muted);padding:2px 8px;border-radius:var(--radius-sm);border:1px solid var(--border);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.retry-dot{display:inline-block;background:var(--skip-bg);color:var(--skip-text);font-size:10px;font-weight:700;padding:1px 6px;border-radius:var(--radius-sm)}
.expand-icon{color:var(--text-faint);font-size:12px;transition:transform var(--transition)}
.t-row.open .expand-icon{transform:rotate(180deg)}

/* Detail row */
tr.detail-row td{padding:0;background:var(--surface2);border-bottom:2px solid var(--border)}
.detail-panel{padding:16px 20px}
.detail-grid{display:grid;grid-template-columns:1fr 360px;gap:20px}
@media(max-width:900px){.detail-grid{grid-template-columns:1fr}}
.detail-left{}
.detail-right{}

.error-card{
  background:var(--fail-bg);border-radius:var(--radius);padding:12px 16px;
  border-left:3px solid var(--fail);margin-bottom:12px;
}
.error-card .err-msg{color:var(--fail-text);font-size:13px;font-weight:600;line-height:1.5;word-break:break-all}
details.stack{margin-top:10px}
details.stack summary{font-size:12px;font-weight:600;color:var(--fail);cursor:pointer;padding:4px 0}
details.stack pre{
  background:#1E1B4B;color:#C7D2FE;font-size:11px;padding:12px;border-radius:var(--radius);
  overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin-top:8px;line-height:1.6;
}
[data-theme="dark"] details.stack pre{background:#0B1120}

.att-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.att-link{
  display:inline-flex;align-items:center;gap:5px;padding:5px 12px;
  border-radius:20px;font-size:12px;font-weight:600;
  background:var(--accent-bg);color:var(--accent);border:1px solid currentColor;
  transition:var(--transition);
}
.att-link:hover{background:var(--accent);color:#fff;text-decoration:none}

.screenshot-box{border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);cursor:zoom-in}
.screenshot-box img{width:100%;display:block;transition:transform var(--transition)}
.screenshot-box:hover img{transform:scale(1.02)}
.screenshot-label{background:var(--surface2);padding:6px 10px;font-size:11px;color:var(--text-muted);text-align:center}
.no-screenshot{
  height:140px;display:flex;align-items:center;justify-content:center;
  background:var(--surface2);border-radius:var(--radius);border:2px dashed var(--border);
  color:var(--text-faint);font-size:13px;
}

/* Pagination */
.pagination{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface2);border-top:1px solid var(--border);border-radius:0 0 var(--radius-lg) var(--radius-lg)}
.page-info{font-size:12px;color:var(--text-muted)}
.page-btns{display:flex;gap:6px}
.page-btn{
  padding:5px 14px;border-radius:var(--radius);border:1px solid var(--border);
  background:var(--surface);color:var(--text);font-size:12px;font-weight:600;
  transition:var(--transition);
}
.page-btn:hover:not(:disabled){background:var(--accent);border-color:var(--accent);color:#fff}
.page-btn:disabled{opacity:.4;cursor:not-allowed}
.page-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}

/* ═══════════════════════════════════════════════════════════════
   MODULE CARDS
═══════════════════════════════════════════════════════════════ */
.mod-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.mod-card{
  background:var(--surface);border-radius:var(--radius-lg);padding:18px 20px;
  box-shadow:var(--shadow);border:1px solid var(--border);cursor:pointer;
  transition:transform var(--transition),box-shadow var(--transition);
}
.mod-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.mod-card-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px}
.mod-name{font-size:14px;font-weight:700;color:var(--text);line-height:1.3}
.mod-total{font-size:11px;color:var(--text-muted);margin-top:2px}
.mod-status-icons{display:flex;gap:6px}
.mod-stat{text-align:center;min-width:36px}
.mod-stat-val{font-size:18px;font-weight:800;line-height:1}
.mod-stat-val.p{color:var(--pass)}
.mod-stat-val.f{color:var(--fail)}
.mod-stat-val.s{color:var(--skip)}
.mod-stat-lab{font-size:9px;font-weight:600;text-transform:uppercase;color:var(--text-faint)}
.mod-bar-bg{height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:12px}
.mod-bar-fill{height:100%;border-radius:3px;transition:width 0.6s ease}
.mod-pass-rate{font-size:11px;font-weight:700;color:var(--text-muted);margin-top:5px;text-align:right}
.mod-drill{
  margin-top:12px;padding:6px 0 0;border-top:1px solid var(--border);
  font-size:11px;font-weight:600;color:var(--accent);
}

/* ═══════════════════════════════════════════════════════════════
   JIRA BUG CARDS
═══════════════════════════════════════════════════════════════ */
.bugs-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.export-btn{
  padding:8px 18px;border-radius:var(--radius);
  background:var(--accent);border:none;color:#fff;font-size:13px;font-weight:600;
  transition:var(--transition);display:flex;align-items:center;gap:6px;
}
.export-btn:hover{opacity:.9}
.bugs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(480px,1fr));gap:20px}
.bug-card{
  background:var(--surface);border-radius:var(--radius-lg);overflow:hidden;
  box-shadow:var(--shadow);border:1px solid var(--border);
  transition:box-shadow var(--transition);
}
.bug-card:hover{box-shadow:var(--shadow-lg)}
.bug-card-top{
  background:var(--surface2);padding:12px 16px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;gap:10px;
}
.bug-key{font-size:12px;font-weight:800;color:var(--accent);font-family:monospace}
.bug-badges{display:flex;gap:6px}
.priority-pill{font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;text-transform:uppercase}
.p-critical{background:#FEE2E2;color:#991B1B}
.p-high    {background:#FEE2E2;color:#991B1B}
.p-medium  {background:#FEF3C7;color:#92400E}
.p-low     {background:#D1FAE5;color:#065F46}
.type-pill {background:var(--accent-bg);color:var(--accent);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px}
.bug-summary{padding:12px 16px 8px;font-size:15px;font-weight:700;color:var(--text);line-height:1.4}
.bug-meta{padding:0 16px 12px;display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border)}
.bug-body{display:grid;grid-template-columns:1fr 280px;gap:0}
@media(max-width:800px){.bug-body{grid-template-columns:1fr}}
.bug-left{padding:14px 16px;border-right:1px solid var(--border)}
.bug-right{padding:14px 16px;background:var(--surface2)}
.bug-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:var(--text-faint);margin-bottom:6px;margin-top:12px}
.bug-section-label:first-child{margin-top:0}
.bug-steps ol{padding-left:18px;font-size:13px;line-height:2}
.bug-steps code{background:var(--surface2);padding:1px 5px;border-radius:var(--radius-sm);font-size:11px}
.result-block{font-size:13px;padding:8px 12px;border-radius:var(--radius);line-height:1.6}
.result-block.exp{background:var(--pass-bg);color:var(--pass-text);border-left:3px solid var(--pass)}
.result-block.act{background:var(--fail-bg);color:var(--fail-text);border-left:3px solid var(--fail)}
.bug-stack{margin-top:10px}
.bug-stack summary{font-size:11px;font-weight:600;color:var(--fail);cursor:pointer}
.bug-stack pre{font-size:10px;background:#1E1B4B;color:#C7D2FE;padding:10px;border-radius:var(--radius);white-space:pre-wrap;word-break:break-all;margin-top:6px;line-height:1.6}
.bug-screenshot{width:100%;border-radius:var(--radius);border:1px solid var(--border);cursor:zoom-in;display:block}
.bug-screenshot:hover{opacity:.9}
.bug-footer{
  padding:10px 16px;background:var(--surface2);border-top:1px solid var(--border);
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;
}
.jira-btn{
  padding:5px 12px;border-radius:var(--radius);border:1px solid var(--border);
  background:var(--surface);color:var(--text);font-size:11px;font-weight:600;
  transition:var(--transition);
}
.jira-btn:hover{background:var(--accent-bg);border-color:var(--accent);color:var(--accent)}
.bug-footer-meta{margin-left:auto;font-size:10px;color:var(--text-faint)}

/* ═══════════════════════════════════════════════════════════════
   SCREENSHOTS GALLERY
═══════════════════════════════════════════════════════════════ */
.gallery-grid{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;
  align-items:start;
}
.gallery-item{
  background:var(--surface);border-radius:var(--radius-lg);overflow:hidden;
  box-shadow:var(--shadow);border:1px solid var(--border);cursor:pointer;
  transition:transform var(--transition),box-shadow var(--transition);
}
.gallery-item:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg)}
.gallery-item img{width:100%;display:block}
.gallery-caption{padding:8px 12px}
.gallery-caption .gc-id{font-size:11px;font-weight:700;color:var(--fail);font-family:monospace}
.gallery-caption .gc-title{font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
.gallery-caption .gc-mod{font-size:10px;color:var(--text-muted);margin-top:1px}
.no-screenshots{
  text-align:center;padding:60px 20px;color:var(--text-muted);
}
.no-screenshots .ns-icon{font-size:48px;margin-bottom:12px}

/* ═══════════════════════════════════════════════════════════════
   LIGHTBOX
═══════════════════════════════════════════════════════════════ */
.lightbox{
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;
  align-items:center;justify-content:center;flex-direction:column;gap:12px;
}
.lightbox.open{display:flex;animation:fadeIn 150ms ease}
.lightbox img{max-width:90vw;max-height:85vh;border-radius:var(--radius);box-shadow:0 0 0 2px rgba(255,255,255,.1)}
.lightbox-label{font-size:13px;color:rgba(255,255,255,.7);max-width:80vw;text-align:center}
.lightbox-close{
  position:absolute;top:16px;right:20px;font-size:24px;color:#fff;cursor:pointer;
  width:36px;height:36px;display:flex;align-items:center;justify-content:center;
  border-radius:50%;background:rgba(255,255,255,.1);transition:var(--transition);
}
.lightbox-close:hover{background:rgba(255,255,255,.25)}

/* ═══════════════════════════════════════════════════════════════
   BADGES & PILLS
═══════════════════════════════════════════════════════════════ */
.status-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:10px;font-size:11px;font-weight:700}
.status-badge.pass{background:var(--pass-bg);color:var(--pass-text)}
.status-badge.fail{background:var(--fail-bg);color:var(--fail-text)}
.status-badge.skip{background:var(--skip-bg);color:var(--skip-text)}

/* ═══════════════════════════════════════════════════════════════
   DIVIDER & UTILS
═══════════════════════════════════════════════════════════════ */
.divider{height:1px;background:var(--border);margin:16px 0}
.row-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
@media(max-width:900px){.row-2,.row-3{grid-template-columns:1fr}}
.mt-4{margin-top:4px}.mt-8{margin-top:8px}.mt-12{margin-top:12px}.mt-16{margin-top:16px}
.flex{display:flex}.items-center{align-items:center}.gap-8{gap:8px}.gap-12{gap:12px}

/* Print */
@media print{
  .sidebar,.top-bar,.filter-bar,.pagination{display:none!important}
  .view{display:block!important}
  body{display:block}
  .main{overflow:visible;height:auto}
  .content-area{overflow:visible}
}
</style>
</head>
<body>

<script>
// ── Embed all test data ────────────────────────────────────────────────────
const __RAW = ${dataJson};
const RECORDS     = __RAW.records;
const SCREENSHOTS = __RAW.screenshots;
const MOD_MAP     = __RAW.modMap;
const STATS       = __RAW.stats;
const META        = __RAW.meta;

// Restore screenshots into records
RECORDS.forEach(r => { if (r.screenshot === '__HAS_IMG__') r.screenshot = SCREENSHOTS[r.idx] || null; });

// ── App state ─────────────────────────────────────────────────────────────
const S = {
  view: 'dashboard',
  filter: 'all',
  search: '',
  sortCol: 'idx',
  sortDir: 'asc',
  page: 0,
  pageSize: 50,
  modFilter: '',
  chartsReady: false,
  openRows: new Set(),
};

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtMs(ms) {
  if (ms < 1000)  return ms + 'ms';
  if (ms < 60000) return (ms/1000).toFixed(1) + 's';
  const m = Math.floor(ms/60000), s = Math.round((ms%60000)/1000);
  return m + 'm ' + s + 's';
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function statusClass(s) {
  return s==='passed'?'pass':(s==='failed'||s==='timedOut')?'fail':'skip';
}
function statusIcon(s) {
  return s==='passed'?'✅':s==='skipped'?'⏭️':'❌';
}

// ── Navigation ────────────────────────────────────────────────────────────
function navigate(viewId, modFilter) {
  S.view = viewId;
  if (modFilter !== undefined) { S.modFilter = modFilter; S.filter = 'all'; S.search = ''; }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + viewId));
  document.getElementById('top-bar-title').textContent = {
    dashboard:'Dashboard', results:'Test Results',
    modules:'Modules', bugs:'Bug Report', screenshots:'Screenshots',
  }[viewId] || viewId;

  if (viewId === 'dashboard' && !S.chartsReady) initCharts();
  if (viewId === 'results')     renderResults();
  if (viewId === 'modules')     renderModules();
  if (viewId === 'bugs')        renderBugs();
  if (viewId === 'screenshots') renderScreenshots();
}

// ── Filter helpers ────────────────────────────────────────────────────────
function filteredRecords() {
  let r = RECORDS;
  if (S.modFilter)                r = r.filter(x => x.module === S.modFilter);
  if (S.filter !== 'all')         r = r.filter(x => statusClass(x.status) === S.filter);
  if (S.search) {
    const q = S.search.toLowerCase();
    r = r.filter(x => x.title.toLowerCase().includes(q) ||
                       x.module.toLowerCase().includes(q) ||
                       x.testId.toLowerCase().includes(q) ||
                       x.suite.toLowerCase().includes(q));
  }
  // Sort
  r = [...r].sort((a,b) => {
    let va = a[S.sortCol], vb = b[S.sortCol];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return S.sortDir==='asc' ? -1 : 1;
    if (va > vb) return S.sortDir==='asc' ?  1 : -1;
    return 0;
  });
  return r;
}

// ── Render: Results table ─────────────────────────────────────────────────
function renderResults() {
  const all   = filteredRecords();
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / S.pageSize));
  if (S.page >= pages) S.page = 0;
  const slice = all.slice(S.page * S.pageSize, (S.page + 1) * S.pageSize);

  // Update filter tab counts
  const baseR = S.modFilter ? RECORDS.filter(x => x.module === S.modFilter) : RECORDS;
  document.getElementById('ftab-all').textContent  = 'All ('  + baseR.length + ')';
  document.getElementById('ftab-pass').textContent = '✅ '    + baseR.filter(x=>statusClass(x.status)==='pass').length;
  document.getElementById('ftab-fail').textContent = '❌ '    + baseR.filter(x=>statusClass(x.status)==='fail').length;
  document.getElementById('ftab-skip').textContent = '⏭️ '   + baseR.filter(x=>statusClass(x.status)==='skip').length;

  // Update active filter tab
  document.querySelectorAll('.ftab').forEach(t => t.classList.toggle('active', t.dataset.filter === S.filter));

  document.getElementById('results-count').textContent =
    'Showing ' + (S.page * S.pageSize + 1) + '–' + Math.min((S.page + 1) * S.pageSize, total) + ' of ' + total;

  const tbody = document.getElementById('results-tbody');
  tbody.innerHTML = slice.map(r => {
    const sc = statusClass(r.status);
    const hasOpen = S.openRows.has(r.idx);
    const hasErr  = !!r.error;
    const hasImg  = !!r.screenshot;
    const hasVid  = !!r.videoPath;
    const hasTrc  = !!r.tracePath;

    const detailHTML = hasOpen ? buildDetailHTML(r) : '';

    return '<tr class="t-row ' + sc + (hasOpen?' open':'') + '" onclick="toggleRow(' + r.idx + ')">' +
      '<td class="t-idx" style="color:var(--text-faint)">' + r.idx + '</td>' +
      '<td class="t-status"><span class="status-dot ' + sc + '"></span></td>' +
      '<td class="t-id">' + (r.testId ? '<span class="id-pill">' + esc(r.testId) + '</span>' : '<span style="color:var(--text-faint);font-size:11px">—</span>') + '</td>' +
      '<td><span title="' + esc(r.title) + '" style="display:block;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.title) + '</span></td>' +
      '<td class="t-module"><span class="mod-pill" title="' + esc(r.module) + '">' + esc(r.module) + '</span></td>' +
      '<td class="t-dur" style="font-variant-numeric:tabular-nums;color:var(--text-muted)">' + fmtMs(r.duration) + '</td>' +
      '<td class="t-retry">' + (r.retry > 0 ? '<span class="retry-dot">×' + r.retry + '</span>' : '') + '</td>' +
      '<td class="t-expand"><span class="expand-icon">▾</span></td>' +
    '</tr>' +
    (hasOpen ? '<tr class="detail-row"><td colspan="8"><div class="detail-panel">' + detailHTML + '</div></td></tr>' : '');
  }).join('');

  // Pagination
  renderPagination(pages, total);
}

function buildDetailHTML(r) {
  const sc = statusClass(r.status);

  let leftHTML = '';
  if (r.error) {
    leftHTML += '<div class="error-card">' +
      '<div class="err-msg">' + r.error + '</div>' +
      (r.errorStack ? '<details class="stack"><summary>Stack Trace</summary><pre>' + r.errorStack + '</pre></details>' : '') +
    '</div>';
  } else {
    leftHTML += '<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">No error message recorded.</div>';
  }

  leftHTML += '<div style="font-size:11px;color:var(--text-faint);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Attachments</div>';
  leftHTML += '<div class="att-row">';
  if (r.videoPath) leftHTML += '<a class="att-link" href="' + esc(r.videoPath) + '" target="_blank">🎬 Video</a>';
  if (r.tracePath) leftHTML += '<a class="att-link" href="' + esc(r.tracePath) + '" target="_blank">🔍 Trace</a>';
  if (!r.videoPath && !r.tracePath) leftHTML += '<span style="font-size:12px;color:var(--text-faint)">No attachments</span>';
  leftHTML += '</div>';

  leftHTML += '<div style="font-size:11px;color:var(--text-faint);margin:12px 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Metadata</div>';
  leftHTML += '<table style="font-size:12px;color:var(--text-muted);width:100%;border-collapse:collapse">' +
    '<tr><td style="padding:2px 0;color:var(--text-faint);width:80px">Suite</td><td>' + esc(r.suite) + '</td></tr>' +
    '<tr><td style="padding:2px 0;color:var(--text-faint)">File</td><td>' + esc(r.file) + '</td></tr>' +
    '<tr><td style="padding:2px 0;color:var(--text-faint)">Start</td><td>' + new Date(r.startTime).toLocaleTimeString('en-IN') + '</td></tr>' +
    '<tr><td style="padding:2px 0;color:var(--text-faint)">Status</td><td><span class="status-badge ' + sc + '">' + r.status + '</span></td></tr>' +
  '</table>';

  const rightHTML = r.screenshot
    ? '<div class="screenshot-box" onclick="event.stopPropagation();openLightbox(' + r.idx + ')">' +
      '<img src="' + r.screenshot + '" alt="screenshot" loading="lazy" />' +
      '<div class="screenshot-label">📸 Click to enlarge</div></div>'
    : '<div class="no-screenshot">📷 No screenshot</div>';

  return '<div class="detail-grid"><div class="detail-left">' + leftHTML + '</div><div class="detail-right">' + rightHTML + '</div></div>';
}

function toggleRow(idx) {
  if (S.openRows.has(idx)) S.openRows.delete(idx); else S.openRows.add(idx);
  renderResults();
}

function renderPagination(pages, total) {
  const el = document.getElementById('results-pagination');
  if (pages <= 1) { el.style.display='none'; return; }
  el.style.display = 'flex';
  const nums = [];
  for (let i = 0; i < pages; i++) {
    if (i === 0 || i === pages-1 || Math.abs(i - S.page) <= 1) {
      nums.push('<button class="page-btn' + (i===S.page?' active':'') + '" onclick="gotoPage(' + i + ')">' + (i+1) + '</button>');
    } else if (nums[nums.length-1] !== '…') nums.push('…');
  }
  el.innerHTML =
    '<span class="page-info">Page ' + (S.page+1) + ' of ' + pages + ' &nbsp;(' + total + ' tests)</span>' +
    '<div class="page-btns">' +
    '<button class="page-btn" ' + (S.page===0?'disabled':'') + ' onclick="gotoPage(' + (S.page-1) + ')">‹ Prev</button>' +
    nums.join('') +
    '<button class="page-btn" ' + (S.page>=pages-1?'disabled':'') + ' onclick="gotoPage(' + (S.page+1) + ')">Next ›</button>' +
    '</div>';
}

function gotoPage(p) { S.page = p; S.openRows.clear(); renderResults(); }
function setFilter(f) { S.filter = f; S.page = 0; S.openRows.clear(); renderResults(); }
function setSearch(q) { S.search = q; S.page = 0; S.openRows.clear(); renderResults(); }
function setSort(col) {
  if (S.sortCol === col) S.sortDir = S.sortDir==='asc'?'desc':'asc';
  else { S.sortCol = col; S.sortDir = 'asc'; }
  S.page = 0; S.openRows.clear();
  renderResults();
  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    const active = th.dataset.sort === col;
    th.classList.toggle('sorted', active);
    th.querySelector('.sort-icon').textContent = !active ? '↕' : (S.sortDir==='asc'?'↑':'↓');
  });
}

// ── Render: Modules ───────────────────────────────────────────────────────
function renderModules() {
  const html = Object.entries(MOD_MAP).map(([mod, v]) => {
    const tot  = v.p + v.f + v.s;
    const pct  = tot > 0 ? Math.round(v.p/tot*100) : 0;
    const color = pct >= 90 ? 'var(--pass)' : pct >= 60 ? 'var(--skip)' : 'var(--fail)';
    return '<div class="mod-card" onclick="drillModule(&quot;' + esc(mod) + '&quot;)">' +
      '<div class="mod-card-header">' +
        '<div><div class="mod-name">' + esc(mod) + '</div><div class="mod-total">' + tot + ' tests</div></div>' +
        '<div class="mod-status-icons">' +
          '<div class="mod-stat"><div class="mod-stat-val p">' + v.p + '</div><div class="mod-stat-lab">pass</div></div>' +
          '<div class="mod-stat"><div class="mod-stat-val f">' + v.f + '</div><div class="mod-stat-lab">fail</div></div>' +
          '<div class="mod-stat"><div class="mod-stat-val s">' + v.s + '</div><div class="mod-stat-lab">skip</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="mod-bar-bg"><div class="mod-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<div class="mod-pass-rate">' + pct + '% pass rate</div>' +
      '<div class="mod-drill">→ View tests in this module</div>' +
    '</div>';
  }).join('');
  document.getElementById('modules-grid').innerHTML = html || '<p style="color:var(--text-muted)">No module data.</p>';
}

function drillModule(mod) { S.modFilter = mod; navigate('results'); }

// ── Render: Bugs ──────────────────────────────────────────────────────────
function renderBugs() {
  const failures = RECORDS.filter(r => statusClass(r.status) === 'fail');
  const productBugsInView = failures.filter(r => r.failureClass === 'Product Bug').length;
  document.getElementById('bugs-count').textContent =
    failures.length + ' failure' + (failures.length!==1?'s':'') + ' — ' +
    productBugsInView + ' product bug' + (productBugsInView!==1?'s':'') + ', ' +
    (failures.length - productBugsInView) + ' infra issues';
  if (!failures.length) {
    document.getElementById('bugs-grid').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:12px">🎉</div><div style="font-size:16px;font-weight:700">No failures! All tests passed.</div></div>';
    return;
  }
  const html = failures.map((r, i) => {
    const priority = (r.annotations.find(a=>a.type==='priority')?.description ?? 'High');
    const pClass   = 'p-' + priority.toLowerCase();
    const jKey     = 'SYNCTAG-BUG-' + String(i+1).padStart(3,'0');

    const imgHTML = r.screenshot
      ? '<img class="bug-screenshot" src="' + r.screenshot + '" alt="screenshot" loading="lazy" onclick="event.stopPropagation();openLightbox(' + r.idx + ')" />'
      : '<div style="height:120px;display:flex;align-items:center;justify-content:center;background:var(--surface);border-radius:var(--radius);border:2px dashed var(--border);color:var(--text-faint);font-size:13px">📷 No screenshot</div>';

    return '<div class="bug-card">' +
      '<div class="bug-card-top">' +
        '<span class="bug-key">' + jKey + '</span>' +
        '<div class="bug-badges">' +
          '<span class="priority-pill ' + pClass + '">' + esc(priority) + '</span>' +
          '<span class="type-pill" style="background:' + (r.failureClass==='Product Bug'?'var(--fail-bg)':'var(--accent-bg)') + ';color:' + (r.failureClass==='Product Bug'?'var(--fail-text)':'var(--accent-text)') + '">' + esc(r.failureClass || 'Bug') + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="bug-summary">' + esc(r.title) + '</div>' +
      '<div class="bug-meta">' +
        '<span>📦 ' + esc(r.module) + '</span>' +
        '<span>⏱ ' + fmtMs(r.duration) + '</span>' +
        '<span>🔄 Retry: ' + r.retry + '</span>' +
        '<span>📅 ' + new Date(r.startTime).toLocaleString('en-IN') + '</span>' +
      '</div>' +
      '<div class="bug-body">' +
        '<div class="bug-left">' +
          '<div class="bug-section-label">Steps to Reproduce</div>' +
          '<div class="bug-steps"><ol>' +
            '<li>Navigate to <code>' + esc(META.env) + '</code></li>' +
            '<li>Run: <strong>' + esc(r.title) + '</strong></li>' +
            '<li>Observe the failure</li>' +
          '</ol></div>' +
          '<div class="bug-section-label">Expected Result</div>' +
          '<div class="result-block exp">Test should pass without errors.</div>' +
          '<div class="bug-section-label">Actual Result</div>' +
          '<div class="result-block act">' + (r.error || 'Test failed or timed out.') + '</div>' +
          (r.errorStack ? '<details class="bug-stack"><summary>Stack Trace</summary><pre>' + r.errorStack + '</pre></details>' : '') +
          (r.videoPath ? '<div style="margin-top:10px"><a class="att-link" href="' + esc(r.videoPath) + '" target="_blank">🎬 Video</a></div>' : '') +
        '</div>' +
        '<div class="bug-right">' +
          '<div class="bug-section-label">Screenshot Evidence</div>' +
          imgHTML +
        '</div>' +
      '</div>' +
      '<div class="bug-footer">' +
        '<button class="jira-btn" onclick="copyText(&quot;' + jKey + '&quot;)">📋 Copy Key</button>' +
        '<button class="jira-btn" onclick="exportBug(' + i + ')">⬇️ JSON</button>' +
        '<span class="bug-footer-meta">Env: ' + esc(META.env) + ' · Browser: Chromium/Firefox/WebKit</span>' +
      '</div>' +
    '</div>';
  }).join('');
  document.getElementById('bugs-grid').innerHTML = html;
}

// ── Render: Screenshots gallery ───────────────────────────────────────────
function renderScreenshots() {
  const withImg = RECORDS.filter(r => r.screenshot);
  if (!withImg.length) {
    document.getElementById('gallery-grid').innerHTML =
      '<div class="no-screenshots"><div class="ns-icon">📷</div>' +
      '<div style="font-size:15px;font-weight:700">No screenshots captured</div>' +
      '<div style="margin-top:6px;font-size:13px">Screenshots are captured automatically for failing tests.</div></div>';
    return;
  }
  document.getElementById('gallery-grid').innerHTML = withImg.map(r =>
    '<div class="gallery-item" onclick="openLightbox(' + r.idx + ')">' +
    '<img src="' + r.screenshot + '" alt="screenshot" loading="lazy" />' +
    '<div class="gallery-caption">' +
      '<div class="gc-id">' + (r.testId || '—') + '</div>' +
      '<div class="gc-title" title="' + esc(r.title) + '">' + esc(r.title) + '</div>' +
      '<div class="gc-mod">' + esc(r.module) + '</div>' +
    '</div></div>'
  ).join('');
}

// ── Charts ────────────────────────────────────────────────────────────────
function initCharts() {
  if (S.chartsReady || typeof Chart === 'undefined') return;
  S.chartsReady = true;

  const isDark = document.documentElement.dataset.theme === 'dark';
  const gridColor  = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const labelColor = isDark ? '#9CA3AF' : '#64748B';
  Chart.defaults.color = labelColor;

  // 1 ── Doughnut
  new Chart(document.getElementById('chart-donut'), {
    type: 'doughnut',
    data: {
      labels: ['Passed','Failed','Skipped'],
      datasets:[{
        data:[STATS.passed,STATS.failed,STATS.skipped],
        backgroundColor:['#10B981','#EF4444','#F59E0B'],
        borderWidth:0, hoverOffset:6,
      }],
    },
    options:{
      cutout:'68%', responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{ position:'bottom', labels:{ boxWidth:10, padding:14 }},
        tooltip:{ callbacks:{ label: c => c.label + ': ' + c.parsed + ' (' + (c.parsed/STATS.total*100).toFixed(1)+'%)' }},
      },
    },
    plugins:[{
      id:'centerText',
      beforeDraw(chart) {
        const { ctx, width, height } = chart;
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const cx = width/2, cy = height/2 - 16;
        ctx.font = 'bold 32px system-ui'; ctx.fillStyle = '#10B981';
        ctx.fillText(STATS.rate+'%', cx, cy);
        ctx.font = '12px system-ui'; ctx.fillStyle = labelColor;
        ctx.fillText('Pass Rate', cx, cy+28);
        ctx.restore();
      }
    }],
  });

  // 2 ── Horizontal bar (modules)
  const mods = Object.keys(MOD_MAP);
  new Chart(document.getElementById('chart-bar'), {
    type: 'bar',
    data: {
      labels: mods,
      datasets:[
        { label:'Passed',  data:mods.map(m=>MOD_MAP[m].p), backgroundColor:'#10B981', borderRadius:3 },
        { label:'Failed',  data:mods.map(m=>MOD_MAP[m].f), backgroundColor:'#EF4444', borderRadius:3 },
        { label:'Skipped', data:mods.map(m=>MOD_MAP[m].s), backgroundColor:'#F59E0B', borderRadius:3 },
      ],
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'top', labels:{ boxWidth:10, padding:12 }}},
      scales:{
        x:{ stacked:true, beginAtZero:true, grid:{color:gridColor}, ticks:{ stepSize:1 }},
        y:{ stacked:true, grid:{display:false}, ticks:{ font:{ size:11 }}},
      },
    },
  });

  // 3 ── Timeline histogram
  const timeLabels = ${JSON.stringify(timeLabels)};
  const timeData   = ${JSON.stringify(timeData)};
  new Chart(document.getElementById('chart-timeline'), {
    type: 'bar',
    data: {
      labels: timeLabels,
      datasets:[{
        label:'Tests/bucket',
        data: timeData,
        backgroundColor:'rgba(99,102,241,.7)',
        borderRadius:3,
      }],
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }},
      scales:{
        x:{ grid:{color:gridColor}, ticks:{ font:{size:10} }},
        y:{ beginAtZero:true, grid:{color:gridColor}, ticks:{ stepSize:1, font:{size:10} }},
      },
    },
  });
}

// ── Lightbox ──────────────────────────────────────────────────────────────
function openLightbox(idx) {
  const r = RECORDS.find(x => x.idx == idx);
  if (!r || !r.screenshot) return;
  document.getElementById('lb-img').src   = r.screenshot;
  document.getElementById('lb-label').textContent = (r.testId ? r.testId + ' · ' : '') + r.title;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key==='Escape') closeLightbox(); });

// ── Export ────────────────────────────────────────────────────────────────
function exportCSV() {
  const cols = ['idx','testId','title','module','suite','status','duration','retry','startTime'];
  const rows = [cols.join(',')].concat(RECORDS.map(r =>
    cols.map(c => '"' + String(r[c]||'').replace(/"/g,'""') + '"').join(',')
  ));
  const blob = new Blob([rows.join('\\n')], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'synctag-results.csv'; a.click();
}

function exportBug(i) {
  const failures = RECORDS.filter(r => statusClass(r.status)==='fail');
  const bug = failures[i];
  if (!bug) return;
  const data = {...bug, screenshot: bug.screenshot ? '[base64 embedded]' : null};
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'SYNCTAG-BUG-' + String(i+1).padStart(3,'0') + '.json'; a.click();
}

function exportAllBugs() {
  const bugs = RECORDS.filter(r => statusClass(r.status)==='fail')
    .map((r,i) => ({...r, jiraKey:'SYNCTAG-BUG-'+String(i+1).padStart(3,'0'), screenshot:r.screenshot?'[embedded]':null}));
  const blob = new Blob([JSON.stringify(bugs,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'synctag-jira-bugs.json'; a.click();
}

function copyText(t) { navigator.clipboard?.writeText(t).then(()=>alert('Copied: '+t)); }

// ── Dark mode ─────────────────────────────────────────────────────────────
function toggleDark() {
  const el = document.documentElement;
  const next = el.dataset.theme === 'dark' ? 'light' : 'dark';
  el.dataset.theme = next;
  document.getElementById('dark-btn').textContent = next==='dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', next);
}
const savedTheme = localStorage.getItem('theme');
if (savedTheme) { document.documentElement.dataset.theme = savedTheme; }
</script>

<!-- ══════════════════════════════════════════════════════════════
     LAYOUT
══════════════════════════════════════════════════════════════ -->
<aside class="sidebar">
  <!-- Logo -->
  <div class="sb-logo">
    <div class="sb-logo-icon">🧪</div>
    <div class="sb-logo-text">
      <strong>Synctag QA</strong>
      <span>E2E Test Report</span>
    </div>
  </div>

  <!-- Navigation -->
  <div class="sb-section-label">Navigation</div>
  <nav class="sb-nav">
    <button class="nav-item active" data-view="dashboard" onclick="navigate('dashboard')">
      <span class="nav-icon">📊</span> Dashboard
    </button>
    <button class="nav-item" data-view="results" onclick="navigate('results')">
      <span class="nav-icon">🧪</span> Test Results
      <span class="nav-badge ${failed > 0 ? '' : 'pass'}" id="sb-fail-badge">${failed > 0 ? failed : passed}</span>
    </button>
    <button class="nav-item" data-view="modules" onclick="navigate('modules')">
      <span class="nav-icon">📦</span> Modules
      <span style="margin-left:auto;font-size:11px;color:#4B5563">${Object.keys(modMap).length}</span>
    </button>
    <button class="nav-item" data-view="bugs" onclick="navigate('bugs')">
      <span class="nav-icon">🐛</span> Bug Report
      ${failed > 0 ? `<span class="nav-badge">${failed}</span>` : ''}
    </button>
    <button class="nav-item" data-view="screenshots" onclick="navigate('screenshots')">
      <span class="nav-icon">📸</span> Screenshots
      <span style="margin-left:auto;font-size:11px;color:#4B5563">${this.records.filter(r => r.screenshot).length}</span>
    </button>
  </nav>

  <!-- Run info -->
  <div class="sb-run-info">
    <div><strong>Environment</strong><br>${env}</div>
    <div style="margin-top:8px"><strong>Run Date</strong><br>${runDate}</div>
    <div style="margin-top:8px"><strong>Duration</strong><br>${this.ms(elapsed)}</div>
    <div style="margin-top:8px">
      <span class="overall-pill ${isPass ? 'pass' : 'fail'}">${isPass ? '✓ PASSED' : '✗ FAILED'}</span>
    </div>
  </div>
</aside>

<!-- Main -->
<div class="main">
  <!-- Top bar -->
  <header class="top-bar">
    <span class="top-bar-title" id="top-bar-title">Dashboard
      <span>${runDate}</span>
    </span>
    <button class="icon-btn" title="Toggle dark mode" id="dark-btn" onclick="toggleDark()">🌙</button>
    <button class="icon-btn" title="Export CSV" onclick="exportCSV()">⬇️</button>
    <button class="icon-btn" title="Print / Save as PDF" onclick="window.print()">🖨</button>
  </header>

  <!-- Content -->
  <div class="content-area">

    <!-- ══ VIEW: DASHBOARD ══════════════════════════════════════════════════ -->
    <div id="view-dashboard" class="view active">
      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi total">
          <div class="kpi-icon">🎯</div>
          <div class="kpi-label">Total Tests</div>
          <div class="kpi-value">${total}</div>
        </div>
        <div class="kpi pass">
          <div class="kpi-icon">✅</div>
          <div class="kpi-label">Passed</div>
          <div class="kpi-value">${passed}</div>
        </div>
        <div class="kpi fail">
          <div class="kpi-icon">❌</div>
          <div class="kpi-label">Failed</div>
          <div class="kpi-value">${failed}</div>
        </div>
        <div class="kpi skip">
          <div class="kpi-icon">⏭️</div>
          <div class="kpi-label">Skipped</div>
          <div class="kpi-value">${skipped}</div>
        </div>
        <div class="kpi rate">
          <div class="kpi-icon">📈</div>
          <div class="kpi-label">Pass Rate</div>
          <div class="kpi-value">${rate}%</div>
        </div>
        <div class="kpi dur">
          <div class="kpi-icon">⏱</div>
          <div class="kpi-label">Total Duration</div>
          <div class="kpi-value">${this.ms(elapsed)}</div>
          <div class="kpi-sub">${Object.keys(modMap).length} modules · 6 browsers</div>
        </div>
        <div class="kpi fail" style="--kpi-color:#DE350B">
          <div class="kpi-icon">🐛</div>
          <div class="kpi-label">Product Bugs</div>
          <div class="kpi-value" style="color:#DE350B">${productBugs}</div>
          <div class="kpi-sub">Need JIRA tickets</div>
        </div>
        <div class="kpi skip" style="--kpi-color:#6366F1">
          <div class="kpi-icon">⚙️</div>
          <div class="kpi-label">Automation Issues</div>
          <div class="kpi-value" style="color:#6366F1;font-size:28px">${autoIssues}</div>
          <div class="kpi-sub">Test infra · no ticket needed</div>
        </div>
        <div class="kpi rate">
          <div class="kpi-icon">${releaseReady ? '✅' : '🚫'}</div>
          <div class="kpi-label">Release Status</div>
          <div class="kpi-value" style="font-size:14px;margin-top:10px;padding:6px 10px;border-radius:6px;background:${releaseReady ? '#D1FAE5' : '#FEE2E2'};color:${releaseReady ? '#065F46' : '#991B1B'}">${releaseReady ? 'READY' : 'NOT READY'}</div>
          <div class="kpi-sub">${productBugs === 0 ? 'No product bugs' : critHigh + ' critical/high bug' + (critHigh !== 1 ? 's' : '')}</div>
        </div>
      </div>

      <!-- Failure classification bar -->
      <div class="card" style="margin-bottom:20px">
        <div class="card-title">📊 Failure Classification Breakdown</div>
        <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-end">
          ${[
            ['🐛 Product Bug', productBugs, '#DE350B', '#FEE2E2'],
            ['⚙️ Automation', autoIssues, '#6366F1', '#EEF2FF'],
            ['🔑 Environment', envIssues, '#F59E0B', '#FEF3C7'],
            ['📧 External Dep', extIssues, '#10B981', '#D1FAE5'],
          ].map(([label, count, color, bg]) => `
            <div style="text-align:center;min-width:100px">
              <div style="font-size:28px;font-weight:900;color:${color}">${count}</div>
              <div style="font-size:12px;font-weight:600;color:#64748B;margin-top:2px">${label}</div>
              <div style="height:6px;border-radius:3px;margin-top:6px;background:${count > 0 ? color : '#E2E8F0'};opacity:${count > 0 ? 1 : 0.3}"></div>
            </div>`).join('')}
          <div style="margin-left:auto;padding:10px 16px;border-radius:8px;background:${releaseReady ? '#D1FAE5' : '#FEE2E2'};border:2px solid ${releaseReady ? '#10B981' : '#EF4444'}">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${releaseReady ? '#065F46' : '#991B1B'}">Release Status</div>
            <div style="font-size:20px;font-weight:900;color:${releaseReady ? '#065F46' : '#991B1B'};margin-top:2px">${releaseReady ? (productBugs === 0 ? '✓ READY' : '⚠ CONDITIONAL') : '✗ NOT READY'}</div>
            <div style="font-size:11px;color:${releaseReady ? '#065F46' : '#991B1B'};margin-top:2px">${productBugs === 0 ? 'No product bugs found' : productBugs + ' product bug' + (productBugs !== 1 ? 's' : '') + ' present'}</div>
          </div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="charts-grid">
        <div class="card">
          <div class="card-title">📊 Pass / Fail by Module</div>
          <div class="chart-wrap" style="height:280px">
            <canvas id="chart-bar"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-title">🥧 Distribution</div>
          <div class="chart-wrap" style="height:260px">
            <canvas id="chart-donut"></canvas>
          </div>
        </div>
        <div class="card">
          <div class="card-title">⏱ Execution Timeline</div>
          <div class="chart-wrap" style="height:260px">
            <canvas id="chart-timeline"></canvas>
          </div>
        </div>
      </div>

      <!-- Top Failure Reasons -->
      ${failed > 0 ? `<div class="card" style="margin-bottom:20px">
        <div class="card-title">🏆 Top Failure Reasons</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${(() => {
            const reasonMap = new Map<string, { count: number; cls: string }>();
            for (const r of R.filter(x => x.status === 'failed' || x.status === 'timedOut')) {
              const e = (r.error || '').toLowerCase();
              const t = r.title.toLowerCase();
              const reason =
                e.includes('tearing down') ? 'SPA WebSocket teardown (>120s cleanup)' :
                e.includes('waitforurl') ? 'waitForURL timeout on SPA navigation' :
                e.includes('locator.click') && e.includes('timeout') ? 'Element click timeout (selector mismatch)' :
                e.includes('tobevisible') && e.includes('timeout') ? 'Element not visible (auth/session)' :
                e.includes('tobetruthy') ? 'Assertion failed — feature not working' :
                e.includes('tohaveurl') ? 'URL mismatch after navigation' :
                r.failureClass === 'External Dependency Issue' ? 'Mailinator OTP delay/timeout' :
                e.includes('test timeout') ? 'Overall test timeout exceeded' :
                r.failureClass + ' — other';
              const prev = reasonMap.get(reason);
              if (prev) { prev.count++; } else { reasonMap.set(reason, { count: 1, cls: r.failureClass }); }
            }
            const sorted = [...reasonMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);
            const maxCount = sorted[0]?.[1]?.count || 1;
            const clsColor: Record<string, string> = {
              'Product Bug': '#EF4444', 'Automation Issue': '#6366F1',
              'Environment Issue': '#F59E0B', 'External Dependency Issue': '#10B981',
              'Performance/SLA Issue': '#8B5CF6',
            };
            return sorted.map(([reason, { count, cls }], i) => {
              const pct = Math.round((count / maxCount) * 100);
              const color = clsColor[cls] || '#94A3B8';
              return '<div style="display:flex;align-items:center;gap:10px;font-size:12px">' +
                '<span style="font-size:11px;font-weight:800;color:var(--text-faint);min-width:20px">#' + (i + 1) + '</span>' +
                '<span style="min-width:280px;color:var(--text)">' + reason + '</span>' +
                '<div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">' +
                  '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px"></div>' +
                '</div>' +
                '<span style="font-weight:700;color:var(--text-muted);min-width:28px;text-align:right">' + count + '\xD7</span>' +
              '</div>';
            }).join('');
          })()}
        </div>
      </div>` : ''}

      <!-- Two columns: Recent failures + Environment -->
      <div class="row-2">
        <div class="card">
          <div class="card-title">🚨 Recent Failures
            ${failed > 5 ? `<span style="margin-left:auto;font-size:11px;font-weight:400;color:var(--text-muted)">showing 5 of ${failed}</span>` : ''}
          </div>
          ${failed === 0
            ? '<div style="text-align:center;padding:24px;color:var(--pass);font-weight:700;font-size:15px">🎉 No failures!</div>'
            : `<div class="fail-list">${
                this.records
                  .filter(r => r.status === 'failed' || r.status === 'timedOut')
                  .slice(0, 5)
                  .map(r => `<div class="fail-item" onclick="navigate('results')">
                    <span class="fail-item-id">${r.testId || '#' + r.idx}</span>
                    <span class="fail-item-title" title="${r.title}">${r.title}</span>
                    <span class="fail-item-mod">${r.module}</span>
                  </div>`).join('')
              }</div>`
          }
        </div>
        <div class="card">
          <div class="card-title">🌐 Environment</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:7px 0;color:var(--text-muted);width:120px;border-bottom:1px solid var(--border)">Base URL</td><td style="padding:7px 0;border-bottom:1px solid var(--border)"><code style="background:var(--surface2);padding:2px 6px;border-radius:4px;font-size:11px">${env}</code></td></tr>
            <tr><td style="padding:7px 0;color:var(--text-muted);border-bottom:1px solid var(--border)">Run Date</td><td style="padding:7px 0;border-bottom:1px solid var(--border)">${runDate}</td></tr>
            <tr><td style="padding:7px 0;color:var(--text-muted);border-bottom:1px solid var(--border)">Duration</td><td style="padding:7px 0;border-bottom:1px solid var(--border)">${this.ms(elapsed)}</td></tr>
            <tr><td style="padding:7px 0;color:var(--text-muted);border-bottom:1px solid var(--border)">Browsers</td><td style="padding:7px 0;border-bottom:1px solid var(--border)">Chromium · Firefox · WebKit · Pixel 7 · iPhone 14 · iPad</td></tr>
            <tr><td style="padding:7px 0;color:var(--text-muted);border-bottom:1px solid var(--border)">Framework</td><td style="padding:7px 0;border-bottom:1px solid var(--border)">Playwright TypeScript</td></tr>
            <tr><td style="padding:7px 0;color:var(--text-muted)">Overall</td><td style="padding:7px 0"><span class="status-badge ${isPass ? 'pass' : 'fail'}">${overallStatus.toUpperCase()}</span></td></tr>
          </table>
        </div>
      </div>
    </div>

    <!-- ══ VIEW: TEST RESULTS ════════════════════════════════════════════════ -->
    <div id="view-results" class="view">
      <div class="view-header">
        <div class="view-title">Test Results</div>
        <div class="view-subtitle" id="results-module-label"></div>
      </div>
      <div class="filter-bar">
        <div class="filter-tabs">
          <button class="ftab active" id="ftab-all"  data-filter="all"  onclick="setFilter('all')">All (${total})</button>
          <button class="ftab pass-tab" id="ftab-pass" data-filter="pass" onclick="setFilter('pass')">✅ ${passed}</button>
          <button class="ftab fail-tab" id="ftab-fail" data-filter="fail" onclick="setFilter('fail')">❌ ${failed}</button>
          <button class="ftab skip-tab" id="ftab-skip" data-filter="skip" onclick="setFilter('skip')">⏭️ ${skipped}</button>
        </div>
        <div class="filter-sep"></div>
        <input class="search-input" type="text" placeholder="🔍  Search by name, module, test ID…"
               oninput="setSearch(this.value)" />
        <span class="results-count" id="results-count"></span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="t-idx" data-sort="idx"    onclick="setSort('idx')"   >#<span class="sort-icon">↕</span></th>
              <th class="t-status">St.</th>
              <th class="t-id"  data-sort="testId" onclick="setSort('testId')" >ID<span class="sort-icon">↕</span></th>
              <th data-sort="title"  onclick="setSort('title')" >Test Name<span class="sort-icon">↕</span></th>
              <th class="t-module" data-sort="module" onclick="setSort('module')">Module<span class="sort-icon">↕</span></th>
              <th class="t-dur" data-sort="duration" onclick="setSort('duration')">Dur<span class="sort-icon">↕</span></th>
              <th class="t-retry">Retry</th>
              <th class="t-expand"></th>
            </tr>
          </thead>
          <tbody id="results-tbody"></tbody>
        </table>
        <div id="results-pagination" class="pagination" style="display:none"></div>
      </div>
    </div>

    <!-- ══ VIEW: MODULES ════════════════════════════════════════════════════ -->
    <div id="view-modules" class="view">
      <div class="view-header">
        <div class="view-title">Modules</div>
        <div class="view-subtitle">${Object.keys(modMap).length} modules across ${total} tests</div>
      </div>
      <div class="mod-grid" id="modules-grid"></div>
    </div>

    <!-- ══ VIEW: BUG REPORT ═════════════════════════════════════════════════ -->
    <div id="view-bugs" class="view">
      <div class="view-header">
        <div class="view-title">Bug Report</div>
        <div class="view-subtitle" id="bugs-count">${failed} bugs found</div>
      </div>
      <div class="bugs-toolbar">
        <button class="export-btn" onclick="exportAllBugs()">⬇️ Export All as JSON</button>
      </div>
      <div class="bugs-grid" id="bugs-grid"></div>
    </div>

    <!-- ══ VIEW: SCREENSHOTS ════════════════════════════════════════════════ -->
    <div id="view-screenshots" class="view">
      <div class="view-header">
        <div class="view-title">Screenshots</div>
        <div class="view-subtitle">${this.records.filter(r => r.screenshot).length} failure screenshots captured</div>
      </div>
      <div class="gallery-grid" id="gallery-grid"></div>
    </div>

  </div><!-- /content-area -->
</div><!-- /main -->

<!-- Lightbox -->
<div id="lightbox" class="lightbox" onclick="closeLightbox()">
  <div class="lightbox-close" onclick="closeLightbox()">✕</div>
  <img id="lb-img" src="" alt="screenshot" onclick="event.stopPropagation()" />
  <div class="lightbox-label" id="lb-label"></div>
</div>

<script>
// Boot: init dark mode button label, then show dashboard
(function boot() {
  if (document.documentElement.dataset.theme === 'dark')
    document.getElementById('dark-btn').textContent = '☀️';
  // Trigger chart init after Chart.js CDN loads
  if (typeof Chart !== 'undefined') {
    initCharts();
  } else {
    const s = document.querySelector('script[src*="chart.js"]');
    if (s) s.addEventListener('load', initCharts);
  }
})();
</script>
</body>
</html>`;
  }

  private ms(ms: number): string {
    if (ms < 1000)  return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  }
}

export default CustomHtmlReporter;
