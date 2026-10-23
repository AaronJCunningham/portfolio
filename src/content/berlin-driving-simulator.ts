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
  excerpt: 'A playable Berlin, generated from real map data. Drive, walk, cycle or fly through 87.6 km² of streets, parks and landmarks inside the Ringbahn.',
  publishedAt: '2026-10-23T12:00:00Z',
  sortOrder: 0,
  experiencePath: '/play/berlin',
  experienceLabel: 'Explore Berlin',
  standaloneExperience: true,
  roleLabel: 'CREATIVE DEVELOPMENT / GEOSPATIAL 3D',
  attribution: {
    label: 'Based on Slop New York by Mr. Doob',
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
    {_key: 'source', label: 'Original project source', url: 'https://github.com/mrdoob/slop-newyork'},
    {_key: 'map-credit', label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright'},
    {_key: 'data', label: 'Berlin map data (.json.gz)', url: '/experiments/berlin/data/berlin.json.gz'},
  ],
  seo: {
    title: 'Berlin Driving Simulator — Explore the Ringbahn',
    description: 'Explore a procedural Berlin built from OpenStreetMap data. Real streets, 14 custom landmarks and 87.6 km² inside the Ringbahn, brought to life with Three.js and WebGPU.',
  },
  body: [
    block('idea-title', 'Turn a map into somewhere you can go.', 'h2'),
    block('idea', 'I wanted to make the Berlin I know explorable in the browser: drive towards the Brandenburg Gate, find Berghain on foot, or take a helicopter over Tempelhofer Feld. The Ringbahn gave the project a natural boundary, connecting distinct neighbourhoods into one continuous world.'),
    block('scope', 'My work focused on translating Berlin’s geography into the simulation: a map-data pipeline, procedural buildings that follow real footprints, 14 custom landmarks, and routes between 25 destinations. The challenge was making a large geographic dataset feel like a place you recognise and want to explore.'),
    block('data-title', 'Real geography becomes the structure.', 'h2'),
    block('data', 'The city starts with OpenStreetMap. Streets, building footprints, courtyards, parks, water and railways were collected through the Overpass API and a regional Geofabrik extract. The dataset contains more than 67,000 building and building-part records, 105,000 road and path segments, and 90,000 individually mapped trees.'),
    block('conversion', 'Those geographic coordinates are converted into the simulation’s 3D space. The expansion follows the actual S41/S42 rail loop, while preserving road junctions, one-way directions and open courtyards. That connectivity matters: a street has to work for driving and navigation as well as look right on a map.'),
    block('procedural-title', 'A city built from rules.', 'h2'),
    block('procedural', 'Building outlines become 3D geometry, using mapped heights and floor counts where available, with estimates filling the gaps. Procedural rules supply facade patterns, windows, roof details and vegetation. This makes it possible to populate whole neighbourhoods without individually modelling every building.'),
    block('graphics', 'Three.js and WebGPU render the world, with TSL shaders generating surface detail and materials. The combination gives the city a real geographic structure and a consistent visual language as you move from street level to the skyline.'),
    block('landmarks-title', 'The details that make it Berlin.', 'h2'),
    block('landmarks', 'Landmarks needed more individual attention. Berghain became a detailed procedural model built from its mapped footprint and photographic references: tall industrial windows, weathered plaster, layered graffiti, fencing and an overgrown approach. Tempelhofer Feld keeps its former runway surfaces, and the Spree follows its mapped banks.'),
    block('interaction', 'I also refined how the city feels to explore. Police sirens come from nearby moving cars at intervals. Searching the map and clicking a destination takes you there and closes the overlay. Berlin street names, local vehicle liveries and neighbourhood arrival points carry the setting through the smaller interactions.'),
    block('performance-title', 'Making the scale manageable.', 'h2'),
    block('performance', 'The expanded city groups buildings and street geometry into 750-metre cells so the renderer can skip distant areas. Repeated objects share geometry through instancing, and night lights are selected from nearby spatial cells. These choices let the simulation reuse its rendering systems across a much larger mapped world.'),
    block('validation', 'Validation covered clear arrival points, camera sightlines and 61 directed route checks across the city. I used AI-assisted development throughout, directing the scope, visual references and interaction changes, then reviewing the results in the browser. The work brought together geospatial data, procedural graphics and close attention to a city’s character.'),
  ],
}

export function includeBerlinDriving<T extends {slug: string}>(items: T[], fallback: T, cmsOwnsSlug: boolean): T[] {
  return cmsOwnsSlug || items.some(item => item.slug === fallback.slug) ? items : [fallback, ...items]
}
