/** Deterministic teaching renderer. No browser, Three.js, or hardware estimates. */
export type Vec3 = [number, number, number]
export type Vertex = { local: Vec3; world: Vec3; view: Vec3; projected: Vec3; normal: Vec3 }
export type Fragment = { pixel: number; depth: number; color: Vec3; triangle: number }
export type PipelineFrame = {
  width: number; height: number; vertices: Vertex[]; indices: number[]
  fragments: Fragment[]; winners: Fragment[]; rejected: Fragment[]
}

export const STAGES = [
  { id: 'command', label: 'Command', title: 'An image begins\nas an instruction.', caption: 'The CPU prepares commands, geometry, and a shader program. One draw call asks the GPU to turn our little ring into an image.', fact: '1 draw call · one indexed torus mesh', color: '#fa7653' },
  { id: 'vertex', label: 'Vertices', title: 'A thousand places.\nOne point of view.', caption: 'The vertex shader places each point in the world, then relative to a camera. Projection makes distant things smaller; drag through the spaces to see the same vertices change coordinates.', fact: '384 vertices · 768 triangles in this mesh', color: '#f3bd79' },
  { id: 'raster', label: 'Rasterize', title: 'From geometry\nto possibility.', caption: 'Three vertices make a triangle. Rasterization finds the pixel samples it covers and creates fragments: candidates for the image, not finished pixels.', fact: '1920 × 1080 = 2,073,600 pixel locations', color: '#f3bd79' },
  { id: 'fragment', label: 'Shade', title: 'Many tiny jobs.\nThe same instruction.', caption: 'Each fragment runs a shader to calculate its color. In this simplified 32-lane group, different branches take turns: the lanes on the other path wait.', fact: '32 lanes in an NVIDIA warp; group sizes vary by GPU', color: '#8fd6c8' },
  { id: 'depth', label: 'Depth', title: 'The nearest\ngets to stay.', caption: 'Several fragments can land on the same pixel. A depth buffer keeps the nearest surface; watch the farther candidates dissolve as the test runs.', fact: 'Depth here: 0 is near · 1 is far', color: '#8fd6c8' },
  { id: 'blend', label: 'Blend', title: 'A color finds\nits way home.', caption: 'The surviving color mixes with the background, then goes into the framebuffer. Change the opacity to see source × alpha + background × (1 − alpha).', fact: 'RGBA8 uses 4 bytes per pixel, before depth or extra buffers', color: '#fa7653' },
  { id: 'present', label: 'Present', title: 'All of that.\nFor one frame.', caption: 'The completed framebuffer is handed off for display. At 60 frames per second, a new image has a budget of just 16.67 milliseconds.', fact: '60 frames / second = 16.67 milliseconds / frame', color: '#fa7653' },
] as const

export const BACKGROUND: Vec3 = [0.025, 0.035, 0.043]
export const WARP_SIZE = 32
export const CHAMBER_SPACING = 28

function rotate([x, y, z]: Vec3): Vec3 {
  const a = .62, b = -.38
  const yy = y * Math.cos(a) - z * Math.sin(a), zz = y * Math.sin(a) + z * Math.cos(a)
  return [x * Math.cos(b) + zz * Math.sin(b), yy, -x * Math.sin(b) + zz * Math.cos(b)]
}

export function projectView([x, y, z]: Vec3, aspect: number): Vec3 {
  const near = .1, far = 20, f = 1 / Math.tan(Math.PI / 8)
  // Perspective division: NDC x/y in [-1,1], depth remapped into [0,1].
  return [x * f / aspect / -z, y * f / -z, far / (far - near) + far * near / ((far - near) * z)]
}

export function createMesh(aspect = 1.6) {
  const vertices: Vertex[] = [], indices: number[] = []
  const rings = 32, sides = 12
  for (let u = 0; u < rings; u++) for (let v = 0; v < sides; v++) {
    const a = u / rings * Math.PI * 2, b = v / sides * Math.PI * 2
    const local: Vec3 = [(1.35 + .5 * Math.cos(b)) * Math.cos(a), (1.35 + .5 * Math.cos(b)) * Math.sin(a), .5 * Math.sin(b)]
    const world = rotate(local), view: Vec3 = [world[0], world[1], world[2] - 5]
    vertices.push({ local, world, view, projected: projectView(view, aspect), normal: rotate([Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)]) })
    const i = u * sides + v, next = ((u + 1) % rings) * sides + v
    const j = u * sides + (v + 1) % sides, k = ((u + 1) % rings) * sides + (v + 1) % sides
    indices.push(i, next, k, i, k, j)
  }
  return { vertices, indices }
}

function edge(a: Vec3, b: Vec3, x: number, y: number) { return (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) }
function topLeft(a: Vec3, b: Vec3) { return b[1] < a[1] || (b[1] === a[1] && b[0] > a[0]) }

/** Single center sample, both faces, no MSAA. Mesh is entirely inside the frustum. */
export function rasterize(vertices: Vertex[], indices: number[], width: number, height: number): Fragment[] {
  const fragments: Fragment[] = []
  for (let t = 0; t < indices.length; t += 3) {
    let ids = indices.slice(t, t + 3)
    let points = ids.map(i => {
      const p = vertices[i].projected
      return [(p[0] * .5 + .5) * width, (p[1] * .5 + .5) * height, p[2]] as Vec3
    })
    let area = edge(points[0], points[1], points[2][0], points[2][1])
    if (Math.abs(area) < 1e-8) continue
    if (area < 0) { ids = [ids[0], ids[2], ids[1]]; points = [points[0], points[2], points[1]]; area = -area }
    const [a, b, c] = points
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])))
    const maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])))
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])))
    const maxY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const e = [edge(b, c, x + .5, y + .5), edge(c, a, x + .5, y + .5), edge(a, b, x + .5, y + .5)]
      if (e.some((value, i) => value < -1e-8 || (Math.abs(value) <= 1e-8 && !topLeft(points[(i + 1) % 3], points[(i + 2) % 3])))) continue
      const weights = e.map(value => value / area)
      const depth = weights.reduce((sum, w, i) => sum + w * points[i][2], 0)
      const perspective = weights.map((w, i) => w / -vertices[ids[i]].view[2])
      const denominator = perspective.reduce((sum, w) => sum + w, 0)
      const normal = [0, 1, 2].map(axis => perspective.reduce((sum, w, i) => sum + w * vertices[ids[i]].normal[axis], 0) / denominator)
      const length = Math.hypot(...normal)
      const light = Math.max(0, (normal[0] * -.4 + normal[1] * .5 + normal[2] * .768) / length)
      const rim = Math.pow(1 - Math.abs(normal[2] / length), 2)
      const color: Vec3 = [.15 + light * .85, .055 + light * .36 + rim * .32, .035 + light * .18 + rim * .32]
      fragments.push({ pixel: y * width + x, depth, color, triangle: t / 3 })
    }
  }
  return fragments
}

export function resolveDepth(fragments: Fragment[]) {
  const nearest = new Map<number, Fragment>()
  for (const fragment of fragments) {
    const current = nearest.get(fragment.pixel)
    if (!current || fragment.depth < current.depth) nearest.set(fragment.pixel, fragment)
  }
  const winners = Array.from(nearest.values()).sort((a, b) => a.pixel - b.pixel)
  return { winners, rejected: fragments.filter(fragment => nearest.get(fragment.pixel) !== fragment) }
}

export function createFrame(width: number, height: number): PipelineFrame {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 128 || height > 80) throw new RangeError('Teaching grid must be 1–128 × 1–80')
  const mesh = createMesh(width / height)
  const fragments = rasterize(mesh.vertices, mesh.indices, width, height)
  return { width, height, ...mesh, fragments, ...resolveDepth(fragments) }
}

export function blendColor(source: Vec3, alpha: number, background: Vec3 = BACKGROUND): Vec3 {
  const a = Math.max(0, Math.min(1, alpha))
  return source.map((c, i) => c * a + background[i] * (1 - a)) as Vec3
}

export function operationCounts(frame: PipelineFrame, divergent = false) {
  const tasks = {
    drawCommands: 1,
    pixelClears: frame.width * frame.height,
    vertexTransforms: frame.vertices.length,
    triangleAssemblies: frame.indices.length / 3,
    generatedFragments: frame.fragments.length,
    shaderInvocations: frame.fragments.length,
    branchPredicates: divergent ? frame.fragments.length : 0,
    depthComparisons: frame.fragments.length,
    colorBlends: frame.winners.length,
    pixelWrites: frame.winners.length,
  }
  return { tasks, total: Object.values(tasks).reduce((sum, count) => sum + count, 0), rejected: frame.rejected.length }
}

/** Two equally costly paths, alternating lanes; illustrative issue slots, not timings. */
export function warpActivity(lane: number, divergent: boolean, phase: number) {
  return !divergent || lane % 2 === phase % 2
}

export function warpSlots(fragmentCount: number, divergent: boolean) {
  const groups = Math.ceil(fragmentCount / WARP_SIZE)
  const slots = groups * WARP_SIZE * (divergent ? 2 : 1)
  return { groups, slots, utilization: slots === 0 ? 0 : fragmentCount / slots }
}
