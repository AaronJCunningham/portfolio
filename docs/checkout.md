# LVX checkout: Stripe + Printful

> The public store is currently locked by `SHOP_COMING_SOON=true` in `src/config/shop.ts`. It shows greyed-out purchase controls and blocks all checkout and provider webhook requests. Provider environment settings cannot override this flag. The development flow below requires temporarily setting it to `false` locally; restore `true` before publishing any preview. Only remove the public lock when the store is ready to launch.

## Start here — accounts can wait

The code for checkout, shipping quotes, payment verification and Printful draft orders is in place. You can preview the whole purchase flow without creating either account. Real provider behavior can only be verified after connecting them.

From `shader-portfolio`:

```sh
npm run shop:prepare
npm run shop:check
npm run dev
```

`shop:prepare` adds missing settings to the git-ignored `.env.local` and generates the two local secrets. It preserves existing values and never connects an account or enables payments. `shop:check` lists missing keys and all 11 product/size mappings without printing secrets or contacting providers. Exit code 1 means setup is incomplete, which is expected while accounts are disconnected. Both commands are safe to run again. For deployed environment checks use `NODE_ENV=production npm run shop:check`; the default follows `next dev` environment precedence.

Open http://localhost:3000/community/shop. Leave `SHOP_CHECKOUT_ENABLED=false`, `SHOP_LIVE_READY=false`, `PRINTFUL_TEST_DRAFTS=false`, and `SHOP_EMAIL_ENABLED=false` while previewing. Use fictional contact details and the sample card below. The offline checkout simulates an order; it does not charge or fulfil it.

### What you will need to do later

1. **Printful:** create a [Manual order / API store](https://help.printful.com/hc/en-us/articles/50262225690257-How-do-I-create-and-use-a-manual-order-API-store). Choose the actual black garments, upload production artwork, and create these decorated sizes:

   | Site product | Sizes | Current sample price |
   | --- | --- | --- |
   | LVX Polo | S, M, L, XL, 2XL | €39 |
   | LVX Long Sleeve | S, M, L, XL, 2XL | €45 |
   | LVX Beanie | One size | €25 |

   Shop mockup PNGs are display assets; prepare suitable print/embroidery artwork for the chosen products. Check costs, final prices and size availability before selling. Add a private token with product read and order read/write access to `.env.local` (and later your host's server environment). For an account-scoped token also set `PRINTFUL_STORE_ID`.
2. **Size mapping:** run `npm run shop:variants`. This reads your Printful products and lists names, sizes, colors, decorated `syncVariantId` values and readiness. Copy the correct IDs into the matching `PRINTFUL_*` settings. Verify the artwork in Printful; do not use the catalog IDs. No products or orders are created by this command.
3. **Stripe:** create the account, begin with a test secret key, and configure Stripe Tax as described below. Stripe collects customer payments; Printful charges you separately for production and shipping when you approve an order. No manually created Stripe product/price IDs or browser publishable key are needed for this hosted Checkout implementation.
4. **Webhook:** configure the two events below. For your public domain the endpoint is `https://aaronjcunningham.com/api/shop/webhook`. Locally use the Stripe CLI command below and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
5. **Connected test:** run `npm run shop:check -- --remote` for read-only Stripe account/Tax and Printful variant checks. Then set `SHOP_CHECKOUT_ENABLED=true`, keep a Stripe **test** key and `SHOP_LIVE_READY=false`, and restart. Complete a purchase with Stripe's test card. Verify shipping, tax, successful payment, signed webhook delivery and the confirmation page. Test a declined card and a cancelled checkout too. To test fulfilment, opt into `PRINTFUL_TEST_DRAFTS=true` and verify one uncharged Printful draft's items, artwork, size and address. Leave it unconfirmed, then turn that setting off again.
6. **Launch later:** finish Stripe business/payout details and Printful billing, replace sample prices/images where needed, and publish your actual delivery/returns information. Add the server settings to your host, use the HTTPS origin and live Stripe key plus the **live endpoint's** signing secret, and repeat configuration checks. Set `SHOP_LIVE_READY=true` only after the connected tests and launch review. Redeploy. Paid orders become Printful drafts, which you must review and confirm before production.

Account verification, final artwork/product selection, margins, provider tests and launch remain outstanding. Configuration checks cannot validate those decisions. Custom shipping emails are a separate optional Resend setup below; they are not required to prepare Stripe and Printful.

## Local workflow

Leave `SHOP_CHECKOUT_ENABLED=false`. No payment, Printful order or email is sent, even if credentials exist in the environment.

1. Add products and sizes, edit quantities in the bag, and continue to checkout.
2. Enter contact email and a worldwide delivery address. US, Canada and Australia require a state/province. A separate billing address is optional.
3. Choose a delivery service. Shipping changes with destination, product mix, quantity and service. Enter `LVXCOMM` for 15% off items.
4. Review delivery, discount, shipping, included tax and total. Enter `4242 4242 4242 4242`, any expiry in `MM/YY` format and a 3–4 digit CVC. Place the order.
5. The confirmation contains the purchased items, delivery address, reference and totals. It survives refresh in the same tab and has a printable summary. Purchased quantities are removed; later bag additions are preserved.

The normal interface has no demo labels, result selectors or extra testing controls. The old `/community/shop/demo` URL redirects to `/community/shop/payment`.

### Calculations and storage

`src/server/shop/local-provider.ts` contains **offline fixtures, not Printful prices or a global tax rules database**. It provides varied shipping services, unavailable destinations, regional tax scenarios and the editable coupon constant. These fixtures never run in connected checkout. Destination tax rates and tax-on-shipping rules are intentionally simplified for interaction testing; a zero fixture rate does not mean a country is legally tax exempt.

All amounts are integer euro cents. Displayed catalog and shipping prices are tax inclusive. Discounts apply to goods, then included tax is calculated on discounted goods and shipping. Included tax is shown separately without being added twice.

The browser sends contact/address/cart data to the local quote endpoint. Card fields are only used for browser validation: they are never submitted, saved or logged. Contact and delivery drafts and local receipts are stored in sessionStorage for that tab; the bag is in localStorage. Do not enter real payment details into the local form. The connected workflow collects cards only on Stripe's hosted page.

Quotes are encrypted, expire after 15 minutes and are recalculated before payment. Server catalog prices override client values. Address/cart edits invalidate the quote; shipping/coupon changes recalculate it. Changed prices/services require another review. Retries use stable payment attempt IDs.

## Connected workflow

The same delivery, shipping, coupon and review screens remain. Printful provides destination/product-specific shipping services; Stripe Tax calculates customer retail tax. The final button opens Stripe-hosted payment. Stripe's final payment page is authoritative; check tax rounding and configured tax treatment against the on-site calculation during connected testing.

Printful's production taxes and charges to you are separate from retail tax charged to your customer. Worldwide address selection does not guarantee Printful can deliver every item everywhere. Actual service availability is checked with Printful. Import duties or recipient customs charges are not estimated by this implementation. Review margins, destinations and customs information before launching.

The integration uses decorated Printful **sync variant IDs** for fulfilment. Variant lookup resolves their **catalog variant IDs** for shipping-rate requests. The selected shipping service is preserved when the paid order is sent to Printful.

Paid orders currently become **Printful drafts**. You review and confirm them in Printful to begin paid production. No automatic production approval was added. Stripe verifies payment; Printful stores the fulfilment record. No database, customer account system or admin application was added.

## Configure providers later

Add server environment variables from `.env.example` without overwriting unrelated settings. No secret uses `NEXT_PUBLIC_`. No accounts were connected during implementation.

1. Set `STRIPE_SECRET_KEY` to a test key and configure Stripe Tax registrations, product tax treatment and inclusive pricing. Set `SHOP_TAX_MODE=automatic`; optionally set `STRIPE_PRODUCT_TAX_CODE`.
2. Create a Printful Manual order / API store with decorated products. Add a private `PRINTFUL_TOKEN` with store-product read and order read/write permissions. Set `PRINTFUL_STORE_ID` for account-scoped tokens.
3. Fill every `PRINTFUL_*` variant mapping in `.env.example` using decorated sync variant IDs from `GET /store/products/{id}`. Match the site's sizes/colors exactly.
4. Leave `SHOP_SHIPPING_COUNTRIES` empty for worldwide provider availability, or provide an optional comma-separated country allowlist. There is no flat shipping configuration.
5. Generate `SHOP_QUOTE_SECRET` with at least 32 random characters. Set `SHOP_ORIGIN` to the exact canonical origin, including the port locally.
6. Register `/api/shop/webhook` in Stripe for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Save its `STRIPE_WEBHOOK_SECRET`. The SDK is pinned to 22.6.2 / API `2026-08-26.dahlia`; match the endpoint version.
7. Set `SHOP_CHECKOUT_ENABLED=true` and restart. Missing configuration keeps connected checkout unavailable.

For Stripe CLI testing:

```sh
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded --forward-to localhost:3000/api/shop/webhook
```

Use the CLI listener's signing secret locally. Stripe test payments skip Printful order creation unless `PRINTFUL_TEST_DRAFTS=true`. That opt-in creates actual uncharged drafts in your Printful account, not sandbox orders. Do not approve test drafts for production.

Use the same port for the dev server, `SHOP_ORIGIN`, and CLI forwarding. When checkout is disabled, the Stripe webhook returns 503 without contacting either provider. After a temporary pause, enable checkout and resend any pending events from Stripe Workbench; provider retry windows are finite.

Live keys additionally require HTTPS and `SHOP_LIVE_READY=true`. Adding a key alone does not open sales. Verify a connected test payment, tax calculation, live shipping quote, artwork/size/address mapping and signed webhook before enabling live payments. Publish appropriate shipping/customs, returns and privacy information for your business before launch.

## Coupons

Local: edit `localCoupons` in `src/server/shop/local-provider.ts`; `LVXCOMM` is 15% off goods. You can set an expiry.

Connected: create the coupon and public promotion code in Stripe, separately for test and live mode. Codes are entered on the site's review screen and validated server-side for activity, expiry, redemption limits, minimum amount and currency. The validated code is passed into Checkout. Product-restricted, customer-specific and first-purchase-only codes are not supported by this guest flow. To rotate a code, deactivate it and create its replacement in Stripe. Discounts reduce retail revenue, not Printful's costs.

## Customer emails

- **Payment receipt:** Stripe. The customer's address is passed as `receipt_email`. Enable successful-payment and refund emails in Stripe's Customer emails settings; configure your public support address and branding. Stripe test receipts are not sent automatically. Ordinary receipts are used; paid-invoice generation (a separately priced Stripe feature) is not enabled.
- **Shipping notification:** this site's `/api/shop/printful-webhook` receives Printful `package_shipped` events, re-fetches the order from Printful, and sends a black/red tracking email through Resend. Each package gets its own message; remaining items may arrive separately. The email uses only the package's shipped items. Replies go to `info@aaronjcunningham.com`.
- **Merchant alerts:** enable Stripe payment notifications and Printful account/order notifications in their dashboards. This code does not send separate owner emails.
- **Refund receipts:** enable Stripe refund emails. Refunding in Stripe and cancelling production in Printful are separate operations.

Shipping email setup:

1. Verify your sending domain in Resend. Set `RESEND_API_KEY` and `SHOP_EMAIL_FROM` (for example `LVX <info@aaronjcunningham.com>`). The `info` inbox/alias itself must also exist to receive replies.
2. Generate a separate random `PRINTFUL_WEBHOOK_SECRET` of at least 32 characters.
3. Configure Printful's **v1** webhook via `POST /webhooks` with `types: ["package_shipped"]` and `url: "https://YOUR-DOMAIN/api/shop/printful-webhook?token=YOUR_SECRET"`. Preserve any other webhook subscriptions your store needs. Keep this URL private and redact its query string from access logs. This is URL-token authentication, not a Printful signature.
4. Set `SHOP_EMAIL_ENABLED=true` only when ready for actual email delivery. Both this and connected checkout must be enabled. The handler verifies the token/store and retrieves the real order; supplied webhook email addresses or tracking URLs are never trusted.
5. Send a verified test shipment event and check delivery, reply-to and tracking. Failed sends return 500 for Printful retries. Resend's idempotency key uses order ID + shipment ID and protects retries for **24 hours**. A manual replay after that window can send another email; durable indefinite email deduplication would require storing sent-event IDs. Monitor webhook failures because provider retries are finite.

Local email previews (development server only, disabled in connected mode):

- `/api/shop/email-preview`: an illustrative order confirmation using local totals. Actual connected receipt styling is managed in Stripe.
- `/api/shop/email-preview?type=shipping`: the actual shipping template with sample package data.

These previews are separate from the shopping UI and never send anything. No Resend SDK or email framework was added; the adapter uses its HTTP API.

## Orders and recovery

The Stripe webhook verifies the raw-body signature and retrieves current payment state. It snapshots purchased variant IDs from Stripe line items, retrieves the quoted shipping address and creates an unconfirmed Printful order using the chosen shipping service.

A deterministic `lvx_…` external ID (within Printful's 32-character limit) deduplicates Printful drafts. Retries look up that ID before writing; a lost response is recovered by looking it up again. Product mapping edits cannot alter the variant snapshot for an already-paid order. Keep outstanding variants and the connected store available.

Stripe Checkout Session metadata records `awaiting_payment`, `draft_created`, `test_skipped`, or `needs_attention`, plus the Printful ID/reference where available. Fix configuration/service issues and resend failed events from Stripe Workbench. Inspect failed webhook deliveries regularly; retries are finite. Review the actual Printful production/shipping charges before confirming drafts, and cross-check refunds/cancellations manually.

## Verification and sources

`npm run test:shop` covers trusted prices, worldwide address validation, destination/quantity/service shipping, tax/discount arithmetic, encrypted/expired quotes, payment idempotency, signatures, draft duplication and lost responses, email escaping/authentication and disabled delivery. Tests mock providers and never send orders, payments or emails.

Official references: [Printful API](https://developers.printful.com/docs/), [Stripe Tax calculations](https://docs.stripe.com/tax/custom), [Checkout discounts](https://docs.stripe.com/payments/checkout/discounts), [Stripe receipts](https://docs.stripe.com/receipts), [Resend email API](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
