// Server only. Configure these in your hosting environment; never use NEXT_PUBLIC_ keys.
export function shopConfig() {
  let origin = ''
  try {
    const url = new URL(process.env.SHOP_ORIGIN || 'http://localhost:3000')
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) origin = url.origin
  } catch { /* Invalid configuration must keep checkout unavailable. */ }
  const countries = (process.env.SHOP_SHIPPING_COUNTRIES || '').split(',').map(value => value.trim().toUpperCase()).filter(Boolean)
  const taxMode = process.env.SHOP_TAX_MODE || 'unconfigured'
  const enabled = process.env.SHOP_CHECKOUT_ENABLED === 'true'
  const key = process.env.STRIPE_SECRET_KEY || ''
  const ready = enabled && !!origin && /^(sk|rk)_(test|live)_/.test(key) && !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.PRINTFUL_TOKEN &&
    (process.env.SHOP_QUOTE_SECRET?.length || 0) >= 32 && taxMode === 'automatic' &&
    (!/^([sr]k)_live_/.test(key) || (origin.startsWith('https:') && process.env.SHOP_LIVE_READY === 'true'))
  return {origin, countries, taxMode, ready}
}

// Map each local size to the decorated product's Printful SYNC variant ID.
// These are not blank catalog variant IDs or product template IDs.
export function variantId(id: string, size: string): number {
  const key = variantKey(id, size)
  const value = Number(process.env[key])
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Missing product mapping: ${key}`)
  return value
}

export const variantKey = (id: string, size: string) => `PRINTFUL_${id.replace(/-/g, '_').toUpperCase()}_${size.replace(/ /g, '_').toUpperCase()}`
