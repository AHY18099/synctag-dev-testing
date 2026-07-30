# Synctag (devextension.synctag.com) — QA Automation Suite

Playwright + TypeScript suite covering signup/login, all pricing plans, and
Razorpay checkout on `https://devextension.synctag.com`.

## How this suite was produced

This was authored from **live manual exploration** of the real dev site via
a connected browser session (not from documentation or assumptions). Every
selector, error string, and flow described below was observed directly.
Business-logic bugs found during that exploration are encoded as regression
tests (see `pricing.spec.ts` "BUG-01"/"BUG-02" and `checkout.spec.ts`
"BUG-02 regression") and are also written up with screenshots in
`bug-report.html`. A full narrative is in `test-report.html`.

**This environment could not execute Playwright against
`devextension.synctag.com` directly** — its sandbox network is allow-listed
and does not include that domain. Run this suite from your own machine or
CI where the domain is reachable.

## Setup

```bash
npm install
npx playwright install chromium
BASE_URL=https://devextension.synctag.com npx playwright test
```

## Structure

```
playwright.config.ts     Config (baseURL, reporters, screenshots/video on failure)
pages/AuthPage.ts         /auth (login + signup) page object
pages/PricingPage.ts       /pricing page object
pages/CheckoutPage.ts      /profile?tab=plan upgrade modal + Razorpay checkout
fixtures/testData.ts       Razorpay test cards, invalid-card fixtures, plan/pricing fixtures
tests/auth.spec.ts         Login & signup: positive + negative + OTP edge cases
tests/pricing.spec.ts      All 7 plans render correctly; pricing-consistency guards
tests/checkout.spec.ts     Razorpay checkout: success/decline/invalid-card scenarios
```

## Known gaps — please read before trusting green runs

1. **OTP verification cannot be completed against the real backend.**
   The app is 100% passwordless (phone OTP, email OTP, or Google OAuth) —
   there is no username/password form and no known test-mode bypass code.
   Per QA sign-off, this suite **mocks the verify-OTP network response**
   (`AuthPage.mockOtpVerifySuccess`) to reach an authenticated state for the
   checkout tests. The URL glob used to intercept that call
   (`**/*verify*otp*` in `AuthPage.ts`) is a best guess — the real endpoint
   was not identifiable from network capture during exploration (client-side
   console logs referenced it as `📤 API Request` / `User Exists Check
   Response`, but the specific request URL did not surface through the
   available browser network inspection tooling). **Before relying on the
   two "positive login" tests and all of `checkout.spec.ts`, confirm/replace
   this URL pattern with the real backend endpoint.**
   - All *front-end validation* tests (invalid phone/email, empty
     submissions, OTP attempt-counter, lockout message) run against the
     real backend with no mocking and are fully trustworthy as written.
   - Alternative if you have a real test inbox: swap
     `mockOtpVerifySuccess()` for a real IMAP/API poll of the code and this
     suite becomes a true end-to-end check.

2. **Google OAuth is not exercised end-to-end** — only presence of the
   "Continue with Google" button is verified. Completing a real Google
   consent screen from an automated test requires a dedicated Google test
   account and is out of scope here.

3. **Checkout tests use the Razorpay TEST MODE checkout only.** The suite
   hard-asserts the red "Test Mode" ribbon (`assertTestModeBannerVisible`)
   before ever filling in card details, and aborts if it's missing. Do not
   remove this guard — it is the safety net that makes it acceptable to run
   card-shaped input against this flow at all. Only Razorpay's own published
   test card numbers are used (see `fixtures/testData.ts`); no real payment
   instruments are involved anywhere in this suite.

4. **`test.fixme(...)` in `auth.spec.ts`** documents BUG-03 (invalid email
   accepted via inline edit on the OTP screen) as a known-failing
   regression test. Un-skip it once the fix ships.

## Recommended: storageState login (faster + more realistic)

Rather than mocking OTP verification for every checkout test, if the team
can provision one QA account (e.g. by completing OTP once manually or via a
CI-only backend bypass), save its authenticated session once with
`page.context().storageState({ path: 'qa-auth.json' })`, then load it via
`use: { storageState: 'qa-auth.json' }` in `playwright.config.ts`. This
avoids re-mocking auth in every test and exercises the real session/cookie
handling end-to-end.
