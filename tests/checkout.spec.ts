import { test, expect, Page } from '@playwright/test';

// ---------- constants ----------
const COUPON_CODE = 'WELCOME10';
const MIN_SPEND = 22;        // WooCommerce → Coupons → Usage restriction → Minimum spend
const DISCOUNT_RATE = 0.10;  // 10% off

const PRODUCTS = [
  'chocolate-sprinkles-hagelslag',
  'droste-chocolate-bars',
];

// ---------- helpers ----------
// "€2,25" or "€1.234,56" -> number
const parseEuro = (text: string) => {
  const match = text.match(/\d[\d.]*,\d{2}/);
  if (!match) throw new Error(`No euro amount found in: "${text}"`);
  return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
};

// 22.5 -> "€22,50"
const formatEuro = (n: number) => `€${n.toFixed(2).replace('.', ',')}`;

async function addFirstProductToCart(page: Page) {
  await page.goto('/shop');
  await page.locator('li.product a').first().click();

  const dropdowns = page.locator('table.variations select');
  const count = await dropdowns.count();
  for (let i = 0; i < count; i++) {
    await dropdowns.nth(i).selectOption({ index: 1 });
  }

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.locator('.woocommerce-message')).toBeVisible();
}

async function fillBillingDetails(page: Page) {
  await page.getByRole('textbox', { name: 'Email address' }).fill('test@example.com');
  await page.getByRole('textbox', { name: 'First name' }).fill('Test');
  await page.getByRole('textbox', { name: 'Last name' }).fill('User');
  await page.getByRole('textbox', { name: 'Address', exact: true }).fill('Teststraat 1');
  await page.getByRole('textbox', { name: 'Postal code' }).fill('5611 AA');
  await page.getByRole('textbox', { name: 'City' }).fill('Eindhoven');
  await page.getByRole('textbox', { name: 'Phone' }).fill('0612345678');
}

async function applyCoupon(page: Page, code: string) {
  await page.getByRole('button', { name: 'Add coupons' }).click();
  await page.getByRole('textbox', { name: 'Enter code' }).fill(code);
  await page.getByRole('button', { name: 'Apply' }).click();
}

// ---------- tests ----------
test('@smoke checkout page opens with a product in the cart', async ({ page }) => {
  await addFirstProductToCart(page);
  await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('textbox', { name: 'First name' })).toBeVisible();
  await expect(page.getByRole('button', { name: /place order/i })).toBeVisible();
});

test('empty cart shows a message', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByText(/cart is currently empty/i).first()).toBeVisible();
});

test('coupon below minimum spend shows an error', async ({ page }) => {
  await addFirstProductToCart(page);   // 1 item, below the minimum
  await page.goto('/cart');

  await applyCoupon(page, COUPON_CODE);

  await expect(page.getByText(/minimum spend/i).first()).toBeVisible();
});

for (const slug of PRODUCTS) {
  test(`coupon above minimum spend is applied (${slug})`, async ({ page }) => {
    await page.goto(`/product/${slug}/`);

    // choose a variation if the product has dropdowns
    const dropdowns = page.locator('table.variations select');
    const count = await dropdowns.count();
    for (let i = 0; i < count; i++) {
      await dropdowns.nth(i).selectOption({ index: 1 });
    }
if (count > 0) {
      // wait until WooCommerce has resolved the chosen variation
      await expect(page.locator('.woocommerce-variation-price')).toBeVisible();
    }
    
    await page.getByRole('spinbutton', { name: /quantity/i }).fill('20');
    await page.getByRole('button', { name: /add to cart/i }).click();
     await expect(page.getByRole('link', { name: /20 items/ })).toBeVisible();
    await expect(page.locator('.woocommerce-message')).toBeVisible();

    
    await page.goto('/cart');
    await applyCoupon(page, COUPON_CODE);
    await expect(page.getByText('Coupon: welcome10')).toBeVisible();

     const totals = page.locator('.wc-block-components-totals-wrapper');
    const subtotalRow = totals.filter({ hasText: 'Subtotal' }).first();
    const discountRow = totals.filter({ hasText: 'Discount' }).first();

    await expect(subtotalRow).toContainText(/€\s?\d/);
    await expect(discountRow).toContainText(/€\s?\d/);

    const subtotal = parseEuro(await subtotalRow.innerText());
    const discount = parseEuro(await discountRow.innerText());
    expect(subtotal).toBeGreaterThanOrEqual(MIN_SPEND);             
    expect(discount).toBeCloseTo(subtotal * DISCOUNT_RATE, 2); 

  });
}

test('checkout with Cash on Delivery', async ({ page }) => {
  await addFirstProductToCart(page);
  await page.goto('/checkout');
  await fillBillingDetails(page);

  await page.getByRole('radio', { name: 'Cash on delivery' }).check();

  const placeOrder = page.getByRole('button', { name: /place order/i });
  await expect(placeOrder).toBeEnabled();
  await placeOrder.click();

  await expect(page).toHaveURL(/order-received/, { timeout: 15_000 });
  await expect(page.getByText('Thank you. Your order has been received.')).toBeVisible();
});