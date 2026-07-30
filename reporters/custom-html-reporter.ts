import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
type Priority = 'P1' | 'P2' | 'P3' | 'P4';
type FailureClass = 'Product Bug' | 'Automation Issue' | 'Environment' | 'External Dependency';

interface TestRecord {
  idx: number;
  file: string;
  suiteTitle: string;
  title: string;
  fullTitle: string;
  status: TestResult['status'];
  expectedStatus: TestCase['expectedStatus'];
  durationMs: number;
  retries: number;
  errorMessage: string;
  screenshotPath: string | null;
  traceRelPath: string | null;
}

interface BugRecord {
  id: string;
  linkedTestId: string;
  title: string;
  module: string;
  severity: Severity;
  priority: Priority;
  failureClass: FailureClass;
  errorMessage: string;
  screenshotPath: string | null;
}

const OUT_DIR = 'reports';
const HTML_OUT = path.join(OUT_DIR, 'custom-report.html');
const BUGS_OUT = path.join(OUT_DIR, 'bug-report.html');

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moduleFromFile(file: string): string {
  const base = path.basename(file, path.extname(file)).replace(/\.spec$/, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Classifies a failure using only signals actually present in this run's
 * error text - no guessing about intent. "Product Bug" is the default for
 * a genuine assertion failure; the other buckets require a specific,
 * recognizable signature (timeout on a real backend/inbox dependency,
 * or a step that never executed because a prior hook failed).
 */
function classifyFailure(errorMessage: string, title: string): FailureClass {
  const msg = errorMessage.toLowerCase();
  if (msg.includes('mailinator') || msg.includes('otp not found')) return 'External Dependency';
  if (msg.includes('recaptcha') || msg.includes('reCAPTCHA'.toLowerCase())) return 'External Dependency';
  if (msg.includes('did not run') || msg.includes('beforeall')) return 'Automation Issue';
  if (title.toLowerCase().includes('real backend') || title.toLowerCase().includes('bug-0')) {
    return 'Product Bug';
  }
  return 'Product Bug';
}

function severityFor(rec: TestRecord, failureClass: FailureClass): { severity: Severity; priority: Priority } {
  if (failureClass === 'External Dependency') return { severity: 'Low', priority: 'P4' };
  if (failureClass === 'Automation Issue') return { severity: 'Medium', priority: 'P3' };
  const t = rec.title.toLowerCase();
  if (t.includes('checkout') || t.includes('payment') || rec.file.includes('checkout')) {
    return { severity: 'High', priority: 'P1' };
  }
  if (t.includes('bug-01') || t.includes('bug-02') || t.includes('bug-03')) {
    return { severity: 'High', priority: 'P1' };
  }
  if (rec.file.includes('auth')) return { severity: 'High', priority: 'P2' };
  return { severity: 'Medium', priority: 'P2' };
}

class CustomHtmlReporter implements Reporter {
  private records: TestRecord[] = [];
  private idx = 0;
  private startTime = 0;
  private config!: FullConfig;

  onBegin(config: FullConfig, _suite: Suite): void {
    this.config = config;
    this.startTime = Date.now();
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const fileRel = path.relative(this.config.rootDir, test.location.file).replace(/\\/g, '/');
    const titlePath = test.titlePath();
    // titlePath: ['', projectName, filePath, describeTitle, testTitle] (shape varies by nesting)
    const suiteTitle = titlePath.length >= 2 ? titlePath[titlePath.length - 2] : '';

    const screenshot = result.attachments.find((a) => a.name === 'screenshot' && a.path);
    const trace = result.attachments.find((a) => a.name === 'trace' && a.path);

    const errorMessage = result.errors
      .map((e) => e.message || '')
      .filter(Boolean)
      .join('\n')
      .split('\n')
      .slice(0, 6)
      .join('\n');

    this.records.push({
      idx: ++this.idx,
      file: fileRel,
      suiteTitle: String(suiteTitle),
      title: test.title,
      fullTitle: titlePath.filter(Boolean).join(' › '),
      status: result.status,
      expectedStatus: test.expectedStatus,
      durationMs: result.duration,
      retries: result.retry,
      errorMessage,
      screenshotPath: screenshot?.path ? path.relative(OUT_DIR, screenshot.path).replace(/\\/g, '/') : null,
      traceRelPath: trace?.path ? path.relative(OUT_DIR, trace.path).replace(/\\/g, '/') : null,
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const durationMs = Date.now() - this.startTime;
    this.writeCustomReport(result, durationMs);
    this.writeBugReport();
  }

  private writeCustomReport(result: FullResult, durationMs: number): void {
    const total = this.records.length;
    const passed = this.records.filter((r) => r.status === 'passed').length;
    const failed = this.records.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
    const skipped = this.records.filter((r) => r.status === 'skipped').length;
    const flaky = this.records.filter((r) => r.retries > 0 && r.status === 'passed').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const byModule = new Map<string, TestRecord[]>();
    for (const rec of this.records) {
      const mod = moduleFromFile(rec.file);
      if (!byModule.has(mod)) byModule.set(mod, []);
      byModule.get(mod)!.push(rec);
    }

    const moduleCards = [...byModule.entries()]
      .map(([mod, recs]) => {
        const p = recs.filter((r) => r.status === 'passed').length;
        const f = recs.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
        const s = recs.filter((r) => r.status === 'skipped').length;
        const notRun = recs.filter((r) => r.status === 'interrupted').length;
        const t = recs.length;
        const pct = t > 0 ? Math.round((p / t) * 100) : 0;
        const state = f > 0 ? 'blocked' : s > 0 || notRun > 0 ? 'partial' : 'ok';
        return `
        <div class="mod-card ${state}">
          <div class="mod-head">
            <span class="mod-name">${esc(mod)}</span>
            <span class="status-chip ${state}">${state === 'ok' ? 'Clean' : state === 'blocked' ? 'Blocked' : 'Partial'}</span>
          </div>
          <div class="mod-bar"><span class="p" style="width:${(p / t) * 100}%"></span><span class="f" style="width:${(f / t) * 100}%"></span><span class="s" style="width:${((s + notRun) / t) * 100}%"></span></div>
          <div class="mod-stats"><span class="ok-t">${p} passed</span><span class="fail-t">${f} failed</span><span class="skip-t">${s + notRun} skipped</span></div>
        </div>`;
      })
      .join('');

    const rows = this.records
      .map((rec) => {
        const statusChip =
          rec.status === 'passed'
            ? '<span class="status-chip ok">Pass</span>'
            : rec.status === 'skipped'
              ? '<span class="status-chip skip">Skip</span>'
              : rec.status === 'interrupted'
                ? '<span class="status-chip skip">Not Run</span>'
                : '<span class="status-chip fail">Fail</span>';
        const evidence = rec.screenshotPath
          ? `<a href="${esc(rec.screenshotPath)}" target="_blank">screenshot</a>`
          : rec.traceRelPath
            ? `<a href="${esc(rec.traceRelPath)}" target="_blank">trace</a>`
            : '&mdash;';
        const errCell = rec.errorMessage
          ? `<pre class="err-cell">${esc(rec.errorMessage.slice(0, 220))}</pre>`
          : '';
        return `<tr>
          <td class="num">${rec.idx}</td>
          <td>${esc(moduleFromFile(rec.file))}</td>
          <td>${esc(rec.title)}</td>
          <td>${statusChip}</td>
          <td class="num">${(rec.durationMs / 1000).toFixed(1)}s</td>
          <td>${errCell}</td>
          <td>${evidence}</td>
        </tr>`;
      })
      .join('');

    const readiness =
      failed === 0
        ? { label: 'READY FOR PRODUCTION', cls: 'ok' }
        : failed <= 2
          ? { label: 'READY WITH MINOR RISKS', cls: 'warn' }
          : { label: 'NOT READY FOR PRODUCTION', cls: 'blocked' };

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Synctag QA Regression Report</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${SHARED_CSS}
</style>
</head>
<body>
<div class="wrap">
  <div class="cover">
    <div class="cover-eyebrow"><span class="dot"></span>QA REGRESSION REPORT · CONFIDENTIAL</div>
    <h1 class="cover-title">Synctag Regression Test Report</h1>
    <p class="cover-sub">Automated Playwright run against the live staging environment. Every result below reflects the actual, current state of the app at the time this report was generated &mdash; not a static snapshot.</p>
    <div class="cover-meta">
      <div><span class="k">Application</span><span class="v">Synctag</span></div>
      <div><span class="k">Environment</span><span class="v">${esc(process.env.BASE_URL || 'https://devextension.synctag.com')}</span></div>
      <div><span class="k">Run date</span><span class="v">${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC</span></div>
      <div><span class="k">Duration</span><span class="v">${(durationMs / 1000 / 60).toFixed(1)} min</span></div>
    </div>
  </div>

  <section>
    <div class="section-head"><h2>Executive summary</h2><span class="section-tag">${total} tests</span></div>
    <div class="stat-row">
      <div class="stat total"><div class="num">${total}</div><div class="label">Total tests</div></div>
      <div class="stat pass"><div class="num">${passed}</div><div class="label">Passed</div></div>
      <div class="stat fail"><div class="num">${failed}</div><div class="label">Failed</div></div>
      <div class="stat skip"><div class="num">${skipped}</div><div class="label">Skipped</div></div>
      <div class="stat total"><div class="num">${passRate}%</div><div class="label">Pass rate</div></div>
    </div>
    <div class="readiness-banner ${readiness.cls}">
      <span class="pill">${readiness.cls === 'ok' ? 'Ready' : readiness.cls === 'warn' ? 'Minor risks' : 'Not ready'}</span>
      <span class="txt"><strong>${readiness.label}</strong>${flaky > 0 ? ` &mdash; ${flaky} test(s) passed only after a retry.` : ''}</span>
    </div>
  </section>

  <section>
    <div class="section-head"><h2>Results by module</h2><span class="section-tag">${byModule.size} modules</span></div>
    <div class="mod-grid">${moduleCards}</div>
  </section>

  <section>
    <div class="section-head"><h2>All test results</h2><span class="section-tag">Full detail</span></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Module</th><th>Test</th><th>Status</th><th class="num">Duration</th><th>Error</th><th>Evidence</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>

  <footer>
    <span>Synctag QA Regression</span>
    <span>Generated ${new Date().toISOString()}</span>
  </footer>
</div>
</body>
</html>`;

    fs.writeFileSync(HTML_OUT, html, 'utf8');

    const failedCount = failed;
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log(`║  📊  Custom HTML Report  →  ${HTML_OUT}`);
    console.log(`║  Tests: ${total}  |  Passed: ${passed}  |  Failed: ${failedCount}  |  Duration: ${(durationMs / 1000 / 60).toFixed(1)}m`);
    console.log('╚══════════════════════════════════════════════════════╝');
  }

  private writeBugReport(): void {
    const failing = this.records.filter((r) => r.status === 'failed' || r.status === 'timedOut');

    const bugs: BugRecord[] = failing.map((rec, i) => {
      const failureClass = classifyFailure(rec.errorMessage, rec.title);
      const { severity, priority } = severityFor(rec, failureClass);
      return {
        id: `SYNCTAG-BUG-${String(i + 1).padStart(3, '0')}`,
        linkedTestId: `T-${rec.idx}`,
        title: rec.title,
        module: moduleFromFile(rec.file),
        severity,
        priority,
        failureClass,
        errorMessage: rec.errorMessage,
        screenshotPath: rec.screenshotPath,
      };
    });

    const productBugs = bugs.filter((b) => b.failureClass === 'Product Bug').length;
    const autoIssues = bugs.filter((b) => b.failureClass === 'Automation Issue').length;
    const envIssues = bugs.filter((b) => b.failureClass === 'Environment').length;
    const extDeps = bugs.filter((b) => b.failureClass === 'External Dependency').length;
    const critHigh = bugs.filter((b) => b.severity === 'Critical' || b.severity === 'High').length;

    if (bugs.length === 0) {
      console.log('');
      console.log('✅  No failures — bug report not generated.');
      return;
    }

    const sevColor: Record<Severity, string> = {
      Critical: '#DE350B',
      High: '#E2795E',
      Medium: '#A3673A',
      Low: '#6B6560',
    };

    const rows = bugs
      .map(
        (b) => `
      <div class="bug-card">
        <div class="bug-band" style="background:${sevColor[b.severity]}">
          <span class="id">${esc(b.id)}</span>
          <span class="sev">${esc(b.severity)} · ${esc(b.priority)}</span>
        </div>
        <div class="bug-body">
          <h3 class="bug-title">${esc(b.title)}</h3>
          <div class="bug-facts">
            <div class="f"><span class="k">Module</span><span class="v">${esc(b.module)}</span></div>
            <div class="f"><span class="k">Linked test</span><span class="v">${esc(b.linkedTestId)}</span></div>
            <div class="f"><span class="k">Classification</span><span class="v">${esc(b.failureClass)}</span></div>
          </div>
          ${b.errorMessage ? `<div class="trace">${esc(b.errorMessage)}</div>` : ''}
          ${b.screenshotPath ? `<a class="evidence-link" href="${esc(b.screenshotPath)}" target="_blank">View screenshot evidence &rarr;</a>` : ''}
        </div>
      </div>`
      )
      .join('');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Synctag Bug Report</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${SHARED_CSS}
</style>
</head>
<body>
<div class="wrap">
  <div class="cover">
    <div class="cover-eyebrow"><span class="dot"></span>BUG REPORT · GENERATED FROM LIVE TEST RUN</div>
    <h1 class="cover-title">Synctag Bug Report</h1>
    <p class="cover-sub">Every entry below is generated directly from a failing test in this run &mdash; classification (Product Bug vs. Automation/Environment/External) is inferred from the actual error signature, not asserted.</p>
  </div>

  <section>
    <div class="section-head"><h2>Summary</h2></div>
    <div class="stat-row">
      <div class="stat fail"><div class="num">${bugs.length}</div><div class="label">Total failures</div></div>
      <div class="stat fail"><div class="num">${productBugs}</div><div class="label">Product bugs</div></div>
      <div class="stat total"><div class="num">${autoIssues}</div><div class="label">Automation issues</div></div>
      <div class="stat skip"><div class="num">${extDeps}</div><div class="label">External dependency</div></div>
      <div class="stat fail"><div class="num">${critHigh}</div><div class="label">Critical / High</div></div>
    </div>
  </section>

  <section>
    <div class="section-head"><h2>Findings</h2><span class="section-tag">Ranked as reported</span></div>
    <div class="bug-list">${rows}</div>
  </section>

  <footer>
    <span>Synctag QA Regression</span>
    <span>Generated ${new Date().toISOString()}</span>
  </footer>
</div>
</body>
</html>`;

    fs.writeFileSync(BUGS_OUT, html, 'utf8');

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log(`║  🐛  Bug Report  (${bugs.length} failing tests)`);
    console.log(`║  Product Bugs: ${productBugs}  |  Automation: ${autoIssues}  |  Environment: ${envIssues}  |  External Dep: ${extDeps}`);
    console.log(`║  HTML → ${BUGS_OUT}`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
  }
}

const SHARED_CSS = `
  :root {
    --paper: #F7F5F2; --paper-raised: #FFFFFF; --ink: #1C1B1A; --ink-soft: #4A4642;
    --muted: #6B6560; --line: #E4DFD8; --line-strong: #D3CBC0; --brick: #8A170F;
    --brick-soft: #F3E4E1; --brick-wash: #FCF6F5; --green: #2F6B4F; --green-soft: #E4EEE8;
    --amber: #A3673A; --amber-soft: #F3E9DE; --grey-soft: #ECE9E4; --code-bg: #211F1D;
    --code-fg: #E8E3DC; --shadow: 0 1px 2px rgba(28,27,26,0.04), 0 8px 24px rgba(28,27,26,0.06);
    --radius: 10px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #17140F; --paper-raised: #201C17; --ink: #EFEAE2; --ink-soft: #C9C2B7;
      --muted: #9A9186; --line: #322C24; --line-strong: #453D33; --brick: #E2795E;
      --brick-soft: #362019; --brick-wash: #241813; --green: #7FBFA0; --green-soft: #1C2B22;
      --amber: #D9A468; --amber-soft: #2E2418; --grey-soft: #241F19; --code-bg: #0F0D0A;
      --code-fg: #E8E3DC; --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.35);
    }
  }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:var(--paper); color:var(--ink);
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; }
  body { font-size:15px; line-height:1.55; }
  a { color: var(--brick); }
  .wrap { max-width: 1000px; margin: 0 auto; padding: 0 28px 96px; }
  .cover { padding: 56px 0 32px; border-bottom: 1px solid var(--line); margin-bottom: 40px; }
  .cover-eyebrow { display:flex; align-items:center; gap:10px; font-family:monospace; font-size:12px;
    letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin-bottom:18px; }
  .cover-eyebrow .dot { width:7px; height:7px; border-radius:50%; background:var(--brick); flex:none; }
  h1.cover-title { font-size: clamp(28px,4vw,38px); line-height:1.1; margin:0 0 12px; color:var(--ink); font-weight:600; }
  .cover-sub { font-size:15px; color:var(--ink-soft); max-width:70ch; margin:0; }
  .cover-meta { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--line);
    border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; margin-top:22px; }
  .cover-meta div { background:var(--paper-raised); padding:12px 14px; }
  .cover-meta .k { display:block; font-family:monospace; font-size:10px; letter-spacing:.06em;
    text-transform:uppercase; color:var(--muted); margin-bottom:4px; }
  .cover-meta .v { font-size:13px; font-weight:600; word-break:break-word; }
  section { margin-bottom: 44px; }
  .section-head { display:flex; align-items:baseline; justify-content:space-between; gap:16px;
    margin-bottom:16px; padding-bottom:10px; border-bottom:1px solid var(--line); }
  h2 { font-size:21px; margin:0; font-weight:600; }
  .section-tag { font-family:monospace; font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); }
  .stat-row { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
  .stat { background:var(--paper-raised); border:1px solid var(--line); border-radius:var(--radius);
    padding:16px 14px; box-shadow:var(--shadow); }
  .stat .num { font-size:28px; line-height:1; font-weight:700; font-variant-numeric:tabular-nums; }
  .stat .label { margin-top:6px; font-size:11.5px; color:var(--muted); }
  .stat.pass .num { color:var(--green); } .stat.fail .num { color:var(--brick); }
  .stat.skip .num { color:var(--amber); } .stat.total .num { color:var(--ink); }
  .readiness-banner { margin-top:16px; display:flex; align-items:center; gap:14px; border-radius:var(--radius);
    padding:14px 18px; border:1px solid var(--line); border-left:4px solid var(--muted); }
  .readiness-banner.ok { background:var(--green-soft); border-left-color:var(--green); }
  .readiness-banner.warn { background:var(--amber-soft); border-left-color:var(--amber); }
  .readiness-banner.blocked { background:var(--brick-wash); border-left-color:var(--brick); }
  .readiness-banner .pill { flex:none; font-family:monospace; font-size:10px; letter-spacing:.05em;
    text-transform:uppercase; padding:5px 10px; border-radius:999px; font-weight:700; background:var(--ink); color:var(--paper); }
  .readiness-banner .txt { font-size:13.5px; color:var(--ink-soft); }
  .mod-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
  .mod-card { background:var(--paper-raised); border:1px solid var(--line); border-radius:8px; padding:14px; }
  .mod-card.blocked { border-left:3px solid var(--brick); }
  .mod-card.partial { border-left:3px solid var(--amber); }
  .mod-card.ok { border-left:3px solid var(--green); }
  .mod-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .mod-name { font-weight:600; font-size:13.5px; }
  .mod-bar { display:flex; height:6px; border-radius:3px; overflow:hidden; background:var(--grey-soft); margin-bottom:8px; }
  .mod-bar .p { background:var(--green); } .mod-bar .f { background:var(--brick); } .mod-bar .s { background:var(--amber); }
  .mod-stats { display:flex; gap:10px; font-size:11px; color:var(--muted); }
  .mod-stats .ok-t { color:var(--green); } .mod-stats .fail-t { color:var(--brick); } .mod-stats .skip-t { color:var(--amber); }
  .status-chip { display:inline-flex; align-items:center; font-family:monospace; font-size:10.5px; font-weight:700;
    letter-spacing:.03em; text-transform:uppercase; padding:3px 8px; border-radius:999px; }
  .status-chip.ok { background:var(--green-soft); color:var(--green); }
  .status-chip.fail { background:var(--brick-soft); color:var(--brick); }
  .status-chip.skip { background:var(--amber-soft); color:var(--amber); }
  .status-chip.blocked { background:var(--brick-soft); color:var(--brick); }
  .status-chip.partial { background:var(--amber-soft); color:var(--amber); }
  .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:var(--radius);
    background:var(--paper-raised); box-shadow:var(--shadow); }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  thead th { text-align:left; font-family:monospace; font-size:10px; letter-spacing:.05em; text-transform:uppercase;
    color:var(--muted); font-weight:600; padding:10px 12px; border-bottom:1px solid var(--line-strong); white-space:nowrap; }
  tbody td { padding:9px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:hover td { background:var(--grey-soft); }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .err-cell { margin:0; font-family:monospace; font-size:11px; white-space:pre-wrap; color:var(--brick); max-width:360px; }
  footer { border-top:1px solid var(--line); padding-top:20px; display:flex; justify-content:space-between;
    gap:12px; flex-wrap:wrap; font-size:11.5px; color:var(--muted); font-family:monospace; }
  .bug-list { display:flex; flex-direction:column; gap:16px; }
  .bug-card { background:var(--paper-raised); border:1px solid var(--line-strong); border-radius:var(--radius);
    overflow:hidden; box-shadow:var(--shadow); }
  .bug-band { padding:10px 16px; display:flex; align-items:center; justify-content:space-between;
    gap:10px; color:#fff; flex-wrap:wrap; }
  .bug-band .id { font-family:monospace; font-size:11px; opacity:.9; }
  .bug-band .sev { font-family:monospace; font-size:10px; letter-spacing:.05em; text-transform:uppercase;
    background:rgba(255,255,255,.18); padding:3px 8px; border-radius:999px; font-weight:700; }
  .bug-body { padding:16px 18px; }
  .bug-title { font-size:15px; margin:0 0 12px; font-weight:600; }
  .bug-facts { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
  .bug-facts .f { background:var(--grey-soft); border-radius:6px; padding:8px 10px; }
  .bug-facts .f .k { display:block; font-family:monospace; font-size:9px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin-bottom:2px; }
  .bug-facts .f .v { font-size:12.5px; font-weight:600; }
  .trace { background:var(--code-bg); color:var(--code-fg); border-radius:6px; padding:10px 12px;
    font-family:monospace; font-size:11px; line-height:1.6; overflow-x:auto; white-space:pre-wrap; margin-bottom:10px; }
  .evidence-link { font-size:12.5px; font-weight:600; }
  @media (max-width:720px) {
    .cover-meta { grid-template-columns:repeat(2,1fr); }
    .stat-row { grid-template-columns:repeat(2,1fr); }
    .bug-facts { grid-template-columns:1fr; }
  }
`;

export default CustomHtmlReporter;
