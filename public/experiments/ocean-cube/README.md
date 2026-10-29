# Six seas

Local interactive prototype: `/play/ocean-cube` in the portfolio, or serve this directory with a static HTTP server and open `index.html`.

The project page is `/six-seas`, listed in `/work` through the existing local-content fallback in `src/sanity/lib/projects.ts`. A published Sanity record with the same slug takes precedence, including its visibility setting.

The shareable page recording is `/media/six-seas/six-seas-1080p.mp4`: 20 seconds, 1920×1080, H.264, 30 fps, silent. It captures the complete page and preserves its aspect ratio with matching background padding. The poster is `/images/six-seas/preview.jpg`. To record again, run `python3 scripts/ocean-cube-capture.py` from the project root, open its localhost URL, and use the recording button. Select only the Six seas tab in Chrome's capture prompt. Raw captures are saved to ignored `.cache/six-seas/`; the capture controls and receiver are never included in the production page.

Uses the actual Ultra-Water four-cascade Tessendorf FFT simulation, shared across six finite face meshes. Each face samples a different ocean patch with displacement in its own local coordinate system. The cube's body diagonal is aligned to world up and rotates around it. A narrow displacement taper seals the edges; this is an artistic boundary, not fluid flowing continuously around corners. Ocean surface shading is custom; upstream planar reflections, shore breakers, buoyancy, and underwater passes are not included.

Drag to orbit, scroll/pinch to zoom, pause the rotation, and adjust swell. Reduced-motion preferences start with a still ocean and rotation disabled. Requires WebGL2 and floating-point render targets. No CDN or runtime network dependencies.

## Credits

- `vendor/ultra-water/water/OceanSim.js` and `vendor/ultra-water/engine/fullscreen.js`: unmodified source from https://github.com/Humpalumps/Ultra-Water, retrieved 2026-10-29. MIT © 2026 Humpalumps; license and upstream third-party notices included.
- `vendor/three`: Three.js from this checkout's installed dependency, MIT; license included.
- `main.js`: custom six-face geometry, water shading, presentation and controls.
