import Image from 'next/image'
import Link from 'next/link'
import {products, productPath, money} from './products'
import {MAX_ITEM_QUANTITY, MAX_CART_QUANTITY} from './cart'
import type {CartItem} from './cart'

type Props = {items: CartItem[]; update: (item: CartItem, quantity: number) => void; onNavigate?: () => void}
export default function CartItems({items, update, onNavigate}: Props) {
  const count = items.reduce((total, item) => total + item.quantity, 0)
  return <div className="shop-cart-items">{items.map(item => {
    const product = products.find(product => product.id === item.id)!
    return <div className="shop-cart-item" key={`${item.id}-${item.size}`}>
      <Image src={product.images[0].src} alt={product.images[0].alt} width={70} height={90} />
      <div className="shop-cart-item__body">
        <h3><Link href={productPath(product)} onClick={onNavigate}>{product.name}</Link></h3>
        <p>Black / {item.size}</p>
        <div className="shop-quantity" role="group" aria-label={`Quantity for ${product.name}, ${item.size}`}>
          <button type="button" aria-label={`Decrease ${product.name}, ${item.size}`} disabled={item.quantity <= 1} onClick={() => update(item, item.quantity - 1)}>−</button>
          <span aria-live="polite">{item.quantity}</span>
          <button type="button" aria-label={`Increase ${product.name}, ${item.size}`} disabled={item.quantity >= MAX_ITEM_QUANTITY || count >= MAX_CART_QUANTITY} onClick={() => update(item, item.quantity + 1)}>+</button>
        </div>
        <button className="shop-remove" type="button" aria-label={`Remove ${product.name}, ${item.size}`} onClick={() => update(item, 0)}>Remove</button>
      </div>
      <strong>{money(product.price * item.quantity)}</strong>
    </div>
  })}</div>
}
