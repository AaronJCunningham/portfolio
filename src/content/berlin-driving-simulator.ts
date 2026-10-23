import type {Project} from '@/sanity/types'

const block = (key: string, text: string, style = 'normal') => ({
  _type: 'block', _key: key, style, markDefs: [],
  children: [{_type: 'span', _key: `${key}-text`, text, marks: []}],
})

/** Local launch content; a published Sanity record (including a hidden one) owns this slug. */
export const berlinDrivingProject: Project = {
  _id: 'local-berlin-driving-simulator',
  title: 'Berlin Driving Simulator',
  slug: 'berlin-driving-simulator',
  excerpt: 'Explore Berlin inside the Ringbahn. An interactive adaptation of Mr. Doob’s Slop New York, with mapped streets, local landmarks and four ways to move through the city.',
  publishedAt: '2026-10-23T12:00:00Z',
  sortOrder: 0,
  experiencePath: '/play/berlin',
  experienceLabel: 'Explore Berlin',
  standaloneExperience: true,
  roleLabel: 'BERLIN ADAPTATION / ART DIRECTION',
  attribution: {
    label: 'Original NYC version by Mr. Doob',
    url: 'https://mrdoob.github.io/slop-newyork/',
    sourceTitle: 'Slop New York',
    creator: 'Mr. Doob',
  },
  imageUrl: '/images/berlin-driving-simulator/preview.jpg',
  seoImageUrl: 'https://aaronjcunningham.com/images/berlin-driving-simulator/preview.jpg',
  mainImage: {
    alt: 'Berlin Driving Simulator running in the browser, with mapped Berlin streets and procedural architecture',
    caption: 'BERLIN / A PLAYABLE CITY INSIDE THE RINGBAHN',
  },
  gallery: [
    {src: '/images/berlin-driving-simulator/ringbahn.jpg', alt: 'The in-game map showing the Ringbahn boundary, Berlin neighbourhoods and teleport destinations', caption: 'THE RINGBAHN INTERIOR / 87.6 KM² / 25 DESTINATIONS'},
    {src: '/images/berlin-driving-simulator/berghain.jpg', alt: 'The recreated Berghain power station with graffiti, weathered walls, fences and trees', caption: 'BERGHAIN / ARCHITECTURE AND GROUNDS STUDIED FROM PHOTOGRAPHS'},
  ],
  links: [
    {_key: 'play', label: 'Explore Berlin', url: '/play/berlin'},
    {_key: 'original', label: 'Original NYC version by Mr. Doob', url: 'https://mrdoob.github.io/slop-newyork/'},
    {_key: 'source', label: 'Original project source', url: 'https://github.com/mrdoob/slop-newyork'},
    {_key: 'map-credit', label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright'},
    {_key: 'data', label: 'Berlin map data (.json.gz)', url: '/experiments/berlin/data/berlin.json.gz'},
  ],
  seo: {
    title: 'Berlin Driving Simulator — Explore the Ringbahn',
    description: 'Drive, walk, cycle or fly through Berlin. An AI-assisted Berlin adaptation by Aaron J. Cunningham of Mr. Doob’s Slop New York, built on Three.js and WebGPU.',
  },
  body: [
    block('idea-title', 'A city I know. A different way to explore it.', 'h2'),
    block('idea', 'I wanted to take the feeling of a freely explorable procedural city and bring it to Berlin. The result covers the area inside the Ringbahn, from Wedding and Prenzlauer Berg to Neukölln, Schöneberg and Charlottenburg, while retaining the earlier surrounding coverage.'),
    block('experience', 'Take a car through the streets, walk up to a landmark, cycle along the river or rise above the city in a helicopter. Change the time of day, search the street map, or jump to one of 25 destinations. The map closes after a teleport so you can keep exploring.'),
    block('credit-title', 'Built on Mr. Doob’s Slop New York.', 'h2'),
    block('credit', 'Mr. Doob created the original simulation and its underlying graphics, movement, traffic, audio and camera systems. This project is a Berlin adaptation of that work. It retains the original Three.js r187dev WebGPU foundation and credits the NYC version in the app itself.'),
    block('role-title', 'My contribution: the Berlin adaptation.', 'h2'),
    block('role', 'I directed the geographic scope, neighbourhood priorities, visual references and interaction refinements. Development was AI-assisted, including the data conversion, Berlin-specific implementation and validation. The work centres on adapting an existing engine to a recognisable local setting.'),
    block('geography', 'OpenStreetMap streets, building footprints, parks, water and railways replace the New York geography. The expansion follows the actual Ringbahn loop, preserves road connectivity, and adds destinations across the newly covered neighbourhoods. Tempelhofer Feld keeps its former runway surfaces.'),
    block('landmarks', 'Berlin-specific landmarks give the city its identity. Berghain received a dedicated exterior study: its power-station proportions, tall industrial windows, stained plaster, graffiti, fencing and overgrown grounds were refined against photographs. Buildings elsewhere combine mapped footprints and available heights with procedural facade detail.'),
    block('technical-title', 'The original engine, a new city.', 'h2'),
    block('technical', 'The simulation runs in plain JavaScript with Three.js, WebGPU and TSL shaders. It remains a standalone browser experience, preserving its pinned renderer and controls. The portfolio loads only the project page and screenshots until you choose Explore Berlin.'),
    block('visit-title', 'Before you explore.', 'h2'),
    block('visit', 'For the best experience, use a desktop or laptop with a current WebGPU-capable browser. The first visit downloads the city and prepares its graphics, so allow a little time for loading. Performance varies by device; the scene is a procedural interpretation of Berlin, with simplified facades and terrain.'),
    block('credits-title', 'Credits and sources.', 'h2'),
    block('credits', 'Original simulation: Mr. Doob / Slop New York, under the MIT license. Berlin adaptation and art direction: Aaron J. Cunningham, developed with AI assistance. Geographic data: © OpenStreetMap contributors, available under ODbL. The original license and downloadable Berlin map data are included with the experience.'),
  ],
}

export function includeBerlinDriving<T extends {slug: string}>(items: T[], fallback: T, cmsOwnsSlug: boolean): T[] {
  return cmsOwnsSlug || items.some(item => item.slug === fallback.slug) ? items : [fallback, ...items]
}
