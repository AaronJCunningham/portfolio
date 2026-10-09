import type {CartItem} from './cart'
export type Address = {name: string; line1: string; line2: string; city: string; postalCode: string; country: string; state: string}
export type CheckoutInput = {items: CartItem[]; email: string; phone: string; address: Address; billing: Address | null; coupon: string; shippingId?: string}
export type ShippingOption = {id: string; name: string; amount: number; minDays: number | null; maxDays: number | null}
export type QuotedItem = CartItem & {name: string; unitAmount: number; amount: number; syncVariantId?: number; catalogVariantId?: number}
export type Discount = {code: string; amount: number; promotionId?: string}
export type Tax = {amount: number; label: string; inclusive: boolean; calculationId?: string}
export type OrderQuote = {
  items: QuotedItem[]; subtotal: number; discount: Discount | null; shippingOptions: ShippingOption[];
  shipping: ShippingOption; tax: Tax; total: number; expiresAt: number; token: string;
}
export type OrderReceipt = Omit<OrderQuote, 'token' | 'shippingOptions'> & {reference: string; createdAt: string; email: string; address: Address; billing: Address | null}
