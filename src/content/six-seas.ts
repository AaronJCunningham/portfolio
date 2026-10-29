import type {Project} from '@/sanity/types'

const block = (key: string, text: string, style = 'normal') => ({
  _type: 'block', _key: key, style, markDefs: [],
  children: [{_type: 'span', _key: `${key}-text`, text, marks: []}],
})

/** Local project content; a published CMS record, including hidden content, takes precedence. */
export const sixSeasProject: Project = {
  _id: 'local-six-seas',
  title: 'Six seas',
  slug: 'six-seas',
  excerpt: 'An impossible ocean suspended on a corner. Six moving seas share one rotating cube, each with its own direction of gravity.',
  publishedAt: '2026-10-29T10:00:00Z',
  sortOrder: 0,
  experiencePath: '/play/ocean-cube',
  experienceLabel: 'Explore the ocean cube',
  roleLabel: 'CREATIVE DIRECTION / INTERACTIVE 3D',
  attribution: {
    label: 'Wave simulation by Ultra-Water / Humpalumps',
    url: 'https://github.com/Humpalumps/Ultra-Water',
    sourceTitle: 'Ultra-Water',
    creator: 'Humpalumps',
    roleLabel: 'CONCEPT / CUBE ADAPTATION',
  },
  imageUrl: '/images/six-seas/preview.jpg',
  seoImageUrl: 'https://www.aaronjcunningham.com/images/six-seas/preview.jpg',
  mainImage: {
    alt: 'A rotating turquoise water cube balanced on one corner beside the title Six seas',
    caption: 'SIX SEAS / EVERY FACE A SURFACE. EVERY DIRECTION, DOWN.',
  },
  video: {
    src: '/media/six-seas/six-seas-1080p.mp4',
    poster: '/images/six-seas/preview.jpg',
    width: 1920,
    height: 1080,
    caption: '20 SECONDS / FULL PAGE RECORDING / 1080P',
  },
  links: [
    {_key: 'play', label: 'Open the interactive cube', url: '/play/ocean-cube'},
    {_key: 'video', label: 'Download the 1080p video', url: '/media/six-seas/six-seas-1080p.mp4', download: true},
    {_key: 'source', label: 'Ultra-Water source and credits', url: 'https://github.com/Humpalumps/Ultra-Water'},
  ],
  seo: {
    title: 'Six seas — An impossible ocean',
    description: 'A rotating ocean cube with six directions of gravity. An interactive Three.js water study by Aaron J. Cunningham, using the Ultra-Water wave simulation.',
  },
  body: [
    block('idea-title', 'Water that breaks the rules.', 'h2'),
    block('idea', 'The starting point was a simple contradiction: realistic ocean waves on an object that could never hold them. A cube balances on one corner and slowly turns around its vertical diagonal. Each face carries an ocean that behaves as though its surface were horizontal.'),
    block('composition', 'The final composition keeps the water on its own. Soft light, a pale background and a suspended shadow make the cube feel like an object in a gallery. Drag to orbit, scroll to move closer, or adjust the swell to change the surface.'),
    block('making-title', 'One simulation, six surfaces.', 'h2'),
    block('making', 'The waves come from Humpalumps’ open-source Ultra-Water FFT simulation. My adaptation maps those waves onto six finite surfaces in Three.js, with local displacement, custom water shading, foam, and reflections of a procedural sky. The wave displacement softens near the edges to keep the cube joined.'),
    block('credit', 'Ultra-Water provides the underlying wave simulation under the MIT licence. The cube geometry, surface shading, presentation and interaction are custom to this experiment. The video above records the running page; the interactive version lets you explore it yourself.'),
  ],
}

export function includeSixSeas<T extends {slug: string}>(items: T[], fallback: T, cmsOwnsSlug: boolean): T[] {
  return cmsOwnsSlug || items.some(item => item.slug === fallback.slug) ? items : [fallback, ...items]
}
