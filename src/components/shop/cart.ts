import {products} from './products'
import type {Size} from './products'

export type CartItem = {id: string; size: Size; quantity: number}
export const CART_STORAGE_KEY = 'lvx-cart-v1'
export const MAX_ITEM_QUANTITY = 10
export const MAX_CART_QUANTITY = 30

// Shared validation; the server always obtains prices from its own catalog.
export function parseCart(input: unknown): CartItem[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) throw new Error('Your bag must contain between 1 and 20 selections.')
  const rows: CartItem[] = []
  for (const value of input) {
    if (!value || typeof value !== 'object') throw new Error('Invalid item in your bag.')
    const product = products.find(product => product.id === value.id)
    if (!product || !product.sizes.includes(value.size)) throw new Error('An item or size is no longer available. Please update your bag.')
    if (!Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > MAX_ITEM_QUANTITY) throw new Error('Choose between 1 and 10 of each item.')
    const existing = rows.find(row => row.id === value.id && row.size === value.size)
    if (existing) {
      existing.quantity += value.quantity
      if (existing.quantity > MAX_ITEM_QUANTITY) throw new Error('Choose between 1 and 10 of each item.')
    } else rows.push({id: product.id, size: value.size, quantity: value.quantity})
  }
  if (rows.reduce((sum, row) => sum + row.quantity, 0) > MAX_CART_QUANTITY) throw new Error('Please limit each order to 30 items.')
  return rows.sort((a, b) => `${a.id}:${a.size}`.localeCompare(`${b.id}:${b.size}`))
}
