# Berlin Driving Simulator

Added locally on 23 October 2026. No deployment or Sanity publication was performed.

The case study now highlights Berlin's map-data pipeline, procedural generation and custom landmark work.

## Portfolio flow

- `/work`: a playable project card, with a real screenshot and an excerpt introducing the mapped city and ways to explore it.
- `/berlin-driving-simulator`: a project article covering the OpenStreetMap pipeline, procedural generation, custom landmarks, interaction refinements and rendering at city scale. It includes an Explore Berlin action, a single linked Mr. Doob credit near the top, screenshots, Aaron's contribution and AI-assisted development disclosure.
- `/play/berlin`: a full-document rewrite to the standalone simulator. Its back arrow returns to the article, and “Original NYC version by Mr. Doob” opens `https://mrdoob.github.io/slop-newyork/`.

The simulation is not imported into Next.js or React. Its native import map preserves the original pinned Three.js r187dev, WebGPU/TSL modules, controls and rendering pipeline. The Work and article pages load images and page content; the large geographic module loads only after entering the experience.

`src/content/berlin-driving-simulator.ts` supplies local launch content. Published Sanity content owns the slug, including hidden records; it takes precedence across Work, article lookup, navigation and generated paths. There are no CMS mutations. New presentation fields are local launch metadata, not changes to the Studio schema.

The production integration includes Berlin only. Inside the GPU and One Frame remain on `feat/inside-the-gpu`, including their routes, cards, assets and tests.

## Edit the simulation

This portfolio is the source of truth. Edit `public/experiments/berlin/index.html`, `css/` and `js/` directly in this checkout, then run `npm run test:berlin` and check `/play/berlin` in the local portfolio. The old standalone checkout is not a dependency and must not be synced over these files.

The native import map, pinned Three.js, MIT license, data attribution, base URL and return-to-project link are maintained here. The former cross-repository sync command has been removed to prevent overwriting portfolio changes.

The adapted OSM database remains downloadable as `data/berlin.json.gz`, alongside its attribution. Compression avoids distributing a second 51 MB uncompressed copy in the static package; startup uses the existing geographic module. The resulting export has 57 files totalling about 86.5 MB. `export-manifest.json` records the upstream pin and exact map-data SHA-256. Raw retrieval files, the Python environment and the regional PBF are excluded.

All public runtime files ship in this checkout, so a Vercel build does not need the sibling source checkout or a fresh OSM fetch. The normal portfolio build remains `npm run build`. This is prepared locally; hosting and bandwidth limits should be reviewed when publishing the whole portfolio.

## Validation

### Mitte geometry trial — 23 October 2026

`/play/berlin/mitte` is an unlisted comparison view built directly in this portfolio, sharing its vendored WebGPU renderer. It does not replace the driving simulator. Five street viewpoints and a same-camera toggle compare official LoD2 surfaces with plain extrusions of the existing OSM footprints and heights. Click official buildings for source records.

The 4 km² trial uses four 1 km tiles from Berlin's [official LoD2 dataset](https://daten.berlin.de/datensaetze/3d-gebaudemodelle-im-level-of-detail-2-lod-2-3c7c49af), licensed dl-de/zero-2-0: 5,239 buildings, 11,608 building records/parts, 452,672 triangles. Model record dates are March 2026; these are not guarantees of survey recency. Source ZIP URLs, hashes, conversion validation and all 13 self-intersecting source-surface repairs are recorded in `public/experiments/berlin/mitte/data/manifest.json`. Repairs resolve existing crossing edges in the surface plane; valid source surfaces remain unchanged, apart from millimetre coordinate rounding. Every triangulated polygon is checked for projected area preservation, including holes.

This tests building geometry, not photographic appearance. Walls have no real windows, doors, storefronts or colours; roof forms are generalized. Ground between buildings is interpolated from building-base elevations. Street-level movement is an inspection camera without building collisions. The [2025 textured mesh](https://daten.berlin.de/datensaetze/3d-meshmodell-berlin) would be a separate appearance test; its download portal and raw data endpoints returned maintenance HTML during this trial. No textured assets were imported.

Only the final ~5.5 MB compressed trial data ships. Raw CityGML and the Python environment stay in the ignored portfolio cache. Rebuild from this checkout:

```sh
python3 -m venv .cache/berlin-mitte/venv
.cache/berlin-mitte/venv/bin/pip install -r scripts/mitte-requirements.txt
.cache/berlin-mitte/venv/bin/python scripts/prepare-mitte-data.py
node scripts/pack-mitte-data.mjs
npm run test:mitte
```

The converter checks surface areas; the tests check source hashes, complete mesh coverage, each building's preserved 3D extent, and street viewpoint positions. Browser checks cover both layers and street-level navigation. This is not an independent survey of the source data's real-world accuracy.

### Auguststraße style trial

`/play/berlin/auguststrasse` now tests the original simulator’s simpler visual language on about 80 m of street. Official ground outlines and street-wall heights become flat-roofed blocks, with mapped floor counts where available. Other storey counts are explicitly height estimates. Courtyards and variations in building scale remain; fine roof forms and modeled facade fittings are omitted.

Canvas-generated window patterns, pale plaster and a restrained brick palette give the blocks character. Published references inform KW’s two-storey frontage and blue entrance, and the former Jewish girls’ school’s red-brown facade and main window rhythm. These are visual approximations, not photographic facade reconstructions. Neighbouring colours and window positions, street furniture and parked cars are illustrative; no businesses are invented. Reference photographs are not redistributed.

The same small viewer supports a **Simple street / Building shapes** toggle and three viewpoints. Grounded extrusions extend down into the interpolated terrain, while source wall-top heights remain fixed. The larger Mitte comparison retains its official surfaces and separate foundation skirts. All changes live in this portfolio; the main driving simulator has not been replaced by this trial.

Rebuild the small data subset after preparing the full Mitte cache and the Auguststraße OSM street extract in `.cache/berlin-mitte/references/osm.json` (Overpass bbox 52.5257,13.3925,52.5280,13.3990):

```sh
.cache/berlin-mitte/venv/bin/python scripts/prepare-auguststrasse.py
node scripts/pack-mitte-data.mjs --auguststrasse
npm run test:mitte
```

The data tests verify mapped storey counts, source footprint bounds, fixed wall-top heights and continuous ground contact. The browser check covers both appearance layers and the KW, school and along-street views.

### Live Mitte buildings

The main `/play/berlin` scene now uses simplified official LoD2 ground outlines and wall heights throughout the existing Mitte locality boundary. This replaces 9,817 OSM records with 16,277 simple building masses, preserving different heights within a building. The 442 unmatched OSM records retain their geometry. Adjoining official parts in the same one-metre height band are merged and outlines simplified by 0.6 m. This approved Mitte result is preserved verbatim by the Ringbahn expansion below. Streets, vehicles, landmarks and the Auguststraße example are unchanged.

The renderer keeps its six shared facade materials, instanced wall boxes, merged roofs and existing streaming. Wall-instance input rises from 577,168 to 595,999 across the city (3.3%). No detailed model surfaces, image textures or new props are added. Available mapped colours and the two existing architectural references adjust wall tint through a per-instance attribute. Storeys use the same procedural window shader; ground-floor shop decoration is not inferred for the replacement masses.

Source ZIP hashes and conversion limits are in `public/experiments/berlin/data/mitte-buildings.json`. Raw data stays in the ignored portfolio cache. Rebuild with `.cache/berlin-mitte/venv/bin/python scripts/update-mitte-buildings.py --apply`; the converter uses its cached original OSM export and updates both the runtime module and downloadable data. Validate with `node --test tests/mitte-live.test.cjs` and `npm run test:berlin`.

### Full Ringbahn building coverage

The same conversion now covers the remaining Ringbahn interior across all 18 other mapped localities. 110 official tiles supply 99,476 simple masses replacing 52,607 former records; 4,451 unmatched records retain their existing geometry. The original Mitte result, all other map layers, the Ringbahn boundary, and Berghain’s custom model/source footprint are preserved. Colours carry over where mapped; no detailed meshes, textures or props are added.

The renderer uses the same shared facade materials and spatial instancing. Total wall input changes from 595,999 to 690,797 segments (+15.91%); this is a geometry count, not an FPS measurement. For 101 near-touching outlines, extra coordinate precision prevents rounding from creating self-intersections. The 0.6 m simplification and building shapes are otherwise unchanged. Static geography is split into `nyc-geodata.js` and `berlin-geodata.js` to keep each file below 100 MiB, while preserving the existing `GEO` interface.

Source tile hashes, per-locality coverage and preservation hashes are in `public/experiments/berlin/data/ringbahn-buildings.json`. Rebuild with `.cache/berlin-mitte/venv/bin/python scripts/update-mitte-buildings.py --ringbahn --apply`. This extends a cached snapshot of the approved Mitte version, making repeat runs deterministic. Run `npm run test:berlin` for the portfolio, data-preservation, geometry and pedestrian-reaction checks. All 18 checks pass. Browser checks in Kreuzberg, Charlottenburg and Prenzlauer Berg load the expanded WebGPU scene without application errors; screenshots are in `docs/qa/berlin/ringbahn-*.png`.

### Portfolio integration

```sh
npm run test:berlin
npx tsc --noEmit --incremental false
NEXT_BUILD_DIR=.next-berlin-build npm run build
```

- Four integration tests pass: consistent project discovery, CMS precedence/hiding, static module-path resolution, and complete licensed map-data export.
- TypeScript and the production build pass. The build generates 32 pages, includes `/berlin-driving-simulator` in the sitemap, and keeps the article's first-load JS around 110 kB. The simulator data is a separate static download. The production route manifests and Work page contain no Inside the GPU, One Frame or Time Frame entries.
- Chrome verified Work → project → simulator → project, the original NYC link target, the real WebGPU/r187dev renderer, and desktop and 390 × 844 layouts. No application console errors were observed.
- Browser responsive emulation is not a physical mobile-device performance certification.

Screenshots: [Work card](qa/berlin/work-card.jpg), [project desktop](qa/berlin/project-desktop.jpg), [project mobile](qa/berlin/project-mobile.jpg), [simulator credit](qa/berlin/simulator-credit.jpg), [simulator mobile](qa/berlin/simulator-mobile.jpg).


## Loading safeguards and performance — 25 October 2026

`js/launch.js` runs before the simulator imports. Phones and tablets see “Big city. Bigger screen.” and a return link; no renderer or map modules are fetched. Desktop visitors need a WebGPU adapter. Missing support, rejected imports, initialization errors, GPU loss/out-of-memory, and a two-minute foreground loading deadline lead to “A little more horsepower?” with a retry and project link. Network/timeouts are described separately from unsupported graphics. A background tab pauses the deadline. A late successful import cannot start the scene after a failure.

Road surfaces and roofs now merge once per existing spatial cell/material instead of splitting the same cells into 250–300-piece batches. Geometry, building data, materials, and the approved trial are unchanged. Both shadow cascades remain, at 2048 pixels each. Render resolution starts at up to 1080p pixel count and adapts in 10% steps only after sustained low frame rates, with a 70% floor and slow recovery. The DOM HUD stays sharp. The radar updates at most 20 times a second, hidden tabs skip simulation/render work, and startup no longer draws the whole city off-screen to warm shadow shaders.

Validation: all 28 `npm run test:berlin` tests pass, including mobile/iPad/touch-laptop detection, no heavy imports on blocked devices, timeout races, failure cleanup, device-loss lifecycle, and resolution hysteresis. The actual launch UI was checked with injected unsupported/mobile environments, including a 390×844 mobile layout with no WebGPU canvas; temporary fixtures and timing instrumentation were removed. In the Reichstag/Paul-Löbe-Allee test view, batching reduced the measured CPU render-call average from 25.62 ms to 18.95 ms. The warmed scene then showed 46–49 fps at 1920×873, full render scale. This is a local spot check, not a guaranteed frame rate across devices or neighbourhoods.

### Follow-up: nearby rendering and a 60 fps target

Static building and ground cells now stop drawing beyond approximately 1.8 km and 1.4 km respectively, plus their bounding radius. The range expands with camera altitude for aerial views. Landmarks, continuous ground and water remain available; nearby building geometry and all map data are unchanged. Teleporting rechecks visibility on the next frame. This reduces rendering work, not the initial geographic download or construction. Immutable cell transforms no longer recalculate every frame.

Screen-space reflections and their normal/metal/roughness buffers have been removed. Environment reflections, lighting, bloom, tone mapping and transparent effects remain. Distant tree crowns beyond the existing 420 m detail boundary no longer cast shadows into both cascades; nearby trees retain their shadows. Adaptive resolution now responds below 55 fps instead of accepting sustained 45–50 fps, with conservative recovery above 59 fps.

All 30 Berlin tests pass, including distance boundaries, teleport/aerial visibility and the revised adaptive target. The approved Auguststraße trial is untouched.

Local Chrome checks at a 1920×873 viewport, before Energy Saver engaged: Skalitzer Straße improved from 52–56 fps to 68–80 fps at full render scale; Reichstag measured 88–97 fps once settled; a ten-second drive from Brandenburger Tor onto Unter den Linden measured 60–84 fps. Night lighting and transparent effects rendered without validation errors. The wide Fernsehturm panorama measured 52–60 fps at 70% render scale before the distant-tree shadow change. Its skyline remained continuous.

During the final tree-shadow check, Chrome activated Energy Saver and both street and aerial views held at 30 fps. The toolbar explicitly showed “Energy saver is on”; this browser mode [reduces the display refresh rate](https://developer.chrome.com/blog/memory-and-energy-saver-mode). That final measurement cannot establish the additional change's unrestricted FPS benefit. No shader errors appeared. These are local spot checks, not a guaranteed frame rate across hardware or the whole map.

## U1/U3 elevated railway — 25 October 2026

The shared Hochbahn follows the two mapped running tracks from the tunnel ramp west of Gleisdreieck to Warschauer Straße, including the U3 terminal branch. The eight elevated stations use their OSM platform outlines, including the openings in Kottbusser Tor's island platform. BVG's [U1](https://www.bvg.de/de/verbindungen/linienuebersicht/u1) and [U3](https://www.bvg.de/de/verbindungen/linienuebersicht/u3) station lists establish the route; [Berlin's monument register](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040456) and [Radbahn's photographs](https://www.radbahn.berlin/en/reallabor/testfeld) informed the steel girders, paired columns and bracing.

Track positions and platform footprints come from OSM. Heights and structural dimensions are a simplified visual profile for the existing flat terrain. The upper U1/U3 level at Gleisdreieck remains above the lower station; the Oberbaumbrücke crossing uses the existing landmark's deck and rails. Underground route sections are omitted. Generic station/roof masses that overlapped these structures are skipped during rendering; the approved building datasets and Auguststraße trial are unchanged.

`js/hochbahn.js` uses a shared box mesh, seven materials and one 1024×512 station-sign atlas. Parts are instanced in 300 m cells and use the existing nearby-city visibility system. It adds no animation/update loop. Ground columns avoid mapped road lanes and water, with small individual colliders; overhead decks never create a road-blocking collider.

To rebuild, download the four `meta.sources` URLs in `data/hochbahn.json` to `.cache/berlin-hochbahn/{u1-west,u1-east,kottbusser-platform,u3}.json`, respectively, then run `python3 scripts/prepare-hochbahn.py`. The converter checks route continuity and shared U3 coverage and writes both the small public JSON and its runtime module. Raw API downloads stay ignored. `npm run test:berlin` includes route/platform, bridge-height, finite-geometry, batching-budget and road-clearance checks.

Validation: all 33 Berlin tests pass. The browser built 28,349 instances in 137 spatial/material batches, with 143 paired viaduct supports, and no console errors. Street-level checks at Kottbusser Tor and the Kreuzberg approach to Oberbaumbrücke confirm the replacement station mass, columns, bracing and bridge connection. A five-second Kottbusser Tor sample at the normal 1920×1080 viewport measured a median 74 fps (mostly 72–77 fps, with one 120 fps reading); this is a local spot check, not a cross-device guarantee.

### Adalbertstraße passage

The Neues Kreuzberger Zentrum spans Adalbertstraße. The simplified LoD2 masses had filled the drive-through, and the road importer had treated its `tunnel=building_passage` tag as an underground road. [OSM way 65425836](https://www.openstreetmap.org/way/65425836) records the two-lane passage and a 4 m maximum vehicle height. A small rendering override splits only the two overlapping building volumes, keeping their footprint, roof height and style while opening the road and sidewalks beneath a 4.25 m ceiling. The road surface, traffic graph and map routing now include this passage. Other underground roads remain excluded.

Rebuild the six replacement parts with `.cache/berlin-mitte/venv/bin/python scripts/prepare-adalbert-passage.py`. The approved city data and trial remain unchanged. All 36 Berlin tests pass, including clearance across both lanes, preserved building area and the new graph connection. Browser verification included driving through the opening.
