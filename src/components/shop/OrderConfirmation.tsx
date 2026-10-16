import Link from 'next/link'
import {useEffect, useRef} from 'react'
import type {OrderReceipt} from './checkout-types'
import {countryName} from './destinations'
import {money} from './products'
import {cartItemKey} from './cart'
export default function OrderConfirmation({receipt}: {receipt: OrderReceipt}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {heading.current?.focus({preventScroll: true})}, [])
  const address = receipt.address
  return <section className="shop-checkout shop-order-result" aria-labelledby="order-title">
    <p className="shop-product__eyebrow">LVX / THANK YOU</p><h1 id="order-title" ref={heading} tabIndex={-1}>Thanks for<br />your order.</h1><p role="status">Your order has been received.</p>
    <p className="shop-order-reference">ORDER REFERENCE <span>{receipt.reference}</span></p>
    <div className="shop-confirmation-grid"><section><h2>Delivery</h2><p>{address.name}<br />{address.line1}{address.line2 && <><br />{address.line2}</>}<br />{address.postalCode} {address.city}{address.state && `, ${address.state}`}<br />{countryName(address.country)}</p><p>{receipt.shipping.name}<br />{receipt.shipping.minDays && receipt.shipping.maxDays ? `${receipt.shipping.minDays}–${receipt.shipping.maxDays} business days, estimated` : 'Delivery estimate confirmed after production'}</p><p>{receipt.email}</p></section><section><h2>Order details</h2>{receipt.items.map(item => <p key={cartItemKey(item)}>{item.name} · {item.size} × {item.quantity}</p>)}<div className="shop-total"><span>Items</span><strong>{money(receipt.subtotal / 100)}</strong></div>{receipt.discount && <div className="shop-total"><span>{receipt.discount.code}</span><strong>−{money(receipt.discount.amount / 100)}</strong></div>}<div className="shop-total"><span>Shipping</span><strong>{money(receipt.shipping.amount / 100)}</strong></div><div className="shop-total"><span>{receipt.tax.label}</span><strong>{money(receipt.tax.amount / 100)}</strong></div><div className="shop-total shop-total--final"><span>Total · EUR</span><strong>{money(receipt.total / 100)}</strong></div></section></div>
    <div className="shop-confirmation-actions"><Link className="community-button" href="/community/shop">Back to the collection <span>↗</span></Link><button className="shop-continue" onClick={() => window.print()}>Print order summary</button></div>
  </section>
}
