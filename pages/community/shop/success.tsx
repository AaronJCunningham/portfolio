import Link from 'next/link'
import {useEffect, useRef} from 'react'
import {useRouter} from 'next/router'
import type {GetServerSideProps} from 'next'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {useCart} from '@/components/shop/ShopLayout'
import {stripeClient} from '@/server/shop/stripe'
import {SHOP_VERSION} from '@/server/shop/checkout'
import {orderReference} from '@/server/shop/fulfilment'
import {CONTACT_EMAIL, CONTACT_EMAIL_HREF} from '@/config/contact'
import {SHOP_COMING_SOON} from '@/config/shop'

type Props = {status: 'paid' | 'pending' | 'unavailable'; sessionId: string | null; reference: string | null}
export default function Success({status, sessionId, reference}: Props) {
  const {hydrated, completePurchase} = useCart()
  const router = useRouter()
  const polls = useRef(0)
  useEffect(() => {
    if (status === 'paid' && sessionId && hydrated) completePurchase(sessionId)
  }, [status, sessionId, hydrated, completePurchase])
  useEffect(() => {
    if (status !== 'pending' || polls.current >= 6) return
    const timer = setInterval(() => {
      if (polls.current >= 6) { clearInterval(timer); return }
      polls.current += 1; void router.replace(router.asPath)
    }, 5000)
    return () => clearInterval(timer)
  }, [status, router])
  return <>
    <MetaDataHeader exactTitle title="Your order — LVX" content="Your LVX order confirmation." noIndex />
    <section className="shop-checkout shop-order-result" aria-labelledby="order-title">
      <p className="shop-product__eyebrow">LVX / {status === 'paid' ? 'THANK YOU' : 'YOUR ORDER'}</p>
      <h1 id="order-title">{status === 'paid' ? <>You’re part<br />of the collection.</> : status === 'pending' ? <>Confirming<br />your payment.</> : <>Let’s check<br />your order.</>}</h1>
      <p role="status">{status === 'paid' ? 'Your payment is confirmed. We’ll review your order before it goes into production.' : status === 'pending' ? 'We’re waiting for payment confirmation. Please wait a moment, then check again if needed.' : 'We couldn’t verify a payment on this page. If you’ve paid, contact us before placing another order.'}</p>
      {status === 'pending' && <button className="community-button" onClick={() => void router.replace(router.asPath)}>Check payment status <span>↗</span></button>}
      {reference && <p className="shop-order-reference">ORDER REFERENCE <span>{reference}</span></p>}
      <Link className="community-button" href="/community/shop">Back to the collection <span>↗</span></Link>
      <p className="shop-checkout__note">Questions about your order? <a href={CONTACT_EMAIL_HREF}>{CONTACT_EMAIL}</a></p>
    </section>
  </>
}

export const getServerSideProps: GetServerSideProps<Props> = async ({query, res}) => {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  const id = query.session_id
  const unavailable: Props = {status: 'unavailable', sessionId: null, reference: null}
  if (SHOP_COMING_SOON) return {props: unavailable}
  if (typeof id !== 'string' || !/^cs_(test_|live_)?[A-Za-z0-9]{10,250}$/.test(id) || !process.env.STRIPE_SECRET_KEY) return {props: unavailable}
  try {
    const session = await stripeClient().checkout.sessions.retrieve(id)
    if (session.metadata?.shop !== SHOP_VERSION) return {props: unavailable}
    const paid = session.status === 'complete' && ['paid', 'no_payment_required'].includes(session.payment_status)
    return {props: {status: paid ? 'paid' : session.status === 'complete' ? 'pending' : 'unavailable', sessionId: paid ? id : null, reference: paid ? orderReference(id) : null}}
  } catch { return {props: unavailable} }
}
