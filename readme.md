# MySweetBites: end-to-end tests for a WooCommerce shop

[![e2e](https://github.com/ayshwarya199/mysweetbites-tests/actions/workflows/e2e.yml/badge.svg)](https://github.com/ayshwarya199/mysweetbites-tests/actions/workflows/e2e.yml)

Automated end-to-end tests for **MySweetBites**, a Dutch sweets web shop built on WooCommerce. The tests are written with [Playwright](https://playwright.dev) and TypeScript. They run against a disposable copy of the shop in Docker, and a GitHub Actions pipeline runs them on every push.

## The three layers

```
 Tests                 Environment                    Pipeline
 (Playwright)          (Docker)                       (GitHub Actions)

 shop.spec.ts   --->   WordPress + WooCommerce   <--- push to main
 checkout.spec.ts      MariaDB database                |
 helpers.ts            seed.sh fills the shop:         v
 test-data.ts          products, coupon,          start shop, seed it,
                       shipping, payment          run tests, save report
```

1. **Tests:** Playwright specs for browsing the shop, the cart, coupons and checkout.
2. **Environment:** `docker-compose.yml` starts WordPress, WooCommerce and a database. `seed.sh` (WP-CLI) fills the shop with the same products, coupon, shipping rate and payment method every time, so each run starts from known data.
3. **Pipeline:** `.github/workflows/e2e.yml` starts the shop in the pipeline, runs the tests and uploads the HTML report.

## What is tested

| Area | Tests |
|---|---|
| Shop (`shop.spec.ts`) | home page title, product list, product page, add a product to the cart |
| Checkout (`checkout.spec.ts`) | checkout page opens (smoke test), empty cart message, coupon rejected below the minimum spend, coupon applied above the minimum spend (once per product, including a variable product), full order with Cash on Delivery |

The coupon test does not hardcode prices. It adds a generous quantity, then reads the real subtotal and discount from the cart and checks the business rule: the subtotal reaches the minimum spend and the discount equals 10% of it.

## Project structure

```
tests/
  shop.spec.ts          shop and product tests
  checkout.spec.ts      coupon and checkout tests
  helpers.ts            reusable steps (add to cart, fill billing details, apply coupon)
  test-data.ts          coupon rules and product list in one place
docker-compose.yml      WordPress + database (+ WP-CLI for seeding)
seed.sh                 creates the shop data
playwright.config.ts    base URL, timeouts, browser project
.github/workflows/e2e.yml   CI pipeline
```

## Run it locally

Requirements: Node.js 20 or newer, Docker Desktop.

```bash
npm ci
npx playwright install msedge
```

**Against the Docker shop** (the same setup as the pipeline):

```bash
docker compose up -d
docker compose run --rm wpcli        # seeds the shop, wait for "Seed finished"
```

PowerShell:

```powershell
$env:BASE_URL="http://localhost:8080"; npx playwright test
```

macOS or Linux:

```bash
BASE_URL=http://localhost:8080 npx playwright test
```

Stop and remove the shop afterwards:

```bash
docker compose down -v
```

**Against another shop:** set `BASE_URL` to its address. Without it, the tests use `http://mysweetbites.local` on a computer and `http://localhost:8080` inside the pipeline (GitHub sets `CI`).

Useful commands:

```bash
npx playwright test -g "above minimum spend"   # run tests by name
npx playwright test --headed                   # watch the browser
npx playwright test --ui                       # UI mode
npx playwright show-report                     # open the HTML report
```

## The pipeline

On every push to `main` and on pull requests, the workflow:

1. installs Node dependencies and the browser,
2. starts the shop with `docker compose up -d --wait`,
3. seeds it with `docker compose run --rm wpcli`,
4. waits until `/shop/` answers,
5. runs the tests with `BASE_URL` pointing at the Docker shop,
6. uploads the HTML report (always) and traces of failed tests,
7. stops the shop.

Download the **playwright-report** artifact from a run to see which tests passed and why one failed.

## Decisions and lessons

- **Block checkout locators:** the shop uses WooCommerce's block-based cart and checkout, so classic IDs like `#billing_first_name` do not exist. The tests use role and label locators (`getByRole`, `getByLabel`), which match what a user sees.
- **Wait for the right condition, not a fixed time:** after "Add to cart" the test waits for the confirmation, and after applying a coupon it waits for the totals to finish loading ("Loading price") before reading them.
- **One worker:** a single local shop handles one test at a time more reliably than parallel browsers.
- **Predictable data:** a seed script gives every run the same products, prices and coupon, which is what makes the tests stable.
- **Environment-independent URL:** the base URL comes from `BASE_URL`, so the same tests run on a laptop, in Docker and in CI.

## Notes

- The `admin / admin` login in `seed.sh` exists only inside the throwaway test shop. Never reuse it anywhere real.
- The Cash on Delivery test creates a real order in the test shop. In the pipeline the shop is deleted afterwards. Locally, `docker compose down -v` resets it.

## Ideas for next steps

- Cart tests (change quantity, remove an item) and account tests (register, log in, wrong password).
- Search, checkout validation and bank transfer payment.
- API tests against the WooCommerce Store API.
- Accessibility checks with `@axe-core/playwright`.