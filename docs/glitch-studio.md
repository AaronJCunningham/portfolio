# Glitch Studio

`/community/tools/glitch-studio` is a free photo-to-video tool listed in Community Tools. It reuses the approved Motion Studio v007 WebGPU/WGSL engine, including its 32 passages, 26-frame image windows, six-frame blends, 282 effect frames and 1,114-frame duration. The original `~/programming/motion-studio` project and exports are unchanged.

Visitors upload 1–32 still JPG, PNG or WebP images. A seeded shuffle bag balances appearances, avoids adjacent duplicates when possible, and scores candidates for repeat distance and recurring transitions. Every uploaded image appears. The film is 37.13 seconds at 30 fps, silent H.264 MP4, in 720×1280 (9:16) or 720×900 (4:5). Optional text replaces the original project-specific phrases, using the same restrained text timing and movement. Each new render gets a fresh seed; the sequence is retained with the job.

## Run locally

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

Open `http://localhost:3000/community/tools/glitch-studio`. In development, the page uses the current hostname on port 4319. Configure `GLITCH_ALLOWED_ORIGINS` if using another website port. The service is bound to loopback by default.

## Rendering and compatibility

All image processing and video generation run in `services/glitch-studio`. The site only previews local thumbnails, sends multipart uploads, polls job status and plays/downloads MP4s. Visitors do not need Chrome or WebGPU. No browser-name detection is used.

Startup creates a synthetic image, compiles the actual shaders, renders two 720×1280 frames and encodes an MP4. Missing Chrome, unavailable WebGPU, shader errors and missing/broken FFmpeg make `/health` report `available: false`. The page disables creation and displays a temporary-unavailability message. Operator diagnostics stay in server logs. A failed check is retried once per minute; a render failure makes the service unavailable until a fresh check passes.

Rendering uses an isolated headless browser, with its network restricted to a dedicated loopback HTTP server. That private server serves only the renderer code, sanitized images and the current job configuration. GPU history is advanced sequentially from frame zero. One video renders at a time, and the public API admits at most five pending jobs. Each render has a 20-minute timeout.

## Public deployment

The website and renderer have different hosting requirements. Deploy the Next.js site through its existing hosting process. Run the renderer as a **long-lived Node 22 service with a compatible GPU, Chrome/Chromium and FFmpeg**, behind HTTPS. It is not a Next.js request handler and is not intended for ordinary serverless function runtimes.

1. On the render host, install this service using its lockfile and configure its `.env`. Run it as an unprivileged user; the browser sandbox remains enabled.
2. Mount a persistent private disk at `GLITCH_DATA_DIR`. Do not expose this directory through the web server or back it up as a photo archive.
3. Set `GLITCH_ALLOWED_ORIGINS` to the exact production website origin(s), without trailing slashes. Default access is limited to the local development origins.
4. Proxy the service through an HTTPS origin, allow multipart uploads up to 64 MB, and give uploads a 120-second timeout. HTTP range requests must pass through for MP4 playback. Configure `GLITCH_TRUST_PROXY` only for the actual trusted proxy count, with inbound forwarded IP headers replaced at the edge.
5. Run `npm run glitch:check` on that host and confirm `/health` reports available. Linux uses the Vulkan WebGPU flags described in [Chrome's headless GPU guidance](https://developer.chrome.com/blog/supercharge-web-ai-testing). Hardware and driver compatibility must be tested on the actual host; local macOS validation does not establish Linux GPU compatibility.
6. Set `NEXT_PUBLIC_GLITCH_RENDERER_URL=https://your-renderer-origin` in the website build environment, then rebuild/deploy the website. Uploads and MP4 downloads go directly to the renderer, avoiding a serverless website's body and response limits. The endpoint is public configuration, not a secret.

When the public renderer URL is absent, a production build shows the unavailable state. No remote GPU service is provisioned by this code. The browser path can be configured independently of Chrome branding; see [Playwright browser configuration](https://playwright.dev/docs/browsers).

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

### Local verification — 18 October 2026

Nine automated tests and the production Next.js build passed. A six-photo vertical render completed in about 60 seconds on the development Mac; the downloaded file decoded as H.264 / yuv420p / Rec.709, 720×1280, 30 fps, 1,114 frames, 37.133 seconds (68,583,007 bytes). A one-photo portrait render also completed and downloaded: 720×900, 1,114 frames, 37.133 seconds (50,000,706 bytes). Sample encoded frames were inspected. These are local measurements, not hosted performance or cost estimates.

Desktop and 390px mobile layouts, the directory link, format radios and title field were checked in Chrome. The browser extension blocked automated file selection, so full uploads and MP4 downloads were verified through the local HTTP API; the file-picker-to-download UI path has not been automated end to end.
