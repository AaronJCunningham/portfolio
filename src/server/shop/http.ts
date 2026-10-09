import type {NextApiRequest, NextApiResponse} from 'next'
import {shopConfig} from './config'
import {connectedMode} from './quote'
import {CheckoutError} from './validation'
import {SHOP_COMING_SOON} from '../../config/shop'

export function allowRequest(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') {res.setHeader('Allow', 'POST'); res.status(405).end(); return false}
  if (SHOP_COMING_SOON) {res.status(503).json({error: 'COMING SOON — shopping is not available yet.'}); return false}
  const origin = req.headers.origin
  let same = origin === shopConfig().origin
  // Offline localhost previews may run on a different port; never allow this in connected mode.
  if (!same && !connectedMode() && typeof origin === 'string') {
    try { const url = new URL(origin); same = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.host === req.headers.host } catch { same = false }
  }
  if (!same) {res.status(403).json({error: 'Please start checkout from the shop.'}); return false}
  return true
}
export function checkoutFailure(res: NextApiResponse, error: unknown) {
  if (error instanceof CheckoutError) return res.status(error.status).json({error: error.message, fields: error.fields})
  console.error('Checkout provider request failed', {type: error instanceof Error ? error.name : 'unknown'})
  return res.status(503).json({error: 'We couldn’t calculate your order right now. Your bag is saved. Please try again.'})
}
