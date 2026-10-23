import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {gzipSync} from 'node:zlib'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = path.resolve(process.argv[2] || path.join(root, '../../slop-berlin-webgpu'))
const target = path.join(root, 'public/experiments/berlin')
const html = await fs.readFile(path.join(source, 'index.html'), 'utf8')
const data = await fs.readFile(path.join(source, 'data/berlin.json'))
const sourcePin = JSON.parse(await fs.readFile(path.join(source, 'UPSTREAM.json'), 'utf8'))

if (!html.includes('Original NYC version by Mr. Doob') || !html.includes('type="importmap"')) {
  throw new Error('Expected the credited, standalone WebGPU Berlin source.')
}
await fs.mkdir(target, {recursive: true})
for (const entry of ['css', 'js', 'vendor', 'LICENSE', 'UPSTREAM.json']) {
  await fs.cp(path.join(source, entry), path.join(target, entry), {recursive: true})
}
// Keep the original module graph and pinned Three.js isolated from Next.js.
// A base URL makes both the friendly rewrite and the static HTML resolve assets correctly.
const exportedHtml = html
  .replace('<head>', '<head>\n  <base href="/experiments/berlin/" />\n  <link rel="canonical" href="https://aaronjcunningham.com/berlin-driving-simulator" />')
  .replace('<span class="mta-bullet" aria-hidden="true">B</span>', '<a class="mta-bullet portfolio-return" href="/berlin-driving-simulator" aria-label="Back to Berlin Driving Simulator project" title="Back to project">←</a>')
  .replace('href="./data/berlin.json" download>Map data', 'href="./data/berlin.json.gz" download>Map data (.gz)')
await fs.writeFile(path.join(target, 'index.html'), exportedHtml)
await fs.mkdir(path.join(target, 'data'), {recursive: true})
await fs.writeFile(path.join(target, 'data/berlin.json.gz'), gzipSync(data, {level: 9}))
await fs.writeFile(path.join(target, 'data/README.txt'), 'Berlin map data is derived from OpenStreetMap. © OpenStreetMap contributors, ODbL 1.0.\nhttps://www.openstreetmap.org/copyright\nDecompress berlin.json.gz to obtain the complete adapted dataset and source metadata.\n')
await fs.writeFile(path.join(target, 'export-manifest.json'), JSON.stringify({
  name: 'Berlin Driving Simulator',
  projectPath: '/berlin-driving-simulator',
  experiencePath: '/play/berlin',
  original: 'https://mrdoob.github.io/slop-newyork/',
  upstream: sourcePin,
  dataSha256: createHash('sha256').update(data).digest('hex'),
  dataLicense: 'ODbL-1.0',
  license: 'MIT',
}, null, 2) + '\n')
console.log('Exported the standalone WebGPU simulation to public/experiments/berlin. No deployment performed.')
