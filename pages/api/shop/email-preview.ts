import type {NextApiRequest, NextApiResponse} from 'next'
import {orderEmail, shippingEmail} from '../../../src/server/shop/email'
import {calculateQuote} from '../../../src/server/shop/quote'
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (process.env.NODE_ENV !== 'development' || process.env.SHOP_CHECKOUT_ENABLED === 'true') return res.status(404).end()
  if (req.method !== 'GET') {res.setHeader('Allow', 'GET'); return res.status(405).end()}
  const address = {name: 'Alex Morgan', line1: 'Example Street 12', line2: '', city: 'Berlin', postalCode: '10115', country: 'DE', state: ''}
  const quote = await calculateQuote({items: [{id: 'polo', size: 'M', quantity: 1}], email: 'alex@example.com', phone: '', address, billing: null, coupon: 'LVXCOMM'})
  const shipment = {id: 1, carrier: 'DHL', tracking_number: '1234567890', tracking_url: 'https://www.dhl.com/', items: [{item_id: 1, quantity: 1}]}
  const email = req.query.type === 'shipping' ? shippingEmail({id: 1, external_id: 'LVX-001', status: 'fulfilled', recipient: {email: 'alex@example.com'}, shipments: [shipment], items: [{id: 1, name: 'LVX Polo'}]}, shipment) : orderEmail({...quote, reference: 'LVX-001', createdAt: new Date().toISOString(), email: 'alex@example.com', address, billing: null})
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
  return res.status(200).send(email.html)
}
