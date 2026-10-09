export const sizes = ['S', 'M', 'L', 'XL', '2XL'] as const
export type Size = typeof sizes[number] | 'One size'

export type ProductImage = {src: string; alt: string}
export type Product = {
  id: string
  name: string
  price: number
  description: string
  sizes: readonly [Size, ...Size[]]
  images: [ProductImage, ...ProductImage[]]
}

// The first image is used on collection cards and in link previews.
// Repeated images preview the four-slide gallery; replace each entry with a real view later.
export const products: Product[] = [
  {
    id: 'polo',
    name: 'LVX Polo',
    price: 39,
    sizes,
    description: 'Black polo with a small red LVX emblem on the chest.',
    images: [
      {src: '/images/shop/lvx-polo.png', alt: 'Black LVX Polo with a small red LVX emblem on the chest'},
      {src: '/images/shop/lvx-polo.png', alt: 'Black LVX Polo with a small red LVX emblem on the chest'},
      {src: '/images/shop/lvx-polo.png', alt: 'Black LVX Polo with a small red LVX emblem on the chest'},
      {src: '/images/shop/lvx-polo.png', alt: 'Black LVX Polo with a small red LVX emblem on the chest'},
    ],
  },
  {
    id: 'long-sleeve',
    name: 'LVX Long Sleeve',
    price: 45,
    sizes,
    description: 'Black long sleeve with a red and white LVX print.',
    images: [
      {src: '/images/shop/lvx-long-sleeve.png', alt: 'Black LVX Long Sleeve with a red and white LVX print'},
      {src: '/images/shop/lvx-long-sleeve.png', alt: 'Black LVX Long Sleeve with a red and white LVX print'},
      {src: '/images/shop/lvx-long-sleeve.png', alt: 'Black LVX Long Sleeve with a red and white LVX print'},
      {src: '/images/shop/lvx-long-sleeve.png', alt: 'Black LVX Long Sleeve with a red and white LVX print'},
    ],
  },
  {
    id: 'beanie',
    name: 'LVX Beanie',
    price: 25,
    sizes: ['One size'],
    description: 'Black cuffed beanie with a red and white LVX emblem.',
    images: [
      {src: '/images/shop/lvx-beanie.png', alt: 'Black LVX Beanie with a red and white emblem on the cuff'},
      {src: '/images/shop/lvx-beanie.png', alt: 'Black LVX Beanie with a red and white emblem on the cuff'},
      {src: '/images/shop/lvx-beanie.png', alt: 'Black LVX Beanie with a red and white emblem on the cuff'},
      {src: '/images/shop/lvx-beanie.png', alt: 'Black LVX Beanie with a red and white emblem on the cuff'},
    ],
  },
]
export const shopOrigin = 'https://aaronjcunningham.com'
export const productPath = (product: Product) => `/community/shop/${product.id}`
export const productUrl = (product: Product) => `${shopOrigin}${productPath(product)}`
export const money = (value: number) => new Intl.NumberFormat('en-IE', {style: 'currency', currency: 'EUR'}).format(value)
