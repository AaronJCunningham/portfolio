import Link from 'next/link'
import {useRouter} from 'next/router'
import {useEffect, useRef, useState} from 'react'
import type {FormEvent} from 'react'
import type {GetServerSideProps} from 'next'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {useCart} from '@/components/shop/ShopLayout'
import AddressFields, {emptyAddress} from '@/components/shop/AddressFields'
import OrderSummary from '@/components/shop/OrderSummary'
import OrderConfirmation from '@/components/shop/OrderConfirmation'
import {countryName} from '@/components/shop/destinations'
import {money} from '@/components/shop/products'
import type {Address, CheckoutInput, OrderQuote, OrderReceipt} from '@/components/shop/checkout-types'
import {connectedMode} from '@/server/shop/quote'
import {CONTACT_EMAIL_HREF} from '@/config/contact'

type Details = Omit<CheckoutInput, 'items' | 'shippingId'>
const initialDetails = (): Details => ({email: '', phone: '', address: emptyAddress(), billing: null, coupon: ''})
const draftKey = 'lvx-delivery-v2'
const validAddress = (value: unknown): value is Address => !!value && typeof value === 'object' && Object.keys(emptyAddress()).every(key => typeof (value as Record<string, unknown>)[key] === 'string')
export default function Payment({local}: {local: boolean}) {
  const {cart, hydrated, completeDemoPurchase} = useCart()
  const router = useRouter()
  const [details, setDetails] = useState<Details>(initialDetails)
  const [loaded, setLoaded] = useState(false)
  const [step, setStep] = useState(0)
  const [quote, setQuote] = useState<OrderQuote | null>(null)
  const [code, setCode] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [expired, setExpired] = useState(false)
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null)
  const request = useRef<AbortController | null>(null)
  const revision = useRef(0)
  const lock = useRef(false)
  const attempt = useRef('')
  const heading = useRef<HTMLHeadingElement>(null)
  const signature = JSON.stringify(cart)
  const previousCart = useRef(signature)
  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); if (saved && typeof saved.email === 'string' && typeof saved.phone === 'string' && typeof saved.coupon === 'string' && validAddress(saved.address) && (saved.billing === null || validAddress(saved.billing))) {setDetails(saved); setCode(saved.coupon || '')} } catch { /* Start fresh if storage is unavailable. */ }
    setLoaded(true)
    return () => {request.current?.abort(); revision.current += 1}
  }, [])
  useEffect(() => {if (loaded) try {sessionStorage.setItem(draftKey, JSON.stringify(details))} catch { /* Checkout still works without storage. */ }}, [details, loaded])
  useEffect(() => {
    if (previousCart.current !== signature) {previousCart.current = signature; request.current?.abort(); revision.current += 1; setQuote(null); setLoading(false); setStep(0)}
  }, [signature])
  useEffect(() => {
    if (!quote) {setExpired(false); return}
    setExpired(quote.expiresAt <= Date.now())
    const timer = setTimeout(() => setExpired(true), Math.max(0, quote.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [quote])
  useEffect(() => {heading.current?.focus({preventScroll: true})}, [step, receipt])

  function editDetails(next: Details) {
    request.current?.abort(); revision.current += 1; setLoading(false); setDetails(next); setQuote(null); setError(''); setFields({})
  }
  async function getQuote(next = details, shippingId?: string, advance = false) {
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    const current = ++revision.current
    setLoading(true); setError(''); setFields({})
    try {
      const response = await fetch('/api/shop/quote', {method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal, body: JSON.stringify({...next, items: cart, shippingId})})
      const data = await response.json()
      if (current !== revision.current) return
      if (!response.ok) {setFields(data.fields || {}); throw new Error(data.error || 'We couldn’t calculate your order. Please try again.')}
      setDetails(next); setQuote(data); attempt.current = crypto.randomUUID()
      if (advance) {setStep(1); window.scrollTo({top: 0})}
    } catch (error) {
      if (current !== revision.current || controller.signal.aborted) return
      setError(error instanceof Error ? error.message : 'Please try again.')
    } finally {if (current === revision.current) setLoading(false)}
  }
  async function delivery(event: FormEvent) {event.preventDefault(); await getQuote(details, undefined, true)}
  async function coupon(event: FormEvent) {event.preventDefault(); await getQuote({...details, coupon: code.trim().toUpperCase()}, quote?.shipping.id)}
  async function placeOrder(event: FormEvent) {
    event.preventDefault()
    if (!quote || expired || loading || lock.current) return
    lock.current = true; setBusy(true); setError('')
    const purchased = cart.map(item => ({...item}))
    try {
      const response = await fetch('/api/shop/checkout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token: quote.token, attempt: attempt.current})})
      const data = await response.json()
      if (!response.ok) {if (response.status === 409) setExpired(true); throw new Error(data.error || 'Your order could not be completed. Please try again.')}
      if (data.url) {
        const url = new URL(data.url)
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Payment is unavailable. Please try again.')
        try {localStorage.setItem(`lvx-checkout:${data.sessionId}`, JSON.stringify(purchased))} catch { /* No card data is stored. */ }
        window.location.assign(url.href)
        return
      }
      if (!local || !data.receipt) throw new Error('Your order could not be confirmed. Please contact us.')
      const order: OrderReceipt = data.receipt
      setReceipt(order)
      let stored = false
      try {sessionStorage.setItem(`lvx-order:${order.reference}`, JSON.stringify(order)); sessionStorage.removeItem(draftKey); stored = true} catch { /* Keep the confirmation visible if storage is unavailable. */ }
      completeDemoPurchase(purchased)
      window.scrollTo({top: 0})
      if (stored) await router.push(`/community/shop/confirmation?order=${order.reference}`)
    } catch (error) {setError(error instanceof Error ? error.message : 'Please try again.')}
    finally {lock.current = false; setBusy(false)}
  }
  function addressText(address: Address) {return <>{address.name}<br />{address.line1}{address.line2 && <><br />{address.line2}</>}<br />{address.postalCode} {address.city}{address.state && `, ${address.state}`}<br />{countryName(address.country)}</>}
  const eta = (min: number | null, max: number | null) => min && max ? `${min}–${max} business days, estimated` : 'Delivery estimate confirmed after production'
  const problem = error || (expired ? 'Your shipping quote has expired. Refresh the totals before placing your order.' : '')
  return <>
    <MetaDataHeader exactTitle title="Checkout — LVX" content="Complete your LVX order." noIndex />
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><Link href="/community/shop">Shop</Link><span>/</span><Link href="/community/shop/checkout">Your bag</Link><span>/</span><span aria-current="page">{receipt ? 'Confirmation' : 'Checkout'}</span></nav>
    {receipt ? <OrderConfirmation receipt={receipt} /> : <section className="shop-checkout" aria-labelledby="payment-title">
      <header className="shop-checkout__heading"><p className="shop-product__eyebrow">LVX / CHECKOUT</p><h1 id="payment-title" ref={heading} tabIndex={-1}>{['Where to?', 'On its way.', 'Make it yours.'][step]}</h1><nav className="shop-checkout-steps" aria-label="Checkout progress">{['Delivery', 'Shipping', 'Payment'].map((label, index) => <button key={label} type="button" disabled={busy || index > step} aria-current={step === index ? 'step' : undefined} onClick={() => {setStep(index); setError('')}}><span>0{index + 1}</span>{label}</button>)}</nav></header>
      {router.query.cancelled && <p className="shop-checkout-notice">Payment was cancelled. Review your details and continue when ready.</p>}
      {!hydrated || !loaded ? <p role="status">Loading your bag…</p> : !cart.length ? <div className="shop-checkout-empty"><h2>Your bag is empty.</h2><Link className="community-button" href="/community/shop">Explore the collection <span>↗</span></Link></div> : <div className="shop-checkout__grid shop-demo-grid">
        <div>
          {step === 0 && <form id="delivery-form" className="shop-demo-form" onSubmit={delivery}><fieldset disabled={busy}><legend>Contact</legend><label>Email<input type="email" value={details.email} onChange={event => editDetails({...details, email: event.target.value})} autoComplete="email" required aria-invalid={!!fields.email} />{fields.email && <small className="shop-field-error">{fields.email}</small>}</label><label>Phone (optional)<input type="tel" value={details.phone} onChange={event => editDetails({...details, phone: event.target.value})} autoComplete="tel" maxLength={40} aria-invalid={!!fields.phone} />{fields.phone && <small className="shop-field-error">{fields.phone}</small>}</label></fieldset><fieldset disabled={busy}><legend>Delivery address</legend><AddressFields value={details.address} prefix="address" onChange={address => editDetails({...details, address})} errors={fields} /></fieldset><label className="shop-checkout-checkbox"><input type="checkbox" checked={!details.billing} onChange={event => editDetails({...details, billing: event.target.checked ? null : {...details.address}})} />Billing address is the same as delivery</label>{details.billing && <fieldset><legend>Billing address</legend><AddressFields value={details.billing} prefix="billing" onChange={billing => editDetails({...details, billing})} errors={fields} /></fieldset>}</form>}
          {step === 1 && quote && <section className="shop-shipping-options"><div className="shop-review-section"><h2>Deliver to</h2><p>{addressText(details.address)}</p><button onClick={() => setStep(0)}>Edit address</button></div><fieldset disabled={loading}><legend>Choose delivery</legend>{quote.shippingOptions.map(option => <label key={option.id} className={quote.shipping.id === option.id ? 'is-selected' : ''}><input type="radio" name="shipping" value={option.id} checked={quote.shipping.id === option.id} onChange={() => void getQuote(details, option.id)} /><span><strong>{option.name}</strong><small>{eta(option.minDays, option.maxDays)}</small></span><strong>{money(option.amount / 100)}</strong></label>)}</fieldset><p className="shop-checkout__note">Items are made to order and may arrive in separate packages. Delivery dates are estimates.</p></section>}
          {step === 2 && quote && <><div className="shop-review-section"><h2>Review your details</h2><p>{details.email}{details.phone && <><br />{details.phone}</>}</p><p>{addressText(details.address)}</p><button onClick={() => setStep(0)}>Edit contact or address</button><p>{quote.shipping.name}<br />{eta(quote.shipping.minDays, quote.shipping.maxDays)}</p><button onClick={() => setStep(1)}>Change delivery</button>{details.billing && <><h3>Billing address</h3><p>{addressText(details.billing)}</p></>}</div><form id="payment-form" className="shop-demo-form" onSubmit={placeOrder}><fieldset disabled={busy}><legend>Payment</legend>{local ? <><label>Name on card<input name="card-name" defaultValue={details.billing?.name || details.address.name} autoComplete="off" required /></label><label>Card number<input name="card-number" inputMode="numeric" placeholder="4242 4242 4242 4242" pattern="[0-9 ]{13,23}" maxLength={23} onChange={event => {event.currentTarget.value = event.currentTarget.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()}} autoComplete="off" required /></label><div className="shop-demo-fields"><label>Expiry date<input name="card-expiry" inputMode="numeric" placeholder="MM/YY" pattern="[0-9]{2}/[0-9]{2}" maxLength={5} onChange={event => {const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, 4); event.currentTarget.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits}} autoComplete="off" required /></label><label>CVC<input name="card-cvc" inputMode="numeric" placeholder="123" pattern="[0-9]{3,4}" maxLength={4} autoComplete="off" required /></label></div></> : <p className="shop-checkout__note">Continue to secure payment with Stripe.</p>}</fieldset></form></>}
        </div>
        <aside className="shop-checkout__summary" aria-label="Order summary"><OrderSummary cart={cart} quote={quote} loading={loading} />
          {step > 0 && <form className="shop-demo-coupon" onSubmit={coupon}><label htmlFor="coupon-code">Community or sale code</label><div><input id="coupon-code" value={code} onChange={event => setCode(event.target.value)} placeholder="Enter code" disabled={busy || loading} autoCapitalize="characters" /><button disabled={busy || loading || !code.trim()} type="submit">Apply</button></div>{quote?.discount && <button className="shop-demo-remove-code" type="button" disabled={loading || busy} onClick={() => {setCode(''); void getQuote({...details, coupon: ''}, quote.shipping.id)}}>Remove {quote.discount.code}</button>}</form>}
          {problem && <div className="shop-checkout-error" role="alert"><p>{problem}</p>{step > 0 && <button type="button" disabled={loading || busy} onClick={() => void getQuote(details)}>Refresh order totals</button>}</div>}
          {step === 0 ? <button className="work-pill shop-action" type="submit" form="delivery-form" disabled={loading}>{loading ? 'Calculating…' : 'Continue to shipping'}<span>↗</span></button> : step === 1 ? <button className="work-pill shop-action" disabled={loading || !quote || expired} onClick={() => {setStep(2); setError(''); window.scrollTo({top: 0})}}>Continue to payment <span>↗</span></button> : <button className="work-pill shop-action" type="submit" form="payment-form" disabled={busy || loading || !quote || expired}>{busy ? 'Processing…' : local ? `Place order · ${money((quote?.total || 0) / 100)}` : 'Continue to secure payment'}<span>↗</span></button>}
          <p className="shop-checkout__note"><a href={CONTACT_EMAIL_HREF}>Questions about your order?</a></p><Link className="shop-product__back" href="/community/shop/checkout">← Back to your bag</Link>
        </aside>
      </div>}
    </section>}
  </>
}
export const getServerSideProps: GetServerSideProps = async ({res}) => {res.setHeader('Cache-Control', 'private, no-store'); return {props: {local: !connectedMode()}}}
