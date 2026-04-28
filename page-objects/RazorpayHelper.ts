import { Page } from '@playwright/test';

type CardKey = keyof typeof RazorpayHelper.CARDS;

export class RazorpayHelper {
  static readonly CARDS = {
    success:       { number: '4111111111111111', expiry: '12/29', cvv: '123',  otp: '1234' },
    mastercard:    { number: '5267316949916581', expiry: '12/29', cvv: '123',  otp: '1234' },
    rupay:         { number: '6073849700004947', expiry: '12/29', cvv: '123',  otp: '1234' },
    international: { number: '4012888888881881', expiry: '12/29', cvv: '123',  otp: ''     },
    amex:          { number: '378282246310005',  expiry: '12/29', cvv: '1234', otp: ''     },
    declined:      { number: '4000000000000002', expiry: '12/29', cvv: '123',  otp: '1234' },
    insufficient:  { number: '4111111111111111', expiry: '12/29', cvv: '123',  otp: '1002' },
    expired:       { number: '4111111111111111', expiry: '12/22', cvv: '123',  otp: '1234' },
    wrongcvv:      { number: '4111111111111111', expiry: '12/29', cvv: '999',  otp: '1234' },
  };

  static async pay(page: Page, cardType: CardKey = 'success'): Promise<void> {
    const card = RazorpayHelper.CARDS[cardType];
    const rzp = page.frameLocator('iframe[src*="razorpay"], iframe[title*="Razorpay"]');

    await rzp.locator('[data-method="card"], text=Card').click();
    await rzp.locator('input[name="card[number]"], #card_number').fill(card.number);
    await rzp.locator('input[name="card[expiry]"], #card_expiry').fill(card.expiry);
    await rzp.locator('input[name="card[cvv]"], #card_cvv').fill(card.cvv);
    await rzp.locator('button:has-text("Pay"), .btn-pay').click();

    if (card.otp) {
      const otpInput = rzp.locator('input[name="otp"], input[placeholder*="OTP"]');
      const visible = await otpInput.isVisible({ timeout: 5000 }).catch(() => false);
      if (visible) {
        await otpInput.fill(card.otp);
        await rzp.locator('button:has-text("Submit"), button:has-text("Verify")').click();
      }
    }
  }

  static async payUPI(page: Page, success = true): Promise<void> {
    const id = success ? 'success@razorpay' : 'failure@razorpay';
    const rzp = page.frameLocator('iframe[src*="razorpay"]');
    await rzp.locator('[data-method="upi"], text=UPI').click();
    await rzp.locator('input[placeholder*="UPI"]').fill(id);
    await rzp.locator('button:has-text("Pay")').click();
  }

  static async payNetBanking(page: Page, success = true): Promise<void> {
    const rzp = page.frameLocator('iframe[src*="razorpay"]');
    await rzp.locator('[data-method="netbanking"], text=Net Banking').click();
    await rzp.locator('select, .bank-list').selectOption({ index: 1 });
    await rzp.locator('button:has-text("Pay")').click();
    const result = success ? 'Success' : 'Failure';
    await rzp.locator(`button:has-text("${result}")`).click();
  }
}
