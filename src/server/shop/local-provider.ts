import type {CheckoutInput, Discount, QuotedItem, ShippingOption, Tax} from '../../components/shop/checkout-types'
import {CheckoutError} from './validation'

// Offline scenarios, NOT published Printful prices or a tax/legal rules database.
// These deliberately exercise destination, product, quantity, service and regional tax changes.
// Connected mode never reads this file's rates or coupons.
export const localCoupons: Record<string, {percent: number; expiresAt?: string}> = {LVXCOMM: {percent: 15}}
const eu = new Set('AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(' '))
export function localDiscount(code: string, subtotal: number, now = Date.now()): Discount | null {
  if (!code) return null
  const coupon = localCoupons[code]
  if (!coupon || (coupon.expiresAt && Date.parse(coupon.expiresAt) <= now)) throw new CheckoutError('That code is invalid or has expired.', 422, {coupon: 'That code is invalid or has expired.'})
  return {code, amount: Math.round(subtotal * coupon.percent / 100)}
}
export function localShipping(input: CheckoutInput, items: QuotedItem[]): ShippingOption[] {
  const {country, state, postalCode} = input.address
  if (['AQ', 'BV', 'HM', 'UM'].includes(country)) return []
  const zone = country === 'DE' ? 0 : eu.has(country) ? 1 : ['GB', 'US', 'CA'].includes(country) ? 2 : ['AU', 'NZ', 'JP'].includes(country) ? 3 : 4
  const base = [399, 599, 799, 999, 1299][zone]
  const extra = [125, 175, 225, 275, 325][zone]
  const apparel = items.filter(item => item.id !== 'beanie').reduce((sum, item) => sum + item.quantity, 0)
  const hats = items.filter(item => item.id === 'beanie').reduce((sum, item) => sum + item.quantity, 0)
  const remote = (country === 'US' && ['AK', 'HI'].includes(state)) || (country === 'AU' && postalCode.startsWith('08'))
  const amount = (apparel ? base + (apparel - 1) * extra : 0) + (hats ? base - 50 + (hats - 1) * extra : 0) + (remote ? 600 : 0)
  const minDays = [5, 7, 8, 10, 12][zone] + (remote ? 4 : 0)
  const standard = {id: 'STANDARD', name: 'Standard delivery', amount, minDays, maxDays: minDays + 7}
  return zone === 4 || remote ? [standard] : [standard, {id: 'EXPRESS', name: 'Express delivery', amount: amount + 950 + 100 * items.reduce((n, item) => n + item.quantity, 0), minDays: 3 + zone, maxDays: 7 + zone}]
}
export function localTax(input: CheckoutInput, amount: number): Tax {
  const rates: Record<string, number> = {DE: 1900, FR: 2000, IE: 2300, GB: 2000, NL: 2100, ES: 2100, IT: 2200, AU: 1000, NZ: 1500, JP: 1000, SG: 900, CH: 810, NO: 2500, SE: 2500, DK: 2500}
  const us: Record<string, number> = {CA: 725, NY: 887.5, TX: 825, OR: 0, DE: 0, NH: 0, MT: 0}
  const ca: Record<string, number> = {ON: 1300, AB: 500, BC: 1200, QC: 1497.5}
  const {country, state} = input.address
  const rate = country === 'US' ? (us[state] ?? 600) : country === 'CA' ? (ca[state] ?? 500) : (rates[country] ?? (eu.has(country) ? 2000 : 0))
  const name = eu.has(country) || country === 'GB' ? 'VAT' : ['AU', 'NZ', 'CA', 'SG'].includes(country) ? 'GST / tax' : 'Tax'
  return {amount: Math.round(amount * rate / (10000 + rate)), label: rate ? `${name} (${rate / 100}%, included)` : 'Tax (included)', inclusive: true}
}
