import {timingSafeEqual} from 'node:crypto'
import type {NextApiRequest, NextApiResponse} from 'next'
import {sendShipment} from '../../../src/server/shop/email'
import {SHOP_COMING_SOON} from '../../../src/config/shop'
export const config = {api: {bodyParser: {sizeLimit: '256kb'}}}
// Printful v1 webhook: authenticate with a private random URL token and re-fetch
// the order. Configure the token-bearing URL only in Printful, never in browser code.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {res.setHeader('Allow', 'POST'); return res.status(405).end()}
  if (SHOP_COMING_SOON) return res.status(503).end()
  const secret = process.env.PRINTFUL_WEBHOOK_SECRET || ''
  if (secret.length < 32 || process.env.SHOP_CHECKOUT_ENABLED !== 'true' || process.env.SHOP_EMAIL_ENABLED !== 'true') return res.status(503).end()
  const supplied = typeof req.query.token === 'string' ? req.query.token : ''
  if (Buffer.byteLength(secret) !== Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) return res.status(401).end()
  if (process.env.PRINTFUL_STORE_ID && String(req.body?.store) !== process.env.PRINTFUL_STORE_ID) return res.status(400).end()
  if (req.body?.type !== 'package_shipped') return res.status(200).json({received: true})
  const orderId = req.body?.data?.order?.id, shipmentId = req.body?.data?.shipment?.id
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isSafeInteger(shipmentId) || shipmentId <= 0) return res.status(400).end()
  try {await sendShipment(orderId, shipmentId); return res.status(200).json({received: true})}
  catch {console.error('LVX shipping email needs attention', {orderId, shipmentId}); return res.status(500).json({error: 'Shipping email pending; retry required'})}
}
