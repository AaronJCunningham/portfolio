import {CONTACT_EMAIL} from '../../config/contact'
import type {OrderReceipt} from '../../components/shop/checkout-types'
import {money} from '../../components/shop/products'
import {printfulRequest} from './printful'

export type Email = {subject: string; html: string; text: string}
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]!))
function template(subject: string, title: string, lines: string[], link?: {url: string; label: string}): Email {
  const safeLink = link && /^https:\/\//i.test(link.url) ? link : undefined
  return {subject, text: `${title}\n\n${lines.join('\n\n')}${safeLink ? `\n\n${safeLink.label}: ${safeLink.url}` : ''}\n\nQuestions? ${CONTACT_EMAIL}`, html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#080707;color:#eeeae4;font:16px Arial,sans-serif"><table role="presentation" style="width:100%;max-width:600px;margin:auto;padding:40px 24px"><tr><td><p style="color:#ed3541;font-size:12px;letter-spacing:3px">LVX COLLECTION</p><h1 style="font-size:34px;font-weight:400;line-height:1.2">${escape(title)}</h1>${lines.map(line => `<p style="line-height:1.7;white-space:pre-line">${escape(line)}</p>`).join('')}${safeLink ? `<p style="margin:32px 0"><a href="${escape(safeLink.url)}" style="background:#ed3541;color:#fff;padding:15px 24px;display:inline-block;text-decoration:none">${escape(safeLink.label)} ↗</a></p>` : ''}<hr style="border:0;border-top:1px solid #333;margin:32px 0"><p style="font-size:13px;color:#aaa">Questions about your order?<br><a href="mailto:${CONTACT_EMAIL}" style="color:#eeeae4">${CONTACT_EMAIL}</a></p></td></tr></table></body></html>`}
}
// Used for local email previews. Connected payment receipts are sent by Stripe.
export function orderEmail(receipt: OrderReceipt) {
  return template(`Your LVX order · ${receipt.reference}`, 'Thanks for your order.', [
    `Order ${receipt.reference}`, ...receipt.items.map(item => `${item.name} · ${item.size} × ${item.quantity} — ${money(item.amount / 100)}`),
    `Items: ${money(receipt.subtotal / 100)}${receipt.discount ? `\n${receipt.discount.code}: −${money(receipt.discount.amount / 100)}` : ''}\nShipping: ${money(receipt.shipping.amount / 100)}\n${receipt.tax.label}: ${money(receipt.tax.amount / 100)}\nTotal: ${money(receipt.total / 100)}`,
    `${receipt.address.name}\n${receipt.address.line1}\n${receipt.address.postalCode} ${receipt.address.city}\n${receipt.address.country}`,
    'Your items are made to order. Tracking details will follow when your package ships.',
  ])
}
export type Shipment = {id: number; carrier: string; tracking_number: string; tracking_url: string; items: {item_id: number; quantity: number}[]}
type ShippedOrder = {id: number; external_id: string; status: string; recipient: {email: string}; shipments: Shipment[]; items: {id: number; name: string}[]}
export function shippingEmail(order: ShippedOrder, shipment: Shipment) {
  return template('Your LVX package is on its way', 'On its way.', [
    `Order ${order.external_id}\nPackage ${shipment.id}`,
    ...shipment.items.map(item => `${order.items.find(product => product.id === item.item_id)?.name || 'LVX item'} × ${item.quantity}`),
    `${shipment.carrier}${shipment.tracking_number ? `\nTracking: ${shipment.tracking_number}` : ''}`,
    'This email covers the items in this package. Other items may arrive separately.',
  ], shipment.tracking_url ? {url: shipment.tracking_url, label: 'Track your package'} : undefined)
}
export async function sendShipment(orderId: number, shipmentId: number) {
  if (process.env.SHOP_CHECKOUT_ENABLED !== 'true' || process.env.SHOP_EMAIL_ENABLED !== 'true') throw new Error('Email delivery is disabled')
  if (!process.env.RESEND_API_KEY || !process.env.SHOP_EMAIL_FROM) throw new Error('Email delivery is not configured')
  // Never use the webhook payload's recipient, items or tracking URL. Fetch the trusted order.
  const order = await printfulRequest<ShippedOrder>(`/orders/${orderId}`)
  if (!/^lvx_[a-f0-9]{28}$/.test(order.external_id || '')) return
  const shipment = order.shipments.find(value => value.id === shipmentId)
  if (!shipment || !['partial', 'fulfilled'].includes(order.status)) throw new Error('Shipment is not yet available')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.recipient.email)) throw new Error('Customer email is missing')
  const message = shippingEmail(order, shipment)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `lvx-shipped-${order.id}-${shipment.id}`},
    body: JSON.stringify({from: process.env.SHOP_EMAIL_FROM, to: [order.recipient.email], reply_to: CONTACT_EMAIL, ...message}),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Shipping email delivery failed')
}
