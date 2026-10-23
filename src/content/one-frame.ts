import type {Project} from '@/sanity/types'

const block = (key: string, text: string, style = 'normal') => ({_type: 'block', _key: key, style, markDefs: [], children: [{_type: 'span', _key: `${key}-text`, text, marks: []}]})

/** Launch content ships with the experience. A published Sanity document with this slug takes precedence. */
export const oneFrameProject: Project = {
  _id: 'local-one-frame',
  title: 'One Frame',
  slug: 'one-frame',
  excerpt: 'A playable expedition inside a GPU. Become a signal, navigate a procedural machine, and discover how thousands of tiny jobs become one image.',
  publishedAt: '2026-10-22T12:00:00Z',
  sortOrder: 1,
  experiencePath: '/time-frame',
  imageUrl: '/images/one-frame/preview.jpg',
  seoImageUrl: 'https://aaronjcunningham.com/images/one-frame/preview.jpg',
  mainImage: {alt: 'The playable One Frame GPU city, with copper routes and floating memory signals', caption: 'ONE FRAME / THE PROCEDURAL GPU CITY'},
  links: [
    {_key: 'play', label: 'Enter the experience', url: '/time-frame'},
    {_key: 'memory-source', label: 'NVIDIA: memory coalescing', url: 'https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#coalesced-access-to-global-memory'},
    {_key: 'warp-source', label: 'NVIDIA: warps and branching', url: 'https://docs.nvidia.com/cuda/cuda-programming-guide/03-advanced/advanced-kernel-programming.html#simt-execution-model'},
    {_key: 'depth-source', label: 'Khronos: depth testing', url: 'https://docs.vulkan.org/spec/latest/chapters/fragops.html#fragops-depth'},
  ],
  seo: {title: 'One Frame — A playable world inside a GPU', description: 'A procedural 3D flight expedition by Aaron J. Cunningham. Explore memory, parallel execution and depth testing through play.'},
  body: [
    block('idea-title', 'A world between two refreshes.', 'h2'),
    block('idea', 'One Frame turns the hidden work of a graphics processor into a place you can explore. You become a signal-courier, flying through copper canyons and monumental processor blocks to help a machine complete one image.'),
    block('play', 'Fly through glowing rings to get data, run calculations, and draw a picture. Each stage shows a counter, one instruction, and one short sentence about what a GPU does. Each visit begins a new flight from the start.'),
    block('architecture-title', 'Inspired by real NVIDIA GPU architecture.', 'h2'),
    block('architecture', 'The memory and execution lessons draw on NVIDIA’s documented SIMT model: 32-thread warps, active lanes, and coalesced memory requests. The memory example follows the 32-byte access model documented for compute capability 6.0 and later. Depth testing comes from the raster graphics pipeline. Together these form a teaching model; the city does not reproduce the floorplan or timing of a particular GPU.'),
    block('memory-title', '01 / Memory canyon', 'h2'),
    block('memory', 'Collect eight data rings, representing four-byte words at addresses 0x00 through 0x1c inside one aligned 32-byte sector. These represent eight participating lanes in a warp. Real coalescing groups concurrent requests from one memory instruction; collecting them one by one is the game mechanic. A full warp requesting 32 adjacent four-byte words from an aligned base would use four such sectors.'),
    block('branch-title', '02 / The branch cathedral', 'h2'),
    block('branch', 'Your convoy becomes a team of 32 logical workers, or threads, in a warp. Flying through A and B starts each group of 16 automatically; progress continues while you fly. The two groups execute sequentially, illustrating different active masks. This exercise simplifies scheduling: modern NVIDIA GPUs support independent thread scheduling, and a lane is not a dedicated physical core.'),
    block('pixel-title', '03 / The last pixel', 'h2'),
    block('pixel', 'Collect three fragments competing for a single pixel. The exercise assumes opaque surfaces, conventional depth values, and a LESS comparison, so depth 0.2 beats 0.5 and 0.8. Real renderers can use other comparisons, reversed depth, blending, and early depth tests. Reach the display for an illustrative final image: this is a lesson in visibility, not a simulation of every operation needed to render that image.'),
    block('built-title', 'A machine made of code.', 'h2'),
    block('built', 'The city is built procedurally from instanced geometry, copper traces, and illuminated routes. Three.js node materials and WebGPU compute animate the signal traffic. A lighter WebGL2 path keeps the expedition available on more devices. Keyboard flight, touch controls, a steering aid, and reduced-motion adaptations make the world approachable.'),
    block('metaphor-title', 'A useful fiction.', 'h2'),
    block('metaphor', 'The architecture, distances, and travel time are metaphors. Bits are states, not little travellers; the districts are not a physical map of a chip. The 32-lane convoy illustrates an NVIDIA-style warp, not every GPU architecture. The frame is illustrative, not a benchmark. The goal is to leave with a useful intuition for memory access, parallel work, and visibility.'),
  ],
}

export function includeOneFrame<T extends {slug: string}>(items: T[], fallback: T, cmsOwnsSlug: boolean): T[] {
  return cmsOwnsSlug || items.some(item => item.slug === fallback.slug) ? items : [fallback, ...items]
}
