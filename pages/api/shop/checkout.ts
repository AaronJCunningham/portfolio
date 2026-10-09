import {createHash} from 'node:crypto'
import type {NextApiRequest, NextApiResponse} from 'next'
import {createCheckout, revalidateQuote, validateAttempt} from '../../../src/server/shop/checkout'
import {connectedMode} from '../../../src/server/shop/quote'
import {stripeClient} from '../../../src/server/shop/stripe'
import {allowRequest, checkoutFailure} from '../../../src/server/shop/http'
import type {OrderReceipt} from '../../../src/components/shop/checkout-types'
export const config = {api: {bodyParser: {sizeLimit: '48kb'}}}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowRequest(req, res)) return
  try {
    validateAttempt(req.body?.attempt)
    const stripe = connectedMode() ? stripeClient() : undefined
    const snapshot = await revalidateQuote(req.body?.token, stripe)
    if (stripe) {
      const session = await createCheckout(snapshot, req.body.attempt, stripe)
      return res.status(200).json({url: session.url, sessionId: session.id})
    }
    const {input, mode, version, shippingOptions, ...details} = snapshot
    const receipt: OrderReceipt = {...details, reference: `LVX-${createHash('sha256').update(`${req.body.token}:${req.body.attempt}`).digest('hex').slice(0, 12).toUpperCase()}`, createdAt: new Date().toISOString(), email: input.email, address: input.address, billing: input.billing}
    // Offline completion only. No card data is accepted, no payment API or fulfilment runs.
    return res.status(200).json({receipt})
  } catch (error) {return checkoutFailure(res, error)}
}
