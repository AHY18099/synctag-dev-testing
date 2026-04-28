/**
 * JIRA Bug Reporter
 * On test run completion, generates two artefacts:
 *   1. reports/jira/bugs.json  — array of JIRA-compatible issue payloads (REST API v3 / ADF)
 *   2. reports/jira/bugs.html  — styled HTML view of all bugs in JIRA card format
 *
 * Each failure becomes one JIRA issue with:
 *   - Summary, Description (ADF), Steps to Reproduce, Environment,
 *     Expected / Actual, Priority, Labels, Attachments (screenshot + video)
 */

import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import * as fs   from 'fs';
import * as path from 'path';

interface BugRecord {
  jiraKey:     string;
  title:       string;
  suite:       string;
  module:      string;
  file:        string;
  error:       string;
  errorStack:  string;
  screenshot:  string | null;   // base64 data URI for HTML; file path for JSON attachment
  screenshotPath: string | null;
  videoPath:   string | null;
  tracePath:   string | null;
  duration:    number;
  retry:       number;
  startTime:   string;
  priority:    string;
  annotations: Array<{ type: string; description?: string }>;
  env:         string;
  browser:     string;
}

function derivePriority(annotations: Array<{ type: string; description?: string }>, retry: number): string {
  const explicit = annotations.find(a => a.type === 'priority')?.description;
  if (explicit) return explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
  if (retry > 1) return 'Critical';
  return 'High';
}

class JiraBugReporter implements Reporter {
  private bugs: BugRecord[] = [];
  private outDir: string;
  private beginTime: Date = new Date();
  private idx = 0;

  constructor(options: Record<string, string> = {}) {
    this.outDir = options['outputDir'] || 'reports/jira';
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.beginTime = new Date();
    fs.mkdirSync(this.outDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const isFailed = result.status === 'failed' || result.status === 'timedOut';
    if (!isFailed) return;

    this.idx++;
    const titlePath = test.titlePath();
    const module    = titlePath[2] || titlePath[1] || 'Unknown';
    const suite     = titlePath.slice(2, -1).join(' › ') || module;
    const file      = titlePath[1] || '';
    const env       = process.env.BASE_URL || 'https://devextension.synctag.com';

    let screenshotPath: string | null = null;
    let screenshot:     string | null = null;
    let videoPath:      string | null = null;
    let tracePath:      string | null = null;

    for (const att of result.attachments) {
      if (!screenshotPath && att.name === 'screenshot' && att.path) {
        screenshotPath = att.path;
        if (fs.existsSync(att.path)) {
          const buf = fs.readFileSync(att.path);
          screenshot = `data:${att.contentType};base64,${buf.toString('base64')}`;
        }
      }
      if (!videoPath && att.name === 'video' && att.path) videoPath = att.path;
      if (!tracePath && att.name === 'trace' && att.path) tracePath = att.path;
    }

    const sanitize = (s = '') =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    this.bugs.push({
      jiraKey:         `SYNCTAG-BUG-${String(this.idx).padStart(3, '0')}`,
      title:           test.title,
      suite,
      module,
      file,
      error:           sanitize(result.error?.message || 'Test failed'),
      errorStack:      sanitize(result.error?.stack    || ''),
      screenshot,
      screenshotPath,
      videoPath,
      tracePath,
      duration:        result.duration,
      retry:           result.retry,
      startTime:       result.startTime.toISOString(),
      priority:        derivePriority(test.annotations, result.retry),
      annotations:     test.annotations,
      env,
      browser:         'Chromium / Firefox / WebKit',
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.bugs.length === 0) {
      console.log('\n✅  No failures — JIRA bug report not generated.\n');
      return;
    }

    this.writeJSON();
    this.writeHTML();

    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║  🐛  JIRA Bug Report (${this.bugs.length} bug${this.bugs.length !== 1 ? 's' : ''})`);
    console.log(`║  JSON: ${path.join(this.outDir, 'bugs.json')}`);
    console.log(`║  HTML: ${path.join(this.outDir, 'bugs.html')}`);
    console.log(`╚══════════════════════════════════════════════════════╝\n`);
  }

  printsToStdio(): boolean { return false; }

  // ─── JSON (JIRA REST API v3 — ADF format) ─────────────────────────────────

  private writeJSON(): void {
    const runDate = this.beginTime.toISOString();

    const issues = this.bugs.map(bug => ({
      fields: {
        project:   { key: 'SYNCTAG' },
        summary:   `[AutoTest] ${bug.jiraKey}: ${bug.title}`,
        issuetype: { name: 'Bug' },
        priority:  { name: bug.priority },
        labels:    ['automated-test', 'playwright', 'regression', bug.module.toLowerCase().replace(/\s+/g, '-')],
        environment: `URL: ${bug.env}\nBrowser: ${bug.browser}\nRun Date: ${runDate}`,
        description: {
          type:    'doc',
          version: 1,
          content: [
            this.adfHeading('Test Information', 3),
            this.adfTable([
              ['Field', 'Value'],
              ['Test ID',    bug.jiraKey],
              ['Test Title', bug.title],
              ['Module',     bug.module],
              ['Suite',      bug.suite],
              ['File',       bug.file],
              ['Duration',   this.fmtMs(bug.duration)],
              ['Retries',    String(bug.retry)],
              ['Run Time',   new Date(bug.startTime).toLocaleString('en-IN')],
              ['Environment', bug.env],
              ['Browser',    bug.browser],
            ]),
            this.adfHeading('Steps to Reproduce', 3),
            this.adfOrderedList([
              `Navigate to ${bug.env}`,
              `Execute automated test: "${bug.title}"`,
              'Observe test failure in the report',
            ]),
            this.adfHeading('Expected Result', 3),
            this.adfParagraph('The test should complete successfully with all assertions passing.'),
            this.adfHeading('Actual Result', 3),
            this.adfParagraph(bug.error || 'Test failed or timed out.'),
            ...(bug.errorStack ? [
              this.adfHeading('Stack Trace', 3),
              this.adfCodeBlock(bug.errorStack),
            ] : []),
            this.adfHeading('Attachments', 3),
            this.adfBulletList([
              bug.screenshotPath ? `Screenshot: ${bug.screenshotPath}` : 'Screenshot: Not available',
              bug.videoPath      ? `Video: ${bug.videoPath}`           : 'Video: Not available',
              bug.tracePath      ? `Trace: ${bug.tracePath}`           : 'Trace: Not available',
            ]),
          ],
        },
        customfield_10014: 'SYNCTAG-SPRINT-CURRENT',
        duedate:           null,
      },
      _meta: {
        jiraKey:        bug.jiraKey,
        screenshotPath: bug.screenshotPath,
        videoPath:      bug.videoPath,
        tracePath:      bug.tracePath,
      },
    }));

    fs.writeFileSync(
      path.join(this.outDir, 'bugs.json'),
      JSON.stringify({ generatedAt: runDate, totalBugs: this.bugs.length, issues }, null, 2),
      'utf-8',
    );
  }

  // ─── HTML ─────────────────────────────────────────────────────────────────

  private writeHTML(): void {
    const runDate = this.beginTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'medium' });

    const cards = this.bugs.map(bug => {
      const priorityClass = `priority-${bug.priority.toLowerCase()}`;

      const screenshotBlock = bug.screenshot
        ? `<div class="jira-section">
             <div class="jira-section-label">📸 Screenshot Evidence</div>
             <img src="${bug.screenshot}" class="bug-screenshot" onclick="zoom(this.src)" alt="screenshot" />
             <div class="screenshot-tip">Click to enlarge</div>
           </div>`
        : '<div class="no-attachment">📷 No screenshot captured</div>';

      const videoBlock = bug.videoPath
        ? `<a href="${bug.videoPath}" target="_blank" class="attachment-link">🎬 Video Recording</a>`
        : '<span class="no-attachment-sm">🎬 No video</span>';

      const traceBlock = bug.tracePath
        ? `<a href="${bug.tracePath}" target="_blank" class="attachment-link">🔍 Playwright Trace</a>`
        : '<span class="no-attachment-sm">🔍 No trace</span>';

      const stackBlock = bug.errorStack
        ? `<details class="stack-details">
             <summary>Stack Trace ▼</summary>
             <pre class="stack-pre">${bug.errorStack}</pre>
           </details>`
        : '';

      return `
      <div class="bug-card">
        <!-- Card Header -->
        <div class="card-header">
          <div class="card-header-left">
            <span class="bug-key">🐛 ${bug.jiraKey}</span>
            <span class="bug-type">Bug</span>
          </div>
          <div class="card-header-right">
            <span class="priority-badge ${priorityClass}">${bug.priority}</span>
            <span class="status-badge">Open</span>
          </div>
        </div>

        <!-- Summary -->
        <div class="bug-summary">${bug.title}</div>

        <!-- Meta Row -->
        <div class="bug-meta">
          <span>📦 ${bug.module}</span>
          <span>📂 ${bug.suite}</span>
          <span>⏱ ${this.fmtMs(bug.duration)}</span>
          <span>🔄 Retry: ${bug.retry}</span>
          <span>📅 ${new Date(bug.startTime).toLocaleString('en-IN')}</span>
        </div>

        <!-- Two-column body -->
        <div class="card-body">
          <div class="card-left">
            <div class="jira-section">
              <div class="jira-section-label">🔬 Steps to Reproduce</div>
              <ol class="steps-list">
                <li>Navigate to <code>${bug.env}</code></li>
                <li>Run automated test: <strong>${bug.title}</strong></li>
                <li>Observe the test failure</li>
              </ol>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">✅ Expected Result</div>
              <div class="result-box expected">Test should pass without errors.</div>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">❌ Actual Result</div>
              <div class="result-box actual">${bug.error}</div>
            </div>

            ${stackBlock}

            <div class="jira-section">
              <div class="jira-section-label">🔗 Attachments</div>
              <div class="attachment-row">
                ${videoBlock}
                ${traceBlock}
              </div>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">🌐 Environment</div>
              <table class="env-table">
                <tr><td>URL</td><td><code>${bug.env}</code></td></tr>
                <tr><td>Browser</td><td>${bug.browser}</td></tr>
                <tr><td>File</td><td>${bug.file}</td></tr>
                <tr><td>Run Date</td><td>${new Date(bug.startTime).toLocaleString('en-IN')}</td></tr>
              </table>
            </div>
          </div>

          <div class="card-right">
            ${screenshotBlock}
          </div>
        </div>

        <!-- JIRA Actions Footer -->
        <div class="card-footer">
          <button class="jira-btn" onclick="copyJiraKey('${bug.jiraKey}')">📋 Copy Key</button>
          <button class="jira-btn" onclick="exportSingle(${this.bugs.indexOf(bug)})">⬇️ Export JSON</button>
          <span class="card-footer-meta">Reporter: Automated Test Suite &nbsp;|&nbsp; Project: SYNCTAG</span>
        </div>
      </div>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>JIRA Bug Report — Synctag</title>
<style>
  :root {
    --bg:      #F4F5F7;
    --surface: #FFFFFF;
    --primary: #0052CC;
    --fail:    #DE350B;
    --pass:    #00875A;
    --border:  #DFE1E6;
    --text:    #172B4D;
    --muted:   #6B778C;
    --shadow:  0 1px 3px rgba(9,30,66,0.12), 0 0 0 1px rgba(9,30,66,0.08);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; }

  .jira-header { background: #0052CC; color: #fff; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
  .jira-header h1 { font-size: 18px; font-weight: 700; }
  .jira-header .meta { font-size: 12px; opacity: 0.85; text-align: right; line-height: 1.8; }

  .jira-summary-bar {
    background: var(--surface); padding: 12px 32px; border-bottom: 1px solid var(--border);
    display: flex; gap: 24px; align-items: center; flex-wrap: wrap;
  }
  .summary-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  .summary-count { font-size: 20px; font-weight: 800; color: var(--fail); }

  .bugs-container { padding: 24px 32px; max-width: 1400px; margin: 0 auto; }
  .bugs-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }

  .bug-card { background: var(--surface); border-radius: 4px; box-shadow: var(--shadow); overflow: hidden; }
  .card-header {
    background: #F4F5F7; padding: 12px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .card-header-left { display: flex; align-items: center; gap: 10px; }
  .card-header-right { display: flex; align-items: center; gap: 8px; }
  .bug-key { font-size: 12px; font-weight: 800; color: #0052CC; text-decoration: none; }
  .bug-type { background: #DEEBFF; color: #0747A6; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 3px; text-transform: uppercase; }
  .priority-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 3px; text-transform: uppercase; }
  .priority-critical { background: #FFEBE6; color: #DE350B; }
  .priority-high     { background: #FFEBE6; color: #DE350B; }
  .priority-medium   { background: #FFFAE6; color: #FF8B00; }
  .priority-low      { background: #E3FCEF; color: #006644; }
  .status-badge { background: #DEEBFF; color: #0747A6; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 3px; }

  .bug-summary { padding: 14px 16px 8px; font-size: 16px; font-weight: 700; color: #172B4D; line-height: 1.4; }
  .bug-meta { padding: 0 16px 12px; display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: var(--muted); border-bottom: 1px solid var(--border); }

  .card-body { display: flex; gap: 0; }
  .card-left  { flex: 1; padding: 16px; border-right: 1px solid var(--border); }
  .card-right { flex: 0 0 340px; padding: 16px; background: #FAFBFC; }

  .jira-section { margin-bottom: 16px; }
  .jira-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted); margin-bottom: 6px; }
  .steps-list { padding-left: 18px; font-size: 13px; line-height: 1.9; }
  .steps-list code { background: #F4F5F7; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
  .result-box { font-size: 13px; padding: 10px 12px; border-radius: 3px; line-height: 1.6; }
  .result-box.expected { background: #E3FCEF; color: #006644; border-left: 3px solid #00875A; }
  .result-box.actual   { background: #FFEBE6; color: #BF2600; border-left: 3px solid #DE350B; }

  .stack-details { margin-top: 12px; }
  .stack-details summary { font-size: 12px; font-weight: 600; color: #BF2600; cursor: pointer; }
  .stack-pre { font-size: 11px; background: #1C1C1E; color: #FF7262; padding: 12px; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin-top: 8px; line-height: 1.6; }

  .attachment-row { display: flex; gap: 10px; flex-wrap: wrap; }
  .attachment-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #0052CC; text-decoration: none; background: #DEEBFF; padding: 4px 10px; border-radius: 3px; }
  .attachment-link:hover { background: #B3D4FF; }
  .no-attachment { font-size: 12px; color: var(--muted); }
  .no-attachment-sm { font-size: 12px; color: #C1C7D0; }

  .env-table { width: 100%; font-size: 12px; border-collapse: collapse; }
  .env-table td { padding: 4px 8px; border-bottom: 1px solid var(--border); }
  .env-table td:first-child { color: var(--muted); width: 80px; font-weight: 600; }

  .bug-screenshot { width: 100%; border-radius: 3px; cursor: zoom-in; border: 1px solid var(--border); display: block; }
  .screenshot-tip { font-size: 10px; color: var(--muted); text-align: center; margin-top: 4px; }

  .card-footer {
    padding: 10px 16px; background: #F4F5F7; border-top: 1px solid var(--border);
    display: flex; align-items: center; gap: 10px;
  }
  .jira-btn {
    padding: 5px 12px; border: 1px solid var(--border); border-radius: 3px;
    background: var(--surface); font-size: 12px; font-weight: 600; cursor: pointer;
    color: #344563; transition: background 0.1s;
  }
  .jira-btn:hover { background: #DEEBFF; border-color: #0052CC; color: #0052CC; }
  .card-footer-meta { margin-left: auto; font-size: 11px; color: var(--muted); }

  .lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; align-items: center; justify-content: center; cursor: zoom-out; }
  .lightbox.open { display: flex; }
  .lightbox img { max-width: 90vw; max-height: 90vh; border-radius: 4px; }

  .jira-footer { text-align: center; padding: 24px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); }
  .export-all-btn { padding: 8px 20px; background: #0052CC; color: #fff; border: none; border-radius: 3px; font-size: 13px; font-weight: 600; cursor: pointer; margin: 0 16px; }
  .export-all-btn:hover { background: #0747A6; }
</style>
</head>
<body>

<div class="jira-header">
  <div>
    <h1>🐛 JIRA Bug Report — Synctag</h1>
    <div style="font-size:12px;opacity:.8;margin-top:4px">Automated test failures ready for JIRA import</div>
  </div>
  <div class="meta">
    <div>📅 ${runDate}</div>
    <div>🌐 ${process.env.BASE_URL || 'https://devextension.synctag.com'}</div>
    <div>Project: <strong>SYNCTAG</strong></div>
  </div>
</div>

<div class="jira-summary-bar">
  <div class="summary-item">
    <span class="summary-count">${this.bugs.length}</span>
    <span>Bug${this.bugs.length !== 1 ? 's' : ''} Found</span>
  </div>
  <div class="summary-item">🔴 Critical/High: ${this.bugs.filter(b => b.priority === 'Critical' || b.priority === 'High').length}</div>
  <div class="summary-item">🟡 Medium: ${this.bugs.filter(b => b.priority === 'Medium').length}</div>
  <div class="summary-item">🟢 Low: ${this.bugs.filter(b => b.priority === 'Low').length}</div>
  <div style="margin-left:auto">
    <button class="export-all-btn" onclick="exportAll()">⬇️ Export All as JSON</button>
  </div>
</div>

<div class="bugs-container">
  <div class="bugs-grid">
    ${cards}
  </div>
</div>

<div class="lightbox" id="lb" onclick="document.getElementById('lb').classList.remove('open')">
  <img id="lbImg" src="" alt="screenshot" />
</div>

<div class="jira-footer">
  Generated by Synctag JIRA Bug Reporter &nbsp;|&nbsp; Playwright TypeScript &nbsp;|&nbsp; ${runDate}
</div>

<script>
  const bugsData = ${JSON.stringify(this.bugs.map(b => ({
    jiraKey: b.jiraKey, title: b.title, module: b.module,
    error: b.error, priority: b.priority,
    screenshotPath: b.screenshotPath, videoPath: b.videoPath,
  })))};

  function zoom(src) {
    document.getElementById('lbImg').src = src;
    document.getElementById('lb').classList.add('open');
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('lb').classList.remove('open'); });

  function copyJiraKey(key) {
    navigator.clipboard?.writeText(key).then(() => alert('Copied: ' + key));
  }

  function exportSingle(idx) {
    const bug = bugsData[idx];
    const blob = new Blob([JSON.stringify(bug, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = bug.jiraKey + '.json';
    a.click();
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(bugsData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'synctag-jira-bugs.json';
    a.click();
  }
</script>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outDir, 'bugs.html'), html, 'utf-8');
  }

  // ─── ADF Helpers ──────────────────────────────────────────────────────────

  private adfHeading(text: string, level: number): object {
    return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
  }

  private adfParagraph(text: string): object {
    return { type: 'paragraph', content: [{ type: 'text', text }] };
  }

  private adfCodeBlock(code: string): object {
    return { type: 'codeBlock', attrs: { language: 'text' }, content: [{ type: 'text', text: code }] };
  }

  private adfOrderedList(items: string[]): object {
    return {
      type: 'orderedList',
      content: items.map(item => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
      })),
    };
  }

  private adfBulletList(items: string[]): object {
    return {
      type: 'bulletList',
      content: items.map(item => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
      })),
    };
  }

  private adfTable(rows: string[][]): object {
    return {
      type: 'table',
      attrs: { isNumberColumnEnabled: false, layout: 'default' },
      content: rows.map((row, ri) => ({
        type: 'tableRow',
        content: row.map(cell => ({
          type: ri === 0 ? 'tableHeader' : 'tableCell',
          attrs: {},
          content: [{ type: 'paragraph', content: [{ type: 'text', text: cell }] }],
        })),
      })),
    };
  }

  private fmtMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  }
}

export default JiraBugReporter;
