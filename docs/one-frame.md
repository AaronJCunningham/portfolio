# One Frame

A playable browser expedition inside an abstract GPU. See [the four original pitches](./playable-worlds.md) for the creative brief and research.

## Routes and Sanity

- `/work` includes the One Frame project card.
- `/one-frame` is the short project article, rendered by the existing Sanity project template.
- `/time-frame` is the full-screen game.

The initial article lives in `src/content/one-frame.ts` and uses Portable Text. The project queries add it only when Sanity has no published document owning the `one-frame` slug. A published Sanity record takes precedence; a hidden published record suppresses the fallback. Drafts do not affect the public page.

To manage the article in Sanity, create a Project titled **One Frame**, slug **one-frame**, and set **Playable experience path** to **/time-frame**. Copy or adapt the supplied article, upload `public/images/one-frame/preview.jpg`, set the project order and visibility, then publish when the app route has been deployed. The additive schema field is in `studio-portfolio/schemaTypes/project.ts`. There is no runtime dependency on publishing that document first.

The project title and app route must differ. `/time-frame` is excluded from dynamic project paths to avoid route collisions. The former GPU teaching scene remains in the repository, but its Tools card has been removed.

## Play

- W/S: forward/back; A/D: strafe.
- Drag the world or use arrows: look/turn. Up/down arrows adjust pitch.
- E/Q: rise/descend. Shift: boost. Space: brake/precision flight.
- C, the target marker, or **Aim**: turn toward the objective.
- R: return to the current checkpoint, retaining progress.
- Escape/P or the Pause button: explicitly open/close the pause menu. Focus loss and hidden tabs quietly freeze simulation, input and audio; returning resumes without a popup. An explicitly paused game stays paused.
- Touch: left flight pad, drag the world to look, rise/descend and boost buttons.

Gather all eight memory requests and enter the bus. The opening follows a shallow, level S-curve with a glowing trail at flight height. Holding forward from the checkpoint collects all eight in order and reaches the bus, at normal or boost speed; no turn-around is required. Guidance follows route order instead of choosing the nearest pickup. Fly through A and B to trigger their workers automatically: work continues after leaving a gate, and the groups execute sequentially. No hovering or manual branch switch is required. Pass the resolve gate, gather three depth samples, and enter the display. Every page load starts a new expedition from the beginning. Progress exists only for the current visit; no browser save or Continue option is used.

The HUD contains four elements: stage, ring counter, one action, and one short GPU fact. It sits at the bottom as borderless monospace text with a terminal prompt, above the controls on touch screens. The three stages are Get data, Do the maths, and Draw the picture. Counters count rings immediately on contact (8, 2, then 3). Exit gates say NEXT or FINISH to match the instruction. The intro defines a GPU in one sentence. Controls stay in the menu; the target marker and C key still aim the ship. Byte boxes, worker grids, depth cards, expandable explanations, toast messages, telemetry, and optional echo collectibles have been removed.

Every collected ring clears with a brief burst of sparks, expanding amber/cyan light waves and a soft central glow. Path A and B clear as soon as they activate; their workers continue running, with no spent ring, core or label left behind. Memory, depth samples and district exits use the same feedback. Decorative grey hoops were removed from the branch corridor so rings consistently mean something the player can activate. Effects pause with the game and reset on restart. Reduced-motion mode uses a short fade without expanding waves or moving sparks.

## Implementation

- `src/components/one-frame/model.ts`: deterministic flight and mission state, collision substeps and fresh-run initialization.
- `engine.ts`: Three.js WebGPURenderer, procedural instanced architecture, TSL compute traffic, third-person flight camera, world markers, simple synthesized sound, ending scene, resource cleanup.
- `OneFrame.tsx`: launch, HUD, controls menu, touch controls and recovery UI.
- `one-frame.module.scss`: isolated full-screen layout and responsive controls.

Native WebGPU updates signal positions in compute shaders. WebGL2 uses an analytic shader field instead. The game model is identical on both paths. Mobile uses fewer particles, lower pixel ratio, and no bloom. The reduced-motion preference removes ambient motion, boost FOV changes, and the ending camera flight; movement remains controlled by the player.

The game is a spatial metaphor: bits are states, the city is not the physical floorplan of a GPU, and the 32-lane convoy is an NVIDIA-style teaching example. The completion image is procedural artwork. Neither flight time nor decorative particle counts measure hardware performance.

## Accuracy and attribution

Public description: **A playable world inspired by NVIDIA GPU architecture.** It teaches selected mechanisms, rather than reproducing a particular chip or simulating a complete rendering pipeline.

- **Memory:** eight participating lanes request four-byte words at 0x00, 0x04, …, 0x1c within one aligned 32-byte sector. NVIDIA documents this access granularity for compute capability 6.0 and later. A full warp requesting 32 contiguous four-byte words from an aligned base spans four sectors. Requests are concurrent within a memory instruction; sequential pickup collection is a gameplay translation. [NVIDIA memory-coalescing reference](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#coalesced-access-to-global-memory).
- **Execution:** NVIDIA warps contain 32 logical threads; divergent paths use different active masks. The fixed two-path exercise omits modern independent thread scheduling and does not assign one physical core to each lane. [NVIDIA SIMT reference](https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html#simt-execution-model).
- **Depth:** choosing the smallest sample models opaque surfaces using conventional depth and LESS comparison with depth writes. It omits reversed depth, transparency, multisampling and early tests. [Khronos fragment-operations reference](https://docs.vulkan.org/spec/latest/chapters/fragops.html#fragops-depth).
- **Fiction:** flight, architecture, sector delivery, district ordering, distances and time. The sunset reveal is illustrative artwork, not the computed output of the three toy challenges.

## Development and verification

```sh
npm run test:one-frame
npx tsc --noEmit --incremental false
NEXT_BUILD_DIR=.next-one-frame npm run dev -- --port 3001
```

Use a separate `NEXT_BUILD_DIR` when another Next.js server is already running in this checkout. It prevents cache and hot-reload collisions. `?quality=low&renderer=webgl` exercises the compatibility renderer. `canvas[data-renderer]` reports the selected backend for inspection.

Tests cover paused state, boost and bounds, collision tunnelling, objective gates, complementary branches, depth ordering, completion with steering input, fresh-run isolation, and Sanity fallback precedence. Browser verification should cover a full expedition, pause/resume, reloading to a fresh run, desktop and narrow layouts, and both rendering backends.

Initial build verified locally on 22 October 2026:

- All nine model/content tests pass; app production build, TypeScript and lint pass; Studio TypeScript passes.
- A complete Chrome WebGPU expedition reaches the final display and completion screen using flight controls.
- WebGL2 compatibility mode launches, moves, pauses and resumes. The 390 × 844 layout exposes working pointer-operated flight controls; physical phone hardware has not been tested.
- The Work card opens the project article, whose primary action opens the game.
- Screenshot evidence: [completion](./qa/one-frame/completion.jpg), [narrow layout](./qa/one-frame/mobile.jpg), and [Work](./qa/one-frame/work.jpg).

This checkout is ready for review locally. No deployment or Sanity publication was performed.

The subsequent memory-route revision passes all 11 tests and the app TypeScript check. New regression coverage completes the memory district using only forward input, both normally and boosted, at 60 and 10 simulated frames per second. The Chrome WebGPU check also reached district two by holding W once, without turning or reversing, with no new browser errors. [Updated trail](./qa/one-frame/memory-trail.jpg) · [Forward-only completion](./qa/one-frame/memory-forward-complete.jpg).

The guided-play revision passes all 13 tests and the production build (including TypeScript and lint). Additional tests cover passing branch gates at boost speed without hovering, work continuing outside the gate, sequential queued work, manual pause, and uninterrupted forward travel through both opening districts. Browser checks confirm A and B completion, silent tab switching, explicit Escape pause/resume, the pixel changing from far to middle to near, the final display, and the narrow-screen guide with its minimize control. [Worker explanation](./qa/one-frame/worker-guide.jpg) · [Depth feedback](./qa/one-frame/depth-guide.jpg) · [Narrow guide](./qa/one-frame/guide-mobile.jpg).

The collection-feedback revision passes all 13 gameplay tests and TypeScript. Chrome checks show memory and both branch gates bursting and clearing on WebGPU, completed A/B gates staying absent after restoring a checkpoint, and pickup effects working on the low-quality WebGL2 renderer with no browser errors. Effects use six reusable slots and instanced sparks, with no per-pickup geometry allocation. [Path B burst](./qa/one-frame/path-b-burst.jpg) · [Cleared branch corridor](./qa/one-frame/branches-cleared.jpg).

Saved progress was subsequently removed: every visit starts at the beginning, with a single Enter the GPU action. All 13 tests and TypeScript pass. Browser verification collected four signals, reloaded, and confirmed the new flight begins in Memory Canyon with 0/8 signals and 00:00 elapsed. [Fresh start after reload](./qa/one-frame/fresh-start.jpg).

The simplified HUD passes all 13 gameplay tests and TypeScript. Browser checks cover stage transitions, the two-ring branch counter, matching NEXT instructions, and the borderless terminal layout on desktop and at 390 × 844. [Desktop terminal HUD](./qa/one-frame/terminal-hud.jpg) · [Mobile terminal HUD](./qa/one-frame/terminal-mobile.jpg).
