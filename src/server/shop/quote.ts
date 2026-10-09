import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto'
import type Stripe from 'stripe'
import {products} from '../../components/shop/products'
import type {CheckoutInput, Discount, OrderQuote, QuotedItem, ShippingOption, Tax} from '../../components/shop/checkout-types'
import {shopConfig, variantId} from './config'
import {parseInput, CheckoutError} from './validation'
import {localDiscount, localShipping, localTax} from './local-provider'
import {checkVariant, printfulRequest} from './printful'
import {stripeClient} from './stripe'

export type Snapshot = Omit<OrderQuote, 'token'> & {version: 2; mode: 'local' | 'connected'; input: CheckoutInput}
export const connectedMode = () => process.env.SHOP_CHECKOUT_ENABLED === 'true'
function encryptionKey() {
  const secret = process.env.SHOP_QUOTE_SECRET
  if (connectedMode() && (!secret || secret.length < 32)) throw new CheckoutError('Checkout is temporarily unavailable.', 503)
  return createHash('sha256').update(secret || 'offline-checkout-only-never-accepted-in-connected-mode').digest()
}
export function sealQuote(snapshot: Snapshot) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(snapshot), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url')
}
export function openQuote(token: unknown, now = Date.now()): Snapshot {
  if (typeof token !== 'string' || token.length > 30000) throw new CheckoutError('Please calculate your order again.', 409)
  let value: Snapshot
  try {
    const bytes = Buffer.from(token, 'base64url')
    const cipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12))
    cipher.setAuthTag(bytes.subarray(12, 28))
    value = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'))
  } catch { throw new CheckoutError('Your order details have changed. Please calculate them again.', 409) }
  if (value.version !== 2 || value.mode !== (connectedMode() ? 'connected' : 'local') || !Number.isFinite(value.expiresAt) || value.expiresAt <= now) throw new CheckoutError('Your shipping quote has expired. Please refresh your order totals.', 409)
  return value
}
export const stripeAddress = (address: CheckoutInput['address']) => ({line1: address.line1, line2: address.line2 || undefined, city: address.city, country: address.country, postal_code: address.postalCode || undefined, state: address.state || undefined})
export const printfulAddress = (input: CheckoutInput) => ({name: input.address.name, address1: input.address.line1, address2: input.address.line2 || undefined, city: input.address.city, country_code: input.address.country, state_code: input.address.state || undefined, zip: input.address.postalCode || undefined, email: input.email, phone: input.phone || undefined})

async function promotion(code: string, subtotal: number, stripe: Stripe): Promise<Discount | null> {
  if (!code) return null
  const {data} = await stripe.promotionCodes.list({code, active: true, limit: 100, expand: ['data.promotion.coupon']})
  const promo = data.find(item => item.code.toUpperCase() === code && !item.customer && !item.customer_account)
  const fail = () => new CheckoutError('That code is invalid or isn’t available for this order.', 422, {coupon: 'That code is invalid or isn’t available for this order.'})
  if (!promo || promo.restrictions.first_time_transaction || (promo.expires_at && promo.expires_at * 1000 <= Date.now()) || (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions)) throw fail()
  const coupon = typeof promo.promotion.coupon === 'string' ? await stripe.coupons.retrieve(promo.promotion.coupon) : promo.promotion.coupon
  if (!coupon?.valid || coupon.applies_to?.products?.length) throw fail()
  const min = promo.restrictions.currency_options?.eur?.minimum_amount ?? promo.restrictions.minimum_amount
  if ((min && subtotal < min) || (promo.restrictions.minimum_amount_currency && promo.restrictions.minimum_amount_currency !== 'eur')) throw fail()
  const amount = coupon.percent_off !== null ? Math.round(subtotal * coupon.percent_off / 100) : coupon.currency === 'eur' ? coupon.amount_off : coupon.currency_options?.eur?.amount_off
  if (amount === null || amount === undefined) throw fail()
  return {code: promo.code, amount: Math.min(subtotal, amount), promotionId: promo.id}
}

// The discount is allocated in cents so the sum always matches the displayed amount.
export function discountedLines(items: QuotedItem[], discount: number) {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  let remaining = discount
  return items.map((item, index) => {
    const off = index === items.length - 1 ? remaining : Math.floor(discount * item.amount / subtotal)
    remaining -= off
    return {amount: item.amount - off, reference: `${item.id}:${item.size}`, tax_behavior: 'inclusive' as const, tax_code: process.env.STRIPE_PRODUCT_TAX_CODE || undefined}
  })
}

export async function calculateQuote(raw: unknown, stripeOverride?: Stripe): Promise<Snapshot> {
  const input = parseInput(raw)
  const connected = connectedMode()
  if (connected && shopConfig().countries.length && !shopConfig().countries.includes(input.address.country)) throw new CheckoutError('Delivery is not available to this country.', 422, {'address.country': 'Choose another destination.'})
  if (connected && !shopConfig().ready) throw new CheckoutError('Checkout is temporarily unavailable. Please try again shortly.', 503)
  const items: QuotedItem[] = input.items.map(item => {
    const product = products.find(product => product.id === item.id)!
    return {...item, name: product.name, unitAmount: Math.round(product.price * 100), amount: Math.round(product.price * 100) * item.quantity}
  })
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  let discount: Discount | null
  let shippingOptions: ShippingOption[]
  let tax: Tax
  const stripe = connected ? stripeOverride || stripeClient() : null
  if (connected) {
    await Promise.all(items.map(async item => {
      item.syncVariantId = variantId(item.id, item.size)
      const variant = await checkVariant(item.syncVariantId)
      item.catalogVariantId = variant.variant_id
      if (!item.catalogVariantId) throw new CheckoutError('An item is unavailable. Please update your bag.', 409)
    }))
    discount = await promotion(input.coupon, subtotal, stripe!)
    type Rate = {id: string; name: string; rate: string; currency: string; minDeliveryDays?: number; maxDeliveryDays?: number}
    const rates = await printfulRequest<Rate[]>('/shipping/rates', {recipient: printfulAddress(input), items: items.map(item => ({variant_id: item.catalogVariantId, quantity: item.quantity})), currency: 'EUR', locale: 'en_US'})
    shippingOptions = rates.filter(rate => rate.currency.toUpperCase() === 'EUR' && Number.isFinite(Number(rate.rate)) && Number(rate.rate) >= 0).map(rate => ({id: rate.id, name: rate.name, amount: Math.round(Number(rate.rate) * 100), minDays: rate.minDeliveryDays ?? null, maxDays: rate.maxDeliveryDays ?? null}))
  } else {
    discount = localDiscount(input.coupon, subtotal)
    shippingOptions = localShipping(input, items)
  }
  if (!shippingOptions.length) throw new CheckoutError('No delivery service is available for this address and these items. Try another address or update your bag.', 422, {'address.country': 'No delivery service is available for this order.'})
  const shipping = input.shippingId ? shippingOptions.find(option => option.id === input.shippingId) : shippingOptions[0]
  if (!shipping) throw new CheckoutError('That delivery option is no longer available. Please choose another.', 409)
  const discounted = subtotal - (discount?.amount || 0)
  let total = discounted + shipping.amount
  if (stripe) {
    const calculation = await stripe.tax.calculations.create({currency: 'eur', customer_details: {address: stripeAddress(input.address), address_source: 'shipping'}, line_items: discountedLines(items, discount?.amount || 0), shipping_cost: {amount: shipping.amount, tax_behavior: 'inclusive'}})
    total = calculation.amount_total
    tax = {amount: calculation.tax_amount_inclusive + calculation.tax_amount_exclusive, label: 'Tax (included)', inclusive: true, calculationId: calculation.id || undefined}
    if (calculation.tax_amount_exclusive !== 0) throw new CheckoutError('We couldn’t calculate a consistent total. Please try again.', 503)
  } else tax = localTax(input, total)
  return {version: 2, mode: connected ? 'connected' : 'local', input: {...input, shippingId: shipping.id}, items, subtotal, discount, shippingOptions, shipping, tax, total, expiresAt: Date.now() + 15 * 60 * 1000}
}
export function publicQuote(snapshot: Snapshot): OrderQuote {
  const {input, mode, version, ...quote} = snapshot
  return {...quote, token: sealQuote(snapshot)}
}
