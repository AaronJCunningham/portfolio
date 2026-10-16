export const sizes = ['S', 'M', 'L', 'XL', '2XL'] as const
export const poloSizes = [...sizes, '3XL', '4XL', '5XL'] as const
export type Size = typeof poloSizes[number] | 'One size'

export type ProductImage = {src: string; alt: string}
export type ProductOption = {
  id: string
  name: string
  price: number
  sizes: readonly [Size, ...Size[]]
  fabricWeight: number
  composition: string
  description: string
  fitNote?: string
}
export type Product = {
  id: string
  name: string
  price: number
  description: string
  sizes: readonly [Size, ...Size[]]
  images: [ProductImage, ...ProductImage[]]
  options?: [ProductOption, ...ProductOption[]]
}

// The first image is used on collection cards and in link previews.
// Campaign photos are ordered from the clearest garment view to supporting portraits.
export const products: Product[] = [
  {
    id: 'polo',
    name: 'LVX Polo',
    price: 39,
    sizes: poloSizes,
    description: 'Black premium piqué polo with a red and white LVX emblem embroidered on the left chest.',
    images: [
      {src: '/images/shop/lvx-polo-portrait.jpg', alt: 'Black LVX polo worn at a wooden doorway, showing the embroidered red and white chest emblem'},
      {src: '/images/shop/lvx-polo-ivy.jpg', alt: 'LVX polo styled with black trousers beside an ivy-covered stone doorway'},
      {src: '/images/shop/lvx-polo-and-sweatshirt.jpg', alt: 'Two models wearing the black LVX polo and printed sweatshirt against a stone wall'},
      {src: '/images/shop/lvx-shared-portrait.jpg', alt: 'Close portrait of two models wearing the LVX sweatshirt and polo, with both emblems visible'},
    ],
  },
  {
    id: 'sweatshirt',
    name: 'LVX Sweatshirt',
    price: 45,
    sizes: [...sizes, '3XL'],
    description: 'Black crewneck sweatshirt with a large red and white LVX print. Choose Classic or Heavyweight.',
    options: [
      {
        id: 'classic', name: 'Classic', price: 45, sizes: [...sizes, '3XL'],
        fabricWeight: 288.2, composition: '65% cotton, 35% polyester, with a 100% cotton face.',
        description: 'Soft fleece with a lighter feel for everyday wear and layering.',
      },
      {
        id: 'heavyweight', name: 'Heavyweight', price: 55, sizes,
        fabricWeight: 350, composition: '100% organic ring-spun combed cotton.',
        description: 'Denser fabric with more body and a regular fit.',
        fitNote: 'EU sizing. For your usual US size, Printful recommends ordering one size up.',
      },
    ],
    images: [
      {src: '/images/shop/lvx-sweatshirt-portrait.jpg', alt: 'Front view of the black LVX crewneck sweatshirt with its large red and white print'},
      {src: '/images/shop/lvx-sweatshirt-column.jpg', alt: 'LVX sweatshirt styled with a long black skirt beside a stone column'},
      {src: '/images/shop/lvx-sweatshirt-side.jpg', alt: 'Side view of another model wearing the LVX sweatshirt in dappled light'},
      {src: '/images/shop/lvx-shared-portrait.jpg', alt: 'Close portrait of two models wearing the LVX sweatshirt and polo, with both emblems visible'},
    ],
  },
]

// Keep price, available sizes and the chosen garment consistent in the UI and on the server.
export function productSelection(id: string, optionId?: unknown) {
  const legacy = id === 'long-sleeve'
  const product = products.find(product => product.id === (legacy ? 'sweatshirt' : id))
  if (!product) throw new Error('This item is no longer available. Please update your bag.')
  const requested = legacy && optionId === undefined ? 'classic' : optionId
  const option = product.options?.find(option => option.id === requested)
  if ((product.options && !option) || (!product.options && requested !== undefined)) {
    throw new Error('Choose a valid sweatshirt weight. Please update your bag.')
  }
  return {product, option, price: option?.price ?? product.price, sizes: option?.sizes ?? product.sizes,
    name: option ? `${product.name} — ${option.name}` : product.name}
}

export const shopOrigin = 'https://aaronjcunningham.com'
export const productPath = (product: Product) => `/community/shop/${product.id}`
export const productUrl = (product: Product) => `${shopOrigin}${productPath(product)}`
export const money = (value: number) => new Intl.NumberFormat('en-IE', {style: 'currency', currency: 'EUR'}).format(value)
