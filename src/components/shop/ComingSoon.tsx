import Link from 'next/link'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'

export default function ComingSoon() {
  return <>
    <MetaDataHeader exactTitle title="Coming soon — LVX" content="The LVX collection is coming soon. Browse the collection while we get ready." noIndex />
    <section className="shop-checkout shop-order-result" aria-labelledby="coming-soon-title">
      <p className="shop-product__eyebrow">LVX / COLLECTION 001</p>
      <h1 id="coming-soon-title">COMING SOON</h1>
      <p>The collection is on its way. Shopping will open soon.</p>
      <Link className="community-button" href="/community/shop">Explore the collection <span aria-hidden="true">↗</span></Link>
    </section>
  </>
}
