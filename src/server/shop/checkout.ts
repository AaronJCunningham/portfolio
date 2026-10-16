import {createHash} from 'node:crypto'
import type Stripe from 'stripe'
import {shopConfig, productTaxCode} from './config'
import {openQuote, calculateQuote, stripeAddress} from './quote'
import type {Snapshot} from './quote'
import {CheckoutError} from './validation'

export const SHOP_VERSION = 'lvx-v1'
export function validateAttempt(attempt: unknown): asserts attempt is string {
  if (typeof attempt !== 'string' || !/^[a-f0-9-]{36}$/i.test(attempt)) throw new CheckoutError('Please refresh and try again.', 400)
}
export async function revalidateQuote(token: unknown, stripe?: Stripe) {
  const saved = openQuote(token)
  const current = await calculateQuote(saved.input, stripe)
  const financial = (value: Snapshot) => JSON.stringify({items: value.items, total: value.total, discount: value.discount, tax: value.tax.amount, shipping: value.shipping.amount, shippingId: value.shipping.id})
  if (financial(saved) !== financial(current)) throw new CheckoutError('Prices or delivery costs have changed. Please refresh and review your order before paying.', 409)
  return saved
}
export async function createCheckout(snapshot: Snapshot, attempt: string, stripe: Stripe) {
  validateAttempt(attempt)
  if (snapshot.mode !== 'connected' || !shopConfig().ready) throw new CheckoutError('Checkout is unavailable.', 503)
  const config = shopConfig()
  const hash = createHash('sha256').update(JSON.stringify({attempt, input: snapshot.input, items: snapshot.items, total: snapshot.total, shipping: snapshot.shipping.amount, discount: snapshot.discount})).digest('hex')
  const customer = await stripe.customers.create({
    email: snapshot.input.email, name: snapshot.input.billing?.name || snapshot.input.address.name,
    phone: snapshot.input.phone || undefined,
    address: stripeAddress(snapshot.input.billing || snapshot.input.address),
    shipping: {name: snapshot.input.address.name, address: stripeAddress(snapshot.input.address), phone: snapshot.input.phone || undefined},
    metadata: {shop: SHOP_VERSION},
  }, {idempotencyKey: `lvx-customer-${hash}`})
  return stripe.checkout.sessions.create({
    mode: 'payment', customer: customer.id, customer_update: {address: 'auto', name: 'auto'},
    branding_settings: {display_name: 'LVX Collection', background_color: '#050404', button_color: '#ed3541', border_style: 'rectangular'},
    payment_method_types: ['card'], billing_address_collection: 'required',
    // Delivery address/service and coupon were already selected and reviewed on our site.
    // Do not collect a second editable delivery address after quoting Printful shipping.
    ...(snapshot.discount?.promotionId ? {discounts: [{promotion_code: snapshot.discount.promotionId}]} : {}),
    shipping_options: [{shipping_rate_data: {display_name: snapshot.shipping.name, type: 'fixed_amount', fixed_amount: {amount: snapshot.shipping.amount, currency: 'eur'}, tax_behavior: 'inclusive'}}],
    automatic_tax: {enabled: true},
    line_items: snapshot.items.map(item => ({quantity: item.quantity, price_data: {
      currency: 'eur', unit_amount: item.unitAmount, tax_behavior: 'inclusive',
      product_data: {name: `${item.name} — ${item.size}`, tax_code: productTaxCode(), metadata: {product_id: item.id, option: item.option || '', size: item.size, printful_variant_id: String(item.syncVariantId)}},
    }})),
    metadata: {shop: SHOP_VERSION, fulfilment: 'awaiting_payment', shipping_service: snapshot.shipping.id, shipping_name: snapshot.shipping.name},
    payment_intent_data: {receipt_email: snapshot.input.email, metadata: {shop: SHOP_VERSION}},
    success_url: `${config.origin}/community/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.origin}/community/shop/payment?cancelled=1`,
  }, {idempotencyKey: `lvx-${hash}`})
}
