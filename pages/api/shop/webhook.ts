import type {NextApiRequest, NextApiResponse} from 'next'
import type Stripe from 'stripe'
import {stripeClient} from '../../../src/server/shop/stripe'
import {fulfilCheckout} from '../../../src/server/shop/fulfilment'
import {SHOP_COMING_SOON} from '../../../src/config/shop'

export const config = {api: {bodyParser: false}}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end() }
  // Keep provider work disabled during offline preparation. A retryable response
  // also preserves paid events if checkout is temporarily paused after launch.
  if (SHOP_COMING_SOON || process.env.SHOP_CHECKOUT_ENABLED !== 'true') return res.status(503).json({error: 'Checkout is disabled'})
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).end()
  const stripe = stripeClient()
  let event: Stripe.Event
  try {
    const chunks: Buffer[] = []
    let length = 0
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk)
      length += buffer.length
      if (length > 1024 * 1024) return res.status(413).end()
      chunks.push(buffer)
    }
    const signature = req.headers['stripe-signature']
    if (typeof signature !== 'string') return res.status(400).end()
    event = stripe.webhooks.constructEvent(Buffer.concat(chunks), signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch { return res.status(400).json({error: 'Invalid webhook'}) }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await fulfilCheckout(event.data.object.id, stripe)
    }
    return res.status(200).json({received: true})
  } catch {
    console.error('LVX fulfilment needs attention', {eventId: event.id})
    return res.status(500).json({error: 'Fulfilment pending; retry required'})
  }
}
