import {createHash} from 'node:crypto'
import type Stripe from 'stripe'
import {printfulRequest, PrintfulError} from './printful'
import {SHOP_VERSION} from './checkout'

type Order = {id: number; external_id: string; status: string}
export const orderReference = (sessionId: string) => `lvx_${createHash('sha256').update(sessionId).digest('hex').slice(0, 28)}`

async function findOrder(reference: string) {
  try { return await printfulRequest<Order>(`/orders/@${reference}`) }
  catch (error) { if (error instanceof PrintfulError && error.status === 404) return null; throw error }
}

// Durable deduplication lives in Printful's unique external_id, not server memory.
// Retrying after a timeout or a duplicate webhook finds the same order.
export async function fulfilCheckout(sessionId: string, stripe: Stripe) {
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.metadata?.shop !== SHOP_VERSION || session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status)) return
  if (session.metadata?.printful_order_id) return
  if (!session.livemode && process.env.PRINTFUL_TEST_DRAFTS !== 'true') {
    await stripe.checkout.sessions.update(sessionId, {metadata: {fulfilment: 'test_skipped'}})
    return
  }
  const reference = orderReference(sessionId)
  try {
    let order = await findOrder(reference)
    if (!order) {
      let shipping = session.collected_information?.shipping_details
      if (!shipping && session.customer) {
        const customer = typeof session.customer === 'string' ? await stripe.customers.retrieve(session.customer) : session.customer
        if (!customer.deleted && customer.shipping) shipping = customer.shipping as NonNullable<typeof shipping>
      }
      const address = shipping?.address
      if (!shipping?.name || !address?.line1 || !address.city || !address.country) throw new Error('Incomplete delivery address')
      const lines = await stripe.checkout.sessions.listLineItems(sessionId, {limit: 100, expand: ['data.price.product']})
      if (lines.has_more || !lines.data.length) throw new Error('Invalid order items')
      const items = lines.data.map(line => {
        const product = line.price?.product
        if (!product || typeof product === 'string' || product.deleted) throw new Error('Missing product snapshot')
        const id = Number(product.metadata.printful_variant_id)
        if (!Number.isSafeInteger(id) || id <= 0 || !line.quantity || line.quantity < 1 || line.quantity > 10) throw new Error('Invalid fulfilment snapshot')
        return {sync_variant_id: id, quantity: line.quantity}
      })
      try {
        order = await printfulRequest<Order>('/orders?confirm=0&update_existing=0', {
          external_id: reference, shipping: session.metadata?.shipping_service || 'STANDARD',
          recipient: {
            name: shipping.name, address1: address.line1, address2: address.line2 || undefined,
            city: address.city, state_code: address.state || undefined, country_code: address.country,
            zip: address.postal_code || undefined, email: session.customer_details?.email || undefined,
            phone: session.customer_details?.phone || undefined,
          },
          items,
        })
      } catch (error) {
        // Covers simultaneous deliveries and a successful write with a lost response.
        order = await findOrder(reference)
        if (!order) throw error
      }
    }
    await stripe.checkout.sessions.update(sessionId, {metadata: {
      fulfilment: 'draft_created', printful_order_id: String(order.id), order_reference: reference,
    }})
  } catch (error) {
    // Visible in Stripe; returning an error to the webhook makes Stripe retry.
    await stripe.checkout.sessions.update(sessionId, {metadata: {fulfilment: 'needs_attention', order_reference: reference}}).catch(() => {})
    throw error
  }
}
