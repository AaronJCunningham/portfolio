import Image from 'next/image'
import Link from 'next/link'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import {money, products, productPath, shopOrigin} from '@/components/shop/products'
import {SHOP_COMING_SOON} from '@/config/shop'

export default function Shop() {
  return (
    <>
      <MetaDataHeader exactTitle title="Aaron LVX — Official Merch" content="Shop merch from Aaron LVX. Designed by Aaron J. Cunningham. Discover the LVX collection." canonical={`${shopOrigin}/community/shop`} image={`${shopOrigin}${products[0].images[0].src}`} imageAlt={products[0].images[0].alt} noIndex />
      <section className="shop-editorial" aria-labelledby="shop-title">
        <div className="shop-editorial__copy">
          <p className="shop-editorial__eyebrow"><span /> COLLECTION 001 / WINTER 2026</p>
          <h1 id="shop-title">The <em>LVX</em><br />Collection</h1>
          <p className="shop-editorial__intro">Designed by Aaron J. Cunningham.</p>
        </div>
      </section>

      <section id="collection" className="project-grid shop-products" aria-labelledby="shop-products-title">
        <header className="shop-collection-heading">
          <h2 id="shop-products-title">{SHOP_COMING_SOON ? 'Preview the collection' : 'Shop the collection'}</h2>
          <span>{String(products.length).padStart(2, '0')} PIECES</span>
        </header>
        <div className="main-grid-container shop-grid">
          {products.map((product, index) => (
            <Link className="work-card shop-card" key={product.id} href={productPath(product)} aria-label={`View ${product.name}`}>
              <span className="grid-container">
                <span className="work-card__meta"><span>{`//0${index + 1}`}</span><span>BLACK / {product.sizes.length === 1 ? product.sizes[0] : `${product.sizes[0]}–${product.sizes[product.sizes.length - 1]}`}</span></span>
                <span className="image_container"><span className="image_container__inner">
                  <Image src={product.images[0].src} alt={product.images[0].alt} fill sizes="(max-width: 700px) calc(100vw - 64px), 45vw" priority />
                </span></span>
                <span className="title-container"><span className="shop-card__title">{product.name}</span><span className="work-card__arrow" aria-hidden="true">↗</span></span>
                <span className="shop-card__details"><span>{product.description}</span>{!SHOP_COMING_SOON && <span className="shop-card__price">{product.options ? 'From ' : ''}{money(product.price)}</span>}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
