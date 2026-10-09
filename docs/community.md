# Community

The YouTube-facing area lives under `/community` and has its own navigation and black/red theme. The portfolio's main menu links to Community before Contact.

- `/community`: landing page with a mouse-responsive particle cloud.
- `/community/resources`: a reading-room placeholder with an explicit coming-soon state.
- `/community/shop`: merchandise collection.
- `/community/shop/[id]`: individual products.
- `/shop/:path*`: permanent redirects to the equivalent community shop URL; query parameters are preserved.

The landing page uses the existing Three.js WebGPU/TSL stack, with WebGL2 fallback. Particle simulation is independent of scroll. It pauses rendering while the document is hidden and uses fewer particles on mobile. Reduced-motion or data-saving preferences show a static background, as does a renderer failure.

Edit copy in `pages/community/index.tsx`, navigation in `CommunityHeader.tsx`, and the visual theme in `styles/_community.scss`. `CommunityCloud.tsx` owns the particle simulation and pointer response. Portfolio rendering is unchanged.

This is a public landing area. Member accounts, private content, and discussion features are not implemented. The shop remains a preview; see `shop.md`.
