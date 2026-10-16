import Image from 'next/image'
import Link from 'next/link'
import {productSelection, productPath, money} from './products'
import {MAX_ITEM_QUANTITY, MAX_CART_QUANTITY, cartItemKey} from './cart'
import type {CartItem} from './cart'

type Props = {items: CartItem[]; update: (item: CartItem, quantity: number) => void; onNavigate?: () => void}
export default function CartItems({items, update, onNavigate}: Props) {
  const count = items.reduce((total, item) => total + item.quantity, 0)
  return <div className="shop-cart-items">{items.map(item => {
    const {product, option, name, price} = productSelection(item.id, item.option)
    return <div className="shop-cart-item" key={cartItemKey(item)}>
      <Image src={product.images[0].src} alt={product.images[0].alt} width={70} height={90} />
      <div className="shop-cart-item__body">
        <h3><Link href={productPath(product)} onClick={onNavigate}>{product.name}</Link></h3>
        <p>{option && <>{option.name} · {option.fabricWeight} g/m²<br /></>}Black / {item.size}</p>
        <div className="shop-quantity" role="group" aria-label={`Quantity for ${name}, ${item.size}`}>
          <button type="button" aria-label={`Decrease ${name}, ${item.size}`} disabled={item.quantity <= 1} onClick={() => update(item, item.quantity - 1)}>−</button>
          <span aria-live="polite">{item.quantity}</span>
          <button type="button" aria-label={`Increase ${name}, ${item.size}`} disabled={item.quantity >= MAX_ITEM_QUANTITY || count >= MAX_CART_QUANTITY} onClick={() => update(item, item.quantity + 1)}>+</button>
        </div>
        <button className="shop-remove" type="button" aria-label={`Remove ${name}, ${item.size}`} onClick={() => update(item, 0)}>Remove</button>
      </div>
      <strong>{money(price * item.quantity)}</strong>
    </div>
  })}</div>
}
