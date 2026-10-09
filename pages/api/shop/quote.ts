import type {NextApiRequest, NextApiResponse} from 'next'
import {calculateQuote, publicQuote} from '../../../src/server/shop/quote'
import {allowRequest, checkoutFailure} from '../../../src/server/shop/http'
export const config = {api: {bodyParser: {sizeLimit: '32kb'}}}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowRequest(req, res)) return
  try {return res.status(200).json(publicQuote(await calculateQuote(req.body)))}
  catch (error) {return checkoutFailure(res, error)}
}
