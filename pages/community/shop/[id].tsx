import Link from 'next/link'
import {useState} from 'react'
import type {GetStaticPaths, GetStaticProps} from 'next'
import MetaDataHeader from '@/components/metadata/MetaDataHeader'
import ProductGallery from '@/components/shop/ProductGallery'
import {useAddToCart} from '@/components/shop/ShopLayout'
import {money, products, productUrl, shopOrigin} from '@/components/shop/products'
import type {Product, Size} from '@/components/shop/products'
import {SHOP_COMING_SOON} from '@/config/shop'

type Props = {product: Product}

function ProductDetails({product}: Props) {
  const [size, setSize] = useState<Size>(product.sizes.includes('M') ? 'M' : product.sizes[0])
  const addToCart = useAddToCart()

  return (
    <>
      <MetaDataHeader
        exactTitle
        title={`${product.name} — Aaron LVX`}
        content={`${product.description} From the LVX Collection, designed by Aaron J. Cunningham.`}
        canonical={productUrl(product)}
        image={`${shopOrigin}${product.images[0].src}`}
        imageAlt={product.images[0].alt}
        noIndex
      />
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <Link href="/community/shop">Shop</Link><span aria-hidden="true">/</span><span aria-current="page">{product.name}</span>
      </nav>
      <div className="shop-product">
        <ProductGallery product={product} />
        <section className="shop-product__details" aria-labelledby="product-title">
          <p className="shop-product__eyebrow">LVX / COLLECTION 001 / WINTER 2026</p>
          <h1 id="product-title">{product.name}</h1>
          {!SHOP_COMING_SOON && <p className="shop-product__price">{money(product.price)}</p>}
          <p className="shop-product__description">{product.description}</p>
          <p className="shop-product__color">COLOR <span>Black</span></p>
          <fieldset className="shop-sizes" disabled={SHOP_COMING_SOON} aria-describedby={SHOP_COMING_SOON ? 'shop-availability' : undefined}>
            <legend>SIZE</legend>
            {product.sizes.map(value => <label key={value}>
              <input type="radio" name="size" value={value} checked={size === value} onChange={() => setSize(value)} />
              <span>{value}</span>
            </label>)}
          </fieldset>
          <button className="work-pill shop-action" disabled={SHOP_COMING_SOON} onClick={() => addToCart(product, size)} aria-haspopup={SHOP_COMING_SOON ? undefined : 'dialog'} aria-describedby="shop-availability">{SHOP_COMING_SOON ? 'COMING SOON' : <>Add to cart <span aria-hidden="true">↗</span></>}</button>
          <p className="shop-preview-note" id="shop-availability">{SHOP_COMING_SOON ? 'This piece isn’t available to order yet. Shopping opens soon.' : 'Made to order. Shipping and discounts are shown at checkout.'}</p>
          <Link className="shop-product__back" href="/community/shop#collection">← Back to the collection</Link>
        </section>
      </div>
    </>
  )
}

export default function ProductPage({product}: Props) {
  return <ProductDetails key={product.id} product={product} />
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: products.map(product => ({params: {id: product.id}})),
  fallback: false,
})

export const getStaticProps: GetStaticProps<Props> = async ({params}) => {
  const product = products.find(item => item.id === params?.id)
  return product ? {props: {product}} : {notFound: true}
}
