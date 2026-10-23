import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Component, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import ThinFrame from './ThinFrame'
import { createFrame, operationCounts, STAGES, warpSlots } from './gpu-pipeline-model'

const Scene = dynamic(() => import('./gpu-scene'), { ssr: false, loading: () => <p className="gpu__loading">Building your little universe…</p> })
const format = (n: number) => n.toLocaleString('en-US')
const reducedQuery = '(prefers-reduced-motion: reduce)', mobileQuery = '(max-width: 760px)'
const subscribeMedia = (query: string, notify: () => void) => { const m = matchMedia(query); m.addEventListener('change', notify); return () => m.removeEventListener('change', notify) }
const subscribeReduced = (notify: () => void) => subscribeMedia(reducedQuery, notify)
const subscribeMobile = (notify: () => void) => subscribeMedia(mobileQuery, notify)

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? <p className="gpu__unavailable">The 3D world could not start. You can still explore all seven stages and their live numbers.</p> : this.props.children }
}

export default function InsideTheGPU() {
  const reduced = useSyncExternalStore(subscribeReduced, () => matchMedia(reducedQuery).matches, () => true)
  const mobile = useSyncExternalStore(subscribeMobile, () => matchMedia(mobileQuery).matches, () => false)
  const [stage, setStage] = useState(0), [resolution, setResolution] = useState<number | null>(null)
  const [space, setSpace] = useState(0), [divergent, setDivergent] = useState(false), [alpha, setAlpha] = useState(1), [depth, setDepth] = useState(0)
  const [branchPhase, setBranchPhase] = useState(0)
  const [pauseOverride, setPauseOverride] = useState<boolean | null>(null), [fly, setFly] = useState(false), [reset, setReset] = useState(0)
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [renderer, setRenderer] = useState('Not available')
  const [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [hidden, setHidden] = useState(false)
  const viewport = useRef<HTMLDivElement>(null), wheel = useRef({ amount: 0, last: 0, moved: 0 })
  const width = Math.min(resolution ?? (mobile ? 32 : 64), mobile ? 64 : 96), height = width * 5 / 8
  const frame = useMemo(() => createFrame(width, height), [width, height])
  const counts = useMemo(() => operationCounts(frame, divergent), [frame, divergent])
  const warp = warpSlots(frame.fragments.length, divergent)
  const paused = (pauseOverride ?? reduced) || hidden
  const current = STAGES[stage]
  const onReady = useCallback((name: string) => { setReady(true); setRenderer(name) }, [])
  const onError = useCallback(() => { setFailed(true); setReady(false) }, [])
  const go = useCallback((next: number) => {
    const value = Math.max(0, Math.min(STAGES.length - 1, next))
    setStage(value); setNotice('')
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${STAGES[value].id}`)
  }, [])

  useEffect(() => {
    const readLocation = () => {
      const index = STAGES.findIndex(s => `#${s.id}` === location.hash)
      if (index >= 0) setStage(index)
      const params = new URLSearchParams(location.search), grid = Number(params.get('grid'))
      if ([32,64,96].includes(grid)) setResolution(grid)
      setDivergent(params.get('branch') === '1')
      const opacity = params.get('alpha')
      if (opacity !== null && Number.isFinite(Number(opacity))) setAlpha(Math.max(0, Math.min(1, Number(opacity))))
    }
    readLocation(); window.addEventListener('hashchange', readLocation)
    const visibility = () => setHidden(document.hidden)
    visibility(); document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('hashchange', readLocation); document.removeEventListener('visibilitychange', visibility) }
  }, [])

  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const scroll = (event: WheelEvent) => {
      if (event.ctrlKey || mobile || (event.target as HTMLElement).closest('button, select, input')) return
      event.preventDefault()
      const now = performance.now(), state = wheel.current
      if (now - state.last > 180) state.amount = 0
      state.last = now
      if (now - state.moved < 1700) return
      state.amount += event.deltaY * (event.deltaMode === 1 ? 16 : 1)
      if (Math.abs(state.amount) > 100) { go(stage + Math.sign(state.amount)); state.moved = now; state.amount = 0 }
    }
    element.addEventListener('wheel', scroll, { passive: false })
    return () => element.removeEventListener('wheel', scroll)
  }, [stage, mobile, go])

  function shareUrl() {
    return `${location.origin}${location.pathname}?grid=${width}&branch=${divergent ? 1 : 0}&alpha=${alpha.toFixed(2)}#present`
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl()); setNotice('Link copied. It opens this frame and your settings.') }
    catch { setNotice(`Copy this link: ${shareUrl()}`) }
  }
  async function saveFrame() {
    const scene = viewport.current?.querySelector('canvas')
    if (!scene) return
    setSaving(true)
    try {
      // Entirely local postcard, using the actual rendered world and computed count.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No 2D canvas')
      ctx.fillStyle = '#080c0e'; ctx.fillRect(0, 0, 1600, 1000)
      const ratio = scene.width / scene.height, h = 720, w = h * ratio
      ctx.drawImage(scene, (1600 - w) / 2, 0, w, h)
      const gradient = ctx.createLinearGradient(0, 560, 0, 820); gradient.addColorStop(0, '#080c0e00'); gradient.addColorStop(1, '#080c0e')
      ctx.fillStyle = gradient; ctx.fillRect(0, 560, 1600, 440)
      ctx.fillStyle = '#f3eeeb'; ctx.font = '24px monospace'; ctx.fillText('AARON LVX / INSIDE THE GPU', 64, 62)
      ctx.font = '112px sans-serif'; ctx.fillText(format(counts.total), 64, 804)
      ctx.font = '28px monospace'; ctx.fillStyle = '#fa7653'; ctx.fillText('WORK ITEMS. ONE FRAME.', 64, 854)
      ctx.font = '19px monospace'; ctx.fillStyle = '#b0bab9'
      ctx.fillText(`${width} × ${height} teaching grid · ${format(frame.vertices.length)} vertices · ${format(frame.fragments.length)} fragments`, 64, 902)
      ctx.fillText('aaronjcunningham.com/community/tools/inside-the-gpu', 64, 950)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Image export failed')
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = 'inside-the-gpu.png'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Frame saved. Made entirely on your device.')
    } catch { setNotice('Image export is unavailable here. You can still take a screenshot or copy the link.') }
    finally { setSaving(false) }
  }

  const spaceNames = ['Model', 'World', 'View', 'Projection']
  return <main className="gpu" style={{ '--gpu-accent': current.color } as CSSProperties} onKeyDown={event => {
    const target = event.target as HTMLElement
    if (target.closest('input, select, textarea, summary, [contenteditable="true"]') || event.altKey || event.metaKey || event.ctrlKey) return
    if (['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault()
      go(event.key === 'Home' ? 0 : event.key === 'End' ? 6 : stage + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1))
    }
  }}>
    <header className="gpu__header">
      <Link href="/community/tools" className="gpu__back">↖ <span>COMMUNITY / TOOLS</span></Link>
      <span className="gpu__edition">AN INTERACTIVE FIELD TRIP / 003</span>
      <Link href="/community" className="community-brand">AARON <span>LVX</span></Link>
    </header>
    <div className="gpu__experience">
      <div className="gpu__story">
        <div className="gpu__identity"><p className="gpu__eyebrow"><i /> FROM DRAW CALL TO DISPLAY</p><h1>Inside{' '}<br />the <em>GPU.</em></h1><p className="gpu__intro">A journey through one frame.</p></div>
        <ThinFrame className="gpu__lesson" aria-label="Current pipeline stage">
          <div aria-live="polite" aria-atomic="true">
            <p className="gpu__eyebrow">{String(stage + 1).padStart(2, '0')} / 07 <span>{current.label.toUpperCase()}</span></p>
            <h2>{current.title}</h2>
            <p className="gpu__caption">{current.caption}</p>
            <p className="gpu__fact">{current.fact}</p>
          </div>
          <div className="gpu__interaction">
            {stage === 0 && <div className="gpu__code"><span>CPU → GPU</span><code>drawElements(TRIANGLES, 2304)</code></div>}
            {stage === 1 && <>
              <label htmlFor="gpu-space">Coordinate space <output>{spaceNames[Math.round(space)]}</output></label>
              <input id="gpu-space" type="range" min="0" max="3" step=".01" value={space} onChange={e => setSpace(Number(e.target.value))} />
              <div className="gpu__space-steps">{spaceNames.map((name, i) => <button key={name} aria-pressed={Math.round(space) === i} onClick={() => setSpace(i)}>{name}</button>)}</div>
              <small>View is recentered for inspection. Projection shows the perspective divide, flattened to the screen.</small>
            </>}
            {stage === 2 && <><label htmlFor="gpu-resolution">Pixel grid <output>{width} × {height}</output></label><select id="gpu-resolution" value={width} onChange={e => setResolution(Number(e.target.value))}>{(mobile ? [32,64] : [32,64,96]).map(n => <option key={n} value={n}>{n} × {n * 5 / 8} {n === 32 ? '/ coarse' : n === 64 ? '/ balanced' : '/ fine'}</option>)}</select><small>{format(frame.fragments.length)} fragments cover {format(frame.winners.length)} pixels. The stacked candidates continue into the next room.</small></>}
            {stage === 3 && <>
              <button className="gpu__toggle" aria-pressed={divergent} onClick={() => setDivergent(v => !v)}><span className="gpu__switch" />Add an if-statement</button>
              <code className="gpu__branch">{divergent ? 'if (lane % 2) → A; else → B;' : 'every lane → shade();'}</code>
              {divergent && paused && <button className="gpu__step" onClick={() => setBranchPhase(v => 1 - v)}>Step to other path →</button>}
              <small>{divergent ? '16 active / 16 waiting per full group, then swap.' : '32 active lanes per full group.'} {Math.round(warp.utilization * 100)}% useful lane slots, including the last partial group. Illustration, not a benchmark.</small>
            </>}
            {stage === 4 && <><label htmlFor="gpu-depth">Apply depth test <output>{Math.round(depth * 100)}%</output></label><input id="gpu-depth" type="range" min="0" max="1" step=".01" value={depth} onChange={e => setDepth(Number(e.target.value))} /><div className="gpu__depth-key"><span>● {format(frame.winners.length)} keep</span><span>● {format(counts.rejected)} discard</span></div><small>Layers are separated for inspection. Real GPUs can test depth before shading to avoid wasted work.</small></>}
            {stage === 5 && <><label htmlFor="gpu-alpha">Source opacity <output>{Math.round(alpha * 100)}%</output></label><input id="gpu-alpha" type="range" min="0" max="1" step=".01" value={alpha} onChange={e => setAlpha(Number(e.target.value))} /><small>Nearest surface over a cleared background; this is not layered glass transparency.</small></>}
            {stage === 6 && <div className="gpu__share"><button onClick={() => void copyLink()}>Copy this journey ↗</button><button disabled={!ready || failed || saving} onClick={() => void saveFrame()}>{saving ? 'Saving…' : 'Save frame ↓'}</button></div>}
          </div>
        </ThinFrame>
      </div>
      <div className="gpu__world" ref={viewport}>
        <div className="gpu__world-top"><span><i /> {failed ? 'TEXT EXPLORER' : ready ? 'LIVE ON YOUR GPU' : 'ENTERING THE CHIP'}</span><span>FRAME 001 / {width} × {height}</span></div>
        {!failed ? <SceneBoundary onError={onError}><Scene stage={stage} frame={frame} space={space} divergent={divergent} branchPhase={branchPhase} alpha={alpha} depth={depth} paused={paused} reduced={reduced} mobile={mobile} reset={reset} fly={fly} onReady={onReady} onError={onError} /></SceneBoundary> : <div className="gpu__unavailable"><p>The 3D world is unavailable on this device.</p><p>All seven captions, controls, and computed counts still work.</p><button onClick={() => { setFailed(false); setReset(v => v + 1) }}>Retry 3D</button></div>}
        {stage === 6 && <div className="gpu__final" aria-label="Frame statistics"><p>{format(counts.total)}</p><h2>work items. <em>one frame.</em></h2><span>At 60 fps, do it all again in 16.67 ms.</span><small>Actual counts from this teaching scene · not hardware instructions</small></div>}
        <div className="gpu__world-bottom"><span>{stage === 6 ? 'ONE FRAME / MILLIONS OF POSSIBILITIES' : `${format(stage === 1 ? frame.vertices.length : frame.fragments.length)} ${stage === 1 ? 'VERTICES' : 'FRAGMENT JOBS'} / ONE IMAGE`}</span><span>{String(stage + 1).padStart(2, '0')} ── 07</span></div>
      </div>
    </div>
    <div className="gpu__transport">
      <div className="gpu__view-controls"><button aria-pressed={paused} onClick={() => setPauseOverride(!paused)}>{paused ? '▷ Play' : 'Ⅱ Pause'}</button><button aria-pressed={fly} onClick={() => { setFly(v => !v); viewport.current?.querySelector('canvas')?.focus() }}>Fly {fly ? 'on' : 'off'}</button><button onClick={() => setReset(v => v + 1)}>Reset view</button></div>
      <p>{fly ? 'Focus world · WASD move · Q/E rise/fall · drag to orbit' : mobile ? 'Drag to orbit · two fingers to pan' : 'Drag to orbit · right-drag to pan · scroll or ← → to travel'}</p>
      <div className="gpu__travel"><button disabled={stage === 0} onClick={() => go(stage - 1)} aria-label="Previous stage">←</button><button onClick={() => go(stage === 6 ? 0 : stage + 1)}>{stage === 6 ? 'Start again' : 'Next stage'} <span>→</span></button></div>
    </div>
    <nav className="gpu__stages" aria-label="GPU pipeline stages">{STAGES.map((s, i) => <button key={s.id} aria-current={stage === i ? 'step' : undefined} onClick={() => go(i)}><span>{String(i + 1).padStart(2, '0')}</span><span>{s.label}</span><i /></button>)}</nav>
    {notice && <p className="gpu__notice" role="status">{notice}</p>}
    <footer className="gpu__footer"><span>A SMALL MODEL OF AN ENORMOUS IDEA.</span><details><summary>What are we counting?</summary><div className="gpu__method">
      <h2>A model you can inspect.</h2><p>One indexed torus, {format(frame.vertices.length)} vertex records, {format(frame.indices.length / 3)} triangles, and a {width} × {height} framebuffer. The same mesh is projected and rasterized at pixel centers in a deterministic local teaching renderer.</p>
      <dl>{Object.entries(counts.tasks).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt><dd>{format(value)}</dd></div>)}<div><dt>Total work items</dt><dd>{format(counts.total)}</dd></div></dl>
      <p>These are conceptual jobs of different sizes, not FLOPs, hardware instructions, measured FPS, or all work required to run this website. With the branch enabled we count one extra predicate per fragment; waiting lane slots are not extra useful work.</p>
      <p>We shade both faces, resolve the nearest fragment per pixel, and blend it over a cleared background. For counting, depth is resolved front to back with one blend/write per survivor. Real draw order, early depth tests, clipping, caching, multisampling, shader compilers, and display compositors change actual workloads. The chambers are a spatial metaphor, not the physical layout of a chip.</p>
      <p>32-lane scheduling illustrates an NVIDIA warp. Other GPUs use other group widths, and modern scheduling is more flexible. A lane is a logical invocation, not a dedicated physical core.</p>
      <p className="gpu__device">Renderer reported locally: {renderer}. WebGL does not reliably expose core counts. No hardware details are sent anywhere.</p>
      <p>Further reading: <a href="https://wikis.khronos.org/opengl/Rendering_Pipeline_Overview" target="_blank" rel="noreferrer">Khronos: rendering pipeline ↗</a> · <a href="https://developer.nvidia.com/blog/using-cuda-warp-level-primitives/" target="_blank" rel="noreferrer">NVIDIA: warps ↗</a></p>
    </div></details><span>FREE / LOCAL / NO ACCOUNT</span></footer>
  </main>
}
