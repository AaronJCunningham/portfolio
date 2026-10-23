import * as THREE from 'three/webgpu'
import {Fn, float, hash, instanceIndex, instancedArray, mix, pass, shapeCircle, uniform, vec3} from 'three/tsl'
import {bloom} from 'three/addons/tsl/display/BloomNode.js'
import {createCollectionEffects} from './collection-effects'
import {BRANCHES, BRANCH_EXIT, DISPLAY, EMPTY_INPUT, FRAGMENTS, MEMORY_EXIT, PACKETS, alignToTarget, clamp, count, createFlight, has, memoryRoutePoint, resetPosition, stepFlight, target, type Flight, type Input, type Obstacle, type Point} from './model'

export type Snapshot = Flight & {speed: number; distance: number; targetLabel: string; targetDetail: string; marker: {x: number; y: number; behind: boolean}; backend: string}
export type Engine = {start: () => void; pause: () => void; resume: () => void; restart: () => void; reset: () => void; align: () => void; sound: (enabled: boolean) => void; input: (input: Partial<Input>) => void; dispose: () => void}
type Marker = {group: THREE.Group; ring: THREE.Mesh; core: THREE.Mesh; label: THREE.Sprite; radius: number; consumed: boolean; isConsumed: () => boolean}
const GOLD = '#ffbd62', CYAN = '#87ddd7', WHITE = '#fff2d6'
const v = (p: Point) => new THREE.Vector3(p.x, p.y, p.z)

function rng(seed = 43) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 } }

function textTexture(title: string, subtitle = '') {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffca87'; ctx.font = '500 55px monospace'; ctx.fillText(title, 512, 83)
  ctx.fillStyle = '#a4a8a4'; ctx.font = '22px monospace'; ctx.fillText(subtitle, 512, 137)
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function label(title: string, subtitle = '', width = 15) {
  const material = new THREE.SpriteNodeMaterial({map: textTexture(title, subtitle), transparent: true, depthWrite: false})
  const sprite = new THREE.Sprite(material); sprite.scale.set(width, width * 192 / 1024, 1)
  return sprite
}

function finalTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 600
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, 600)
  gradient.addColorStop(0, '#0c1c24'); gradient.addColorStop(.6, '#895137'); gradient.addColorStop(1, '#131c20')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, 600)
  ctx.fillStyle = '#ffd490'; ctx.beginPath(); ctx.arc(480, 268, 136, 0, Math.PI * 2); ctx.fill()
  for (let layer = 0; layer < 5; layer++) {
    ctx.fillStyle = ['#975839', '#714632', '#44372d', '#25302b', '#101e21'][layer]
    ctx.beginPath(); ctx.moveTo(0, 600)
    for (let x = 0; x <= 960; x += 8) {
      const y = 355 + layer * 39 + Math.sin(x * .008 + layer * 2) * 46 + Math.sin(x * .021 + layer) * 18
      ctx.lineTo(x, y)
    }
    ctx.lineTo(960, 600); ctx.fill()
  }
  ctx.fillStyle = '#ffffff08'
  for (let x = 0; x < 960; x += 10) ctx.fillRect(x, 0, 1, 600)
  for (let y = 0; y < 600; y += 10) ctx.fillRect(0, y, 960, 1)
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** One shared renderer, deterministic world geometry, no network assets. */
export async function createEngine(canvas: HTMLCanvasElement, onSnapshot: (state: Snapshot) => void, onError: (message: string) => void): Promise<Engine> {
  let disposed = false, state = createFlight(), lastTime = 0, reportAt = 0, soundOn = false
  const mobile = matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 760px)').matches, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const quality = new URLSearchParams(location.search).get('quality')
  const low = quality === 'low' || mobile
  const renderer = new THREE.WebGPURenderer({canvas, antialias: !low, powerPreference: 'high-performance', forceWebGL: new URLSearchParams(location.search).get('renderer') === 'webgl'})
  try { await renderer.init() } catch (error) { try { await renderer.dispose() } catch { /* Initialization did not finish. */ } throw error }
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15
  const native = (renderer as unknown as {backend: {isWebGPUBackend?: boolean}}).backend.isWebGPUBackend === true
  const backend = native ? 'WebGPU' : 'WebGL2'
  canvas.dataset.renderer = backend
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5))
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#10151a'); scene.fog = new THREE.FogExp2('#171b1d', .0065)
  const camera = new THREE.PerspectiveCamera(58, 1, .15, 950)
  camera.position.set(34, 25, 38); camera.lookAt(0, 12, -70)
  const city = new THREE.Group(); scene.add(city)
  const architecture = new THREE.Group(); city.add(architecture)
  const ambient = new THREE.HemisphereLight('#c5d7e7', '#382416', 2.1); scene.add(ambient)
  const sun = new THREE.DirectionalLight('#ffcd8f', 3.8); sun.position.set(-25, 60, 20); scene.add(sun)
  const coolLight = new THREE.DirectionalLight('#8aa6bd', 1.7); coolLight.position.set(35, 24, -100); scene.add(coolLight)

  const metal = new THREE.MeshStandardNodeMaterial({color: '#2c3033', roughness: .62, metalness: .78})
  const copper = new THREE.MeshStandardNodeMaterial({color: '#91613c', roughness: .44, metalness: .76})
  const dark = new THREE.MeshStandardNodeMaterial({color: '#131b20', roughness: .68, metalness: .45})
  const gold = new THREE.MeshBasicNodeMaterial({color: new THREE.Color(GOLD).multiplyScalar(2.4)})
  const mint = new THREE.MeshBasicNodeMaterial({color: new THREE.Color(CYAN).multiplyScalar(1.7)})
  const pale = new THREE.MeshBasicNodeMaterial({color: new THREE.Color(WHITE).multiplyScalar(1.4)})
  const dim = new THREE.MeshBasicNodeMaterial({color: '#3b494a'})
  const soft = new THREE.MeshBasicNodeMaterial({color: '#ad7948'})
  const boxes: {position: Point; size: Point; material: number}[] = []
  const addBox = (x: number, y: number, z: number, w: number, h: number, d: number, material = 0) => boxes.push({position: {x, y, z}, size: {x: w, y: h, z: d}, material})
  const obstacles: Obstacle[] = []
  const random = rng()

  // The central lane is clear; the outer towers provide a real collision boundary and scale.
  for (let side = -1; side <= 1; side += 2) for (let row = 0; row < 29; row++) for (let col = 0; col < 3; col++) {
    const x = side * (35 + col * 16 + random() * 4), z = 35 - row * 15 + random() * 5
    const h = 17 + random() * 55, w = 7 + random() * 6, d = 8 + random() * 3
    addBox(x, h / 2, z, w, h, d)
    if (col === 0) obstacles.push({x, z, width: w, depth: d, height: h})
    addBox(x, h + .15, z, w + .5, .3, d + .5, 1)
    for (let k = 0; k < 4; k++) {
      addBox(x - w / 2 + .7 + k * (w - 1.4) / 3, h / 2, z + d / 2 + .07, .07, h * .93, .08, k === 0 ? 3 : 1)
    }
    for (let y = 3; y < h; y += 5) {
      addBox(x, y, z + d / 2 + .1, w * .84, .12, .2, 1)
      if (random() > .35) addBox(x + (random() - .5) * w * .65, y + 1.2, z + d / 2 + .15, 1.4, .18, .15, 3)
    }
  }
  for (const o of [{x: -16, z: -130, width: 8, depth: 10, height: 18}, {x: 8, z: -245, width: 6, depth: 10, height: 19}]) {
    obstacles.push(o); addBox(o.x, o.height / 2, o.z, o.width, o.height, o.depth, 0)
    addBox(o.x, o.height + .2, o.z, o.width + .4, .3, o.depth + .4, 1)
    addBox(o.x, o.height / 2, o.z + o.depth / 2 + .1, .16, o.height, .12, 3)
  }
  addBox(0, -.7, -156, 170, 1.4, 450, 2)
  // Inlaid circuit traces; staggered copper connections rather than a uniform grid.
  for (let i = 0; i < 80; i++) {
    const x = (i - 39.5) * 1.8
    addBox(x, .02, -160, i % 7 === 0 ? .12 : .045, .035, 430, i % 7 === 0 ? 3 : 1)
  }
  for (let z = 40; z > -375; z -= 14) {
    addBox(-20, .08, z, 24, .05, .09, 1); addBox(20, .08, z - 5, 24, .05, .09, 1)
    addBox(-28, 1.5, z, .3, 3, .3, 1); addBox(28, 1.5, z, .3, 3, .3, 1)
    addBox(-28, 3.1, z, .5, .2, .5, 3); addBox(28, 3.1, z, .5, .2, .5, 3)
  }
  // Monumental district portals and high bridges frame the view without restricting flight.
  for (const z of [-4, -112, -232, -334]) {
    addBox(-26, 20, z, 2, 40, 3, 0); addBox(26, 20, z, 2, 40, 3, 0); addBox(0, 40, z, 54, 2, 3, 0)
    addBox(-24.9, 20, z + 1.6, .11, 39, .12, 3); addBox(24.9, 20, z + 1.6, .11, 39, .12, 3)
    addBox(0, 39, z + 1.6, 50, .13, .13, 3)
  }
  for (const z of [-68, -208, -312]) { addBox(0, 47, z, 155, 2, 7, 2); addBox(0, 45.8, z + 3, 140, .15, .16, 1) }
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1), dummy = new THREE.Object3D()
  ;[metal, copper, dark, gold].forEach((material, i) => {
    const group = boxes.filter(b => b.material === i), mesh = new THREE.InstancedMesh(boxGeometry, material, group.length)
    group.forEach((b, j) => { dummy.position.copy(v(b.position)); dummy.scale.copy(v(b.size)); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); mesh.setMatrixAt(j, dummy.matrix) })
    mesh.computeBoundingSphere(); architecture.add(mesh)
  })

  const markers: Marker[] = [], collectionEffects = createCollectionEffects(city, reduced, low)
  function marker(p: Point, title: string, subtitle: string, isConsumed: () => boolean, color: THREE.MeshBasicNodeMaterial = gold, radius = 2.8) {
    const group = new THREE.Group(); group.position.copy(v(p)); city.add(group)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .045, 5, 48), color)
    const inner = new THREE.Mesh(new THREE.TorusGeometry(radius * .82, .025, 4, 40, Math.PI * 1.5), soft)
    ring.add(inner); inner.rotation.z = .5
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(.65), color)
    const text = label(title, subtitle, radius * 4.4); text.position.y = radius + 1.6
    group.add(ring, core, text)
    const item = {group, ring, core, label: text, radius, consumed: isConsumed(), isConsumed}; markers.push(item); return item
  }
  const memoryMarkers = PACKETS.map((p, i) => marker(p, `DATA ${i + 1}`, '', () => has(state.packets, i)))
  const memoryExit = marker(MEMORY_EXIT, 'NEXT', '', () => state.chapter > 0, gold, 5.4)
  const branchMarkers = BRANCHES.map((p, i) => marker(p, i === 0 ? 'A' : 'B', '', () => state.branches[i] > 0, gold, 5.3))
  const branchExit = marker(BRANCH_EXIT, 'NEXT', '', () => state.chapter > 1, mint, 5)
  const fragmentMarkers = FRAGMENTS.map((p, i) => marker(p, ['FAR', 'MIDDLE', 'NEAR'][i], '', () => has(state.fragments, i), [gold, pale, mint][i], 3.6))
  const displayGate = marker(DISPLAY, 'FINISH', '', () => state.phase === 'ending' || state.phase === 'complete', gold, 6)
  const districtLabels = [label('01 / GET DATA', '', 33), label('02 / DO THE MATHS', '', 35), label('03 / DRAW THE PICTURE', '', 33)]
  districtLabels.forEach((l, i) => { l.position.set(0, 33, [-4, -112, -232][i]); city.add(l) })

  // Physical rails connect the districts and give the player a route to read at a glance.
  const railPoints: THREE.Vector3[] = []
  const path = [{x: 0, y: 1, z: 42}, ...PACKETS.map(p => ({...p, y: 1})), {...MEMORY_EXIT, y: 1}, {x: 0, y: 1, z: -145}, ...BRANCHES.map(p => ({...p, y: 1})), {...BRANCH_EXIT, y: 1}, ...FRAGMENTS.map(p => ({...p, y: 1})), {...DISPLAY, y: 1}]
  const route = new THREE.CatmullRomCurve3(path.map(v))
  railPoints.push(...route.getPoints(400))
  city.add(new THREE.Mesh(new THREE.TubeGeometry(route, 320, .055, 4, false), gold))
  // The opening has one continuous flight-height trail, separate from the floor circuitry.
  // It follows the same curve as the pickups and leads all the way into the bus.
  const memoryTrail = new THREE.Group(); city.add(memoryTrail)
  const memoryCurve = new THREE.CatmullRomCurve3(Array.from({length: 65}, (_, i) => {
    const p = memoryRoutePoint(i / 64); return new THREE.Vector3(p.x, p.y - 1.2, p.z)
  }))
  memoryTrail.add(new THREE.Mesh(new THREE.TubeGeometry(memoryCurve, 192, .065, 5, false), gold))
  const arrowGeometry = new THREE.ConeGeometry(.24, .9, 3)
  for (let i = 1; i < 23; i++) {
    const t = i / 24, arrow = new THREE.Mesh(arrowGeometry, gold)
    arrow.position.copy(memoryCurve.getPoint(t))
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), memoryCurve.getTangent(t))
    memoryTrail.add(arrow)
  }
  const branchCurve = new THREE.CatmullRomCurve3([MEMORY_EXIT, ...BRANCHES, BRANCH_EXIT].map(p => new THREE.Vector3(p.x, p.y - 1.2, p.z)))
  const branchTrail = new THREE.Mesh(new THREE.TubeGeometry(branchCurve, 140, .065, 5, false), gold); city.add(branchTrail)

  // Native WebGPU owns the traffic positions; the compatibility path evaluates a cheaper analytic field.
  const particleCount = low ? 7000 : 22000
  const clock = uniform(0), delta = uniform(0), flow = uniform(1), positionBuffer = native ? instancedArray(particleCount, 'vec3') : null
  const seed = hash(instanceIndex), seed2 = hash(instanceIndex.add(17)), seed3 = hash(instanceIndex.add(71))
  const baseX = seed.mul(2).sub(1).mul(29), baseY = seed2.greaterThan(.86).select(seed2.mul(36), seed2.mul(2).add(.4))
  let update: Parameters<typeof renderer.compute>[0] | null = null
  if (positionBuffer) {
    const init = Fn(() => { positionBuffer.element(instanceIndex).assign(vec3(baseX, baseY, seed3.mul(-410).add(40))) })().compute(particleCount)
    update = Fn(() => {
      const p = positionBuffer.element(instanceIndex)
      p.z.assign(p.z.sub(delta.mul(seed.mul(14).add(9)).mul(flow)).add(380).mod(420).sub(380))
    })().compute(particleCount)
    renderer.compute(init)
  }
  const trafficMaterial = new THREE.SpriteNodeMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})
  trafficMaterial.positionNode = positionBuffer ? positionBuffer.toAttribute() : vec3(baseX, baseY, seed3.mul(420).sub(clock.mul(seed.mul(14).add(9))).mod(420).sub(380))
  trafficMaterial.colorNode = mix(vec3(1, .42, .1), vec3(.32, .86, .81), seed.greaterThan(.93).select(1, 0)).mul(2.3)
  trafficMaterial.scaleNode = vec3(.06, .06, .06).mul(seed2.mul(2).add(1))
  trafficMaterial.opacityNode = (shapeCircle() as unknown as ReturnType<typeof float>).mul(.78)
  const traffic = new THREE.Sprite(trafficMaterial); traffic.count = particleCount; traffic.frustumCulled = false; city.add(traffic)

  // Convoy: 32 visible logical lanes. Its active mask follows the same state as the challenge.
  const convoy = new THREE.Group(); city.add(convoy)
  const laneGeometry = new THREE.BoxGeometry(.13, .13, .6)
  const lanes = Array.from({length: 32}, (_, i) => { const lane = new THREE.Mesh(laneGeometry, gold); lane.position.set((i % 8 - 3.5) * .37, -.7 - Math.floor(i / 8) * .28, 2 + Math.floor(i / 8) * .8); convoy.add(lane); return lane })
  const ship = new THREE.Group(); city.add(ship)
  const hull = new THREE.Mesh(new THREE.ConeGeometry(.62, 2.6, 4), copper); hull.rotation.x = -Math.PI / 2; ship.add(hull)
  const spine = new THREE.Mesh(new THREE.BoxGeometry(.09, .09, 2), gold); spine.position.y = .26; ship.add(spine)
  const wingGeometry = new THREE.BoxGeometry(1.3, .065, .5)
  for (const side of [-1, 1]) { const wing = new THREE.Mesh(wingGeometry, metal); wing.position.set(side * .65, -.08, .45); wing.rotation.y = side * .5; ship.add(wing) }
  const engineGlow = new THREE.Mesh(new THREE.ConeGeometry(.22, 1.7, 8), gold); engineGlow.rotation.x = Math.PI / 2; engineGlow.position.z = 1.7; ship.add(engineGlow)

  const image = finalTexture()
  const imageMaterial = new THREE.MeshBasicNodeMaterial({map: image})
  const worldScreen = new THREE.Mesh(new THREE.PlaneGeometry(40, 25), imageMaterial); worldScreen.position.set(0, 18, -359); city.add(worldScreen)
  const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(42, 27, 1.4), dark); screenFrame.position.set(0, 18, -360); city.add(screenFrame)

  const finale = new THREE.Group(); scene.add(finale); finale.visible = false
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(23, 15, .7), dark); monitor.position.set(0, 8.5, -.5); finale.add(monitor)
  const monitorScreen = new THREE.Mesh(new THREE.PlaneGeometry(22, 13.75), imageMaterial); monitorScreen.position.set(0, 8.5, -.1); finale.add(monitorScreen)
  const stand = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.5, 1.3), metal); stand.position.set(0, 1.7, -.9); finale.add(stand)
  const foot = new THREE.Mesh(new THREE.BoxGeometry(8, .2, 4), metal); foot.position.set(0, .35, -.8); finale.add(foot)
  const desk = new THREE.Mesh(new THREE.BoxGeometry(80, .4, 50), dark); desk.position.y = -.1; finale.add(desk)
  const indicator = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), mint); indicator.position.set(10.8, 1.4, -.1); finale.add(indicator)

  let pipeline: THREE.RenderPipeline | null = null
  if (native && !low) {
    pipeline = new THREE.RenderPipeline(renderer)
    const scenePass = pass(scene, camera), color = scenePass.getTextureNode('output')
    const glow = bloom(color, .28, .35, 1.05); glow.setResolutionScale(.35)
    pipeline.outputNode = color.add(glow)
  }
  const resize = () => {
    const rect = canvas.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height)
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false)
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize()

  const keys = new Set<string>(), touch: Input = {...EMPTY_INPUT}
  let dragging = false, lastPointer = {x: 0, y: 0}, suspended = document.hidden || !document.hasFocus()
  const controlledKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyR', 'KeyC', 'KeyP', 'Escape']
  function keydown(e: KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, textarea, select')) return
    if (!controlledKeys.includes(e.code) || state.phase === 'intro' || state.phase === 'complete' || state.phase === 'ending') return
    if (e.code === 'Space' && (e.target as HTMLElement).closest('button, a')) return
    e.preventDefault()
    if (!e.repeat) {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (state.phase === 'playing') pause(); else resume() }
      if (state.phase === 'playing') {
        if (e.code === 'KeyR') resetPosition(state)
        if (e.code === 'KeyC') alignToTarget(state)
      }
    }
    keys.add(e.code)
  }
  function keyup(e: KeyboardEvent) { keys.delete(e.code) }
  function clearInput() { keys.clear(); Object.assign(touch, EMPTY_INPUT); dragging = false }
  function pause() { if (state.phase === 'playing') { state.phase = 'paused'; clearInput(); report() } }
  function resume() { if (state.phase === 'paused') { state.phase = 'playing'; clearInput(); canvas.focus(); report() } }
  // Focus changes are a quiet suspension, never an invitation to open a modal.
  // Explicitly paused games stay paused when focus returns.
  function syncFocus() {
    suspended = document.hidden || !document.hasFocus()
    lastTime = 0
    if (suspended) {
      clearInput(); state.velocity = {x: 0, y: 0, z: 0}
      if (audio && volume) volume.gain.setTargetAtTime(0, audio.currentTime, .05)
    }
  }
  function pointerdown(e: PointerEvent) {
    if (state.phase !== 'playing') return
    dragging = true; lastPointer = {x: e.clientX, y: e.clientY}; canvas.setPointerCapture(e.pointerId); canvas.focus()
  }
  function pointermove(e: PointerEvent) {
    if (!dragging || state.phase !== 'playing') return
    state.yaw -= (e.clientX - lastPointer.x) * .0035
    state.pitch = clamp(state.pitch - (e.clientY - lastPointer.y) * .003, -.95, .95)
    lastPointer = {x: e.clientX, y: e.clientY}
  }
  function pointerup() { dragging = false }
  window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', syncFocus); window.addEventListener('focus', syncFocus)
  document.addEventListener('visibilitychange', syncFocus)
  canvas.addEventListener('pointerdown', pointerdown); canvas.addEventListener('pointermove', pointermove); canvas.addEventListener('pointerup', pointerup); canvas.addEventListener('pointercancel', pointerup)
  const key = (positive: string, negative: string) => Number(keys.has(positive)) - Number(keys.has(negative))
  const cameraPosition = new THREE.Vector3(), cameraTarget = new THREE.Vector3(), look = new THREE.Vector3(0, 12, -70), projected = new THREE.Vector3(), cameraForward = new THREE.Vector3()

  let audio: AudioContext | null = null, volume: GainNode | null = null, drone: OscillatorNode | null = null, filter: BiquadFilterNode | null = null
  function sound(enabled: boolean) {
    soundOn = enabled
    if (enabled && !audio) {
      const Audio = window.AudioContext
      if (!Audio) return
      audio = new Audio(); volume = audio.createGain(); volume.gain.value = .035; volume.connect(audio.destination)
      drone = audio.createOscillator(); drone.type = 'triangle'; drone.frequency.value = 55
      filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 300
      drone.connect(filter); filter.connect(volume); drone.start()
    }
    if (audio) {
      if (enabled) void audio.resume().catch(() => {})
      volume?.gain.setTargetAtTime(enabled ? .035 : 0, audio.currentTime, .12)
    }
  }
  function ping(chapter: number) {
    if (!audio || !volume || !soundOn) return
    const o = audio.createOscillator(), gain = audio.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(220 * Math.pow(2, chapter / 3), audio.currentTime)
    o.frequency.exponentialRampToValueAtTime(880, audio.currentTime + .3)
    gain.gain.setValueAtTime(0, audio.currentTime); gain.gain.linearRampToValueAtTime(.9, audio.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .7)
    o.connect(gain); gain.connect(volume); o.start(); o.stop(audio.currentTime + .8)
    o.onended = () => { o.disconnect(); gain.disconnect() }
  }

  function report() {
    const destination = target(state), speed = Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z)
    projected.copy(v(destination.position)).project(camera)
    camera.getWorldDirection(cameraForward)
    const behind = v(destination.position).sub(camera.position).dot(cameraForward) < 0
    onSnapshot({...state, position: {...state.position}, velocity: {...state.velocity}, branches: [...state.branches], speed, distance: v(destination.position).distanceTo(v(state.position)), targetLabel: destination.label, targetDetail: destination.detail,
      marker: {x: clamp((projected.x + 1) * 50, 7, 93), y: clamp((1 - projected.y) * 50, 18, 78), behind}, backend})
  }

  const updateMarkers = (time: number) => {
    markers.forEach((m, i) => {
      const consumed = m.isConsumed()
      if (consumed && !m.consumed) collectionEffects.burst(m.group.position, m.radius, (m.ring.material as THREE.MeshBasicNodeMaterial).color)
      m.consumed = consumed
      m.ring.rotation.z = reduced ? 0 : time * .13 * (i % 2 ? 1 : -1)
      m.core.rotation.y = time * .7; m.core.rotation.z = time * .3
      m.core.position.y = reduced ? 0 : Math.sin(time * 1.8 + i) * .25
      m.label.visible = state.phase !== 'intro' && m.group.position.distanceTo(camera.position) < 85
    })
    memoryMarkers.forEach((m, i) => { m.group.visible = state.chapter === 0 && !has(state.packets, i) })
    memoryTrail.visible = state.chapter === 0
    branchTrail.visible = state.chapter === 1
    memoryExit.group.visible = state.chapter === 0 && state.packets === 255
    branchMarkers.forEach((m, i) => { m.group.visible = state.chapter === 1 && state.branches[i] === 0 })
    branchExit.group.visible = state.chapter === 1 && state.branches.every(p => p === 1)
    fragmentMarkers.forEach((m, i) => { m.group.visible = state.chapter === 2 && !has(state.fragments, i) })
    displayGate.group.visible = state.chapter === 2 && state.fragments === 7 && !displayGate.consumed
    worldScreen.visible = state.chapter === 2
    districtLabels.forEach((l, i) => { l.visible = !mobile && state.phase !== 'intro' && i >= state.chapter && l.position.distanceTo(camera.position) < 140 })
    lanes.forEach((lane, i) => {
      lane.visible = state.chapter > 0 || i < count(state.packets)
      lane.material = state.chapter === 1 ? state.branches[i % 2] === 1 ? mint : i % 2 === state.branch && state.branches[i % 2] > 0 ? gold : dim : gold
    })
  }

  let failed = false
  const feedbackKey = () => `${state.packets}/${state.fragments}/${state.chapter}/${state.branches.map(p => p === 1 ? 2 : p > 0 ? 1 : 0).join('/')}`
  function fail() { if (!failed && !disposed) { failed = true; renderer.setAnimationLoop(null); onError('The graphics device stopped. Reload to start a new flight.') } }
  renderer.onDeviceLost = fail; renderer.onError = fail
  function render(ms: number) {
    if (disposed || failed) return
    const dt = lastTime ? Math.min((ms - lastTime) / 1000, .1) : 1 / 60; lastTime = ms
    if (document.hidden || suspended) return
    const before = feedbackKey()
    const input: Input = {forward: clamp(key('KeyW', 'KeyS') + touch.forward, -1, 1), strafe: clamp(key('KeyD', 'KeyA') + touch.strafe, -1, 1), lift: clamp(key('KeyE', 'KeyQ') + touch.lift, -1, 1), turn: key('ArrowLeft', 'ArrowRight') + touch.turn, pitch: key('ArrowUp', 'ArrowDown') + touch.pitch, boost: keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.boost, brake: keys.has('Space') || touch.brake}
    stepFlight(state, input, dt, obstacles)
    if (feedbackKey() !== before) ping(state.chapter)
    const playing = state.phase === 'playing', cinematic = state.phase === 'ending' || state.phase === 'complete'
    const active = playing || state.phase === 'intro'
    if (active && !document.hidden && !reduced) clock.value += dt
    delta.value = active && !document.hidden && !reduced ? dt : 0
    flow.value = state.chapter === 0 ? .5 : 1
    city.visible = !cinematic || state.endingTime < 1.1; finale.visible = !city.visible
    ship.visible = state.phase !== 'intro'; convoy.visible = ship.visible
    if (playing || state.phase === 'paused') {
      ship.position.copy(v(state.position)); ship.rotation.set(state.pitch, state.yaw, -input.strafe * .22, 'YXZ')
      convoy.position.copy(ship.position); convoy.quaternion.copy(ship.quaternion)
      const forward = new THREE.Vector3(-Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), -Math.cos(state.yaw) * Math.cos(state.pitch))
      cameraPosition.copy(ship.position).addScaledVector(forward, -10.5); cameraPosition.y += 3.2
      cameraTarget.copy(ship.position).addScaledVector(forward, 16); cameraTarget.y += 1
      camera.position.lerp(cameraPosition, 1 - Math.exp(-dt * 7)); look.lerp(cameraTarget, 1 - Math.exp(-dt * 9)); camera.lookAt(look)
      engineGlow.scale.y = input.boost && state.energy > .02 ? 2 : .7
      const desiredFov = input.boost && playing && state.energy > .02 && !reduced ? 66 : 58
      camera.fov += (desiredFov - camera.fov) * (1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix()
    } else if (state.phase === 'intro') {
      const t = reduced ? 0 : clock.value
      camera.position.set(14 + Math.sin(t * .07) * 2, 23 + Math.cos(t * .09), 44)
      camera.lookAt(-7, 11, -78)
    } else if (cinematic && state.endingTime >= 1.1) {
      const t = reduced ? 1 : clamp((state.endingTime - 1.1) / 6.8, 0, 1), ease = 1 - Math.pow(1 - t, 3)
      const extra = camera.aspect < 1 ? 15 : 0
      camera.position.set(ease * 9, 8.5 + ease * 4, 4 + ease * (27 + extra)); camera.lookAt(0, 8.5, 0)
      scene.fog = null
    }
    if (audio && volume) {
      volume.gain.setTargetAtTime(soundOn && state.phase !== 'paused' && !document.hidden ? .035 : 0, audio.currentTime, .2)
      filter?.frequency.setTargetAtTime(200 + Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) * 35, audio.currentTime, .1)
    }
    updateMarkers(clock.value)
    collectionEffects.update(playing || state.phase === 'ending' ? dt : 0)
    try { if (update && active) renderer.compute(update as Parameters<typeof renderer.compute>[0]); if (pipeline) pipeline.render(); else renderer.render(scene, camera) } catch { fail() }
    if (ms - reportAt > 100) { report(); reportAt = ms }
  }
  renderer.setAnimationLoop(render)
  report()

  function start() {
    state = createFlight()
    state.phase = 'playing'; collectionEffects.reset(); markers.forEach(m => { m.consumed = m.isConsumed() })
    clearInput(); scene.fog = new THREE.FogExp2('#171b1d', .0065); canvas.focus(); report()
  }
  return {
    start, pause, resume, restart: () => start(), reset: () => { resetPosition(state); report() },
    align: () => { alignToTarget(state); report() }, sound,
    input: values => Object.assign(touch, values),
    dispose: () => {
      disposed = true; renderer.setAnimationLoop(null); observer.disconnect()
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', syncFocus); window.removeEventListener('focus', syncFocus)
      document.removeEventListener('visibilitychange', syncFocus)
      canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointermove', pointermove); canvas.removeEventListener('pointerup', pointerup); canvas.removeEventListener('pointercancel', pointerup)
      collectionEffects.dispose()
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
      scene.traverse(object => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) geometries.add(mesh.geometry)
        if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => { materials.add(m); const map = (m as THREE.MeshBasicNodeMaterial).map; if (map) textures.add(map) })
      })
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose())
      pipeline?.dispose(); void Promise.resolve(renderer.dispose()).catch(() => {}); if (audio) void audio.close().catch(() => {})
    },
  }
}
