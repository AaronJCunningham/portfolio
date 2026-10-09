import {useEffect, useRef} from 'react'
import * as THREE from 'three/webgpu'
import {Fn, TWO_PI, acos, cos, float, hash, instanceIndex, instancedArray, mix, shapeCircle, sin, smoothstep, uniform, vec3} from 'three/tsl'

type Props = {onReady: () => void; onError: () => void}

export default function CommunityCloud({onReady, onError}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let renderer: THREE.WebGPURenderer | null = null
    let material: THREE.SpriteNodeMaterial | null = null
    let particles: THREE.Sprite | null = null
    let observer: ResizeObserver | null = null
    let removeListeners = () => {}

    const initialize = async () => {
      try {
        const mobile = window.matchMedia('(max-width: 700px)').matches
        renderer = new THREE.WebGPURenderer({canvas, alpha: false, antialias: false, powerPreference: 'low-power'})
        renderer.setClearColor(0x050404, 1)
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.35
        await renderer.init()
        if (disposed) { renderer.dispose(); return }
        renderer.onDeviceLost = () => { renderer?.setAnimationLoop(null); if (!disposed) onError() }
        renderer.onError = () => { renderer?.setAnimationLoop(null); if (!disposed) onError() }

        const native = (renderer as unknown as {backend: {isWebGPUBackend?: boolean}}).backend.isWebGPUBackend
        const count = mobile ? 24000 : native ? 80000 : 48000
        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#050404')
        const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 50)
        camera.position.z = 10
        const positions = instancedArray(count, 'vec3')
        const velocities = instancedArray(count, 'vec3')
        const time = uniform(0)
        const delta = uniform(1 / 60)
        const pointer = uniform(new THREE.Vector3(100, 100, 0))
        const pointerActive = uniform(0)
        const center = uniform(new THREE.Vector3(mobile ? 0 : 2.2, mobile ? 0.45 : 0, 0))

        const cloudPosition = Fn(() => {
          const a = hash(instanceIndex)
          const b = hash(instanceIndex.add(13))
          const c = hash(instanceIndex.add(37))
          const phi = acos(b.mul(2).sub(1))
          const theta = a.mul(TWO_PI).add(time.mul(0.045))
          const radius = c.pow(0.4).mul(2.7)
          const breathing = sin(time.mul(0.38).add(b.mul(5))).mul(0.085).add(1)
          return vec3(sin(phi).mul(cos(theta)), cos(phi), sin(phi).mul(sin(theta)))
            .mul(radius).mul(breathing)
            .add(vec3(sin(b.mul(18).add(time.mul(0.22))), cos(a.mul(16).add(time.mul(0.19))), sin(c.mul(13).add(time.mul(0.16)))).mul(0.22))
            .add(center)
        })

        const init = Fn(() => {
          positions.element(instanceIndex).assign(cloudPosition())
          velocities.element(instanceIndex).assign(vec3(0))
        })().compute(count)
        const update = Fn(() => {
          const position = positions.element(instanceIndex)
          const velocity = velocities.element(instanceIndex)
          const offset = position.sub(pointer)
          const influence = smoothstep(0, 1.65, offset.xy.length()).oneMinus().mul(pointerActive)
          velocity.addAssign(cloudPosition().sub(position).mul(delta).mul(2.1))
          velocity.addAssign(offset.add(vec3(0.001)).normalize().mul(influence).mul(delta).mul(8))
          velocity.addAssign(vec3(offset.y.negate(), offset.x, 0).mul(influence).mul(delta).mul(1.4))
          velocity.mulAssign(float(1).sub(delta.mul(3.2)))
          position.addAssign(velocity.mul(delta))
        })().compute(count)

        material = new THREE.SpriteNodeMaterial()
        const seed = hash(instanceIndex.add(51))
        material.positionNode = positions.toAttribute()
        material.scaleNode = seed.pow(9).mul(0.038).add(mobile ? 0.024 : 0.018)
        material.colorNode = mix(vec3(0.19, 0.002, 0.008), vec3(0.95, 0.025, 0.04), seed.pow(0.65))
        material.opacityNode = (shapeCircle() as unknown as ReturnType<typeof float>).mul(seed.mul(0.3).add(0.14))
        material.transparent = true
        material.alphaToCoverage = true
        material.depthWrite = false
        material.blending = THREE.AdditiveBlending
        particles = new THREE.Sprite(material)
        particles.geometry = particles.geometry.clone()
        particles.count = count
        particles.frustumCulled = false
        scene.add(particles)

        const resize = () => {
          if (!renderer || disposed) return
          const width = canvas.clientWidth || window.innerWidth
          const height = canvas.clientHeight || window.innerHeight
          const narrow = width <= 700
          camera.aspect = width / height
          camera.position.z = Math.max(9.8, 6.5 / camera.aspect)
          camera.updateProjectionMatrix()
          center.value.set(narrow ? 0.25 : 2.2, narrow ? 1 : 0, 0)
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow ? 1 : 1.35))
          renderer.setSize(width, height, false)
        }
        observer = new ResizeObserver(resize)
        observer.observe(canvas)
        resize()

        const target = new THREE.Vector2()
        let hovering = false
        const move = (event: PointerEvent) => {
          const rect = canvas.getBoundingClientRect()
          target.set(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2)
          hovering = true
        }
        const leave = () => { hovering = false }
        const root = canvas.closest('.community-landing') || canvas
        root.addEventListener('pointermove', move as EventListener)
        root.addEventListener('pointerleave', leave)
        root.addEventListener('pointerup', leave)
        removeListeners = () => {
          root.removeEventListener('pointermove', move as EventListener)
          root.removeEventListener('pointerleave', leave)
          root.removeEventListener('pointerup', leave)
        }

        renderer.compute(init)
        let previous = performance.now()
        let ready = false
        renderer.setAnimationLoop(() => {
          if (!renderer || disposed) return
          const now = performance.now()
          const step = Math.min((now - previous) / 1000, 1 / 30)
          previous = now
          if (document.hidden) return
          delta.value = step
          time.value += step
          const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
          pointer.value.set(target.x * height * camera.aspect / 2, target.y * height / 2, 0)
          pointerActive.value = THREE.MathUtils.damp(pointerActive.value, hovering ? 1 : 0, 5, step)
          camera.position.x = THREE.MathUtils.damp(camera.position.x, target.x * 0.12, 2, step)
          camera.position.y = THREE.MathUtils.damp(camera.position.y, target.y * 0.08, 2, step)
          camera.lookAt(0, 0, 0)
          try {
            renderer.compute(update)
            renderer.render(scene, camera)
            if (!ready) { ready = true; onReady() }
          } catch {
            renderer.setAnimationLoop(null)
            onError()
          }
        })
      } catch {
        if (!disposed) onError()
      }
    }
    void initialize()
    return () => {
      disposed = true
      observer?.disconnect()
      removeListeners()
      renderer?.setAnimationLoop(null)
      particles?.geometry.dispose()
      material?.dispose()
      renderer?.dispose()
    }
  }, [onReady, onError])

  return <canvas className="community-cloud" ref={canvasRef} aria-hidden="true" />
}
