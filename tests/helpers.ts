import { expect, Page } from '@playwright/test';

// "€2,25" or "€1.234,56" -> number
export const parseEuro = (text: string) => {
  const match = text.match(/\d[\d.]*,\d{2}/);
  if (!match) throw new Error(`No euro amount found in: "${text}"`);
  return parseFloat(match[0].replace(/\./g, '').replace(',', '.'));
};

// 22.5 -> "€22,50"
export const formatEuro = (n: number) => `€${n.toFixed(2).replace('.', ',')}`;

// Adds whatever product is first on the shop page.
export async function addFirstProductToCart(page: Page) {
  await page.goto('/shop');
  await page.locator('li.product a').first().click();

  const dropdowns = page.locator('table.variations select');
  const count = await dropdowns.count();
  for (let i = 0; i < count; i++) {
    await dropdowns.nth(i).selectOption({ index: 1 });
  }

  await page.locator('button.single_add_to_cart_button').click();
  await expect(page.locator('.woocommerce-message')).toBeVisible();
}

export async function fillBillingDetails(page: Page) {
  await page.getByRole('textbox', { name: 'Email address' }).fill('test@example.com');
  await page.getByRole('textbox', { name: 'First name' }).fill('Test');
  await page.getByRole('textbox', { name: 'Last name' }).fill('User');
  await page.getByRole('textbox', { name: 'Address', exact: true }).fill('Teststraat 1');
  await page.getByRole('textbox', { name: 'Postal code' }).fill('5611 AA');
  await page.getByRole('textbox', { name: 'City' }).fill('Eindhoven');
  await page.getByRole('textbox', { name: 'Phone' }).fill('0612345678');
}

export async function applyCoupon(page: Page, code: string) {
  await page.getByRole('button', { name: 'Add coupons' }).click();
  await page.getByRole('textbox', { name: 'Enter code' }).fill(code);
  await page.getByRole('button', { name: 'Apply' }).click();
}