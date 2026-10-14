import { useEffect, useMemo, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import type { TreePart } from '../TreeInfoPanel'
import type { PerformanceState } from './proof-of-belief'

type Props = {
  parts: TreePart[]
  performance: MutableRefObject<PerformanceState>
  paused: boolean
  hoveredId: string | null
  selectedId: string | null
  reducedMotion: boolean
}

// Keep the original monochrome film intact; a separate mask limits a hover tint
// to the actual visible geometry, including correct occlusion at crossings.
export default function StudyFilm({ parts, performance, paused, hoveredId, selectedId, reducedMotion }: Props) {
  const { gl, scene, camera, size } = useThree()
  const pipeline = useMemo(() => {
    const mask = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter })
    const black = new THREE.MeshBasicMaterial({ color: 'black', side: THREE.DoubleSide, toneMapped: false })
    const highlights = new Map<string, THREE.MeshBasicMaterial>()
    const targets = {
      uHover: { count: 0, amount: 0, colors: Array.from({ length: 4 }, () => new THREE.Vector3()) },
      uSelected: { count: 0, amount: 0, colors: Array.from({ length: 4 }, () => new THREE.Vector3()) },
    }
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))
    const pass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, uMask: { value: null },
        uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(1, 1) },
        uHoverCount: { value: 0 }, uSelectedCount: { value: 0 },
        uSelectedAmount: { value: 0 },
        uHoverColors: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
        uSelectedColors: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
        uHoverOrigin: { value: new THREE.Vector2(.7, .5) },
        uSelectedOrigin: { value: new THREE.Vector2(.7, .5) },
      },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        uniform sampler2D tDiffuse,uMask;
        uniform float uTime,uHoverCount,uSelectedCount,uSelectedAmount;
        uniform vec2 uResolution,uHoverOrigin,uSelectedOrigin;
        uniform vec3 uHoverColors[4],uSelectedColors[4];
        varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
        vec3 palette(vec3 colors[4],float count,vec2 origin){
          vec2 p=(vUv-origin)*vec2(uResolution.x/uResolution.y,1.);
          vec3 split=p.x>0.?colors[1]:colors[0];
          vec3 quad=p.y>abs(p.x)?colors[0]:p.x< -abs(p.y)?colors[1]:p.x>abs(p.y)?colors[2]:colors[3];
          return mix(split,quad,smoothstep(2.,4.,count));
        }
        vec3 pigment(vec3 color,float q){
          // Preserve a charcoal body and silvery reflected light for black on black.
          float dark=1.-smoothstep(.12,.2,max(color.r,max(color.g,color.b)));
          vec3 ink=color*(.12+.88*q)+vec3(pow(q,5.)*.12+dark*(.06+.2*q));
          // Lift muted colours by 30%, easing off near white to retain texture.
          float peak=max(ink.r,max(ink.g,ink.b));
          return ink*mix(1.3,1.,smoothstep(.65,1.,peak));
        }
        void main(){
          vec3 raw=texture2D(tDiffuse,vUv).rgb;
          float l=dot(raw,vec3(.299,.587,.114));
          float n=hash(floor(vUv*uResolution*.75)+floor(uTime*9.));
          float q=floor(pow(clamp(l,0.,1.),.58)*30.+n)/30.;
          vec3 base=vec3(.022,.021,.018);
          vec3 col=base+vec3(q*1.06,q*.99,q*.86);
          if(l>.0001)
            col=mix(col,base+pigment(palette(uSelectedColors,uSelectedCount,uSelectedOrigin),q),uSelectedAmount);
          if(uHoverCount>0.)
            col=mix(col,base+pigment(palette(uHoverColors,uHoverCount,uHoverOrigin),q),texture2D(uMask,vUv).r);
          col+=(n-.5)*.027;
          float vignette=smoothstep(.85,.2,length((vUv-.5)*vec2(1.1,1.)));
          col*=.83+.17*vignette;
          float scan=mod(gl_FragCoord.y,3.)<1.?.94:1.;
          gl_FragColor=vec4(col*scan,1.);
        }`,
    })
    // ShaderPass clones its uniforms; render-target textures must be assigned afterwards.
    pass.uniforms.uMask.value = mask.texture
    composer.addPass(pass)
    return { composer, pass, mask, black, highlights, targets, point: new THREE.Vector3(), clear: new THREE.Color() }
  }, [gl, scene, camera])

  useEffect(() => {
    for (const [id, prefix] of [[hoveredId, 'uHover'], [selectedId, 'uSelected']] as const) {
      const palette = parts.find(part => part.id === id)?.palette
      const target = pipeline.targets[prefix]
      target.amount = palette ? 1 : 0
      // Retain the last palette while fading out; repeat single colours in all
      // slots so one-, two- and four-colour entries can blend without a jump.
      if (!palette) continue
      target.count = palette.colors.length
      target.colors.forEach((color, index) => {
        const hex = palette.colors[index] ?? palette.colors[palette.colors.length - 1]
        const rgb = parseInt(hex.slice(1), 16)
        color.set((rgb >> 16) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255)
      })
      // A first tint fades in at its actual hue, rather than rising from black.
      if (pipeline.pass.uniforms[`${prefix}Count`].value === 0) {
        pipeline.pass.uniforms[`${prefix}Count`].value = target.count
        target.colors.forEach((color, index) => pipeline.pass.uniforms[`${prefix}Colors`].value[index].copy(color))
      }
    }
  }, [pipeline, parts, hoveredId, selectedId])

  useEffect(() => {
    const pixel = gl.getPixelRatio()
    pipeline.composer.setSize(size.width, size.height)
    pipeline.mask.setSize(size.width * pixel, size.height * pixel)
    pipeline.pass.uniforms.uResolution.value.set(size.width * pixel, size.height * pixel)
    pipeline.pass.uniforms.uSelectedOrigin.value.set(size.width > 900 ? .7 : .5, .5)
  }, [pipeline, size, gl])

  useEffect(() => () => {
    pipeline.composer.dispose(); pipeline.pass.dispose(); pipeline.mask.dispose()
    pipeline.highlights.forEach(material => material.dispose()); pipeline.black.dispose()
  }, [pipeline])

  useFrame((_, delta) => {
    // Exponential damping follows the latest target, independent of frame rate.
    // It continues while particles are paused; reduced motion applies instantly.
    const colorBlend = reducedMotion ? 1 : 1 - Math.exp(-6 * Math.min(delta, .1))
    const hoverBlend = reducedMotion ? 1 : 1 - Math.exp(-10 * Math.min(delta, .1))
    for (const prefix of ['uHover', 'uSelected'] as const) {
      const target = pipeline.targets[prefix]
      const count = pipeline.pass.uniforms[`${prefix}Count`]
      count.value = THREE.MathUtils.lerp(count.value, target.count, colorBlend)
      target.colors.forEach((color, index) => pipeline.pass.uniforms[`${prefix}Colors`].value[index].lerp(color, colorBlend))
    }
    const amount = pipeline.pass.uniforms.uSelectedAmount
    amount.value = THREE.MathUtils.lerp(amount.value, pipeline.targets.uSelected.amount, colorBlend)
    const tree = scene.getObjectByName('tree-of-life-display')
    if (tree) {
      tree.getWorldPosition(pipeline.point).project(camera)
      pipeline.pass.uniforms.uSelectedOrigin.value.set(pipeline.point.x * .5 + .5, pipeline.point.y * .5 + .5)
    }
    if (hoveredId || pipeline.highlights.size) {
      const meshes: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = []
      const points: { object: THREE.Points; visible: boolean }[] = []
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          meshes.push({ mesh: object, material: object.material })
          const id = object.userData.detailId as string | undefined
          const highlighted = !!id && id === hoveredId && pipeline.targets.uHover.amount > 0
          let highlight = id ? pipeline.highlights.get(id) : undefined
          if (highlighted && !highlight) {
            highlight = pipeline.black.clone()
            pipeline.highlights.set(id!, highlight)
          }
          if (highlight) {
            const weight = THREE.MathUtils.lerp(highlight.color.r, highlighted ? 1 : 0, hoverBlend)
            highlight.color.setRGB(weight, weight, weight)
            object.material = highlight
            if (!highlighted && weight < .001) {
              object.material = pipeline.black
              pipeline.highlights.delete(id!)
              highlight.dispose()
            }
          } else object.material = pipeline.black
          if (highlighted) {
            object.getWorldPosition(pipeline.point).project(camera)
            pipeline.pass.uniforms.uHoverOrigin.value.set(pipeline.point.x * .5 + .5, pipeline.point.y * .5 + .5)
          }
        } else if (object instanceof THREE.Points) {
          points.push({ object, visible: object.visible }); object.visible = false
        }
      })
      const target = gl.getRenderTarget()
      const alpha = gl.getClearAlpha()
      gl.getClearColor(pipeline.clear)
      try {
        gl.setClearColor('black', 1)
        gl.setRenderTarget(pipeline.mask)
        gl.clear()
        gl.render(scene, camera)
      } finally {
        meshes.forEach(({ mesh, material }) => { mesh.material = material })
        points.forEach(({ object, visible }) => { object.visible = visible })
        gl.setRenderTarget(target)
        gl.setClearColor(pipeline.clear, alpha)
      }
    }
    pipeline.pass.uniforms.uTime.value = performance.current.time
    pipeline.composer.render(paused ? 0 : undefined)
  }, 1)
  return null
}
