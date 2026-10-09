import Link from 'next/link'
import {useRouter} from 'next/router'
import {createContext, useContext, useEffect, useRef, useState} from 'react'
import type {ReactNode} from 'react'
import {money, products} from './products'
import type {Product, Size} from './products'
import {CART_STORAGE_KEY, parseCart} from './cart'
import type {CartItem} from './cart'
import CartItems from './CartItems'
import CommunityHeader from '@/components/community/CommunityHeader'
import ComingSoon from './ComingSoon'
import StoreAnnouncement from './StoreAnnouncement'
import {SHOP_COMING_SOON} from '@/config/shop'

const purchaseRoutes = new Set(['/community/shop/checkout', '/community/shop/payment', '/community/shop/confirmation', '/community/shop/success'])

type CartState = {
  cart: CartItem[]; hydrated: boolean; subtotal: number;
  add: (product: Product, size: Size) => void;
  update: (item: CartItem, quantity: number) => void;
  completePurchase: (sessionId: string) => void;
  completeDemoPurchase: (items: CartItem[]) => void;
}
const CartContext = createContext<CartState | null>(null)
export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('Shop pages require ShopLayout')
  return cart
}
export function useAddToCart() { return useCart().add }

export default function ShopLayout({children}: {children: ReactNode}) {
  const {pathname} = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (SHOP_COMING_SOON) {setHydrated(true); return}
    try { const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]'); if (saved.length) setCart(parseCart(saved)) } catch { /* Discard invalid or outdated local data. */ }
    setHydrated(true)
  }, [])
  useEffect(() => {
    if (hydrated && !SHOP_COMING_SOON) try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)) } catch { /* The bag still works when storage is unavailable. */ }
  }, [cart, hydrated])
  const count = cart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + products.find(product => product.id === item.id)!.price * item.quantity, 0)

  function add(product: Product, size: Size) {
    if (SHOP_COMING_SOON) return
    try { setCart(parseCart([...cart, {id: product.id, size, quantity: 1}])); setMessage('') }
    catch (error) { setMessage((error as Error).message) }
    dialog.current?.showModal()
  }
  function update(item: CartItem, quantity: number) {
    if (SHOP_COMING_SOON) return
    const next = cart.flatMap(row => row.id === item.id && row.size === item.size ? (quantity ? [{...row, quantity}] : []) : [row])
    try { setCart(next.length ? parseCart(next) : []); setMessage('') } catch (error) { setMessage((error as Error).message) }
  }
  function completePurchase(sessionId: string) {
    if (!hydrated) return
    try {
      const key = `lvx-checkout:${sessionId}`
      const saved = localStorage.getItem(key)
      if (!saved) return
      const purchased = parseCart(JSON.parse(saved))
      const remaining = cart.flatMap(row => {
        const paid = purchased.find(item => item.id === row.id && item.size === row.size)
        const quantity = row.quantity - (paid?.quantity || 0)
        return quantity > 0 ? [{...row, quantity}] : []
      })
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(remaining))
      localStorage.removeItem(key)
      setCart(remaining)
    } catch { /* Never clear an unrelated bag or an unverified purchase. */ }
  }

  function completeDemoPurchase(items: CartItem[]) {
    setCart(current => current.flatMap(row => {
      const purchased = items.find(item => item.id === row.id && item.size === row.size)
      const quantity = row.quantity - (purchased?.quantity || 0)
      return quantity > 0 ? [{...row, quantity}] : []
    }))
  }

  return <CartContext.Provider value={{cart, hydrated, subtotal, add, update, completePurchase, completeDemoPurchase}}>
    <div className="work-experience shop-experience">
      <main className="work-page">
        <CommunityHeader actions={<button className="shop-cart-toggle" disabled={SHOP_COMING_SOON} onClick={() => dialog.current?.showModal()} aria-haspopup={SHOP_COMING_SOON ? undefined : 'dialog'}>Bag {SHOP_COMING_SOON ? <span className="shop-cart-status">COMING SOON</span> : <span className="shop-cart-count">{String(count).padStart(2, '0')}</span>}</button>} />
        {SHOP_COMING_SOON && purchaseRoutes.has(pathname) ? <ComingSoon /> : children}
      </main>
      <footer className="shop-footer">
        <span>© {new Date().getFullYear()} AARON LVX</span>
        <nav aria-label="Shop information"><Link href="/contact">Contact</Link><Link href="/impressum">Imprint</Link><Link href="/datenschutz">Privacy</Link></nav>
      </footer>
      {SHOP_COMING_SOON && <StoreAnnouncement />}
      {!SHOP_COMING_SOON && <dialog ref={dialog} className="shop-dialog" aria-labelledby="shop-cart-title" onClick={event => {if (event.target === dialog.current) dialog.current?.close()}}>
        <div className="shop-dialog__inner">
          <button className="shop-dialog__close" onClick={() => dialog.current?.close()} aria-label="Close cart">✕</button>
          <div className="work-kicker"><span>{'// YOUR BAG'}</span><span>{count} {count === 1 ? 'ITEM' : 'ITEMS'}</span></div>
          <h2 id="shop-cart-title">Your selection</h2>
          {message && <p role="alert" className="shop-checkout-error">{message}</p>}
          {!cart.length ? <p>Your bag is empty.</p> : <>
            <CartItems items={cart} update={update} onNavigate={() => dialog.current?.close()} />
            <div className="shop-total"><span>SUBTOTAL</span><strong>{money(subtotal)}</strong></div>
            <p className="shop-preview-note">Shipping and discounts are shown at checkout.</p>
            <Link className="work-pill shop-action" href="/community/shop/checkout" onClick={() => dialog.current?.close()}>Review your order <span aria-hidden="true">↗</span></Link>
          </>}
          <button className="shop-continue" onClick={() => dialog.current?.close()}>Continue shopping →</button>
        </div>
      </dialog>}
    </div>
  </CartContext.Provider>
}
