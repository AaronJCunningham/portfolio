import {countryCodes, regions, postcodeOptional} from '../../components/shop/destinations'
import {parseCart} from '../../components/shop/cart'
import type {Address, CheckoutInput} from '../../components/shop/checkout-types'

export class CheckoutError extends Error {
  constructor(message: string, public status = 422, public fields: Record<string, string> = {}) { super(message) }
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const clean = (value: unknown, max = 150) => typeof value === 'string' ? value.trim().replace(/[\x00-\x1f]/g, '').slice(0, max) : ''
export function parseInput(raw: unknown): CheckoutInput {
  const data = record(raw)
  const fields: Record<string, string> = {}
  function address(input: unknown, prefix: string): Address {
    const data = record(input)
    const result: Address = {name: clean(data.name), line1: clean(data.line1), line2: clean(data.line2), city: clean(data.city), postalCode: clean(data.postalCode, 20).toUpperCase(), country: clean(data.country, 2).toUpperCase(), state: clean(data.state, 80)}
    for (const key of ['name', 'line1', 'city'] as const) if (!result[key]) fields[`${prefix}.${key}`] = 'Please complete this field.'
    if (!countryCodes.includes(result.country)) fields[`${prefix}.country`] = 'Choose a country.'
    if (regions[result.country] && !regions[result.country].some(region => region.code === result.state)) fields[`${prefix}.state`] = 'Choose a state or province.'
    if (!postcodeOptional.has(result.country) && !result.postalCode) fields[`${prefix}.postalCode`] = 'Enter your postal code.'
    const patterns: Record<string, RegExp> = {DE: /^\d{5}$/, US: /^\d{5}(-\d{4})?$/, CA: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/, AU: /^\d{4}$/, FR: /^\d{5}$/, GB: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/}
    if (result.postalCode && patterns[result.country] && !patterns[result.country].test(result.postalCode)) fields[`${prefix}.postalCode`] = 'Check the postal code for this country.'
    return result
  }
  const shipping = address(data.address, 'address')
  const billing = data.billing ? address(data.billing, 'billing') : null
  const email = clean(data.email, 254).toLowerCase()
  const phone = clean(data.phone, 40)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Enter a valid email address.'
  if (phone && !/^[+\d() .-]{5,40}$/.test(phone)) fields.phone = 'Enter a valid phone number.'
  if (Object.keys(fields).length) throw new CheckoutError('Please check your contact and delivery details.', 422, fields)
  let items
  try { items = parseCart(data.items) } catch (error) { throw new CheckoutError((error as Error).message) }
  return {items, email, phone, address: shipping, billing, coupon: clean(data.coupon, 40).toUpperCase(), shippingId: clean(data.shippingId, 100) || undefined}
}
