# Shop product pages

The shop lives under `/community/shop`. Legacy `/shop` URLs permanently redirect to the equivalent nested URL, including individual products.

## Public coming-soon mode

`SHOP_COMING_SOON` in `src/config/shop.ts` is currently `true`. The store loads normally, then a black-and-red **STORE COMING SOON** dialog opens after three seconds, thanking visitors and inviting them back in a day or two. It stays dismissed while navigating between shop pages. Leaving the store before the delay finishes cancels the popup. Visitors can close it with the Keep exploring button, close button, Escape, or a backdrop click. Product prices are hidden. Visitors can browse products and galleries, but sizes, the bag and purchase buttons are greyed out with **COMING SOON** messaging. Direct checkout/payment/confirmation URLs show a coming-soon page. Quote, checkout and provider webhook endpoints reject requests before contacting providers, even if credentials are configured. Existing saved bags are left untouched.

Keep this flag on for the public preview. When the store is ready, complete [checkout setup](checkout.md), deliberately change the flag to `false`, and rebuild/redeploy. The existing Stripe and Printful readiness settings still apply.

## Sharing on YouTube

After deployment, the product URLs are:

- LVX Polo: https://aaronjcunningham.com/community/shop/polo
- LVX Long Sleeve: https://aaronjcunningham.com/community/shop/long-sleeve
- LVX Beanie: https://aaronjcunningham.com/community/shop/beanie

Use these HTTPS URLs in channel profile links or long-form video descriptions. YouTube requires advanced features for clickable external links in long-form descriptions/comments. URLs in Shorts descriptions/comments and posts are not clickable. See [YouTube's link guidance](https://support.google.com/youtube/answer/13748639?hl=en).

Each product page is statically generated, works on direct entry, and includes its product title, description, canonical URL, and absolute Open Graph/Twitter image URL in the initial HTML. Tracking parameters such as `?utm_source=youtube&utm_medium=video_description` do not change the canonical URL. These tags provide metadata to platforms that use link previews; YouTube controls whether and how a preview appears.

YouTube Shopping product shelves, tags, and the Store tab require an eligible channel and a connected supported store. An image and arbitrary URL do not establish that connection. See [YouTube's store setup](https://support.google.com/youtube/answer/12258186?hl=en). This implementation does not connect a commerce platform or submit a product feed.

The store hides sample prices and keeps `noindex` until launch. Stripe Checkout and Printful draft fulfilment are implemented but disabled until configured. See [checkout setup](checkout.md) for credentials, coupon codes, shipping, and activation. Direct links still work. No purchasable Offer structured data is emitted while the shop remains a preview.

For a future connected store/feed, use a stable product landing-page URL, an absolute primary image URL, and separate additional image URLs. Google requires mobile-friendly pages accessible without sign-in. See [landing-page links](https://support.google.com/merchants/answer/6324416?hl=en), [primary images](https://support.google.com/merchants/answer/6324350?hl=en), and [additional images](https://support.google.com/merchants/answer/6324370?hl=en). The current images are 800 × 800; Google recommends 1500 × 1500 or larger for listing performance.

## Adding product images

Catalog data lives in `src/components/shop/products.ts`. Keep IDs stable once links are shared. Add image files under `public/images/shop/`, then append their paths and meaningful alt text to the product's `images` array:

```ts
images: [
  {src: '/images/shop/lvx-polo.png', alt: 'Black LVX Polo, front view'},
  {src: '/images/shop/lvx-polo-back.png', alt: 'Black LVX Polo, back view'},
  {src: '/images/shop/lvx-polo-detail.png', alt: 'Close-up of the red LVX chest emblem'},
]
```

Only reference files that exist. The first image supplies the collection card and share image. Rebuild/redeploy after catalog changes. Each product currently repeats its existing image in four slots so the full carousel can be previewed. Replace the repeated entries with the final image paths and alt text when ready.

## Gallery and cart

The gallery uses native horizontal scrolling and CSS scroll snap for touch gestures. With multiple images, it displays thumbnails, previous/next buttons, and an image count. Keyboard users can Tab to controls or use Left/Right/Home/End on the image area. It never advances automatically, respects reduced motion, and offers a full-size image link. With one image, thumbnails and arrows are hidden.

Desktop places the gallery beside product details; mobile stacks them. Thumbnails run vertically to the left of the main image, with previous/next buttons over its bottom-right corner. The image count and full-size link sit underneath. Visible thumbnails follow [Baymard's thumbnail research](https://baymard.com/research-articles/always-use-thumbnails-additional-images); keyboard controls follow [W3C's carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).

`ShopLayout` owns the shared cart and is mounted in `_app.tsx` for shop routes. The cart is validated and persisted in local storage, including quantities and per-product sizes. Checkout and payment confirmation use the same layout. See [checkout setup](checkout.md).

The collection uses three columns above 700px and one column on mobile. Sizes are configured per product; the beanie uses a sample one-size option and a temporary €25 demo price.
