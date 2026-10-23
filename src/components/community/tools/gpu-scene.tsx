import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { gsap } from 'gsap'
import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BACKGROUND, blendColor, CHAMBER_SPACING, STAGES, type PipelineFrame, type Vec3 } from './gpu-pipeline-model'

type SceneProps = {
  stage: number; frame: PipelineFrame; space: number; divergent: boolean; branchPhase: number; alpha: number
  depth: number; paused: boolean; reduced: boolean; mobile: boolean; reset: number
  fly: boolean; onReady: (renderer: string) => void; onError: () => void
}
type Cell = { position: Vec3; color: Vec3; size: Vec3; seed?: number; kind?: number }
const CORAL: Vec3 = [1, .29, .14], MINT: Vec3 = [.36, .85, .73]

const vertexShader = `
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aKind;
  uniform float uTime;
  uniform float uMode;
  uniform float uDivergent;
  uniform float uPhase;
  uniform float uDepth;
  varying vec3 vColor;
  varying vec3 vNormal;
  void main() {
    vec3 p = position;
    vec3 offset = vec3(0.0);
    vColor = aColor;
    if (uMode == 1.0) {
      offset.z = 6.5 - mod(aSeed * 1.73 + uTime * 2.4, 13.0);
    }
    if (uMode == 2.0) {
      float phase = mod(floor(uTime * .65) + uPhase, 2.0);
      float waiting = uDivergent * step(.5, abs(mod(aSeed, 2.0) - phase));
      float pulse = .78 + .22 * sin(uTime * 2.5 - floor(aSeed / 32.0) * .12);
      vColor *= mix(pulse, .055, waiting);
      p.y *= mix(1.0 + pulse * .45, .25, waiting);
    }
    if (uMode == 3.0 && aKind > .5) {
      p *= 1.0 - uDepth;
      offset.y += uDepth * 1.6;
      vColor *= 1.0 - uDepth;
    }
    if (uMode == 4.0) {
      float lift = .5 + .5 * sin(uTime * .7 + aSeed * .016);
      offset.y += lift * .18;
    }
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * (instanceMatrix * vec4(p, 1.0) + vec4(offset, 0.0));
  }
`
const fragmentShader = `
  varying vec3 vColor;
  varying vec3 vNormal;
  void main() {
    float light = .65 + .35 * abs(dot(normalize(vNormal), normalize(vec3(.4, 1., .7))));
    gl_FragColor = vec4(vColor * light * 1.35, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** Thousands of cells share one draw call; motion and lane masks run on the GPU. */
function Cells({ cells, mode = 0, time, divergent = false, depth = 0, phase = 0 }: { cells: Cell[]; mode?: number; time: MutableRefObject<number>; divergent?: boolean; depth?: number; phase?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree(state => state.invalidate)
  const geometry = useMemo(() => {
    const result = new THREE.BoxGeometry(1, 1, 1)
    result.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(cells.flatMap(c => c.color)), 3))
    result.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(cells.map((c, i) => c.seed ?? i)), 1))
    result.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(cells.map(c => c.kind ?? 0)), 1))
    return result
  }, [cells])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uMode: { value: mode }, uDivergent: { value: Number(divergent) }, uDepth: { value: depth }, uPhase: { value: phase } }), [mode, divergent, depth, phase])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => {
    if (!mesh.current) return
    const dummy = new THREE.Object3D()
    cells.forEach((cell, i) => {
      dummy.position.set(...cell.position); dummy.scale.set(...cell.size); dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    invalidate()
  }, [cells, invalidate])
  useFrame(() => { uniforms.uTime.value = time.current })
  return <instancedMesh ref={mesh} args={[geometry, undefined, cells.length]} frustumCulled={false}>
    <shaderMaterial vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} />
  </instancedMesh>
}

function Label({ children, position = [0, 0, 0] }: { children: ReactNode; position?: Vec3 }) {
  return <Html position={position} center className="gpu-world-label" style={{ pointerEvents: 'none' }}>{children}</Html>
}

function RingMesh({ frame, space, time }: { frame: PipelineFrame; space: number; time: MutableRefObject<number> }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const points = frame.vertices.flatMap(vertex => {
      // View coordinates are recentered for display; the HTML readout retains the actual z.
      const stages = [vertex.local, vertex.world, [vertex.view[0], vertex.view[1], vertex.view[2] + 4] as Vec3, [vertex.projected[0] * 3.2, vertex.projected[1] * 2, 0] as Vec3]
      const i = Math.min(2, Math.floor(space)), t = space - i
      return stages[i].map((v, axis) => (v * (1 - t) + stages[i + 1][axis] * t) * 1.5)
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); g.setIndex(frame.indices); g.computeVertexNormals()
    return g
  }, [frame, space])
  useEffect(() => () => geometry.dispose(), [geometry])
  const cells = useMemo(() => {
    const points = geometry.getAttribute('position')
    return frame.vertices.map((_, i): Cell => ({ position: [points.getX(i), points.getY(i), points.getZ(i)], color: [1, .68, .34], size: [.055, .055, .055] }))
  }, [frame, geometry])
  const workers = useMemo(() => frame.vertices.map((_, i): Cell => ({ position: [(i % 24 - 11.5) * .27, .12, (Math.floor(i / 24) - 7.5) * .27], color: [1, .49, .22], size: [.1, .1, .1] })), [frame])
  return <>
    <group position={[0, 3.1, 0]}>
      <mesh geometry={geometry}><meshBasicMaterial color="#d27d4c" wireframe transparent opacity={.32} /></mesh>
      <Cells cells={cells} time={time} />
      <gridHelper args={[7, 14, '#6a4938', '#282a2a']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.7]} />
    </group>
    <Cells cells={workers} time={time} mode={2} />
    <Label position={[0, .1, 3.4]}>384 VERTEX JOBS / ONE PROGRAM</Label>
  </>
}

function Command({ time }: { time: MutableRefObject<number> }) {
  const cells = useMemo(() => Array.from({ length: 96 }, (_, i): Cell => ({ position: [((i % 8) - 3.5) * .4, .8 + (Math.floor(i / 8) % 3) * .65, 0], color: i % 5 === 0 ? MINT : CORAL, size: [.08, .08, .42] })), [])
  return <>
    <Cells cells={cells} time={time} mode={1} />
    <group position={[0, 2, -2.5]}>
      <mesh><boxGeometry args={[5, 4, .45]} /><meshBasicMaterial color="#39221d" /></mesh>
      <mesh position={[0, 0, .24]}><planeGeometry args={[4.65, 3.65]} /><meshBasicMaterial color="#0d1113" /></mesh>
      <mesh position={[0, 0, .3]}><torusGeometry args={[1.2, .025, 6, 64]} /><meshBasicMaterial color={new THREE.Color(2, .4, .18)} /></mesh>
      <Label position={[0, 0, .4]}><span className="gpu-world-label__large">GPU</span></Label>
      <Label position={[0, 2.65, 0]}>DRAW ELEMENTS / 2,304 INDICES</Label>
    </group>
    <Label position={[0, .4, 6]}>CPU → COMMAND BUFFER</Label>
  </>
}

function Raster({ frame, time }: { frame: PipelineFrame; time: MutableRefObject<number> }) {
  const cells = useMemo(() => frame.fragments.map((f): Cell => ({ position: [((f.pixel % frame.width) / frame.width - .5) * 10, .2 + (1 - f.depth) * 45, (Math.floor(f.pixel / frame.width) / frame.height - .5) * -6.25], color: f.color, size: [9 / frame.width, .12, 5.6 / frame.height] })), [frame])
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(frame.vertices.flatMap(v => [v.projected[0] * 5, 2.5 + v.world[2] * .3, -v.projected[1] * 3.125]), 3))
    g.setIndex(frame.indices)
    return g
  }, [frame])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <>
    <Cells cells={cells} time={time} mode={4} />
    <mesh geometry={geometry}><meshBasicMaterial wireframe color="#f1b974" transparent opacity={.5} /></mesh>
    <gridHelper args={[10, frame.width, '#876146', '#33302c']} position={[0, -.01, 0]} />
    <Label position={[0, 4.2, 0]}>TRIANGLES → COVERED SAMPLES</Label>
  </>
}

function ShaderField({ frame, time, divergent, phase }: { frame: PipelineFrame; time: MutableRefObject<number>; divergent: boolean; phase: number }) {
  const cells = useMemo(() => frame.fragments.map((f, i): Cell => {
    const group = Math.floor(i / 32), lane = i % 32
    return { position: [((group % 8) - 3.5) * 1.45 + (lane % 8) * .145, .22, (Math.floor(group / 8) - Math.ceil(frame.fragments.length / 256) / 2) * 1 + Math.floor(lane / 8) * .16], color: lane % 2 ? CORAL : MINT, size: [.105, .2, .105] }
  }), [frame])
  const hero = useMemo(() => Array.from({ length: 32 }, (_, i): Cell => ({ position: [(i % 8 - 3.5) * .58, 2 + Math.floor(i / 8) * .4, 4.5], color: i % 2 ? CORAL : MINT, size: [.45, .23, .32], seed: i })), [])
  return <>
    <Cells cells={cells} mode={2} time={time} divergent={divergent} phase={phase} />
    <Cells cells={hero} mode={2} time={time} divergent={divergent} phase={phase} />
    <Label position={[0, 4.4, 4.5]}>{divergent ? 'PATH A / PATH B · WAITING LANES DIM' : 'ONE INSTRUCTION · 32 ACTIVE LANES'}</Label>
    <Label position={[0, -.1, 5.4]}>ONE GROUP ENLARGED ABOVE · FRAGMENT JOBS BELOW</Label>
  </>
}

function Depth({ frame, time, depth }: { frame: PipelineFrame; time: MutableRefObject<number>; depth: number }) {
  const cells = useMemo(() => [...frame.winners.map(f => ({ f, kind: 0 })), ...frame.rejected.map(f => ({ f, kind: 1 }))].map(({ f, kind }): Cell => ({ position: [((f.pixel % frame.width) / frame.width - .5) * 9, 3 + (Math.floor(f.pixel / frame.width) / frame.height - .5) * 5.625, kind ? -1.7 - (f.depth - .97) * 100 : 1], color: kind ? CORAL : MINT, size: [8 / frame.width, 5 / frame.height, .13], kind })), [frame])
  return <>
    <Cells cells={cells} mode={3} time={time} depth={depth} />
    <Label position={[0, 6, 1]}>NEAR / KEEP</Label>
    <Label position={[0, .2, -2]}>FAR / DISCARD</Label>
  </>
}

function Framebuffer({ frame, time, alpha, present }: { frame: PipelineFrame; time: MutableRefObject<number>; alpha: number; present: boolean }) {
  const cells = useMemo(() => {
    const colors = new Map(frame.winners.map(f => [f.pixel, blendColor(f.color, alpha)]))
    return Array.from({ length: frame.width * frame.height }, (_, i): Cell => ({ position: [((i % frame.width) / frame.width - .5) * 10, 3.8 + (Math.floor(i / frame.width) / frame.height - .5) * 6.25, 0], color: colors.get(i) ?? BACKGROUND, size: [9.6 / frame.width, 6 / frame.height, .08] }))
  }, [frame, alpha])
  return <>
    <mesh position={[0, 3.75, -.15]}><boxGeometry args={[10.5, 6.7, .12]} /><meshBasicMaterial color="#6e4e3e" /></mesh>
    <Cells cells={cells} time={time} />
    {!present && <Cells cells={frame.winners.slice(0, 48).map((f, i) => ({ position: [((f.pixel % frame.width) / frame.width - .5) * 10, 1.5 + (i % 7) * .5, 0], color: blendColor(f.color, alpha), size: [.06, .06, .16] }))} time={time} mode={1} />}
    <Label position={[0, 7.7, 0]}>{present ? 'FRAME 001 / READY FOR DISPLAY' : 'SOURCE × α + BACKGROUND × (1 − α)'}</Label>
  </>
}

function Architecture() {
  const time = useRef(0)
  const traces = useMemo(() => Array.from({ length: 110 }, (_, i): Cell => ({ position: [i * 1.8 - 12, -.13, (i % 5 - 2) * 3], size: [1.6, .012, .022], color: [.17, .25, .25] })), [])
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[84, -.25, 0]}><planeGeometry args={[220, 65]} /><meshBasicMaterial color="#0a0e10" /></mesh>
    <Cells cells={traces} time={time} />
    {STAGES.map((stage, i) => <group key={stage.id} position={[i * CHAMBER_SPACING, 0, 0]}>
      <gridHelper args={[18, 18, '#313335', '#171f21']} position={[0, -.19, 0]} />
      <mesh position={[0, 4, -6]}><torusGeometry args={[7.6, .022, 4, 80]} /><meshBasicMaterial color={stage.color} transparent opacity={.4} /></mesh>
      {[-7, 7].map(x => <mesh key={x} position={[x, 3.5, -5]}><boxGeometry args={[.025, 7, .025]} /><meshBasicMaterial color={stage.color} transparent opacity={.5} /></mesh>)}
    </group>)}
  </>
}

function CameraJourney({ stage, reduced, reset, fly, mobile }: Pick<SceneProps, 'stage' | 'reduced' | 'reset' | 'fly' | 'mobile'>) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera, gl, invalidate } = useThree()
  const moving = useRef(false), keys = useRef(new Set<string>())
  const vectors = useMemo(() => ({ forward: new THREE.Vector3(), right: new THREE.Vector3(), delta: new THREE.Vector3() }), [])
  useEffect(() => {
    const control = controls.current
    if (!control) return
    keys.current.clear()
    const x = stage * CHAMBER_SPACING
    const destination = stage === 6 ? { x: x + .3, y: 5.5, z: mobile ? 19 : 17 } : { x: x + 7, y: stage === 3 ? 9 : 7, z: mobile ? 16 : 12 }
    moving.current = true; control.enabled = false
    const timeline = gsap.timeline({ onUpdate: () => { control.update(); invalidate() }, onComplete: () => { moving.current = false; control.enabled = true } })
    timeline.to(camera.position, { ...destination, duration: reduced ? 0 : 1.65, ease: 'power3.inOut' }, 0)
    timeline.to(control.target, { x, y: stage >= 5 ? 3.6 : 2, z: 0, duration: reduced ? 0 : 1.65, ease: 'power3.inOut' }, 0)
    return () => { timeline.kill(); control.enabled = true; moving.current = false }
  }, [stage, reduced, reset, camera, invalidate, mobile])
  useEffect(() => {
    const canvas = gl.domElement
    const down = (event: KeyboardEvent) => {
      if (!fly || !'wasdqe'.includes(event.key.toLowerCase()) || event.key.length !== 1) return
      event.preventDefault(); keys.current.add(event.key.toLowerCase())
    }
    const up = (event: KeyboardEvent) => keys.current.delete(event.key.toLowerCase())
    const clear = () => keys.current.clear()
    canvas.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); canvas.addEventListener('blur', clear)
    return () => { canvas.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); canvas.removeEventListener('blur', clear); clear() }
  }, [fly, gl])
  useFrame((_, delta) => {
    if (!fly || moving.current || !controls.current || !keys.current.size) return
    const { forward, right, delta: move } = vectors
    camera.getWorldDirection(forward); right.crossVectors(forward, camera.up).normalize(); move.set(0, 0, 0)
    for (const key of Array.from(keys.current)) {
      if (key === 'w' || key === 's') move.addScaledVector(forward, key === 'w' ? 1 : -1)
      if (key === 'a' || key === 'd') move.addScaledVector(right, key === 'd' ? 1 : -1)
      if (key === 'q' || key === 'e') move.y += key === 'e' ? 1 : -1
    }
    move.normalize().multiplyScalar(Math.min(delta, .05) * 5)
    // Keep exploration local so a reset or stage change always has a clear destination.
    const target = controls.current.target
    if (Math.abs(target.x + move.x - stage * CHAMBER_SPACING) > 10 || Math.abs(target.z + move.z) > 10 || target.y + move.y < 0 || target.y + move.y > 12) return
    camera.position.add(move); target.add(move); controls.current.update()
  })
  return <OrbitControls ref={controls} makeDefault enableDamping={!reduced} dampingFactor={.08} enableZoom={false} enablePan minDistance={3} maxDistance={30} maxPolarAngle={Math.PI * .49} />
}

function World(props: SceneProps) {
  const time = useRef(0)
  const { gl } = useThree()
  const { onReady, onError } = props
  useEffect(() => {
    const canvas = gl.domElement
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'GPU world. Drag to orbit, right-drag or two-finger drag to pan. Use arrow keys for stages. In fly mode use W A S D, Q and E.')
    const context = gl.getContext(), info = context.getExtension('WEBGL_debug_renderer_info')
    onReady(info ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'WebGL 2 · renderer name unavailable')
    const lost = (event: Event) => { event.preventDefault(); onError() }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onReady, onError])
  useFrame((_, delta) => { if (!props.paused && !document.hidden) time.current += Math.min(delta, .05) })
  return <>
    <color attach="background" args={['#080c0e']} />
    <fog attach="fog" args={['#080c0e', 20, 65]} />
    <CameraJourney {...props} />
    <Architecture />
    {STAGES.map((stage, i) => Math.abs(props.stage - i) <= 1 && <group key={stage.id} position={[i * CHAMBER_SPACING, 0, 0]}>
      {i === 0 && <Command time={time} />}
      {i === 1 && <RingMesh frame={props.frame} space={props.space} time={time} />}
      {i === 2 && <Raster frame={props.frame} time={time} />}
      {i === 3 && <ShaderField frame={props.frame} time={time} divergent={props.divergent} phase={props.branchPhase} />}
      {i === 4 && <Depth frame={props.frame} time={time} depth={props.depth} />}
      {i >= 5 && <Framebuffer frame={props.frame} time={time} alpha={props.alpha} present={i === 6} />}
    </group>)}
    {!props.mobile && <EffectComposer multisampling={0}><Bloom intensity={.65} luminanceThreshold={.9} mipmapBlur resolutionScale={.5} /></EffectComposer>}
  </>
}

export default function GPUScene(props: SceneProps) {
  return <Canvas camera={{ position: [7, 7, 12], fov: 48, near: .1, far: 250 }} dpr={props.mobile ? 1 : [1, 1.5]} frameloop={props.paused && !props.fly ? 'demand' : 'always'} gl={{ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true }} fallback={<p className="gpu__unavailable">WebGL is unavailable. The complete lesson and controls are still available alongside.</p>}>
    <World {...props} />
  </Canvas>
}
