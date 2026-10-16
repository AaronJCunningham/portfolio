# Shop product pages

The shop lives under `/community/shop`. Legacy `/shop` URLs permanently redirect to the equivalent nested URL, including individual products.

## Storefront availability

`SHOP_COMING_SOON` in `src/config/shop.ts` is `false`. The coming-soon popup and messaging are disabled. Prices, sizes, Add to cart, and the bag are available. Payment availability is separate: production requires configured Stripe/Printful credentials and the checkout readiness settings. Disconnected production checkout returns an unavailable message and never offers the simulated card form or issues a simulated order receipt.

Complete [checkout setup](checkout.md) to accept payments, then rebuild/redeploy. The offline purchase simulator is restricted to development and tests.

## Sharing on YouTube

After deployment, the product URLs are:

- LVX Polo: https://aaronjcunningham.com/community/shop/polo
- LVX Sweatshirt: https://aaronjcunningham.com/community/shop/sweatshirt

The old `long-sleeve` URL permanently redirects to `sweatshirt`; old saved sweatshirt carts migrate to Classic. New sweatshirt cart items include their fabric option. The beanie is removed from the catalog, its product URL returns 404, and saved carts containing it are rejected by cart validation.

Use these HTTPS URLs in channel profile links or long-form video descriptions. YouTube requires advanced features for clickable external links in long-form descriptions/comments. URLs in Shorts descriptions/comments and posts are not clickable. See [YouTube's link guidance](https://support.google.com/youtube/answer/13748639?hl=en).

Each product page is statically generated, works on direct entry, and includes its product title, description, canonical URL, and absolute Open Graph/Twitter image URL in the initial HTML. Tracking parameters such as `?utm_source=youtube&utm_medium=video_description` do not change the canonical URL. These tags provide metadata to platforms that use link previews; YouTube controls whether and how a preview appears.

YouTube Shopping product shelves, tags, and the Store tab require an eligible channel and a connected supported store. An image and arbitrary URL do not establish that connection. See [YouTube's store setup](https://support.google.com/youtube/answer/12258186?hl=en). This implementation does not connect a commerce platform or submit a product feed.

The store shows prices and keeps `noindex` until payment launch. Stripe Checkout and Printful draft fulfilment are implemented but disabled until configured. See [checkout setup](checkout.md) for credentials, coupon codes, shipping, and activation. Direct links still work. No purchasable Offer structured data is emitted yet.

For a future connected store/feed, use a stable product landing-page URL, an absolute primary image URL, and separate additional image URLs. Google requires mobile-friendly pages accessible without sign-in. See [landing-page links](https://support.google.com/merchants/answer/6324416?hl=en), [primary images](https://support.google.com/merchants/answer/6324350?hl=en), and [additional images](https://support.google.com/merchants/answer/6324370?hl=en). The current campaign photographs are JPEGs with a 2400px long edge; Next.js serves responsive image sizes.

## Adding product images

Catalog data lives in `src/components/shop/products.ts`. Keep IDs stable once links are shared. Add image files under `public/images/shop/`, then append their paths and meaningful alt text to the product's `images` array:

```ts
images: [
  {src: '/images/shop/lvx-polo-portrait.jpg', alt: 'Black LVX polo worn at a wooden doorway'},
  {src: '/images/shop/lvx-polo-ivy.jpg', alt: 'LVX polo beside an ivy-covered stone doorway'},
]
```

Only reference files that exist. The first image supplies the collection card and share image. Rebuild/redeploy after catalog changes. Each product has four distinct campaign photographs, including one shared portrait.

Selected source images, in gallery order:

| Product | Source files |
| --- | --- |
| Polo | `P1012305.jpg`, `polofirst2.jpg`, `both corner.jpg`, `perfect.jpg` |
| Sweatshirt | `nice_sweater.jpg`, `P1022362.jpg`, `me_02.jpg`, `perfect.jpg` |

The leads show the garments and emblems clearly. The supporting photos add wider styling, different wearers and a shared close portrait. Original photos remain untouched; web copies are resized and compressed under `public/images/shop/`.

## Gallery and cart

The gallery uses native horizontal scrolling and CSS scroll snap for touch gestures. With multiple images, it displays thumbnails, previous/next buttons, and an image count. Keyboard users can Tab to controls or use Left/Right/Home/End on the image area. It never advances automatically, respects reduced motion, and offers a full-size image link. With one image, thumbnails and arrows are hidden.

Desktop places the gallery beside product details; mobile stacks them. Thumbnails run vertically to the left of the main image, with previous/next buttons over its bottom-right corner. The image count and full-size link sit underneath. Visible thumbnails follow [Baymard's thumbnail research](https://baymard.com/research-articles/always-use-thumbnails-additional-images); keyboard controls follow [W3C's carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/).

`ShopLayout` owns the shared cart and is mounted in `_app.tsx` for shop routes. The cart is validated and persisted in local storage, including quantities and per-product sizes. Checkout and payment confirmation use the same layout. See [checkout setup](checkout.md).

The collection uses two columns above 700px and one column on mobile. Cards, main gallery images and thumbnails fill their portrait frames using `object-fit: cover` and a slightly raised crop position to preserve faces and garment graphics. The full-size link opens the uncropped photograph. The polo offers S–5XL, matching the eight black variants published to the Printful API store. Verified product details and sync variant IDs are recorded in `printful-polo.json` and `printful-sweatshirt.json`.

The single sweatshirt page has two fabric options, with prices approved on 2026-10-16:

| Option | Fabric | Sizes | Price |
| --- | --- | --- | --- |
| Classic | 288.2 g/m²; 65% cotton / 35% polyester, 100% cotton face; Cotton Heritage M2480 | S–3XL | €45 |
| Heavyweight | 350 g/m²; 100% organic ring-spun combed cotton; Stanley/Stella STSU178 | S–2XL | €55 |

The selector updates price, composition, description and available sizes. Campaign photographs show Classic; the page explains that fabric and fit vary. Printful advises US customers to order Heavyweight one size up. Cart identity includes product, fabric option and size, so the same size in both weights remains separate. Checkout uses server catalog prices and snapshots each decorated Printful sync variant for fulfilment.

All 19 sync variants have been verified through the Printful API. Connected Stripe sandbox checkout, signed webhook delivery, the correct three-item Printful draft, decline/cancel handling, duplicate delivery and a manual Stripe receipt passed on 2026-10-16. Deployment and live checkout activation are still outstanding; see [verification details](checkout.md#connected-test--2026-10-16).
