# Glitch Studio

`/community/tools/glitch-studio` creates a video entirely in the visitor’s browser. It needs **no render server, paid video API, upload endpoint, environment variable or always-on Mac**. Deploy the Next.js site normally. `NEXT_PUBLIC_GLITCH_RENDERER_URL` is no longer read.

## Browser workflow

Visitors select 1–32 JPG, PNG or WebP photos. Files remain local. The approved Motion Studio v007 WebGPU effects run on an `OffscreenCanvas`; WebCodecs and the bundled, open-source Mediabunny library encode H.264 into a local MP4 blob. The download link saves that blob directly. There is no network upload, render queue, hourly creation quota, storage service or one-hour video expiry.

The film retains 32 passages, 26-frame holds, six-frame blends and 282 effect frames: 1,114 frames / 37.13 seconds at 30 fps. The two output sizes are 1080×1920 (9:16) and 1080×1350 (4:5). Encoding targets 24 Mbps with the encoder’s quality mode. Effects and text render at the full output resolution. Optional text is limited to 36 characters. The original Motion Studio project is unchanged.

A seeded shuffle bag uses every photo, balances appearances and spreads repetitions. Each new export receives a random seed. One photo works; multiple photos avoid adjacent duplicates.

## Compatibility and lifecycle

- The page tests actual WebGPU adapter/device availability and H.264 encoding at both output sizes. Unsupported browsers receive an explanatory dialog recommending current Chrome or Edge with graphics acceleration. Browser brands are not blocked if the required features work.
- HTTPS is required in production; localhost is a secure context for development. No experimental browser flags are requested.
- Keep the page open during creation. A screen wake lock is requested where available, but mobile background/screen-lock behaviour varies. The page warns before unloading during an export.
- Cancel stops generation, closes the encoder and releases GPU resources. A completed previous video remains downloadable if a new attempt is cancelled or fails.
- Files are limited to 8 MiB each / 64 MiB total / 24 megapixels per decoded image. Full-size photos are decoded sequentially, downscaled only if needed to a maximum 2,560-pixel edge, and released after copying to GPU textures.
- Download before closing or reloading: photos and output blobs are not persisted. Object URLs and GPU resources are released on replacement/unmount/completion/cancellation.
- Rendering speed, memory headroom and encoder availability depend on the user’s device. Mobile and in-app browser support must be tested on real devices before advertising support.

## Run and verify locally

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://localhost:3000/community/tools/glitch-studio`. No second process is needed.

```sh
npm run test:glitch
npx tsc --noEmit
npm run build
```

The development-only `/dev/glitch-studio-check` page supplies the site’s existing public sample photos through the real file input, then exercises the same production component. It can check complete MP4 packet counts, duration, dimensions, decode nonblank sample frames and flag requests to the old renderer endpoints. It supports one/six/32 photos and a corrupt-image fixture. This route returns 404 in production.

Browser support and file validation have automated regression coverage, alongside the shared sequence/timing and legacy service tests.

### 1080-pixel browser acceptance — 18 October 2026

Chrome on the development Mac completed a six-photo export with text at 1080×1920 and a 32-photo export at 1080×1350. The fixtures use 2,400-pixel source photos. Both downloaded MP4s passed the browser verifier and independent FFprobe inspection: H.264, yuv420p, 30 fps, 1,114 frames and 37.133 seconds. Measured bitrates were 23.97 and 24.03 Mbps, with file sizes of 111,284,397 and 111,532,263 bytes respectively. Each export decoded five nonblank sample frames; a contact sheet of the vertical video was inspected for image detail and effects. No legacy renderer requests were made. The Instagram tagging popup also appeared and could be dismissed while rendering continued.

The browser verifier now rejects incorrect dimensions/codecs or missing frames. Browser regression tests, TypeScript checks and the production Next.js build passed. These results cover desktop Chrome; real mobile devices remain untested.

### Initial 720-pixel browser acceptance — 18 October 2026

Chrome on the development Mac completed exports through the real component and file-input change handler with six photos plus text (720×1280), one photo without text (720×900), and the maximum 32 photos (720×900). All three MP4s contained 1,114 H.264 packets and a 37.133-second duration. Five decoded frames per export were checked for nonblank content; representative encoded frames were also inspected visually. The six-photo and one-photo files were downloaded through the page and independently checked with FFprobe: H.264, yuv420p, 30 fps, the expected dimensions and 1,114 frames.

The browser verification recorded zero requests to the legacy renderer. Cancellation restored the controls and retained the previous download; a corrupt JPEG displayed a readable error. All 13 automated tests passed, including unsupported browser/codec cases and file limits. TypeScript and the final production build passed without lint warnings. File selection fixtures use existing public site photos; native operating-system file-picker automation remains limited by the browser extension. Real mobile devices have not yet been tested.

## Optional offline render service

Use Node 22. Install the render service separately so Chromium and image-processing dependencies do not enter the website bundle:

```sh
npm ci --prefix services/glitch-studio
cp services/glitch-studio/.env.example services/glitch-studio/.env
```

Set `GLITCH_FFMPEG_PATH` in the service's ignored `.env` to an FFmpeg executable with libx264. The existing Motion Studio bundled FFmpeg also works: use its absolute `node_modules/@remotion/compositor-darwin-arm64/ffmpeg` path. On macOS the renderer supplies the adjacent shared-library directory automatically. Use an installed Chrome, or set `GLITCH_BROWSER_PATH` to a compatible Chromium executable.

```sh
npm run glitch:check
npm run glitch:renderer
```

In a second terminal:

```sh
npm run dev
```

This starts the optional legacy HTTP API on loopback port 4319. The website no longer connects to this service. Its API remains available for offline rendering and regression checks.

## Rendering and compatibility

This section describes only the optional offline service, not the public browser tool.

The optional service startup creates a synthetic image, compiles the actual shaders, renders two 720×1280 frames and encodes an MP4. Missing Chrome, unavailable WebGPU, shader errors and missing/broken FFmpeg make `/health` report `available: false`. The API rejects jobs while unavailable. Operator diagnostics stay in server logs. A failed check is retried once per minute; a render failure makes the service unavailable until a fresh check passes.

Rendering uses an isolated headless browser, with its network restricted to a dedicated loopback HTTP server. That private server serves only the renderer code, sanitized images and the current job configuration. GPU history is advanced sequentially from frame zero. One video renders at a time, and the public API admits at most five pending jobs. Each render has a 20-minute timeout.

## Limits and lifecycle

- Up to 32 images, 8 MB per file, 64 MB total, 24 megapixels per decoded image. Animated and unsupported formats are rejected.
- Uploaded images are decoded, auto-oriented, resized within 1080×1440 and re-encoded without source metadata. Original filenames never become storage paths.
- Three creation attempts per IP per hour, with a global five-job admission limit. These counters are in memory; run one service instance. A restart resets rate counters. Apply additional edge limits if the public tool attracts abuse.
- A 192-bit random job identifier acts as the private access link. It is kept in session storage to resume polling in the same tab after navigation or reload. Anyone with that link can fetch the result until expiry. The service does not log these identifiers or uploaded filenames.
- Source images are removed when rendering succeeds or fails. Completed MP4s expire one hour after completion; expired files are removed by a minute-by-minute sweep. Queued jobs that cannot start within one hour fail and have their images removed. Expired downloads return a useful error.
- Restarting preserves completed downloads until expiry and marks interrupted jobs failed. The original photos, render states and GPU context cannot be resumed.
- The example video and stills are compressed derivatives of the existing approved v007 export. They are public example assets, separate from user uploads. The effect has flashes; playback is user-initiated and the page labels this.

## Verification

```sh
npm run test:glitch
npm run glitch:check
npx tsc --noEmit
npm run build
```

The automated service tests cover every supported image count, balanced repetition, no adjacent repeats, preservation of timing, missing browser, unavailable renderer, invalid files/options/origins, upload limits, queue serialization, rate limits, range downloads, removal and expiry. The compatibility check exercises the real GPU renderer and encoder; a full-film render remains the performance and visual acceptance test for each deployment host.

### Historical service verification — 18 October 2026

Nine automated tests and the production Next.js build passed. A six-photo vertical render completed in about 60 seconds on the development Mac; the downloaded file decoded as H.264 / yuv420p / Rec.709, 720×1280, 30 fps, 1,114 frames, 37.133 seconds (68,583,007 bytes). A one-photo portrait render also completed and downloaded: 720×900, 1,114 frames, 37.133 seconds (50,000,706 bytes). Sample encoded frames were inspected. These are local measurements, not hosted performance or cost estimates.

Desktop and 390px mobile layouts, the directory link, format radios and title field were checked in Chrome. The browser extension blocked automated file selection, so full uploads and MP4 downloads were verified through the local HTTP API; the file-picker-to-download UI path has not been automated end to end.
