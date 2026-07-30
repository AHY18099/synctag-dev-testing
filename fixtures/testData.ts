/**
 * Shared test data: Razorpay published TEST-MODE cards, plan catalogue, and
 * helper generators for unique QA identities.
 *
 * Razorpay test cards (safe only while the merchant/checkout is in TEST MODE,
 * as confirmed by the red "Test Mode" ribbon seen on the live checkout
 * during manual exploration of devextension.synctag.com):
 * https://razorpay.com/docs/payments/payments/test-card-upi-details/
 */

export const RAZORPAY_TEST_CARDS = {
  /** Generic Visa test card - simulates a successful authorization/capture */
  success: {
    number: '4111 1111 1111 1111',
    network: 'Visa',
    expiry: '12/30',
    cvv: '123',
    expectedOutcome: 'success',
  },
  /** Mastercard test card - simulates a successful authorization/capture */
  successMastercard: {
    number: '5267 3181 8797 5449',
    network: 'Mastercard',
    expiry: '12/30',
    cvv: '123',
    expectedOutcome: 'success',
  },
  /** Razorpay-documented card that simulates a bank/issuer decline */
  failureDecline: {
    number: '4000 0000 0000 0002',
    network: 'Visa',
    expiry: '12/30',
    cvv: '123',
    expectedOutcome: 'failure',
    expectedReason: 'card_declined',
  },
  /** Simulates insufficient funds decline */
  failureInsufficientFunds: {
    number: '4000 0000 0000 9995',
    network: 'Visa',
    expiry: '12/30',
    cvv: '123',
    expectedOutcome: 'failure',
    expectedReason: 'insufficient_funds',
  },
} as const;

export const INVALID_CARDS = {
  /** Fails the Luhn checksum -> should be rejected client-side before hitting Razorpay */
  luhnInvalid: { number: '4111 1111 1111 1112', expiry: '12/30', cvv: '123' },
  /** Card number too short */
  tooShort: { number: '4111 1111', expiry: '12/30', cvv: '123' },
  /** Expiry already in the past */
  expiredCard: { number: '4111 1111 1111 1111', expiry: '01/20', cvv: '123' },
  /** CVV with wrong length */
  shortCvv: { number: '4111 1111 1111 1111', expiry: '12/30', cvv: '1' },
  /** Non-numeric card number */
  nonNumeric: { number: 'abcd efgh ijkl mnop', expiry: '12/30', cvv: '123' },
};

/**
 * Plan names exactly as rendered on the public /pricing page (case-sensitive
 * — the app renders title case, e.g. "Pro - 7 days", not "PRO - 7 DAYS").
 * Re-verified live on 2026-07-30 via each card's heading text.
 */
export const PLAN_NAMES = [
  'Free',
  'Free - 7 days',
  'Custom Free',
  'Pro',
  'Pro - 7 days',
  'Team',
  'Enquiry',
] as const;

/**
 * Expected price-cadence text per plan on the public pricing page.
 * Captured from live exploration on 2026-07-30. If the dev team changes
 * pricing copy, update this fixture - it backs the pricing-consistency
 * regression tests that caught BUG-02.
 */
export const EXPECTED_PRICING = {
  Free: { amount: '₹0', cadence: null },
  'Free - 7 days': { amount: '₹0', cadence: null },
  'Custom Free': { amount: '₹0', cadence: null },
  Pro: { amount: '₹5,000', cadence: '/ month' },
  'Pro - 7 days': { amount: '₹100', cadence: '/ day' },
  Team: { amount: '₹35,000', cadence: '/ month' },
} as const;

/**
 * Generates a unique, real, pollable Mailinator address (public inbox — do
 * not use for anything sensitive). Mailinator inbox names must be
 * alphanumeric/hyphen only, so the prefix is sanitized and the timestamp
 * keeps each test run's address unique.
 */
export function uniqueTestEmail(prefix = 'qa-synctag'): string {
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, '-');
  return `${safePrefix}-${Date.now()}@mailinator.com`;
}

export function uniqueTestPhone(): string {
  // Indian 10-digit mobile format starting with a valid leading digit (6-9)
  const rand = Math.floor(100000000 + Math.random() * 899999999);
  return `9${String(rand).slice(0, 9)}`;
}
