import Link from 'next/link'
import {useRouter} from 'next/router'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import CartItems from '@/components/shop/CartItems'
import OrderSummary from '@/components/shop/OrderSummary'
import {useCart} from '@/components/shop/ShopLayout'
import {CONTACT_EMAIL, CONTACT_EMAIL_HREF} from '@/config/contact'
export default function Checkout() {
  const {cart, hydrated, update} = useCart()
  const router = useRouter()
  return <>
    <MetaDataHeader exactTitle title="Your bag — LVX" content="Review your LVX selection and continue to checkout." noIndex />
    <nav className="shop-breadcrumb" aria-label="Breadcrumb"><Link href="/community/shop">Shop</Link><span>/</span><span aria-current="page">Your bag</span></nav>
    <section className="shop-checkout" aria-labelledby="checkout-title">
      <header className="shop-checkout__heading"><p className="shop-product__eyebrow">LVX / YOUR SELECTION</p><h1 id="checkout-title">Your bag.</h1></header>
      {router.query.cancelled === '1' && <p className="shop-checkout-notice" role="status">Checkout was cancelled. Your bag is saved.</p>}
      {!hydrated ? <p role="status">Loading your bag…</p> : !cart.length ? <div className="shop-checkout-empty"><h2>Your bag is empty.</h2><Link className="community-button" href="/community/shop">Explore the collection <span>↗</span></Link></div> : <div className="shop-checkout__grid">
        <div><h2 className="shop-checkout__label">Your items</h2><CartItems items={cart} update={update} /></div>
        <aside className="shop-checkout__summary" aria-label="Order summary"><OrderSummary cart={cart} quote={null} /><p className="shop-checkout__note">Delivery options and tax are calculated for your address. You can apply a code before paying.</p><Link className="work-pill shop-action" href="/community/shop/payment">Continue to checkout <span>↗</span></Link><p className="shop-checkout__note"><a className="shop-checkout__help" href={CONTACT_EMAIL_HREF}>{CONTACT_EMAIL}</a></p></aside>
      </div>}
      <Link className="shop-product__back" href="/community/shop">← Back to the collection</Link>
    </section>
  </>
}
