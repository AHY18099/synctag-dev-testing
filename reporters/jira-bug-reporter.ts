/**
 * JIRA Bug Reporter — v3 Professional Edition
 *
 * Generates:
 *   1. reports/jira/bugs.json  — JIRA REST API v3 ADF-format issue payloads
 *   2. reports/jira/bugs.html  — Styled HTML with complete JIRA fields
 *
 * Key features:
 *   - Deduplication: retried tests produce ONE bug record (last failure wins)
 *   - Failure classification: Product Bug / Automation Issue / Environment Issue /
 *     External Dependency Issue / Performance/SLA Issue / Test Data Issue
 *   - All mandatory JIRA fields: Test Case ID, Severity, Priority, Reproducibility,
 *     Root Cause, QA Recommendation, Preconditions, Env Details, Attachments
 *   - Release status: READY / NOT READY based on Product Bug count + priority
 *   - Top failure reasons summary
 */

import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import * as fs   from 'node:fs';
import * as path from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

type FailureClass =
  | 'Product Bug'
  | 'Automation Issue'
  | 'Environment Issue'
  | 'External Dependency Issue'
  | 'Performance/SLA Issue'
  | 'Test Data Issue';

interface BugRecord {
  jiraKey:          string;
  title:            string;
  testCaseId:       string;
  suite:            string;
  module:           string;
  file:             string;
  error:            string;
  errorStack:       string;
  screenshot:       string | null;
  screenshotPath:   string | null;
  videoPath:        string | null;
  tracePath:        string | null;
  duration:         number;
  retry:            number;
  startTime:        string;
  priority:         string;
  severity:         string;
  failureClass:     FailureClass;
  rootCause:        string;
  qaRecommendation: string;
  reproducibility:  string;
  annotations:      Array<{ type: string; description?: string }>;
  env:              string;
  browser:          string;
}

// ─── Classification helpers ───────────────────────────────────────────────────

function classifyFailure(errorMsg: string, title: string): FailureClass {
  const e = (errorMsg || '').toLowerCase();
  const t = title.toLowerCase();

  if (e.includes('tearing down') || e.includes('context was closed') || e.includes('target page, context or browser has been closed')) {
    return 'Automation Issue';
  }
  if (e.includes('waitforurl') || e.includes('page.waitforurl')) {
    return 'Automation Issue';
  }
  if (e.includes('locator.click') && e.includes('timeout')) {
    return 'Automation Issue';
  }
  if (t.includes('signup') || t.includes('new user') || t.includes('email verif') ||
      (t.includes('otp') && !t.includes('profile'))) {
    return 'External Dependency Issue';
  }
  if (e.includes('test timeout') && (t.includes('signup') || t.includes('mailinator') || t.includes('registration'))) {
    return 'External Dependency Issue';
  }
  if (e.includes('profile not found') ||
      (e.includes('tobevisible') && (t.includes('dashboard') || t.includes('sidebar') || t.includes('tag library')))) {
    return 'Environment Issue';
  }
  if (e.includes('tohaveurl') && (t.includes('login') || t.includes('auth') || t.includes('redirect'))) {
    return 'Environment Issue';
  }
  if (e.includes('tobelessthan') || (e.includes('received') && e.includes('expected') && e.includes('15000'))) {
    return 'Performance/SLA Issue';
  }
  if (e.includes('test timeout') && !t.includes('signup')) {
    return 'Automation Issue';
  }
  if (e.includes('tobetruthy') || e.includes('toequal') || e.includes('tohavetext') || e.includes('tohavecount')) {
    return 'Product Bug';
  }
  if (e.includes('tobevisible')) {
    return 'Product Bug';
  }
  if (e.includes('tohaveurl')) {
    return 'Product Bug';
  }
  return 'Product Bug';
}

function deriveRootCause(errorMsg: string, failureClass: FailureClass, title: string): string {
  const e = (errorMsg || '').toLowerCase();
  switch (failureClass) {
    case 'Automation Issue':
      if (e.includes('tearing down'))
        return 'Playwright context teardown timeout. SPA WebSocket connections prevent fast cleanup. Fix: increase playwright.config.ts timeout to 120000ms.';
      if (e.includes('waitforurl'))
        return 'gotoApp() waitForURL() fails on SPA navigation. SPA may redirect through intermediate URLs. Fix: use waitForFunction(() => !pathname.startsWith("/login")).';
      if (e.includes('locator.click'))
        return 'CSS wildcard selector too broad or element not in DOM at time of click. Fix: use specific data-testid or aria-label selectors.';
      return 'Test infrastructure / selector issue. Investigate locator strategy and timeouts.';
    case 'External Dependency Issue':
      return 'Mailinator public inbox rate-limited, delayed, or blocked. Fix: use dedicated test email domain or mock OTP in CI.';
    case 'Environment Issue':
      return 'Auth session in auth-state.json is invalid, expired, or workspace registration not completed. Fix: delete auth-state.json and regenerate.';
    case 'Performance/SLA Issue':
      return `Page load/response time exceeded SLA threshold. Investigate server performance at ${process.env.BASE_URL || 'devextension.synctag.com'}.`;
    case 'Product Bug':
      return `Expected UI element or behavior not present in test: "${title}". Likely a product defect.`;
    default:
      return 'Unknown root cause. Manual investigation required.';
  }
}

function deriveQARecommendation(failureClass: FailureClass): string {
  switch (failureClass) {
    case 'Automation Issue':
      return 'Fix test infrastructure — no JIRA product bug needed. This is a test code issue, not a product defect.';
    case 'External Dependency Issue':
      return 'Use mock/stub for Mailinator OTP in CI. Log as external dependency risk, not a product bug.';
    case 'Environment Issue':
      return 'Verify auth-state.json is fresh (< 30 min). Re-run auth setup: delete auth-state.json then npx playwright test tests/setup/. Not a product bug.';
    case 'Performance/SLA Issue':
      return 'Log as performance issue. Investigate with APM tools. Set baseline and regression threshold alerts.';
    case 'Product Bug':
      return 'Raise JIRA bug ticket. Assign to dev team for investigation. Block release if severity is Critical or Major.';
    case 'Test Data Issue':
      return 'Refresh test data. Not a product bug — re-run with clean test data after refreshing.';
  }
}

function derivePriority(
  annotations: Array<{ type: string; description?: string }>,
  failureClass: FailureClass,
  retry: number,
): string {
  const explicit = annotations.find(a => a.type === 'priority')?.description;
  if (explicit) return explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase();
  if (failureClass === 'Product Bug' && retry > 1) return 'Critical';
  if (failureClass === 'Product Bug') return 'High';
  if (failureClass === 'Performance/SLA Issue') return 'Medium';
  return 'Low';
}

function deriveSeverity(failureClass: FailureClass, retry: number): string {
  if (failureClass === 'Product Bug') return retry > 1 ? 'Critical' : 'Major';
  if (failureClass === 'Performance/SLA Issue') return 'Minor';
  return 'Trivial';
}

function normalizeReason(error: string, failureClass: string): string {
  const e = (error || '').toLowerCase();
  if (e.includes('tearing down'))                                    return 'SPA WebSocket teardown (>120s context cleanup)';
  if (e.includes('waitforurl') || e.includes('page.waitforurl'))    return 'waitForURL timeout on SPA navigation';
  if (e.includes('locator.click') && e.includes('timeout'))         return 'Element click timeout (selector mismatch)';
  if (e.includes('tobevisible') && e.includes('timeout'))           return 'Element not visible (auth/session issue)';
  if (e.includes('tobetruthy'))                                      return 'Assertion failed — feature not working';
  if (e.includes('tohaveurl'))                                       return 'URL mismatch after navigation';
  if (failureClass === 'External Dependency Issue')                  return 'Mailinator OTP email delay/timeout';
  if (e.includes('test timeout'))                                    return 'Overall test timeout exceeded';
  return failureClass + ' — other';
}

// ─── Reporter class ───────────────────────────────────────────────────────────

class JiraBugReporter implements Reporter {
  // Dedup: map test.id → last failure record (retry overwrites earlier attempts)
  private readonly bugMap = new Map<string, BugRecord>();
  private readonly outDir: string;
  private beginTime: Date = new Date();

  constructor(options: Record<string, string> = {}) {
    this.outDir = options['outputDir'] || 'reports/jira';
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.beginTime = new Date();
    fs.mkdirSync(this.outDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') return;

    const titlePath  = test.titlePath();
    const module     = titlePath[2] || titlePath[1] || 'Unknown';
    const suite      = titlePath.slice(2, -1).join(' › ') || module;
    const file       = titlePath[1] || '';
    const env        = process.env.BASE_URL || 'https://devextension.synctag.com';
    const testCaseId = (/^(SM-\d+|[A-Z]+-\d+)/.exec(test.title)?.[1] ?? '').trim();

    const sanitize = (s = '') =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let screenshotPath: string | null = null;
    let screenshot:     string | null = null;
    let videoPath:      string | null = null;
    let tracePath:      string | null = null;

    for (const att of result.attachments) {
      if (!screenshotPath && att.name === 'screenshot' && att.path) {
        screenshotPath = att.path;
        if (fs.existsSync(att.path)) {
          screenshot = `data:${att.contentType};base64,${fs.readFileSync(att.path).toString('base64')}`;
        }
      }
      if (!videoPath && att.name === 'video' && att.path) videoPath = att.path;
      if (!tracePath && att.name === 'trace' && att.path) tracePath = att.path;
    }

    const errorMsg    = result.error?.message || 'Test failed';
    const failClass   = classifyFailure(errorMsg, test.title);
    const priority    = derivePriority(test.annotations, failClass, result.retry);
    const severity    = deriveSeverity(failClass, result.retry);

    // Last retry always overwrites — most recent failure has the most useful screenshot/stack
    this.bugMap.set(test.id, {
      jiraKey:          '',   // assigned in onEnd after sorting
      title:            test.title,
      testCaseId,
      suite,
      module,
      file,
      error:            sanitize(errorMsg),
      errorStack:       sanitize(result.error?.stack || ''),
      screenshot,
      screenshotPath,
      videoPath,
      tracePath,
      duration:         result.duration,
      retry:            result.retry,
      startTime:        result.startTime.toISOString(),
      priority,
      severity,
      failureClass:     failClass,
      rootCause:        deriveRootCause(errorMsg, failClass, test.title),
      qaRecommendation: deriveQARecommendation(failClass),
      reproducibility:  result.retry > 1 ? 'Always' : result.retry === 1 ? 'Intermittent' : 'Once (not yet retried)',
      annotations:      test.annotations,
      env,
      browser:          'Chromium / Firefox / WebKit',
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    const bugs = Array.from(this.bugMap.values());

    if (bugs.length === 0) {
      console.log('\n✅  No failures — JIRA bug report not generated.\n');
      return;
    }

    // Sort: Product Bugs first (highest priority for JIRA), then by module, then title
    const classOrder: FailureClass[] = [
      'Product Bug', 'Environment Issue', 'Performance/SLA Issue',
      'External Dependency Issue', 'Automation Issue', 'Test Data Issue',
    ];
    bugs.sort((a, b) => {
      const ca = classOrder.indexOf(a.failureClass);
      const cb = classOrder.indexOf(b.failureClass);
      if (ca !== cb) return ca - cb;
      if (a.module !== b.module) return a.module.localeCompare(b.module);
      return a.title.localeCompare(b.title);
    });

    bugs.forEach((bug, i) => { bug.jiraKey = `SYNCTAG-BUG-${String(i + 1).padStart(3, '0')}`; });

    this.writeJSON(bugs);
    this.writeHTML(bugs);

    const productCount = bugs.filter(b => b.failureClass === 'Product Bug').length;
    const autoCount    = bugs.filter(b => b.failureClass === 'Automation Issue').length;
    const envCount     = bugs.filter(b => b.failureClass === 'Environment Issue').length;
    const extCount     = bugs.filter(b => b.failureClass === 'External Dependency Issue').length;

    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║  🐛  JIRA Bug Report  (${bugs.length} unique failure${bugs.length === 1 ? '' : 's'} after dedup)`);
    console.log(`║  Product Bugs: ${productCount}  |  Automation: ${autoCount}  |  Environment: ${envCount}  |  External: ${extCount}`);
    console.log(`║  JSON → ${path.join(this.outDir, 'bugs.json')}`);
    console.log(`║  HTML → ${path.join(this.outDir, 'bugs.html')}`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
  }

  printsToStdio(): boolean { return false; }

  // ─── JSON ─────────────────────────────────────────────────────────────────

  private writeJSON(bugs: BugRecord[]): void {
    const runDate     = this.beginTime.toISOString();
    const productBugs = bugs.filter(b => b.failureClass === 'Product Bug');

    const summary = {
      generatedAt:       runDate,
      totalUniqueAfterDedup: bugs.length,
      productBugs:       productBugs.length,
      automationIssues:  bugs.filter(b => b.failureClass === 'Automation Issue').length,
      environmentIssues: bugs.filter(b => b.failureClass === 'Environment Issue').length,
      externalDeps:      bugs.filter(b => b.failureClass === 'External Dependency Issue').length,
      performanceSLA:    bugs.filter(b => b.failureClass === 'Performance/SLA Issue').length,
      releaseStatus:     productBugs.some(b => b.priority === 'Critical' || b.priority === 'High')
        ? 'NOT READY — Critical/High product bugs exist'
        : productBugs.length > 0 ? 'CONDITIONAL — Medium/Low bugs present' : 'READY',
      note: 'Only "Product Bug" items need JIRA tickets. Automation/Environment/External issues are infra concerns.',
    };

    const issues = bugs.map(bug => ({
      fields: {
        project:     { key: 'SYNCTAG' },
        summary:     `[${bug.failureClass === 'Product Bug' ? 'BUG' : bug.failureClass.split(' ')[0].toUpperCase()}] ${bug.testCaseId || bug.jiraKey}: ${bug.title}`,
        issuetype:   { name: bug.failureClass === 'Product Bug' ? 'Bug' : 'Task' },
        priority:    { name: bug.priority },
        labels: [
          'automated-test', 'playwright', 'smoke-regression',
          bug.failureClass.toLowerCase().replace(/[\s/]+/g, '-'),
          bug.module.toLowerCase().replace(/\s+/g, '-'),
        ],
        environment: `URL: ${bug.env}\nBrowser: ${bug.browser}\nRun Date: ${runDate}\nFile: ${bug.file}`,
        description: {
          type: 'doc', version: 1,
          content: [
            this.adfHeading('Test Information', 3),
            this.adfTable([
              ['Field',                 'Value'],
              ['Test Case ID',          bug.testCaseId || bug.jiraKey],
              ['Test Name',             bug.title],
              ['Module',                bug.module],
              ['Suite',                 bug.suite],
              ['Failure Classification',bug.failureClass],
              ['Severity',              bug.severity],
              ['Priority',              bug.priority],
              ['Reproducibility',       bug.reproducibility],
              ['Retry Count',           String(bug.retry)],
              ['Duration',              this.fmtMs(bug.duration)],
              ['Run Time',              new Date(bug.startTime).toLocaleString('en-IN')],
              ['Environment',           bug.env],
              ['Browser',               bug.browser],
              ['File',                  bug.file],
            ]),
            this.adfHeading('Preconditions', 3),
            this.adfBulletList([
              'User logged in as synctagfreetest@mailinator.com',
              'Application accessible at ' + bug.env,
              'Auth session valid (auth-state.json generated within last 30 minutes)',
            ]),
            this.adfHeading('Steps to Reproduce', 3),
            this.adfOrderedList([
              `Open browser, navigate to ${bug.env}`,
              'Log in as synctagfreetest@mailinator.com',
              `Execute automated test: "${bug.title}"`,
              'Observe the test failure in reporter output',
            ]),
            this.adfHeading('Expected Result', 3),
            this.adfParagraph('Test completes successfully with all assertions passing.'),
            this.adfHeading('Actual Result', 3),
            this.adfParagraph(this.deHtml(bug.error) || 'Test failed or timed out.'),
            ...(bug.errorStack ? [
              this.adfHeading('Error Message & Stack Trace', 3),
              this.adfCodeBlock(this.deHtml(bug.errorStack)),
            ] : []),
            this.adfHeading('Root Cause Analysis', 3),
            this.adfParagraph(bug.rootCause),
            this.adfHeading('QA Recommendation', 3),
            this.adfParagraph(bug.qaRecommendation),
            this.adfHeading('Attachments', 3),
            this.adfBulletList([
              bug.screenshotPath ? `Screenshot: ${bug.screenshotPath}` : 'Screenshot: Not captured',
              bug.videoPath      ? `Video: ${bug.videoPath}`           : 'Video: Not captured',
              bug.tracePath      ? `Trace: ${bug.tracePath}`           : 'Trace: Not captured',
            ]),
          ],
        },
      },
      _meta: {
        jiraKey:          bug.jiraKey,
        testCaseId:       bug.testCaseId,
        failureClass:     bug.failureClass,
        shouldCreateJira: bug.failureClass === 'Product Bug',
        screenshotPath:   bug.screenshotPath,
        videoPath:        bug.videoPath,
        tracePath:        bug.tracePath,
      },
    }));

    fs.writeFileSync(
      path.join(this.outDir, 'bugs.json'),
      JSON.stringify({ summary, issues }, null, 2),
      'utf-8',
    );
  }

  // ─── HTML ─────────────────────────────────────────────────────────────────

  private writeHTML(bugs: BugRecord[]): void {
    const runDate = this.beginTime.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'long', timeStyle: 'medium',
    });
    const env = process.env.BASE_URL || 'https://devextension.synctag.com';

    const productBugs = bugs.filter(b => b.failureClass === 'Product Bug');
    const autoIssues  = bugs.filter(b => b.failureClass === 'Automation Issue');
    const envIssues   = bugs.filter(b => b.failureClass === 'Environment Issue');
    const extIssues   = bugs.filter(b => b.failureClass === 'External Dependency Issue');
    const perfIssues  = bugs.filter(b => b.failureClass === 'Performance/SLA Issue');

    const criticalHigh = productBugs.filter(b => b.priority === 'Critical' || b.priority === 'High').length;
    const releaseReady = criticalHigh === 0;
    const releaseLabel = releaseReady
      ? (productBugs.length === 0 ? '✓ READY FOR RELEASE' : `✓ CONDITIONAL — ${productBugs.length} Low/Medium bug${productBugs.length !== 1 ? 's' : ''}`)
      : `✗ NOT READY — ${criticalHigh} Critical/High bug${criticalHigh !== 1 ? 's' : ''}`;

    // ── Top failure reasons ──────────────────────────────────────────────────
    const reasonMap = new Map<string, { count: number; cls: string }>();
    for (const bug of bugs) {
      const r = normalizeReason(bug.error, bug.failureClass);
      const prev = reasonMap.get(r);
      if (prev) prev.count++;
      else reasonMap.set(r, { count: 1, cls: bug.failureClass });
    }
    const topReasons = [...reasonMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6);
    const maxReasonCount = topReasons[0]?.[1]?.count || 1;
    const clsBarColor: Record<string, string> = {
      'Product Bug':                '#DE350B',
      'Automation Issue':           '#0052CC',
      'Environment Issue':          '#FF8B00',
      'External Dependency Issue':  '#00875A',
      'Performance/SLA Issue':      '#6554C0',
      'Test Data Issue':            '#00B8D9',
    };

    const reasonRows = topReasons.map(([reason, { count, cls }], i) => {
      const pct = Math.round((count / maxReasonCount) * 100);
      return `<div class="fr-item">
          <span class="fr-rank">#${i + 1}</span>
          <span class="fr-label">${reason}</span>
          <div class="fr-bar-wrap"><div class="fr-bar" style="width:${pct}%;background:${clsBarColor[cls] || '#DFE1E6'}"></div></div>
          <span class="fr-count">${count}×</span>
        </div>`;
    }).join('');

    // ── Bug cards ────────────────────────────────────────────────────────────
    const cards = bugs.map((bug, idx) => {
      const classBgMap: Record<string, string> = {
        'Product Bug':                '#FFEBE6',
        'Automation Issue':           '#DEEBFF',
        'Environment Issue':          '#FFFAE6',
        'External Dependency Issue':  '#E3FCEF',
        'Performance/SLA Issue':      '#EAE6FF',
        'Test Data Issue':            '#E6FCFF',
      };
      const classTxtMap: Record<string, string> = {
        'Product Bug':                '#BF2600',
        'Automation Issue':           '#0747A6',
        'Environment Issue':          '#FF8B00',
        'External Dependency Issue':  '#006644',
        'Performance/SLA Issue':      '#403294',
        'Test Data Issue':            '#006B7E',
      };
      const classBg  = classBgMap[bug.failureClass]  || '#F4F5F7';
      const classTxt = classTxtMap[bug.failureClass] || '#172B4D';
      const isProduct = bug.failureClass === 'Product Bug';

      const screenshotBlock = bug.screenshot
        ? `<div class="jira-section">
             <div class="jira-section-label">📸 Screenshot Evidence</div>
             <img src="${bug.screenshot}" class="bug-screenshot" onclick="zoom(this.src)" alt="failure screenshot"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
             <div class="no-att-box" style="display:none">📷 Screenshot failed to load</div>
             <div class="screenshot-tip">🔍 Click to enlarge</div>
           </div>`
        : `<div class="jira-section">
             <div class="jira-section-label">📸 Screenshot Evidence</div>
             <div class="no-att-box">
               <div style="font-size:28px;margin-bottom:6px">📷</div>
               <div style="font-size:12px;color:#6B778C">No screenshot captured</div>
               <div style="font-size:11px;color:#97A0AF;margin-top:3px">Not available for this failure type</div>
             </div>
           </div>`;

      const stackBlock = bug.errorStack
        ? `<details class="stack-details">
             <summary>Stack Trace ▼</summary>
             <pre class="stack-pre">${bug.errorStack}</pre>
           </details>`
        : '';

      return `
      <div class="bug-card${isProduct ? ' product-bug' : ''}" data-class="${bug.failureClass}">
        <div class="card-header">
          <div class="card-header-left">
            <span class="bug-key">🐛 ${bug.jiraKey}</span>
            ${bug.testCaseId ? `<span class="test-id-badge">${bug.testCaseId}</span>` : ''}
            <span class="bug-type">${isProduct ? 'Bug' : 'Task'}</span>
          </div>
          <div class="card-header-right">
            <span class="class-badge" style="background:${classBg};color:${classTxt}">${bug.failureClass}</span>
            <span class="priority-badge priority-${bug.priority.toLowerCase()}">${bug.priority}</span>
            <span class="severity-badge">${bug.severity}</span>
            <span class="status-badge">${isProduct ? 'Open' : 'Infra'}</span>
          </div>
        </div>

        <div class="bug-summary">${bug.title}</div>

        <div class="bug-meta">
          <span>📦 ${bug.module}</span>
          <span>🔬 ${bug.suite}</span>
          <span>⏱ ${this.fmtMs(bug.duration)}</span>
          <span>🔄 Retries: ${bug.retry}</span>
          <span>♻️ ${bug.reproducibility}</span>
          <span>📅 ${new Date(bug.startTime).toLocaleString('en-IN')}</span>
        </div>

        <div class="card-body">
          <div class="card-left">
            <div class="jira-section">
              <div class="jira-section-label">📋 Preconditions</div>
              <ul class="steps-list">
                <li>User logged in as <code>synctagfreetest@mailinator.com</code></li>
                <li>App accessible at <code>${bug.env}</code></li>
                <li>Auth session valid (auth-state.json &lt; 30 min old)</li>
              </ul>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">🔬 Steps to Reproduce</div>
              <ol class="steps-list">
                <li>Navigate to <code>${bug.env}</code></li>
                <li>Log in with test account</li>
                <li>Execute: <strong>${bug.title}</strong></li>
                <li>Observe the failure</li>
              </ol>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">✅ Expected Result</div>
              <div class="result-box expected">Test passes with all assertions satisfied.</div>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">❌ Actual Result</div>
              <div class="result-box actual">${bug.error}</div>
            </div>

            ${stackBlock}

            <div class="jira-section">
              <div class="jira-section-label">🔍 Root Cause Analysis</div>
              <div class="root-cause-box">${bug.rootCause}</div>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">💡 QA Recommendation</div>
              <div class="recommendation-box ${isProduct ? 'rec-bug' : 'rec-infra'}">${bug.qaRecommendation}</div>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">🔗 Attachments</div>
              <div class="attachment-row">
                ${bug.videoPath ? `<a href="${bug.videoPath}" target="_blank" class="att-link">🎬 Video</a>` : '<span class="no-att-sm">No video</span>'}
                ${bug.tracePath ? `<a href="${bug.tracePath}" target="_blank" class="att-link">🔍 Trace</a>` : '<span class="no-att-sm">No trace</span>'}
              </div>
            </div>

            <div class="jira-section">
              <div class="jira-section-label">🌐 Environment</div>
              <table class="env-table">
                <tr><td>URL</td><td><code>${bug.env}</code></td></tr>
                <tr><td>Browser</td><td>${bug.browser}</td></tr>
                <tr><td>Test Case ID</td><td>${bug.testCaseId || '—'}</td></tr>
                <tr><td>Severity</td><td>${bug.severity}</td></tr>
                <tr><td>File</td><td>${bug.file}</td></tr>
                <tr><td>Run Date</td><td>${new Date(bug.startTime).toLocaleString('en-IN')}</td></tr>
              </table>
            </div>
          </div>

          <div class="card-right">
            ${screenshotBlock}
          </div>
        </div>

        <div class="card-footer">
          <button class="jira-btn" onclick="copyKey('${bug.jiraKey}')">📋 Copy Key</button>
          <button class="jira-btn" onclick="exportOne(${idx})">⬇️ Export JSON</button>
          ${isProduct
            ? '<span class="jira-ready-badge">✓ JIRA-Ready</span>'
            : '<span class="infra-badge">⚙️ Infra Issue</span>'}
          <span class="card-footer-meta">Project: SYNCTAG &nbsp;|&nbsp; Automated QA</span>
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
:root{--bg:#F4F5F7;--surface:#FFFFFF;--primary:#0052CC;--fail:#DE350B;--pass:#00875A;--border:#DFE1E6;--text:#172B4D;--muted:#6B778C;--shadow:0 1px 3px rgba(9,30,66,.12),0 0 0 1px rgba(9,30,66,.08)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);font-size:14px}

.jira-header{background:#0052CC;color:#fff;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.jira-header h1{font-size:18px;font-weight:700}
.jira-header .meta{font-size:12px;opacity:.85;text-align:right;line-height:1.9}

.summary-bar{background:var(--surface);padding:14px 32px;border-bottom:1px solid var(--border);display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
.sum-section{display:flex;flex-direction:column;gap:6px}
.sum-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--muted)}
.sum-pills{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.sp{display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px solid}
.sp-total{background:#172B4D;color:#fff;border-color:#172B4D}
.sp-bug{background:#FFEBE6;color:#BF2600;border-color:#DE350B}
.sp-auto{background:#DEEBFF;color:#0747A6;border-color:#0052CC}
.sp-env{background:#FFFAE6;color:#FF8B00;border-color:#FF8B00}
.sp-ext{background:#E3FCEF;color:#006644;border-color:#00875A}
.sp-perf{background:#EAE6FF;color:#403294;border-color:#6554C0}
.release-badge{padding:9px 18px;border-radius:6px;font-size:14px;font-weight:800;letter-spacing:.4px;white-space:nowrap}
.release-ok{background:#E3FCEF;color:#006644;border:2px solid #00875A}
.release-no{background:#FFEBE6;color:#BF2600;border:2px solid #DE350B}
.release-cond{background:#FFFAE6;color:#FF8B00;border:2px solid #FF8B00}

.failure-reasons{background:var(--surface);padding:12px 32px 14px;border-bottom:2px solid var(--border)}
.fr-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-bottom:8px}
.fr-list{display:flex;flex-direction:column;gap:5px}
.fr-item{display:flex;align-items:center;gap:10px;font-size:12px}
.fr-rank{font-size:11px;font-weight:800;color:var(--muted);min-width:22px}
.fr-label{min-width:280px;color:var(--text)}
.fr-bar-wrap{flex:1;height:8px;background:#F4F5F7;border-radius:4px;overflow:hidden}
.fr-bar{height:100%;border-radius:4px;transition:width .4s}
.fr-count{font-weight:700;color:var(--muted);min-width:28px;text-align:right}

.toolbar{background:var(--surface);padding:10px 32px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sev-row{font-size:12px;color:var(--muted)}
.filter-btns{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
.filter-btn{padding:4px 12px;border:1.5px solid var(--border);border-radius:12px;background:transparent;font-size:11px;font-weight:600;cursor:pointer;color:var(--muted);transition:all .15s}
.filter-btn.active,.filter-btn:hover{border-color:#0052CC;background:#DEEBFF;color:#0052CC}
.export-btn{padding:7px 18px;background:#0052CC;color:#fff;border:none;border-radius:3px;font-size:12px;font-weight:600;cursor:pointer}
.export-btn:hover{background:#0747A6}

.bugs-container{padding:24px 32px;max-width:1440px;margin:0 auto}
.bugs-grid{display:grid;grid-template-columns:1fr;gap:20px}

.bug-card{background:var(--surface);border-radius:4px;box-shadow:var(--shadow);overflow:hidden}
.bug-card.product-bug{border-left:4px solid #DE350B}
.card-header{background:#F4F5F7;padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.card-header-left{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.card-header-right{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.bug-key{font-size:12px;font-weight:800;color:#0052CC}
.test-id-badge{background:#DEEBFF;color:#0747A6;font-size:10px;font-weight:700;padding:2px 7px;border-radius:3px;font-family:monospace}
.bug-type{background:#DEEBFF;color:#0747A6;font-size:10px;font-weight:700;padding:2px 7px;border-radius:3px;text-transform:uppercase}
.class-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.3px}
.priority-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;text-transform:uppercase}
.priority-critical,.priority-high{background:#FFEBE6;color:#DE350B}
.priority-medium{background:#FFFAE6;color:#FF8B00}
.priority-low{background:#E3FCEF;color:#006644}
.severity-badge{font-size:10px;color:var(--muted);padding:2px 8px;border:1px solid var(--border);border-radius:3px}
.status-badge{background:#DEEBFF;color:#0747A6;font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px}

.bug-summary{padding:14px 16px 8px;font-size:15px;font-weight:700;color:#172B4D;line-height:1.4}
.bug-meta{padding:0 16px 12px;display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)}

.card-body{display:flex}
.card-left{flex:1;padding:16px;border-right:1px solid var(--border)}
.card-right{flex:0 0 320px;padding:16px;background:#FAFBFC}

.jira-section{margin-bottom:14px}
.jira-section-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin-bottom:5px}
.steps-list{padding-left:18px;font-size:13px;line-height:1.9}
.steps-list code{background:#F4F5F7;padding:1px 5px;border-radius:3px;font-size:11px}
.result-box{font-size:13px;padding:10px 12px;border-radius:3px;line-height:1.6}
.result-box.expected{background:#E3FCEF;color:#006644;border-left:3px solid #00875A}
.result-box.actual{background:#FFEBE6;color:#BF2600;border-left:3px solid #DE350B}
.root-cause-box{font-size:12px;padding:10px 12px;background:#F4F5F7;border-radius:3px;border-left:3px solid #B3BAC5;line-height:1.6;color:#344563}
.recommendation-box{font-size:12px;padding:10px 12px;border-radius:3px;line-height:1.6}
.rec-bug{background:#FFEBE6;border-left:3px solid #DE350B;color:#BF2600}
.rec-infra{background:#E3FCEF;border-left:3px solid #00875A;color:#006644}

.stack-details{margin-top:10px}
.stack-details summary{font-size:12px;font-weight:600;color:#BF2600;cursor:pointer}
.stack-pre{font-size:11px;background:#1C1C1E;color:#FF7262;padding:12px;border-radius:4px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;margin-top:8px;line-height:1.5;max-height:200px;overflow-y:auto}

.attachment-row{display:flex;gap:8px;flex-wrap:wrap}
.att-link{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:#0052CC;text-decoration:none;background:#DEEBFF;padding:4px 10px;border-radius:3px}
.att-link:hover{background:#B3D4FF}
.no-att-sm{font-size:12px;color:#C1C7D0}

.env-table{width:100%;font-size:12px;border-collapse:collapse}
.env-table td{padding:4px 8px;border-bottom:1px solid var(--border)}
.env-table td:first-child{color:var(--muted);width:110px;font-weight:600}

.bug-screenshot{width:100%;border-radius:3px;cursor:zoom-in;border:1px solid var(--border);display:block}
.screenshot-tip{font-size:10px;color:var(--muted);text-align:center;margin-top:4px}
.no-att-box{min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#F4F5F7;border-radius:3px;border:2px dashed var(--border);padding:16px}

.card-footer{padding:10px 16px;background:#F4F5F7;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.jira-btn{padding:5px 12px;border:1px solid var(--border);border-radius:3px;background:var(--surface);font-size:12px;font-weight:600;cursor:pointer;color:#344563;transition:background .1s}
.jira-btn:hover{background:#DEEBFF;border-color:#0052CC;color:#0052CC}
.jira-ready-badge{background:#E3FCEF;color:#006644;font-size:11px;font-weight:700;padding:3px 10px;border-radius:3px;border:1px solid #00875A}
.infra-badge{background:#DEEBFF;color:#0052CC;font-size:11px;font-weight:700;padding:3px 10px;border-radius:3px;border:1px solid #0052CC}
.card-footer-meta{margin-left:auto;font-size:11px;color:var(--muted)}

.lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.87);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out}
.lightbox.open{display:flex}
.lightbox img{max-width:90vw;max-height:90vh;border-radius:4px}

.jira-footer{text-align:center;padding:24px;font-size:11px;color:var(--muted);border-top:1px solid var(--border)}
</style>
</head>
<body>

<div class="jira-header">
  <div>
    <h1>🐛 JIRA Bug Report — Synctag</h1>
    <div style="font-size:12px;opacity:.8;margin-top:4px">Playwright Smoke Suite · Automated failure analysis</div>
  </div>
  <div class="meta">
    <div>📅 ${runDate}</div>
    <div>🌐 ${env}</div>
    <div>Project: <strong>SYNCTAG</strong></div>
  </div>
</div>

<!-- Classification summary -->
<div class="summary-bar">
  <div class="sum-section">
    <div class="sum-title">Failure Classification (${bugs.length} unique failures after dedup)</div>
    <div class="sum-pills">
      <span class="sp sp-total">📊 Total: ${bugs.length}</span>
      <span class="sp sp-bug">🐛 Product Bugs: ${productBugs.length}</span>
      <span class="sp sp-auto">⚙️ Automation: ${autoIssues.length}</span>
      <span class="sp sp-env">🔑 Environment: ${envIssues.length}</span>
      <span class="sp sp-ext">📧 External Dep: ${extIssues.length}</span>
      ${perfIssues.length > 0 ? `<span class="sp sp-perf">⚡ Performance: ${perfIssues.length}</span>` : ''}
    </div>
  </div>
  <div class="sum-section" style="margin-left:auto;align-items:flex-end">
    <div class="sum-title">Release Status</div>
    <div class="release-badge ${releaseReady ? (productBugs.length === 0 ? 'release-ok' : 'release-cond') : 'release-no'}">${releaseLabel}</div>
  </div>
</div>

<!-- Top failure reasons -->
<div class="failure-reasons">
  <div class="fr-title">🏆 Top Failure Reasons</div>
  <div class="fr-list">${reasonRows}</div>
</div>

<!-- Severity / Priority row + filter -->
<div class="toolbar">
  <div class="sev-row">
    🔴 Critical: ${bugs.filter(b => b.priority === 'Critical').length} &nbsp;|&nbsp;
    🟠 High: ${bugs.filter(b => b.priority === 'High').length} &nbsp;|&nbsp;
    🟡 Medium: ${bugs.filter(b => b.priority === 'Medium').length} &nbsp;|&nbsp;
    🟢 Low: ${bugs.filter(b => b.priority === 'Low').length}
  </div>
  <div class="filter-btns">
    <button class="filter-btn active" onclick="filterCards('all',this)">All (${bugs.length})</button>
    <button class="filter-btn" onclick="filterCards('Product Bug',this)">🐛 Bugs (${productBugs.length})</button>
    <button class="filter-btn" onclick="filterCards('Automation Issue',this)">⚙️ Automation (${autoIssues.length})</button>
    <button class="filter-btn" onclick="filterCards('Environment Issue',this)">🔑 Env (${envIssues.length})</button>
    <button class="filter-btn" onclick="filterCards('External Dependency Issue',this)">📧 External (${extIssues.length})</button>
  </div>
  <button class="export-btn" onclick="exportAll()">⬇️ Export All JSON</button>
</div>

<div class="bugs-container">
  <div class="bugs-grid" id="bugs-grid">
    ${cards}
  </div>
</div>

<div class="lightbox" id="lb" onclick="document.getElementById('lb').classList.remove('open')">
  <img id="lbImg" src="" alt="screenshot" onclick="event.stopPropagation()" />
</div>

<div class="jira-footer">
  Generated by Synctag JIRA Bug Reporter &nbsp;|&nbsp; Playwright TypeScript &nbsp;|&nbsp; ${runDate}
  <br><small style="color:#97A0AF">Only "Product Bug" items need JIRA tickets. Automation / Environment / External items are test infrastructure concerns.</small>
</div>

<script>
const bugsData = ${JSON.stringify(bugs.map((b, i) => ({
  idx: i,
  jiraKey: b.jiraKey,
  title: b.title,
  testCaseId: b.testCaseId,
  module: b.module,
  failureClass: b.failureClass,
  priority: b.priority,
  severity: b.severity,
  error: b.error,
  rootCause: b.rootCause,
  qaRecommendation: b.qaRecommendation,
  screenshotPath: b.screenshotPath,
  videoPath: b.videoPath,
  tracePath: b.tracePath,
}))
)};

function zoom(src) {
  document.getElementById('lbImg').src = src;
  document.getElementById('lb').classList.add('open');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('lb').classList.remove('open'); });

function copyKey(key) {
  navigator.clipboard?.writeText(key).then(() => alert('Copied: ' + key));
}

function exportOne(idx) {
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

function filterCards(cls, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cards = document.querySelectorAll('#bugs-grid .bug-card');
  cards.forEach((card, i) => {
    const bug = bugsData[i];
    card.style.display = (cls === 'all' || bug?.failureClass === cls) ? '' : 'none';
  });
}
</script>
</body>
</html>`;

    fs.writeFileSync(path.join(this.outDir, 'bugs.html'), html, 'utf-8');
  }

  // ─── ADF helpers ──────────────────────────────────────────────────────────

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

  private deHtml(s: string): string {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
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
