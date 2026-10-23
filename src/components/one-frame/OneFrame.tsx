import Link from 'next/link'
import {useEffect, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react'
import type {Engine, Snapshot} from './engine'
import {createFlight, missionGuide, type Input} from './model'
import styles from './one-frame.module.scss'

const initial: Snapshot = {...createFlight(), speed: 0, distance: 0, targetLabel: '', targetDetail: '', marker: {x: 50, y: 50, behind: false}, backend: ''}

export default function OneFrame() {
  const surface = useRef<HTMLDivElement>(null), engine = useRef<Engine | null>(null)
  const [state, setState] = useState<Snapshot>(initial), [ready, setReady] = useState(false), [error, setError] = useState('')
  const [sound, setSound] = useState(false)
  const [stick, setStick] = useState({x: 0, y: 0})

  useEffect(() => {
    let cancelled = false
    // A disposed WebGL renderer loses its context. Give every mount (including Fast Refresh)
    // a fresh canvas so a new renderer never inherits a lost context.
    const canvas = document.createElement('canvas')
    canvas.className = styles.canvas; canvas.tabIndex = 0
    canvas.setAttribute('aria-label', 'GPU flight world. W A S D to move, Q and E to descend and rise, drag to look, arrow keys to turn, Shift to boost, Space to brake, C to face your objective, Escape to pause.')
    surface.current!.appendChild(canvas)
    setReady(false); setError(''); setState(initial)
    void import('./engine').then(({createEngine}) => createEngine(canvas, snapshot => {
      if (cancelled) return
      setState(snapshot)
    }, message => { if (!cancelled) setError(message) })).then(instance => {
      if (cancelled) instance.dispose()
      else { engine.current = instance; setReady(true) }
    }).catch(() => { if (!cancelled) setError('This device could not open the 3D world. Try the lighter graphics mode or another browser.') })
    return () => { cancelled = true; engine.current?.dispose(); engine.current = null; canvas.remove() }
  }, [])

  function start() { engine.current?.start(); if (sound) engine.current?.sound(true) }
  function toggleSound() { setSound(!sound); engine.current?.sound(!sound) }
  function pause() { engine.current?.pause(); setStick({x: 0, y: 0}) }
  function resume() { engine.current?.resume() }
  function joystick(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const box = event.currentTarget.getBoundingClientRect(), x = Math.max(-1, Math.min(1, (event.clientX - box.left - box.width / 2) / 39)), y = Math.max(-1, Math.min(1, (event.clientY - box.top - box.height / 2) / 39))
    setStick({x: x * 29, y: y * 29}); engine.current?.input({strafe: Math.abs(x) < .12 ? 0 : x, forward: Math.abs(y) < .12 ? 0 : -y})
  }
  const hold = (values: Partial<Input>) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.input(values) },
    onPointerUp: () => engine.current?.input(Object.fromEntries(Object.keys(values).map(k => [k, typeof values[k as keyof Input] === 'boolean' ? false : 0]))),
    onPointerCancel: () => engine.current?.input(Object.fromEntries(Object.keys(values).map(k => [k, typeof values[k as keyof Input] === 'boolean' ? false : 0]))),
  })
  const flying = state.phase === 'playing', paused = state.phase === 'paused', ending = state.phase === 'ending', complete = state.phase === 'complete'
  const guide = missionGuide(state)

  return <main className={styles.experience} aria-label="One Frame, a playable GPU expedition">
    <div ref={surface} className={styles.surface} />
    <div className={styles.vignette} aria-hidden="true" />
    <header className={styles.header}>
      <Link href="/one-frame" className={styles.brand} aria-label="One Frame project story"><i aria-hidden="true">◈</i> ONE FRAME </Link>
      <nav aria-label="Experience controls">
        <button onClick={toggleSound} aria-pressed={sound} disabled={!ready}>{sound ? '◖ Sound on' : '◌ Sound off'}</button>
        {flying && <button onClick={pause}>Controls</button>}
        {paused && <button onClick={resume}>▷ Resume</button>}
        <Link href="/work">Work ↗</Link>
      </nav>
    </header>

    {state.phase === 'intro' && !error && <section className={styles.intro}>
      <p className={styles.eyebrow}><span /> INSIDE A GPU</p>
      <h1>One<br /><em>Frame.</em></h1>
      <p className={styles.lead}>Fly through the rings.<br />Build a picture.</p>
      <p className={styles.description}>A GPU is a chip that draws pictures by doing lots of small calculations at once.</p>
      <div className={styles.launch}>
        <button className={styles.primary} disabled={!ready} onClick={start}>{!ready ? 'Building the machine…' : 'Enter the GPU'} <span>↗</span></button>
      </div>
      <p className={styles.introControls}><span className={styles.desktopOnly}>W to fly · drag to look · C to aim</span><span className={styles.touchOnly}>Pad to fly · drag to look</span></p>
    </section>}
    {state.phase === 'intro' && <footer className={styles.introFooter}><span>3 STAGES · ONE PICTURE</span><Link href="/one-frame">Behind the experience ↗</Link></footer>}

    {(flying || paused) && <>
      <section className={styles.mission} aria-label="Current objective">
        <div className={styles.missionHeading}>
          <p className={styles.eyebrow}>Stage {state.chapter + 1} / 3 · {guide.stage}</p>
          <span className={styles.counter} aria-label={`${guide.collected} of ${guide.total} rings collected`}>{guide.collected}<span> / {guide.total}</span></span>
        </div>
        <h1>{guide.action}</h1>
        <p className={styles.lesson}>{guide.lesson}</p>
      </section>
      {flying && <>
        <button className={`${styles.beacon} ${state.marker.behind ? styles.behind : ''}`} style={{left: `${state.marker.x}%`, top: `${state.marker.y}%`}} onClick={() => engine.current?.align()} aria-label={`Face ${state.targetLabel}, ${Math.round(state.distance)} metres away`}>
          <i aria-hidden="true">{state.marker.behind ? '↶' : '◇'}</i><span>{Math.round(state.distance)} m</span>
          {state.marker.behind && <small>BEHIND YOU</small>}
        </button>
        <div className={styles.reticle} aria-hidden="true"><i /><i /></div>
        <div className={styles.touchControls}>
          <div className={styles.joystick} role="group" aria-label="Touch flight pad" onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); joystick(e) }} onPointerMove={joystick} onPointerUp={() => { setStick({x: 0, y: 0}); engine.current?.input({forward: 0, strafe: 0}) }} onPointerCancel={() => { setStick({x: 0, y: 0}); engine.current?.input({forward: 0, strafe: 0}) }}><span style={{transform: `translate(${stick.x}px, ${stick.y}px)`}} /><small>FLY</small></div>
          <div className={styles.touchButtons}><button aria-label="Rise" {...hold({lift: 1})}>↑</button><button aria-label="Descend" {...hold({lift: -1})}>↓</button><button {...hold({boost: true})}>Boost</button><button onClick={() => engine.current?.align()}>Aim</button></div>
        </div>
      </>}
    </>}

    {paused && <section className={styles.modal} aria-label="Expedition paused">
      <div className={styles.modalCard}>
        <h2>Paused.</h2>
        <div className={styles.controlGrid}><span><kbd>W A S D</kbd> Fly / strafe</span><span><kbd>DRAG / ← →</kbd> Look / turn</span><span><kbd>Q / E</kbd> Descend / rise</span><span><kbd>↑ / ↓</kbd> Pitch up / down</span><span><kbd>SHIFT</kbd> Boost</span><span><kbd>SPACE</kbd> Brake / precision</span><span><kbd>C</kbd> Aim at next ring</span><span><kbd>R</kbd> Return to checkpoint</span><span><kbd>ESC / P</kbd> Pause / resume</span></div>
        <div className={styles.actions}><button className={styles.primary} onClick={resume}>Continue flight <span>↗</span></button><button onClick={() => { engine.current?.reset(); resume() }}>Return to checkpoint</button></div>
        <button className={styles.quiet} onClick={() => engine.current?.restart()}>Restart</button>
      </div>
    </section>}

    {(ending || complete) && <>
      <div className={styles.transition} style={{opacity: ending ? state.endingTime < 1.1 ? state.endingTime / 1.1 : Math.max(0, 1 - (state.endingTime - 1.1) / 1.2) : 0}} />
      {state.endingTime > 3 && <section className={`${styles.ending} ${complete ? styles.endingComplete : ''}`}>
        <p className={styles.eyebrow}>3 / 3 · COMPLETE</p><h1>You made<br /><em>one picture.</em></h1>
        <p>A GPU repeats this many times a second to make a game look like it’s moving.</p>
        {complete && <div className={styles.actions}><button className={styles.primary} onClick={() => engine.current?.restart()}>Play again <span>↗</span></button><Link href="/one-frame">How it works ↗</Link></div>}
      </section>}
    </>}

    {error && <section className={styles.modal} role="alert"><div className={styles.modalCard}><p className={styles.eyebrow}>SIGNAL INTERRUPTED</p><h2>A little turbulence.</h2><p>{error}</p><div className={styles.actions}><button className={styles.primary} onClick={() => window.location.assign('/time-frame?quality=low&renderer=webgl')}>Try lighter graphics ↗</button><Link href="/one-frame">Read the project story</Link></div></div></section>}
  </main>
}
