import { test, expect } from '@playwright/test';
  import { parseEuro, addFirstProductToCart, fillBillingDetails, applyCoupon } from './helpers';
  import { COUPON_CODE, MIN_SPEND, DISCOUNT_RATE, PRODUCTS } from './test-data';

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
    await page.locator('button.single_add_to_cart_button').click();
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