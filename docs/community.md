# Community

The YouTube-facing area lives under `/community` and has its own navigation and black/red theme. The portfolio's main menu links to Community before Contact.

- `/community`: landing page with a mouse-responsive particle cloud.
- `/community/resources`: a reading-room placeholder with an explicit coming-soon state.
- `/community/tools`: the tools collection.
- `/community/tools/glitch-studio`: free photo-to-video creation using the Motion Studio shader engine; see [Glitch Studio setup and rendering](glitch-studio.md).
- `/community/tools/tree-of-life`: a solid Tree of Life with swirling particles, using the null-site Proof of Belief aesthetic.
- `/community/shop`: merchandise collection.
- `/community/shop/[id]`: individual products.
- `/shop/:path*`: permanent redirects to the equivalent community shop URL; query parameters are preserved.

The landing page uses the existing Three.js WebGPU/TSL stack, with WebGL2 fallback. Particle simulation is independent of scroll. It pauses rendering while the document is hidden and uses fewer particles on mobile. Reduced-motion or data-saving preferences show a static background, as does a renderer failure.

Edit copy in `pages/community/index.tsx`, navigation in `CommunityHeader.tsx`, and the visual theme in `styles/_community.scss`. `CommunityCloud.tsx` owns the particle simulation and pointer response. Portfolio rendering is unchanged.

The tools directory uses a two-column card grid, switching to one column at 800px. Each card contains a static page preview, title, description and link; add future tools to `.community-tools__grid` in `pages/community/tools/index.tsx`. `public/tools/preview.jpg` is a screenshot of the directory used for its Open Graph and Twitter sharing image. Refresh this screenshot when the directory changes.

This is a public landing area. Member accounts, private content, and discussion features are not implemented. The shop remains a preview; see `shop.md`.

The Tree of Life page started as a complete copy of `proof-scene.tsx` and `proof-of-belief.tsx` from `~/programming/null-site/src/components/art/` into `src/components/community/tools/reference/`. It retains the reference's layout, sound, lighting, weathered material, particles, grain and scanlines. The tree now stays opaque and stationary in its assembled pose, and the film shader always uses the dark palette. Only the particle field and film grain animate. The text no longer cycles automatically; the movement timeline, restart control and pointer/keyboard deformation have been removed. Pause/resume and reduced-motion preferences stop the particles and grain.

`_tree-reference.scss` copies null-site's global CSS inside a scoped wrapper and resets inherited portfolio styles. The same IBM Plex Mono font is served locally. The previous custom Tree of Life renderer and page styling have been removed.

`tree-of-life-reference.glb` is generated from the original exported `tree-of-life.glb` by `node scripts/tree-of-life-model.cjs`. It preserves the binary mesh data and reference framing. To match the supplied book diagram, the Chokmah–Geburah and Binah–Chesed cylinders are repositioned as Netzach–Malkuth and Hod–Malkuth. All twenty-two paths carry the book’s path numbers (11–32) and Hebrew letters. The original export and `~/Movies/youtube/blender/tree-of-life-white.blend` remain unchanged.

The study view replaces the large changing words with `ThinFrame.tsx`, a reusable frame using the exact homepage border, corner marks and side ticks. `TreeInfoPanel.tsx` displays an introduction on load, then information for the sephirah or path under the pointer. Moving off the model restores the introduction unless a part has been selected. Clicking or tapping keeps details open so the panel can be scrolled; empty space or “Back to introduction” resets it. Keyboard users can focus the tree and use arrows, Home/End and Escape, then tab into its scrollable details. The panel keeps a fixed size as its content changes and scrolls internally if longer copy is added.

At widths up to 900px, the scene fills the dynamic viewport with no header or page footer. The veil labels overlay the scene. A thin-framed drawer peeks above the bottom edge with the current entry's title and meaning; tapping its edge or swiping up opens the full notes and cards. “Back to tree”, a downward swipe on the handle, or Escape collapses it. The tree is framed above the closed drawer so every sephirah remains visible. Navigation, sound and pause controls sit inside the expanded drawer, and its content scrolls independently of the full-screen scene.

Edit the introduction and all 32 entries in `src/components/community/tools/tree-content.json`. Each `modelKey` matches the GLB's `sephirah` or `connects` metadata. The path order and connections follow Diagram No. 6 in *A Garden of Pomegranates*, p. 68 (`IMG_8777.JPG`). Names use familiar transliterations while `sourceName` retains the chart's spelling. Kether and Tiphareth retain the existing site spelling (the text uses Keser and Tipharas).

All twenty-two paths include the supplied book’s correspondences and paraphrased descriptions, with page references inside each panel. Aleph (11, Kether–Chokmah) and Beth/Bes (12, Kether–Binah) use pp. 69–71 (`IMG_8776.JPG`, `IMG_8778.JPG`, `IMG_8779.JPG`). Gimel through Tav (13–32) use pp. 71–91, completed from `IMG_8780 2.JPG` and `IMG_8781.JPG` through `IMG_8789.JPG`. Entries include tarot, the stated elemental/planetary/zodiacal attribution, letter meaning and value, the other listed correspondences, card imagery and interpretive notes. Only correspondences actually stated in those pages are included; not every path has a colour or intelligence title in this text.

The assignments follow this edition: He is The Emperor / Aries, Tzaddi is The Star / Aquarius, Strength is VIII and Justice is XI. The blurry details on pp. 88–89 were checked against a [scan of the same text](https://www.labirintoermetico.com/06numerologia_cabala/Isreael_Regardie_A_Garden_Of_Pomegranates_2Nd%20Ed.pdf#page=48). Unusual historical terminology is attributed to the book; its pronunciation notes and spiritual interpretations are summaries of that source. `correspondences` and optional `sections` remain editable in the content file. The photographs themselves are not published.

Initial sephirah labels follow common English renderings; references: [The Sefirot](https://www.chabad.org/library/article_cdo/aid/361885/jewish/The-Sefirot.htm) and [What are the Sefirot?](https://neohasid.org/kabbalah/sefirot/).

Run `node --test tests/tree-of-life.test.cjs` to verify the full path order, all 32 content bindings, the actual endpoints of each rendered path, preservation of the original binary geometry, and all twenty-two tarot and elemental/planetary/zodiacal correspondences.

Above Kether, `.tree-veils` adds HTML text buttons for Ain (Nothing), Ain Soph (Limitless), and Ain Soph Aur (Limitless Light), in that order. Hovering or focusing a label shows its information in the left panel; clicking or tapping keeps it open. The tree's arrow-key navigation includes these three entries before the 32 model parts. Edit their descriptions and source links in the separate `veils` array in `tree-content.json`.

These are the three negative veils in the Hermetic Qabalah tradition: see the [Hermetic Order of the Golden Dawn dictionary](https://hermeticgoldendawn.org/h-o-g-d-dictionary/) and [Liber 777, Table I, columns II–III](https://hermetic.com/_media/93beast.fea.st/files/section1/777/liber_777.pdf). They are separate from the model and its 32 interactive parts; no GLB or scene geometry was changed to add them.

### Sephiroth and the three veils

All ten sephiroth now include the supplied chapter's meanings, correspondences, tarot attributions, explanatory sections and page references. Their sources are `IMG_8791.JPG`–`IMG_8805.JPG`, pp. 37–64; the three veil entries use the Ain and Kether discussion on pp. 42–43 and the related passages on pp. 51–52 and 62. The introduction includes the chapter's method of reading correspondences, three triads, the Abyss and tarot. The same panel renders sections and sources for the introduction as well as individual entries. User-facing terminology is **sephirah / sephiroth**.

### Colours and tarot scans

Each of the 32 model entries has a named `palette`. The stated colours follow this edition, including Teth's purple, Lamed's blue and Malkuth's citrine / olive / russet / black. Three path entries do not supply an explicit standalone colour: Beth uses Mercury/Hod's orange, He uses the Emperor's red robe, and Shin uses red for Fire. Each choice is documented in `palette.basis`, separate from the book's factual correspondence rows.

`reference/study-film.tsx` retains the original film, grain and scanlines. A depth-tested mask tints only the hovered geometry; a selected entry colours the entire visible sculpture and particle field. Hovering another entry previews its own colour while preserving the selected scene palette. Reset, Escape or clicking empty canvas restores the neutral study. Black is rendered as a dark pigment with neutral highlights so the form remains visible against the black ground. Malkuth uses four quadrants, and Daleth uses its two greens. The GLB geometry is unchanged.

Colour changes use frame-rate-independent exponential interpolation, settling over roughly half a second. Individual hover masks fade in and out, and single, double and four-colour palettes blend continuously. These interaction transitions still run when particles are paused. The information panel waits 100ms for a hover to settle, fades out over 140ms, replaces its content, then fades in over 280ms. Clicking skips the hover delay. New targets cancel pending swaps, keeping rapid sweeps from queuing stale cards; scroll resets only when the displayed entry changes. Reduced-motion preferences make both colour and content updates immediate.

`tarot-cards.json` and `public/tools/tree-of-life/tarot/sources.json` record all 78 scans, original source URLs, artist, edition, scan credit, dimensions, public-domain status and SHA-256 checksums. These are the **original 1909 Roses & Lilies Rider–Waite–Smith deck**, illustrated by Pamela Colman Smith, scanned from Saskia Jansen's collection and hosted by [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Rider-Waite_tarot_deck_(Roses_%26_Lilies)). The unmodified JPEGs are served locally. Images are lazy-loaded in the panel; selecting an image opens its full-size local scan, and each caption links to its Commons source page.

The 22 paths show their Major Arcana. The ten sephiroth show their four matching numbered cards, plus Kings at Chokmah, Queens at Binah, Knights at Tiphareth and Pages at Malkuth. The latter two include visible notes preserving the book's Princes or Knights (Jacks) and Princesses terminology. The three veils have no invented tarot-card assignments.

The Tree study has understated Old Aeon / New Aeon text controls (Old Aeon by default). New Aeon is currently a limited, reversible He/Tzaddi overlay: He shows the existing Star/Aquarius set and Tzaddi the Emperor/Aries set. Descriptive sections and colours travel with each set; New Aeon now uses the Thoth artwork described below. Letter meanings, numerical values, path intelligence titles, endpoints and model geometry stay attached to their original paths. The source JSON is unchanged; this is not a full Thoth correspondence edition. Switching mode also uses the panel fade and colour damping, including for an already pinned selection. Mobile controls sit above the three veils, within the full-height scene.


New Aeon displays all 78 Thoth cards from `thoth-cards.json`, stored locally under `public/tools/tree-of-life/thoth/`; Old Aeon continues to use the original Rider–Waite manifest and scans. The Thoth images were downloaded from the [TarotFans deck gallery](https://tarotfans.com/thoth-tarot-deck-review-aleister-crowley/), with original URLs, dimensions and SHA-256 checksums recorded per card in the manifest and public `sources.json`. Credits name Frieda Harris and Aleister Crowley; no public-domain claim is made for this deck. These are source gallery scans, not newly generated artwork. Thoth previews use Next image optimisation; full-size links retain the original downloaded files.

Card IDs express the existing cross-deck correspondence, not necessarily the printed numeral: `major-08` selects XI Lust for Teth, and `major-11` selects VIII Adjustment for Lamed. Temperance maps to Art, Judgement to The Aeon, World to The Universe, and Pentacles to Disks. Court IDs 11/12/13/14 select Princess/Prince/Queen/Knight respectively, preserving the existing assignments to Malkuth/Tiphareth/Binah/Chokmah. The path Tarot row and captions use Thoth names in New Aeon. Descriptive book passages remain the supplied source text; a short note beside the Thoth cards makes this distinction visible. The deck follows the panel’s displayed mode during its fade, preventing a new image from briefly appearing with the outgoing correspondence set.
