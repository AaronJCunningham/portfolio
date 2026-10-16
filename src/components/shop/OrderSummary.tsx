import {money, productSelection} from './products'
import {cartItemKey} from './cart'
import type {CartItem} from './cart'
import type {OrderQuote} from './checkout-types'
export default function OrderSummary({cart, quote, loading = false}: {cart: CartItem[]; quote: OrderQuote | null; loading?: boolean}) {
  const subtotal = cart.reduce((sum, item) => sum + Math.round(productSelection(item.id, item.option).price * 100) * item.quantity, 0)
  return <>
    <h2>Your order</h2>
    <ul className="shop-demo-items">{cart.map(item => {const selection = productSelection(item.id, item.option);return <li key={cartItemKey(item)}><span>{selection.name}<small>{selection.option && `${selection.option.fabricWeight} g/m² / `}{item.size} / Qty {item.quantity}</small></span><strong>{money(selection.price * item.quantity)}</strong></li>})}</ul>
    <div className="shop-total"><span>Subtotal</span><strong>{money(subtotal / 100)}</strong></div>
    {!!quote?.discount && <div className="shop-total shop-demo-discount"><span>{quote.discount.code}</span><strong>−{money(quote.discount.amount / 100)}</strong></div>}
    <div className="shop-total"><span>Shipping</span><strong>{quote ? money(quote.shipping.amount / 100) : 'Calculated next'}</strong></div>
    <div className="shop-total"><span>{quote?.tax.label || 'Tax'}</span><strong>{quote ? money(quote.tax.amount / 100) : 'Calculated next'}</strong></div>
    <div className="shop-total shop-total--final" aria-live="polite"><span>{quote ? 'Total · EUR' : 'Items · EUR'}</span><strong>{money((quote?.total ?? subtotal) / 100)}</strong></div>
    {loading && <p className="shop-checkout__note" role="status">Updating shipping and tax…</p>}
    {quote && <p className="shop-checkout__note">Tax is included in the total shown.</p>}
  </>
}
