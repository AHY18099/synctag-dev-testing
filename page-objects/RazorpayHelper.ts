import { Page } from '@playwright/test';

type CardKey = keyof typeof RazorpayHelper.CARDS;

export class RazorpayHelper {
  // ── Official Razorpay test cards ──────────────────────────────────────────
  // Source: https://razorpay.com/docs/payments/payments/test-card-upi-details/
  static readonly CARDS = {
    // Domestic — success path
    visa_success:     { number: '4111 1111 1111 1111', expiry: '12/29', cvv: '123',  otp: '1234', name: 'Test User' },
    mastercard:       { number: '5267 3169 4991 6581', expiry: '12/29', cvv: '123',  otp: '1234', name: 'Test User' },
    rupay:            { number: '6073 8497 0000 4947', expiry: '12/29', cvv: '123',  otp: '1234', name: 'Test User' },

    // International
    visa_intl:        { number: '4012 8888 8888 1881', expiry: '12/29', cvv: '123',  otp: '',     name: 'Test User' },
    amex:             { number: '3782 822463 10005',   expiry: '12/29', cvv: '1234', otp: '',     name: 'Test User' },

    // Failure scenarios
    card_declined:    { number: '4000 0000 0000 0002', expiry: '12/29', cvv: '123',  otp: '1234', name: 'Test User' },
    insufficient:     { number: '4111 1111 1111 1111', expiry: '12/29', cvv: '123',  otp: '1002', name: 'Test User' },
    expired_card:     { number: '4111 1111 1111 1111', expiry: '12/22', cvv: '123',  otp: '1234', name: 'Test User' },
    wrong_cvv:        { number: '4111 1111 1111 1111', expiry: '12/29', cvv: '999',  otp: '1234', name: 'Test User' },
    invalid_card:     { number: '4000 0000 0000 0069', expiry: '12/29', cvv: '123',  otp: '1234', name: 'Test User' },

    // Aliases kept for backward compat
    success:          { number: '4111 1111 1111 1111', expiry: '12/29', cvv: '123',  otp: '1234', name: 'Test User' },
    international:    { number: '4012 8888 8888 1881', expiry: '12/29', cvv: '123',  otp: '',     name: 'Test User' },
    declined:         { number: '4000 0000 0000 0002', expiry: '12/29', cvv: '123',  otp: '1234', name: 'Test User' },
    wrongcvv:         { number: '4111 1111 1111 1111', expiry: '12/29', cvv: '999',  otp: '1234', name: 'Test User' },
    expired:          { number: '4111 1111 1111 1111', expiry: '12/22', cvv: '123',  otp: '1234', name: 'Test User' },
  } as const;

  // ── UPI test IDs ──────────────────────────────────────────────────────────
  static readonly UPI = {
    success: 'success@razorpay',
    failure: 'failure@razorpay',
  } as const;

  // ── Net banking test bank codes ───────────────────────────────────────────
  static readonly NETBANKING = {
    hdfc:    'HDFC',
    sbi:     'SBIN',
    icici:   'ICIC',
    axis:    'UTIB',
  } as const;

  // ── Pay via card ──────────────────────────────────────────────────────────
  static async pay(page: Page, cardType: CardKey = 'success'): Promise<void> {
    const card = RazorpayHelper.CARDS[cardType];
    const rzp  = page.frameLocator([
      'iframe[src*="razorpay"]',
      'iframe[src*="checkout"]',
      'iframe[title*="Razorpay"]',
      'iframe[title*="Payment"]',
    ].join(', '));

    // Select card method
    await rzp.locator('[data-method="card"], text=Card, text=Credit/Debit').click();

    // Cardholder name (some flows ask for it)
    const nameField = rzp.locator('input[name="card[name]"], #card_name').first();
    if (await nameField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameField.fill(card.name);
    }

    // Card details
    await rzp.locator('input[name="card[number]"], #card_number, [placeholder*="Card Number"]').fill(card.number);
    await rzp.locator('input[name="card[expiry]"], #card_expiry, [placeholder*="MM"]').fill(card.expiry);
    await rzp.locator('input[name="card[cvv]"], #card_cvv, [placeholder*="CVV"]').fill(card.cvv);
    await rzp.locator('button:has-text("Pay"), .btn-pay, button[type="submit"]').click();

    // Handle OTP / 3DS if required
    if (card.otp) {
      const otpInput = rzp.locator('input[name="otp"], input[placeholder*="OTP"], input[placeholder*="Enter OTP"]');
      if (await otpInput.isVisible({ timeout: 8000 }).catch(() => false)) {
        await otpInput.fill(card.otp);
        await rzp.locator('button:has-text("Submit"), button:has-text("Verify"), button:has-text("Pay")').click();
      }
    }
  }

  // ── Pay via UPI ───────────────────────────────────────────────────────────
  static async payUPI(page: Page, success = true): Promise<void> {
    const vpa = success ? RazorpayHelper.UPI.success : RazorpayHelper.UPI.failure;
    const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[src*="checkout"]');
    await rzp.locator('[data-method="upi"], text=UPI, text=Pay via UPI').click();
    const upiInput = rzp.locator('input[placeholder*="UPI"], input[name*="vpa"]');
    await upiInput.fill(vpa);
    await rzp.locator('button:has-text("Verify"), button:has-text("Pay")').click();
  }

  // ── Pay via Net Banking ───────────────────────────────────────────────────
  static async payNetBanking(page: Page, bankCode = 'HDFC', success = true): Promise<void> {
    const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[src*="checkout"]');
    await rzp.locator('[data-method="netbanking"], text=Net Banking').click();
    await rzp.locator(`[value="${bankCode}"], option[value="${bankCode}"]`).click().catch(async () => {
      await rzp.locator('select').selectOption(bankCode);
    });
    await rzp.locator('button:has-text("Pay"), button[type="submit"]').click();
    // Razorpay test banking simulator
    const result = success ? 'Success' : 'Failure';
    await rzp.locator(`button:has-text("${result}")`).click().catch(() => {});
  }

  // ── Pay via Wallet ────────────────────────────────────────────────────────
  static async payWallet(page: Page, wallet = 'Paytm'): Promise<void> {
    const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[src*="checkout"]');
    await rzp.locator('[data-method="wallet"], text=Wallets').click();
    await rzp.locator(`text=${wallet}`).click();
    await rzp.locator('button:has-text("Pay")').click();
  }
}
