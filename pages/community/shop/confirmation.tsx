import Link from 'next/link'
import {useRouter} from 'next/router'
import {useEffect, useState} from 'react'
import type {GetServerSideProps} from 'next'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import OrderConfirmation from '@/components/shop/OrderConfirmation'
import type {OrderReceipt} from '@/components/shop/checkout-types'
import {connectedMode} from '@/server/shop/quote'
export default function Confirmation() {
  const router = useRouter()
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!router.isReady) return
    try {
      const reference = router.query.order
      if (typeof reference === 'string' && /^LVX-[A-F0-9]{12}$/.test(reference)) {
        const saved = JSON.parse(sessionStorage.getItem(`lvx-order:${reference}`) || 'null')
        if (saved?.reference === reference && Array.isArray(saved.items) && saved.address && saved.shipping && saved.tax && Number.isSafeInteger(saved.total)) setReceipt(saved)
      }
    } catch { /* A missing local receipt must not claim an order was placed. */ }
    setLoaded(true)
  }, [router.isReady, router.query.order])
  return <><MetaDataHeader exactTitle title="Your order — LVX" content="Your LVX order confirmation." noIndex />{receipt ? <OrderConfirmation receipt={receipt} /> : <section className="shop-checkout shop-order-result"><h1>{loaded ? 'Your order.' : 'Loading…'}</h1><p>{loaded ? 'This order summary isn’t available in this browser.' : 'Loading your order summary.'}</p><Link className="community-button" href="/community/shop">Back to the collection <span>↗</span></Link></section>}</>
}
export const getServerSideProps: GetServerSideProps = async ({res}) => {
  res.setHeader('Cache-Control', 'private, no-store')
  return connectedMode() ? {redirect: {destination: '/community/shop', permanent: false}} : {props: {}}
}
