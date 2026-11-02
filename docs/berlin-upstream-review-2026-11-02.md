# Berlin simulator: upstream review — 2 November 2026

Compared the portfolio's recorded base, `9301fcbe4009b83480e4d916f7e1f308b23b17cc`, with [mrdoob/slop-newyork at `343a0f9`](https://github.com/mrdoob/slop-newyork/tree/343a0f91471dfd23ee24acabab22303420a733b7). There are 119 subsequent commits and 84 changed files. The latest changes were published on 2 November. This section records the initial source review. The subsequent selective implementation and validation are recorded in [Berlin driving simulator](berlin-driving-simulator.md#selective-upstream-improvements--2-november-2026).

Several changes are useful. Selective ports are preferable to merging the whole upstream application because Berlin has its own geometry, data, collision adapters, railway, landmarks, launch safeguards and performance choices.

## Recommended order

### 1. Trees: strongest performance candidate

Upstream adds spatial tree batches, cheaper geometry, and hierarchical detail-level updates:

- [Spatial chunks, `539289a`](https://github.com/mrdoob/slop-newyork/commit/539289a)
- [Reduced tree triangles, `9b48bc0`](https://github.com/mrdoob/slop-newyork/commit/9b48bc0)
- [Cell-level LOD updates, `e35c06c`](https://github.com/mrdoob/slop-newyork/commit/e35c06c)

Berlin's `js/trees.js` still scans all trees after four metres of camera movement. Any detail-level change rebuilds the global instance lists. Its update is attached to `scene.onBeforeRender`. Upstream rejects whole distant cells, examines individual trees only where necessary, rebuilds dirty cells, and calls the update explicitly from the frame loop. This is particularly relevant to Berlin's large tree population.

Port the batching and update design together. Retain Berlin's placements, altitude-dependent visibility, and distant-crown shadow suppression. Check teleporting, helicopter views, canopy consistency and precompilation. Compare frame times while moving, when the old update actually runs; a stationary FPS comparison would miss much of the benefit.

### 2. Road markings and shadow costs

Berlin's `js/road-paint.js` is byte-for-byte identical to the original upstream base. It creates a single citywide mesh, outside the named roots currently passed to `setupSceneCulling`.

- [Marking chunks, `997185d`](https://github.com/mrdoob/slop-newyork/commit/997185d): split markings into spatial meshes with distance limits and padded bounds for shader-expanded thin lines. Integrate the returned group into Berlin's culling system; copying the builder alone would not enable distance culling.
- [Connected markings through bends, `30096be`](https://github.com/mrdoob/slop-newyork/commit/30096be): also worth adapting to Berlin's irregular street graph. Preserve the building-passage connection and assess local marking conventions independently of upstream's NYC rules.
- [Explicit building shadow proxies, `c4ab18f`](https://github.com/mrdoob/slop-newyork/commit/c4ab18f): fixes a selection problem where already-chunked buildings miss the size thresholds for cheap shadow rendering. Berlin has the same threshold-based selection, but its 750 m cells differ; inspect which cells actually miss it before enabling proxies.
- [Simplified lamp shadows, `0630114`](https://github.com/mrdoob/slop-newyork/commit/0630114): render lamp-post shadows using a low-polygon stand-in. Berlin's culler does not yet support the upstream custom proxy geometry.

Preserve Berlin's altitude-aware city ranges and frozen static transforms. Upstream's published draw-count improvements describe Manhattan, not measured Berlin gains.

### 3. Pedestrian rendering

Berlin's `js/pedestrians.js` is also unchanged from the original base. [Upstream's `1fe128d`](https://github.com/mrdoob/slop-newyork/commit/1fe128d) reduces shader work, improves crowd culling and avoids posing distant inactive player characters. Berlin currently poses the pedestrian and cyclist every update, regardless of distance.

This is a good second performance pass. The current upstream integrates with its newly extracted `pedestrian-system.js`, whereas Berlin still manages pedestrians in `traffic.js`. Adapt those interfaces and retain Berlin's tested pedestrian reactions. Connected walking routes, conversations, obstacle-detour caching and individual crossing delays are separate behaviour improvements, with more integration work than the rendering changes.

### 4. Compressed runtime geography: a startup project

Upstream now loads validated compressed binary building and tree data, using coordinate deltas instead of large JavaScript literals: [buildings, `062c4a9`](https://github.com/mrdoob/slop-newyork/commit/062c4a9), [trees, `7249a39`](https://github.com/mrdoob/slop-newyork/commit/7249a39), and [already-decompressed response handling, `2813f08`](https://github.com/mrdoob/slop-newyork/commit/2813f08).

Berlin's two runtime geography modules total 108,114,023 bytes (about 103.1 MiB) uncompressed. This is source size, not measured network transfer; the host may already compress JavaScript. `data/berlin.json.gz` is currently the downloadable attribution/data export, not the runtime loader.

Adapting the packing approach could reduce JavaScript parsing and download overhead. It would not remove city geometry construction time. Keep Berlin's full metadata, source IDs, holes, per-part heights, colours and preservation hashes. Do not copy upstream's 0.5 m coordinate or 1 m height quantization: Berlin already needs extra precision for some near-touching outlines. Measure transfer, parsing, memory and first playable frame separately before claiming a speedup.

### 5. Driving improvements and a small controller fix

- [Gamepad fix, `67ef6be`](https://github.com/mrdoob/slop-newyork/commit/67ef6be): reserve the horizontal stick for steering and triggers for acceleration/braking in car and bicycle modes. Berlin's gamepad module is unchanged from the base and still lets vertical stick movement affect throttle. This is a small, isolated candidate.
- [Steering and grip, `9ee80eb`](https://github.com/mrdoob/slop-newyork/commit/9ee80eb), [collision momentum, `12dbb1d`](https://github.com/mrdoob/slop-newyork/commit/12dbb1d), and [handbrake slides, `cc6d707`](https://github.com/mrdoob/slop-newyork/commit/cc6d707) form a larger driving-feel update. Include the later direction-change braking fix and upstream regression tests when porting. Berlin's controller has custom spawn, teleport, saved-position and collision handling that must survive.
- [Polygon collision fixes, `28c0af7`](https://github.com/mrdoob/slop-newyork/commit/28c0af7) are relevant design references, but not a direct fix for an established Berlin bug. Upstream now collides against whole polygons; Berlin builds oriented thin-wall colliders. A replacement would require preserving courtyards, elevated masses and Adalbertstraße clearance.

### 6. Visual improvements worth a separate pass

- [Asphalt repairs and wear, `dcb453f`](https://github.com/mrdoob/slop-newyork/commit/dcb453f): patches, cracks and potholes are useful visual ingredients. These are shader details, not physical road bumps.
- [Sidewalk detail, `4a921f0`](https://github.com/mrdoob/slop-newyork/commit/4a921f0): adapt the technique to Berlin paving rather than adopting NYC's five-foot slabs.
- [Distant window lighting, `2a369ca`](https://github.com/mrdoob/slop-newyork/commit/2a369ca): filtered clusters retain variation in distant illuminated windows. This concerns facade appearance, not CPU point-light selection.
- [Water reflection gating, `f097197`](https://github.com/mrdoob/slop-newyork/commit/f097197): skip night-only analytic reflection calculations during daytime. Berlin still computes its custom bank intersection shader before multiplying by the night factor, so the gating idea applies. Preserve the Spree bank geometry and derivative-safe control flow; upstream's Manhattan shoreline code is unsuitable. This is separate from the screen-space reflections already removed in Berlin.
- New storefront interiors, entrances and vehicle models offer visible polish. Berlin deliberately suppresses inferred shops on its official replacement building masses, so upstream's storefront selection should not be copied wholesale. Keep Berlin liveries and adapt vehicle choices to the setting.

## Renderer upgrade is a coordinated change

On 2 November upstream moved to [Three.js r187, `16d6782`](https://github.com/mrdoob/slop-newyork/commit/16d6782), then [removed its storage-buffer matrix workaround, `21f71bd`](https://github.com/mrdoob/slop-newyork/commit/21f71bd). Berlin vendors an older `187dev` commit and still needs evaluation against that specific renderer.

Do not remove the matrix workaround independently. If upgrading, update the vendored build and addons together, adjust light-node registration, revisit alpha-test workarounds and verify streamed instance uploads. Berlin's `main.js` traversal also clears old MRT overrides after removing SSR; preserve that operation when changing the matrix code. Both the simulator and the Mitte/Auguststraße viewers share the vendored renderer and need browser checks.

## Existing Berlin work to retain

Berlin already has spatial building/ground batching, distance culling, adaptive render resolution, two shadow cascades, reduced distant-tree shadows, a throttled radar, hidden-tab suspension, launch failure handling and custom pedestrian reactions. Upstream's similarly named commits are not evidence that these are absent here. Preserve the approved Ringbahn/Mitte buildings, landmarks, Hochbahn, passages, source data, attribution and trial views.

Recommended first implementation: tree batching/LOD, road-marking culling, targeted shadow proxies and the gamepad fix. Benchmark the same moving street and aerial routes before and after. Treat compressed data, driving behaviour, visual changes and the renderer upgrade as individually reviewable follow-ups. No FPS or loading-time improvement has yet been measured for these proposed ports.
