import {productSelection} from './products'
import type {Size} from './products'

export type CartItem = {id: string; size: Size; quantity: number; option?: string}
export const cartItemKey = (item: Pick<CartItem, 'id' | 'size' | 'option'>) => `${item.id}:${item.option || ''}:${item.size}`
export function subtractPurchased(cart: CartItem[], purchased: CartItem[]) {
  return cart.flatMap(row => {
    const paid = purchased.find(item => cartItemKey(item) === cartItemKey(row))
    const quantity = row.quantity - (paid?.quantity || 0)
    return quantity > 0 ? [{...row, quantity}] : []
  })
}
export const CART_STORAGE_KEY = 'lvx-cart-v1'
export const MAX_ITEM_QUANTITY = 10
export const MAX_CART_QUANTITY = 30

// Shared validation; the server always obtains prices from its own catalog.
export function parseCart(input: unknown): CartItem[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) throw new Error('Your bag must contain between 1 and 20 selections.')
  const rows: CartItem[] = []
  for (const value of input) {
    if (!value || typeof value !== 'object') throw new Error('Invalid item in your bag.')
    const {product, option, sizes} = productSelection(value.id, value.option)
    if (!sizes.includes(value.size)) throw new Error('An item or size is no longer available. Please update your bag.')
    if (!Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > MAX_ITEM_QUANTITY) throw new Error('Choose between 1 and 10 of each item.')
    const item = {id: product.id, size: value.size, quantity: value.quantity, ...(option ? {option: option.id} : {})}
    const existing = rows.find(row => cartItemKey(row) === cartItemKey(item))
    if (existing) {
      existing.quantity += value.quantity
      if (existing.quantity > MAX_ITEM_QUANTITY) throw new Error('Choose between 1 and 10 of each item.')
    } else rows.push(item)
  }
  if (rows.reduce((sum, row) => sum + row.quantity, 0) > MAX_CART_QUANTITY) throw new Error('Please limit each order to 30 items.')
  return rows.sort((a, b) => cartItemKey(a).localeCompare(cartItemKey(b)))
}
