import {money, products} from './products'
import type {CartItem} from './cart'
import type {OrderQuote} from './checkout-types'
export default function OrderSummary({cart, quote, loading = false}: {cart: CartItem[]; quote: OrderQuote | null; loading?: boolean}) {
  const subtotal = cart.reduce((sum, item) => sum + Math.round(products.find(product => product.id === item.id)!.price * 100) * item.quantity, 0)
  return <>
    <h2>Your order</h2>
    <ul className="shop-demo-items">{cart.map(item => {const product = products.find(product => product.id === item.id)!;return <li key={`${item.id}-${item.size}`}><span>{product.name}<small>{item.size} / Qty {item.quantity}</small></span><strong>{money(product.price * item.quantity)}</strong></li>})}</ul>
    <div className="shop-total"><span>Subtotal</span><strong>{money(subtotal / 100)}</strong></div>
    {!!quote?.discount && <div className="shop-total shop-demo-discount"><span>{quote.discount.code}</span><strong>−{money(quote.discount.amount / 100)}</strong></div>}
    <div className="shop-total"><span>Shipping</span><strong>{quote ? money(quote.shipping.amount / 100) : 'Calculated next'}</strong></div>
    <div className="shop-total"><span>{quote?.tax.label || 'Tax'}</span><strong>{quote ? money(quote.tax.amount / 100) : 'Calculated next'}</strong></div>
    <div className="shop-total shop-total--final" aria-live="polite"><span>{quote ? 'Total · EUR' : 'Items · EUR'}</span><strong>{money((quote?.total ?? subtotal) / 100)}</strong></div>
    {loading && <p className="shop-checkout__note" role="status">Updating shipping and tax…</p>}
    {quote && <p className="shop-checkout__note">Tax is included in the total shown.</p>}
  </>
}
