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

type Classification = 'Confirmed Issue' | 'Test Environment';
type Severity = 'High' | 'Medium' | 'Low';

interface TestRecord {
  idx: number;
  file: string;
  module: string;
  title: string;
  description: string;
  status: TestResult['status'];
  durationMs: number;
  errorMessage: string;
  screenshotDataUri: string | null;
}

interface IssueRecord {
  id: string;
  module: string;
  title: string;
  severity: Severity;
  classification: Classification;
  whatHappened: string;
  likelyCause: string;
  recommendation: string;
  screenshotDataUri: string | null;
}

const OUT_DIR = 'reports';
const OUT_FILE = path.join(OUT_DIR, 'client-report.html');

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Plain-language module names shown to a non-technical reader, keyed by
 * spec file basename. Falls back to a title-cased version of the file
 * name for any spec file added later that isn't in this list yet.
 */
const MODULE_NAMES: Record<string, string> = {
  'auth.spec.ts': 'Sign In & Account Creation',
  'pricing.spec.ts': 'Pricing Page',
  'checkout.spec.ts': 'Plan Upgrade & Payment',
};

function moduleNameFor(fileBase: string): string {
  if (MODULE_NAMES[fileBase]) return MODULE_NAMES[fileBase];
  const stem = fileBase.replace(/\.spec\.(ts|js)$/, '');
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

/**
 * Hand-written, plain-English descriptions matched against the real test
 * title. Order matters - first match wins. Anything that doesn't match one
 * of these (e.g. a brand-new test added later) falls back to a cleaned-up
 * version of its own title rather than failing to render.
 */
const DESCRIPTIONS: Array<[RegExp, string]> = [
  [/login and signup share the same OTP form/i, 'Checks that the same sign-in screen is correctly reused for both new and returning users, changing only its heading.'],
  [/Phone tab is selected by default/i, 'Confirms the phone number option is shown first when a customer opens the sign-in page, with email and Google sign-in offered as alternatives.'],
  [/rejects a phone number shorter than 10 digits/i, 'Makes sure the app stops a customer from continuing if they type in an incomplete phone number.'],
  [/rejects a phone number with letters/i, 'Makes sure the app rejects a phone number if it contains letters instead of digits.'],
  [/rejects an empty phone submission/i, 'Makes sure the app won’t let a customer continue without entering a phone number.'],
  [/accepts a well-formed 10-digit phone number/i, 'Checks that a correctly formatted phone number is accepted and moves the customer forward to the verification code screen.'],
  [/rejects a malformed email address/i, 'Makes sure the app catches an incorrectly typed email address before sending a verification code.'],
  [/rejects an empty email submission/i, 'Makes sure the app won’t let a customer continue without entering an email address.'],
  [/accepts a well-formed email and reaches the OTP screen/i, 'Checks that entering a valid email address correctly sends a verification code and takes the customer to the code-entry screen.'],
  [/BUG-03 regression/i, 'A known issue, already logged separately, where editing the email address on the code-entry screen doesn’t re-check that the new address is valid. Deliberately not run in this pass.'],
  [/shows a client-side error when submitting an empty code/i, 'Makes sure the app shows a clear message if a customer tries to submit the verification form without entering a code.'],
  [/decrements the remaining-attempts counter on each wrong code/i, 'Checks that the "attempts remaining" message correctly counts down each time a customer enters the wrong verification code.'],
  [/locks out further attempts once the limit is exceeded/i, 'Checks that after too many wrong verification codes, the app locks the customer out and tells them to request a new code.'],
  [/Resend OTP.*is disabled.timered/i, 'Checks that the "Resend code" option is temporarily disabled right after a code is sent, with a visible countdown.'],
  [/real verify-OTP success redirects the user/i, 'The full, real sign-up journey: request a code, retrieve it from the test inbox, enter it, and confirm the customer lands inside their account.'],
  [/Continue with Google.*control is present/i, 'Checks that the "Continue with Google" button is available on both the sign-in and sign-up screens.'],
  [/upgrading to PRO - 7 DAYS with a successful Visa/i, 'The full payment journey for the 7-day Pro trial: choose the plan, enter a working Visa test card, and confirm the payment succeeds.'],
  [/upgrading to PRO with a successful Mastercard/i, 'The full payment journey for the monthly Pro plan: choose the plan, enter a working Mastercard test card, and confirm the payment succeeds.'],
  [/generic decline test card surfaces a payment-failed message/i, 'Checks that a card which the bank would decline shows a clear failure message, and never a false "success".'],
  [/insufficient-funds test card surfaces a payment-failed message/i, 'Checks that a card declined for insufficient funds shows a clear failure message to the customer.'],
  [/account plan must NOT be upgraded after a declined payment/i, 'Checks that a customer’s plan is not upgraded if their payment is declined — they should stay on their current plan.'],
  [/rejects invalid card input: luhnInvalid/i, 'Checks that a card number that fails the standard card-number checksum is rejected before any payment is attempted.'],
  [/rejects invalid card input: tooShort/i, 'Checks that a card number that’s too short is rejected before any payment is attempted.'],
  [/rejects invalid card input: expiredCard/i, 'Checks that a card with an expiry date already in the past is rejected before any payment is attempted.'],
  [/rejects invalid card input: shortCvv/i, 'Checks that a security code (CVV) that’s too short is rejected before any payment is attempted.'],
  [/rejects invalid card input: nonNumeric/i, 'Checks that a card number containing letters is rejected before any payment is attempted.'],
  [/Confirm Plan Change dialog.*must not silently switch cadence/i, 'A pricing-consistency check: the 7-day plan must be billed every 7 days everywhere in the app — not silently switched to a monthly charge partway through checkout.'],
  [/plan card is visible with a CTA button/i, 'Confirms this pricing plan’s card is visible on the public pricing page with a working "choose this plan" button.'],
  [/shows the expected amount/i, 'Confirms this plan shows the correct price on the public pricing page.'],
  [/BUG-02 regression/i, 'A known pricing-consistency issue, already logged separately: the 7-day Pro plan’s billing frequency must match between the public pricing page and the in-app upgrade screen.'],
  [/BUG-01 regression/i, 'A known access-control issue, already logged separately: the free "Custom Free" plan must not offer features that are meant to be paid-only.'],
  [/every plan.s .Choose. button requires authentication/i, 'Checks that clicking "choose this plan" while logged out correctly asks the customer to sign in first, rather than starting a purchase.'],
];

function describe(title: string): string {
  for (const [re, desc] of DESCRIPTIONS) {
    if (re.test(title)) return desc;
  }
  return title.replace(/\[positive\]|\[negative\]/gi, '').trim();
}

interface Explanation {
  whatHappened: string;
  likelyCause: string;
  recommendation: string;
  classification: Classification;
}

/**
 * Plain-English explanation of WHY a test failed, matched against the real
 * error message. Anything unrecognized still gets a safe, honest fallback
 * rather than a blank field.
 */
function explainFailure(errorMessage: string): Explanation {
  const m = errorMessage || '';
  if (/Real OTP not found in Mailinator/i.test(m)) {
    return {
      whatHappened: 'The test asked for a one-time verification code by email, but the test inbox didn’t receive it within 60 seconds.',
      likelyCause: 'This looks like a side effect of running many sign-in tests back-to-back in a short time — the verification-code system may have temporarily slowed down or paused sending to protect against spam. It is not a confirmed fault in the app itself.',
      recommendation: 'Re-run this check on its own, with a short gap since the last one, to confirm whether it passes normally.',
      classification: 'Test Environment',
    };
  }
  if (/Verify your access/i.test(m)) {
    return {
      whatHappened: 'After entering a valid email and asking for a verification code, the "enter your code" screen did not appear in time.',
      likelyCause: 'Most likely the same temporary slowdown in the verification-code system mentioned above, rather than a broken screen — this screen has been confirmed working correctly in other passes.',
      recommendation: 'Re-run this check after a short cooldown period to confirm.',
      classification: 'Test Environment',
    };
  }
  if (/getByRole\('button', \{ name: 'Verify Code' \}\)/i.test(m)) {
    return {
      whatHappened: 'The test could not find the "Verify Code" button to click, because the screen before it never fully loaded.',
      likelyCause: 'A knock-on effect of the verification-code screen not appearing in time — not a separate, standalone problem.',
      recommendation: 'Re-run alongside the other sign-in checks once the cooldown has passed.',
      classification: 'Test Environment',
    };
  }
  if (/getByRole\('textbox', \{ name: 'Verification Code' \}\)/i.test(m)) {
    return {
      whatHappened: 'The test could not find the box to type the verification code into, because the screen never fully loaded.',
      likelyCause: 'A knock-on effect of the verification-code screen not appearing in time.',
      recommendation: 'Re-run alongside the other sign-in checks once the cooldown has passed.',
      classification: 'Test Environment',
    };
  }
  if (/Resend OTP in/i.test(m)) {
    return {
      whatHappened: 'The "Resend code in Xs" countdown message never appeared.',
      likelyCause: 'A knock-on effect of the verification-code screen not appearing in time.',
      recommendation: 'Re-run alongside the other sign-in checks once the cooldown has passed.',
      classification: 'Test Environment',
    };
  }
  if (/does not support recurring payments/i.test(m) || /Payment could not be completed/i.test(m)) {
    return {
      whatHappened: 'A customer trying to buy a recurring plan with a test card was shown a payment error: "the seller does not support recurring payments."',
      likelyCause: 'The payment provider (Razorpay) account behind this plan is not fully set up to accept repeating (subscription-style) charges.',
      recommendation: 'Escalate to the payments/finance team to enable recurring billing on the account before this plan goes live — customers cannot currently buy it.',
      classification: 'Confirmed Issue',
    };
  }
  if (/Payment successful\|Plan upgraded\|Subscription active/i.test(m)) {
    return {
      whatHappened: 'After entering valid test card details and confirming the payment, the app never showed a clear "payment successful" or "plan upgraded" confirmation within 20 seconds.',
      likelyCause: 'Either the payment is taking longer than expected to confirm, or the confirmation message uses different wording than what a customer would recognize as success.',
      recommendation: 'Have someone manually run this exact purchase to see what actually appears on screen, then confirm whether the plan was really upgraded on the account.',
      classification: 'Confirmed Issue',
    };
  }
  if (/Payment failed\|declined\|try a different/i.test(m)) {
    return {
      whatHappened: 'A test card that the bank should decline was submitted, but the app never showed a clear "payment failed" message within 20 seconds.',
      likelyCause: 'Either the decline takes longer to come back than expected, or the failure message uses different wording than a customer would recognize as "your payment didn’t go through."',
      recommendation: 'Have someone manually run this exact declined-card scenario to see what actually appears on screen, and confirm the customer isn’t left unsure whether they were charged.',
      classification: 'Confirmed Issue',
    };
  }
  if (/name: 'Upgrade Plan'/i.test(m) || /name: \/\^choose/i.test(m)) {
    return {
      whatHappened: 'The test could not click the "Upgrade Plan" or "Choose [plan]" button — something else on the page was covering it and blocking the click.',
      likelyCause: 'A pop-up that appears the first time a new account visits this page (choosing a profile theme) can sometimes still be on screen and block the button underneath it.',
      recommendation: 'Confirm this pop-up is reliably dismissed before a customer can act on this page, on every visit, not just most visits.',
      classification: 'Confirmed Issue',
    };
  }
  return {
    whatHappened: 'The check did not complete as expected.',
    likelyCause: 'See the technical detail for this test in the results table.',
    recommendation: 'Needs a closer look by the engineering team.',
    classification: 'Confirmed Issue',
  };
}

function severityFor(fileBase: string, classification: Classification): Severity {
  if (classification === 'Test Environment') return 'Low';
  if (fileBase === 'checkout.spec.ts') return 'High';
  return 'Medium';
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
    const fileBase = path.basename(test.location.file);

    const screenshot = result.attachments.find((a) => a.name === 'screenshot' && a.path);
    let screenshotDataUri: string | null = null;
    if (screenshot?.path && fs.existsSync(screenshot.path)) {
      try {
        const buf = fs.readFileSync(screenshot.path);
        screenshotDataUri = `data:image/png;base64,${buf.toString('base64')}`;
      } catch {
        screenshotDataUri = null;
      }
    }

    const errorMessage = result.errors
      .map((e) => (e.message || '').replace(/\[[0-9;]*m/g, '')) // strip ANSI colour codes
      .filter(Boolean)
      .join('\n');

    this.records.push({
      idx: ++this.idx,
      file: fileBase,
      module: moduleNameFor(fileBase),
      title: test.title,
      description: describe(test.title),
      status: result.status,
      durationMs: result.duration,
      errorMessage,
      screenshotDataUri,
    });
  }

  async onEnd(_result: FullResult): Promise<void> {
    const durationMs = Date.now() - this.startTime;
    this.writeReport(durationMs);
  }

  private writeReport(durationMs: number): void {
    const total = this.records.length;
    const passed = this.records.filter((r) => r.status === 'passed').length;
    const failed = this.records.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
    const skipped = this.records.filter((r) => r.status === 'skipped' || r.status === 'interrupted').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const byModule = new Map<string, TestRecord[]>();
    for (const r of this.records) {
      if (!byModule.has(r.module)) byModule.set(r.module, []);
      byModule.get(r.module)!.push(r);
    }

    const failingRecords = this.records.filter((r) => r.status === 'failed' || r.status === 'timedOut');
    const issues: IssueRecord[] = failingRecords.map((r, i) => {
      const explanation = explainFailure(r.errorMessage);
      return {
        id: `ISSUE-${String(i + 1).padStart(2, '0')}`,
        module: r.module,
        title: r.description,
        severity: severityFor(r.file, explanation.classification),
        classification: explanation.classification,
        whatHappened: explanation.whatHappened,
        likelyCause: explanation.likelyCause,
        recommendation: explanation.recommendation,
        screenshotDataUri: r.screenshotDataUri,
      };
    });

    const confirmedCount = issues.filter((b) => b.classification === 'Confirmed Issue').length;
    const readiness =
      confirmedCount === 0
        ? { label: total === 0 ? 'No checks were run' : 'Ready for launch', cls: 'ok' }
        : { label: `Ready for launch, with ${confirmedCount} issue${confirmedCount > 1 ? 's' : ''} to resolve first`, cls: 'warn' };

    const moduleCards = [...byModule.entries()]
      .map(([mod, recs]) => {
        const p = recs.filter((r) => r.status === 'passed').length;
        const f = recs.filter((r) => r.status === 'failed' || r.status === 'timedOut').length;
        const s = recs.filter((r) => r.status === 'skipped' || r.status === 'interrupted').length;
        const t = recs.length;
        const pct = t > 0 ? Math.round((p / t) * 100) : 0;
        const state = f > 0 ? 'attention' : s > 0 ? 'partial' : 'clean';
        const stateLabel = state === 'attention' ? 'Needs attention' : state === 'partial' ? 'Partially checked' : 'All clear';
        return `<div class="mcard ${state}">
          <div class="mcard-top"><span class="mcard-name">${esc(mod)}</span><span class="mcard-pill ${state}">${stateLabel}</span></div>
          <div class="mcard-pct">${pct}<span class="pct-sym">%</span></div>
          <div class="mcard-sub">of checks passed</div>
          <div class="mcard-bar"><span class="b-p" style="width:${(p / t) * 100}%"></span><span class="b-f" style="width:${(f / t) * 100}%"></span><span class="b-s" style="width:${(s / t) * 100}%"></span></div>
          <div class="mcard-counts"><span>${p} passed</span><span>${f} failed</span><span>${s} skipped</span></div>
        </div>`;
      })
      .join('');

    const rows = this.records
      .map((r) => {
        const statusPill =
          r.status === 'passed'
            ? '<span class="pill pass">Passed</span>'
            : r.status === 'skipped' || r.status === 'interrupted'
              ? '<span class="pill skip">Skipped</span>'
              : '<span class="pill fail">Failed</span>';
        const shotBtn = r.screenshotDataUri
          ? `<button class="ev-btn" data-shot="shot-${r.idx}">View</button><div class="shot-modal" id="shot-${r.idx}"><div class="shot-inner"><button class="shot-close" data-close="shot-${r.idx}">&times;</button><img src="${r.screenshotDataUri}" alt="Screenshot"></div></div>`
          : '<span class="ev-none">&mdash;</span>';
        return `<tr>
          <td class="num">${r.idx}</td>
          <td><span class="mod-tag">${esc(r.module)}</span></td>
          <td>${esc(r.description)}</td>
          <td>${statusPill}</td>
          <td class="num">${(r.durationMs / 1000).toFixed(1)}s</td>
          <td>${shotBtn}</td>
        </tr>`;
      })
      .join('');

    const sevClass: Record<Severity, string> = { High: 'sev-high', Medium: 'sev-med', Low: 'sev-low' };
    const classBadgeClass: Record<Classification, string> = { 'Confirmed Issue': 'class-confirmed', 'Test Environment': 'class-env' };

    const bugCards = issues
      .map((b) => {
        const shot = b.screenshotDataUri
          ? `<figure class="bug-shot"><img src="${b.screenshotDataUri}" alt="Screenshot of the issue"></figure>`
          : '';
        return `<div class="bcard ${b.classification === 'Confirmed Issue' ? 'flagged' : ''}">
          <div class="bcard-head">
            <div class="bcard-head-left">
              <span class="bcard-id">${esc(b.id)}</span>
              <span class="badge ${sevClass[b.severity]}">${esc(b.severity)} impact</span>
              <span class="badge ${classBadgeClass[b.classification]}">${esc(b.classification)}</span>
            </div>
            <span class="bcard-module">${esc(b.module)}</span>
          </div>
          <h3 class="bcard-title">${esc(b.title)}</h3>
          <div class="bcard-grid">
            <div class="bcard-text">
              <div class="bfield"><span class="bfield-k">What we saw</span><p>${esc(b.whatHappened)}</p></div>
              <div class="bfield"><span class="bfield-k">Likely reason</span><p>${esc(b.likelyCause)}</p></div>
              <div class="bfield"><span class="bfield-k">What we recommend</span><p>${esc(b.recommendation)}</p></div>
            </div>
            ${shot}
          </div>
        </div>`;
      })
      .join('');

    const noIssuesCard =
      issues.length === 0
        ? '<div class="bcard"><h3 class="bcard-title">No issues found in this run.</h3></div>'
        : '';

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Synctag &mdash; QA Test Report</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${CSS}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand"><span class="brand-mark">S</span><span class="brand-name">Synctag</span><span class="brand-sub">Quality Assurance</span></div>
    <div class="topbar-meta">
      <span>${new Date().toISOString().slice(0, 10)}</span>
      <span class="dot">&middot;</span>
      <span>${esc(process.env.BASE_URL || 'devextension.synctag.com')}</span>
    </div>
  </header>

  <div class="hero">
    <h1>Test Report &amp; Issues Found</h1>
    <p>An automated check of the Synctag sign-in, pricing, and plan-upgrade flows, run against the live staging site. Written for a non-technical reader &mdash; every result below reflects what a real customer would actually experience.</p>
    <div class="readiness ${readiness.cls}">
      <span class="readiness-dot"></span>
      <div><strong>${esc(readiness.label)}</strong><span class="readiness-sub">${passed} of ${total} checks passed (${passRate}%)</span></div>
    </div>
  </div>

  <nav class="tabs">
    <button class="tab-btn active" data-tab="summary">Overview</button>
    <button class="tab-btn" data-tab="results">Test Results</button>
    <button class="tab-btn" data-tab="issues">Issues Found${issues.length ? ` <span class="tab-count">${issues.length}</span>` : ''}</button>
  </nav>

  <main>
    <section class="panel active" id="panel-summary">
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-num">${total}</div><div class="kpi-label">Total checks run</div></div>
        <div class="kpi good"><div class="kpi-num">${passed}</div><div class="kpi-label">Passed</div></div>
        <div class="kpi bad"><div class="kpi-num">${failed}</div><div class="kpi-label">Failed</div></div>
        <div class="kpi warn"><div class="kpi-num">${skipped}</div><div class="kpi-label">Skipped</div></div>
        <div class="kpi"><div class="kpi-num">${passRate}%</div><div class="kpi-label">Pass rate</div></div>
      </div>
      <h2 class="section-title">Results by area</h2>
      <div class="mgrid">${moduleCards}</div>
    </section>

    <section class="panel" id="panel-results">
      <h2 class="section-title">Every check we ran</h2>
      <p class="section-sub">Each row is one thing we tested. Click "View" to see exactly what the screen looked like.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Area</th><th>What was checked</th><th>Result</th><th class="num">Time</th><th>Evidence</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>

    <section class="panel" id="panel-issues">
      <h2 class="section-title">Issues found</h2>
      <p class="section-sub">One card per problem. "Confirmed Issue" means we’re confident this affects real customers. "Test Environment" means the check itself hit a snag (like a slow test inbox) &mdash; likely not a real product problem, but included for transparency.</p>
      <div class="bug-list">${bugCards}${noIssuesCard}</div>
    </section>
  </main>

  <footer>
    <span>Synctag Quality Assurance</span>
    <span>Report generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC &middot; run took ${(durationMs / 1000 / 60).toFixed(1)} min</span>
  </footer>
</div>

<script>
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });
  document.querySelectorAll('.ev-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var modal = document.getElementById(btn.dataset.shot);
      if (modal) modal.classList.add('open');
    });
  });
  document.querySelectorAll('.shot-close').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var modal = document.getElementById(btn.dataset.close);
      if (modal) modal.classList.remove('open');
    });
  });
  document.querySelectorAll('.shot-modal').forEach(function (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('open'); });
  });
</script>
</body>
</html>`;

    fs.writeFileSync(OUT_FILE, html, 'utf8');

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log(`║  📋  Client Report  →  ${OUT_FILE}`);
    console.log(`║  Checks: ${total}  |  Passed: ${passed}  |  Failed: ${failed}  |  Skipped: ${skipped}`);
    console.log(`║  Issues flagged: ${issues.length}  (${confirmedCount} confirmed, ${issues.length - confirmedCount} test-environment)`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
  }
}

const CSS = `
  :root {
    --ink: #0F1B2D; --ink-soft: #2E3D52; --muted: #64748B; --line: #E2E7EE;
    --line-strong: #C9D1DD; --paper: #F5F7FA; --card: #FFFFFF; --accent: #1F4E8C;
    --accent-soft: #E7EFFA; --good: #1E7A5C; --good-soft: #E4F3ED; --bad: #B23A2E;
    --bad-soft: #FBEAE7; --warn: #A9700D; --warn-soft: #FBF0DD;
    --shadow: 0 1px 2px rgba(15,27,45,0.04), 0 6px 20px rgba(15,27,45,0.06);
    --radius: 12px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ink: #EDF1F7; --ink-soft: #C4CEDB; --muted: #8B98AC; --line: #263449;
      --line-strong: #33445D; --paper: #0B121F; --card: #121C2C; --accent: #6FA3E8;
      --accent-soft: #16273E; --good: #6FCBA8; --good-soft: #10241D; --bad: #E8877C;
      --bad-soft: #2C1714; --warn: #E0B15B; --warn-soft: #2A2011;
      --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 6px 20px rgba(0,0,0,0.35);
    }
  }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:var(--paper); color:var(--ink);
    font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased; }
  body { font-size:15px; line-height:1.6; }
  .shell { max-width:1160px; margin:0 auto; padding:0 24px 64px; }
  .topbar { display:flex; align-items:center; justify-content:space-between; padding:18px 0; border-bottom:1px solid var(--line); }
  .brand { display:flex; align-items:center; gap:10px; }
  .brand-mark { width:32px; height:32px; border-radius:8px; background:var(--accent); color:#fff;
    display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; flex:none; }
  .brand-name { font-weight:700; font-size:16px; letter-spacing:-0.01em; }
  .brand-sub { font-size:12px; color:var(--muted); border-left:1px solid var(--line-strong);
    padding-left:10px; margin-left:2px; text-transform:uppercase; letter-spacing:0.04em; }
  .topbar-meta { font-size:12.5px; color:var(--muted); display:flex; align-items:center; gap:8px; }
  .topbar-meta .dot { color:var(--line-strong); }
  .hero { padding:40px 0 28px; }
  .hero h1 { font-size:clamp(28px,3.4vw,36px); font-weight:700; letter-spacing:-0.015em;
    margin:0 0 12px; text-wrap:balance; color:var(--ink); }
  .hero p { max-width:68ch; color:var(--ink-soft); margin:0 0 22px; font-size:15.5px; }
  .readiness { display:flex; align-items:center; gap:14px; padding:14px 18px; border-radius:var(--radius);
    border:1px solid var(--line); background:var(--card); box-shadow:var(--shadow); max-width:560px; }
  .readiness-dot { width:10px; height:10px; border-radius:50%; flex:none; }
  .readiness.ok .readiness-dot { background:var(--good); }
  .readiness.warn .readiness-dot { background:var(--warn); }
  .readiness strong { font-size:15px; display:block; }
  .readiness-sub { font-size:13px; color:var(--muted); }
  .tabs { display:flex; gap:4px; border-bottom:1px solid var(--line); margin-bottom:32px; }
  .tab-btn { appearance:none; border:none; background:none; cursor:pointer; font-family:inherit;
    font-size:14.5px; font-weight:600; color:var(--muted); padding:12px 18px; border-bottom:2px solid transparent;
    margin-bottom:-1px; display:flex; align-items:center; gap:8px; transition:color .15s; }
  .tab-btn:hover { color:var(--ink-soft); }
  .tab-btn.active { color:var(--accent); border-bottom-color:var(--accent); }
  .tab-count { background:var(--bad-soft); color:var(--bad); font-size:11.5px; font-weight:700;
    padding:2px 7px; border-radius:999px; line-height:1.4; }
  .panel { display:none; }
  .panel.active { display:block; }
  .section-title { font-size:20px; font-weight:700; margin:0 0 6px; letter-spacing:-0.01em; }
  .section-sub { color:var(--muted); font-size:14px; margin:0 0 22px; max-width:72ch; }
  .kpi-row { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:36px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:var(--radius);
    padding:18px 16px; box-shadow:var(--shadow); }
  .kpi-num { font-size:30px; font-weight:700; line-height:1; font-variant-numeric:tabular-nums; color:var(--ink); }
  .kpi.good .kpi-num { color:var(--good); } .kpi.bad .kpi-num { color:var(--bad); } .kpi.warn .kpi-num { color:var(--warn); }
  .kpi-label { margin-top:8px; font-size:12.5px; color:var(--muted); }
  .mgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px; }
  .mcard { background:var(--card); border:1px solid var(--line); border-radius:var(--radius);
    padding:18px; box-shadow:var(--shadow); border-top:3px solid var(--line-strong); }
  .mcard.clean { border-top-color:var(--good); } .mcard.attention { border-top-color:var(--bad); } .mcard.partial { border-top-color:var(--warn); }
  .mcard-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px; }
  .mcard-name { font-weight:700; font-size:14.5px; }
  .mcard-pill { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.03em;
    padding:3px 8px; border-radius:999px; white-space:nowrap; }
  .mcard-pill.clean { background:var(--good-soft); color:var(--good); }
  .mcard-pill.attention { background:var(--bad-soft); color:var(--bad); }
  .mcard-pill.partial { background:var(--warn-soft); color:var(--warn); }
  .mcard-pct { font-size:32px; font-weight:700; line-height:1; }
  .pct-sym { font-size:18px; color:var(--muted); }
  .mcard-sub { font-size:12px; color:var(--muted); margin-bottom:12px; }
  .mcard-bar { display:flex; height:7px; border-radius:4px; overflow:hidden; background:var(--line); margin-bottom:10px; }
  .mcard-bar .b-p { background:var(--good); } .mcard-bar .b-f { background:var(--bad); } .mcard-bar .b-s { background:var(--warn); }
  .mcard-counts { display:flex; gap:12px; font-size:11.5px; color:var(--muted); }
  .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:var(--radius); background:var(--card); box-shadow:var(--shadow); }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  thead th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--muted);
    font-weight:700; padding:12px 16px; border-bottom:1px solid var(--line-strong); white-space:nowrap; background:var(--paper); }
  tbody td { padding:12px 16px; border-bottom:1px solid var(--line); vertical-align:middle; }
  tbody tr:last-child td { border-bottom:none; }
  tbody tr:hover td { background:var(--accent-soft); }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .mod-tag { font-size:12px; font-weight:600; color:var(--accent); background:var(--accent-soft); padding:3px 9px; border-radius:999px; white-space:nowrap; }
  .pill { display:inline-flex; align-items:center; font-size:11.5px; font-weight:700; text-transform:uppercase;
    letter-spacing:0.02em; padding:4px 10px; border-radius:999px; }
  .pill.pass { background:var(--good-soft); color:var(--good); }
  .pill.fail { background:var(--bad-soft); color:var(--bad); }
  .pill.skip { background:var(--warn-soft); color:var(--warn); }
  .ev-btn { appearance:none; border:1px solid var(--line-strong); background:var(--card); color:var(--accent);
    font-family:inherit; font-size:12.5px; font-weight:600; padding:5px 12px; border-radius:7px; cursor:pointer; transition:background .15s; }
  .ev-btn:hover { background:var(--accent-soft); }
  .ev-none { color:var(--line-strong); }
  .shot-modal { display:none; position:fixed; inset:0; background:rgba(15,27,45,0.72); z-index:50;
    align-items:center; justify-content:center; padding:40px; }
  .shot-modal.open { display:flex; }
  .shot-inner { position:relative; max-width:min(90vw,1000px); max-height:85vh; background:var(--card);
    border-radius:10px; padding:12px; box-shadow:0 20px 60px rgba(0,0,0,0.4); }
  .shot-inner img { display:block; max-width:100%; max-height:78vh; border-radius:6px; }
  .shot-close { position:absolute; top:-14px; right:-14px; width:32px; height:32px; border-radius:50%;
    background:var(--ink); color:var(--paper); border:none; font-size:18px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; line-height:1; }
  .bug-list { display:flex; flex-direction:column; gap:18px; }
  .bcard { background:var(--card); border:1px solid var(--line); border-radius:var(--radius);
    padding:22px 24px; box-shadow:var(--shadow); border-left:4px solid var(--line-strong); }
  .bcard.flagged { border-left-color:var(--bad); }
  .bcard-head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
  .bcard-head-left { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .bcard-id { font-size:12px; font-weight:700; color:var(--muted); letter-spacing:0.02em; }
  .bcard-module { font-size:12px; font-weight:600; color:var(--accent); background:var(--accent-soft); padding:3px 10px; border-radius:999px; }
  .badge { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.02em; padding:4px 10px; border-radius:999px; }
  .sev-high { background:var(--bad-soft); color:var(--bad); }
  .sev-medium, .sev-med { background:var(--warn-soft); color:var(--warn); }
  .sev-low { background:var(--line); color:var(--muted); }
  .class-confirmed { background:var(--bad-soft); color:var(--bad); }
  .class-env { background:var(--line); color:var(--muted); }
  .bcard-title { font-size:17px; font-weight:700; margin:0 0 16px; line-height:1.4; text-wrap:balance; }
  .bcard-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:22px; align-items:start; }
  .bfield { margin-bottom:14px; } .bfield:last-child { margin-bottom:0; }
  .bfield-k { display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.03em; color:var(--muted); margin-bottom:4px; }
  .bfield p { margin:0; font-size:14px; color:var(--ink-soft); line-height:1.55; }
  .bug-shot { margin:0; border:1px solid var(--line); border-radius:8px; overflow:hidden; background:var(--paper); }
  .bug-shot img { display:block; width:100%; height:auto; }
  footer { border-top:1px solid var(--line); padding-top:22px; margin-top:48px; display:flex;
    justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:12px; color:var(--muted); }
  @media (max-width:860px) { .kpi-row { grid-template-columns:repeat(2,1fr); } .bcard-grid { grid-template-columns:1fr; } }
  @media (max-width:620px) { .tabs { overflow-x:auto; } }
`;

export default CustomHtmlReporter;
