import { test, expect } from '@playwright/test';

test('shows products', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/mysweetbites/i);
  });

test('shop page lists products', async ({ page }) => {
  await page.goto('/shop');
  await expect(
page.locator('li.product').first()
  ).toBeVisible();
});

test('open a product page', async ({ page }) => {
  await page.goto('/shop');
  await page.locator('li.product a').first().click();
  await expect(page.locator('h1.product_title')).toBeVisible();
  await expect(page.locator('button.single_add_to_cart_button')).toBeVisible();
});

test('add a product to the cart', async ({ page }) => {
  await page.goto('/shop');
  await page.locator('li.product a').first().click();

  // choose the first available option for each dropdown
  const dropdowns = page.locator('table.variations select');
  for (let i = 0; i < await dropdowns.count(); i++) {
    await dropdowns.nth(i).selectOption({ index: 1 });
  }

  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.locator('.woocommerce-message')).toBeVisible();
  await page.goto('/cart');
    await expect(
  page.locator('.cart_item, .wc-block-cart-items__row, tr.woocommerce-cart-form__cart-item').first()
).toBeVisible();

});


