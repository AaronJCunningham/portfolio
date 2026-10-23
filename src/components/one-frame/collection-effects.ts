import * as THREE from 'three/webgpu'
import {uniform, uv} from 'three/tsl'

/** Reusable bursts: no per-pickup geometry, textures, timers, or animation loops. */
export function createCollectionEffects(parent: THREE.Group, reduced: boolean, low: boolean) {
  const root = new THREE.Group(); parent.add(root)
  const ringGeometry = new THREE.TorusGeometry(1, .014, 4, 64)
  const sparkGeometry = new THREE.BoxGeometry(1, 1, 1)
  const dummy = new THREE.Object3D(), sparkCount = low ? 16 : 28
  const duration = reduced ? .4 : 1.05
  const pool = Array.from({length: 6}, () => {
    const group = new THREE.Group(); group.visible = false; root.add(group)
    const material = new THREE.MeshBasicNodeMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})
    const echoMaterial = material.clone()
    const ring = new THREE.Mesh(ringGeometry, material), echo = new THREE.Mesh(ringGeometry, echoMaterial)
    const sparks = new THREE.InstancedMesh(sparkGeometry, material, sparkCount)
    sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sparks.frustumCulled = false
    const flashMaterial = new THREE.SpriteNodeMaterial({color: new THREE.Color('#fff2d6').multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})
    const flashOpacity = uniform(0)
    flashMaterial.opacityNode = uv().sub(.5).length().mul(2).oneMinus().max(0).pow(3).mul(flashOpacity)
    const flash = new THREE.Sprite(flashMaterial)
    group.add(ring, echo, sparks, flash)
    return {group, ring, echo, sparks, flash, material, echoMaterial, flashMaterial, flashOpacity, age: duration, radius: 1}
  })
  let next = 0

  return {
    burst(position: THREE.Vector3, radius: number, color: THREE.Color) {
      const effect = pool[next]; next = (next + 1) % pool.length
      effect.group.position.copy(position); effect.radius = radius; effect.age = 0; effect.group.visible = true
      effect.material.color.copy(color)
      effect.echoMaterial.color.set('#87ddd7').multiplyScalar(2)
    },
    update(dt: number) {
      for (const effect of pool) {
        if (!effect.group.visible) continue
        effect.age += dt
        if (effect.age >= duration) { effect.group.visible = false; continue }
        const t = effect.age / duration, spread = 1 - Math.pow(1 - t, 3)
        const fade = Math.pow(1 - t, 2), delayed = Math.max(0, (t - .12) / .88)
        effect.material.opacity = fade
        effect.ring.scale.setScalar(effect.radius * (reduced ? 1 : 1 + spread * .85))
        effect.echo.visible = !reduced && t > .12
        effect.echo.scale.setScalar(effect.radius * (.9 + delayed * 1.15))
        effect.echo.position.z = reduced ? 0 : -delayed * 3
        effect.echoMaterial.opacity = Math.pow(1 - delayed, 2) * .65
        effect.flash.scale.setScalar(reduced ? 1 : 1.4 + spread * 4)
        effect.flashOpacity.value = Math.pow(Math.max(0, 1 - t * 3), 2) * .75
        effect.sparks.visible = !reduced
        if (reduced) continue
        for (let i = 0; i < sparkCount; i++) {
          const angle = i / sparkCount * Math.PI * 2, seed = (i * .61803398875) % 1
          const radius = effect.radius + spread * (2 + seed * 4)
          dummy.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, (seed - .5) * spread * 9)
          dummy.rotation.set(t * (2 + seed * 4), angle, angle + t * 2)
          dummy.scale.set(.06 * (1 - t), .1 * (1 - t), (.35 + seed * .7) * (1 - t))
          dummy.updateMatrix(); effect.sparks.setMatrixAt(i, dummy.matrix)
        }
        effect.sparks.instanceMatrix.needsUpdate = true
      }
    },
    reset() { pool.forEach(effect => { effect.group.visible = false; effect.age = duration }); next = 0 },
    dispose() {
      root.removeFromParent()
      ringGeometry.dispose(); sparkGeometry.dispose()
      pool.forEach(effect => { effect.sparks.dispose(); effect.material.dispose(); effect.echoMaterial.dispose(); effect.flashMaterial.dispose() })
    },
  }
}
