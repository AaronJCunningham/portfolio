# Berlin Driving Simulator

Added locally on 23 October 2026. No deployment or Sanity publication was performed.

The case study now highlights Berlin's map-data pipeline, procedural generation and custom landmark work.

## Portfolio flow

- `/work`: a playable project card, with a real screenshot and an excerpt introducing the mapped city and ways to explore it.
- `/berlin-driving-simulator`: a project article covering the OpenStreetMap pipeline, procedural generation, custom landmarks, interaction refinements and rendering at city scale. It includes an Explore Berlin action, a single linked Mr. Doob credit near the top, screenshots, Aaron's contribution and AI-assisted development disclosure.
- `/play/berlin`: a full-document rewrite to the standalone simulator. Its back arrow returns to the article, and “Original NYC version by Mr. Doob” opens `https://mrdoob.github.io/slop-newyork/`.

The simulation is not imported into Next.js or React. Its native import map preserves the original pinned Three.js r187dev, WebGPU/TSL modules, controls and rendering pipeline. The Work and article pages load images and page content; the large geographic module loads only after entering the experience.

`src/content/berlin-driving-simulator.ts` supplies local launch content using the same pattern as One Frame. Published Sanity content owns the slug, including hidden records; it takes precedence across Work, article lookup, navigation and generated paths. There are no CMS mutations. New presentation fields are local launch metadata, not changes to the Studio schema.

## Refresh the simulation

From this portfolio checkout:

```sh
npm run sync:berlin
# Or provide another checkout explicitly:
node scripts/sync-berlin-simulator.mjs /absolute/path/to/slop-berlin-webgpu
```

The sync helper copies runtime CSS, JavaScript, vendored Three.js, MIT license and upstream pin into `public/experiments/berlin`. It adds a stable base URL, a return-to-project link, and the article canonical URL to the exported HTML. No source rewrite, dependency upgrade, commit or deployment occurs.

The adapted OSM database remains downloadable as `data/berlin.json.gz`, alongside its attribution. Compression avoids distributing a second 51 MB uncompressed copy in the static package; startup uses the existing geographic module. The resulting export has 57 files totalling about 86.5 MB. `export-manifest.json` records the upstream pin and exact map-data SHA-256. Raw retrieval files, the Python environment and the regional PBF are excluded.

All public runtime files ship in this checkout, so a Vercel build does not need the sibling source checkout or a fresh OSM fetch. The normal portfolio build remains `npm run build`. This is prepared locally; hosting and bandwidth limits should be reviewed when publishing the whole portfolio.

## Validation

```sh
npm run test:berlin
npm run test:one-frame
npx tsc --noEmit --incremental false
NEXT_BUILD_DIR=.next-berlin-build npm run build
```

- Four integration tests pass: consistent project discovery, CMS precedence/hiding, static module-path resolution, and complete licensed map-data export.
- All 13 existing One Frame tests pass.
- TypeScript and the production build pass. The build generates `/berlin-driving-simulator`, includes it in the sitemap, and keeps the article's first-load JS around 111 kB. The simulator data is a separate static download.
- Chrome verified Work → project → simulator → project, the original NYC link target, the real WebGPU/r187dev renderer, and desktop and 390 × 844 layouts. No application console errors were observed.
- Browser responsive emulation is not a physical mobile-device performance certification.

Screenshots: [Work card](qa/berlin/work-card.jpg), [project desktop](qa/berlin/project-desktop.jpg), [project mobile](qa/berlin/project-mobile.jpg), [simulator credit](qa/berlin/simulator-credit.jpg), [simulator mobile](qa/berlin/simulator-mobile.jpg).
