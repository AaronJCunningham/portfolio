const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {createHash} = require('node:crypto')
const {gunzipSync} = require('node:zlib')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

function load(file, imports = {}) {
  const result = {exports: {}}
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText
  new Function('require', 'exports', code)(name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`)
    return imports[name]
  }, result.exports)
  return result.exports
}

const berlin = load('src/content/berlin-driving-simulator.ts')
const sixSeas = load('src/content/six-seas.ts')
const queries = load('src/sanity/lib/queries.ts', {'next-sanity': {defineQuery: q => q}})
function repository({ownsBerlin = false, visibleBerlin = null, ownsSixSeas = false, visibleSixSeas = null} = {}) {
  return load('src/sanity/lib/projects.ts', {
    '@/content/berlin-driving-simulator': berlin,
    '@/content/six-seas': sixSeas,
    './queries': queries,
    './client': {client: {fetch: async (query, params) => {
      if (query === queries.berlinDrivingPresenceQuery) return ownsBerlin
      if (query === queries.sixSeasPresenceQuery) return ownsSixSeas
      if (query === queries.projectBySlugQuery) return params.slug === berlin.berlinDrivingProject.slug ? visibleBerlin : params.slug === sixSeas.sixSeasProject.slug ? visibleSixSeas : null
      return [visibleBerlin, visibleSixSeas].filter(Boolean)
    }}},
  })
}

test('local Berlin project appears consistently in Work, project navigation, and generated paths', async () => {
  const repo = repository()
  for (const list of await Promise.all([repo.getProjects(), repo.getProjectNavigation(), repo.getProjectSlugs()])) {
    assert.equal(list.filter(item => item.slug === 'berlin-driving-simulator').length, 1)
    assert.ok(!list.some(item => ['one-frame', 'time-frame', 'inside-the-gpu'].includes(item.slug)), 'GPU experiments stay off the production project list')
  }
  assert.equal(await repo.getProjectBySlug('berlin-driving-simulator'), berlin.berlinDrivingProject)
  assert.equal(await repo.getProjectBySlug('unknown-project'), null)
})

test('Six seas is linked consistently and respects published or hidden CMS ownership', async () => {
  const repo = repository()
  for (const list of await Promise.all([repo.getProjects(), repo.getProjectNavigation(), repo.getProjectSlugs()])) {
    assert.equal(list.filter(item => item.slug === 'six-seas').length, 1)
  }
  assert.equal(await repo.getProjectBySlug('six-seas'), sixSeas.sixSeasProject)
  const hidden = repository({ownsSixSeas: true})
  assert.equal(await hidden.getProjectBySlug('six-seas'), null)
  for (const list of await Promise.all([hidden.getProjects(), hidden.getProjectNavigation(), hidden.getProjectSlugs()])) {
    assert.ok(!list.some(item => item.slug === 'six-seas'))
  }
  const cms = {...sixSeas.sixSeasProject, _id: 'cms-six-seas', title: 'CMS ocean'}
  const visible = repository({ownsSixSeas: true, visibleSixSeas: cms})
  assert.equal((await visible.getProjects()).filter(item => item.slug === 'six-seas').length, 1)
  assert.equal(await visible.getProjectBySlug('six-seas'), cms)
})

test('published or hidden CMS ownership takes precedence without duplicate Berlin cards', async () => {
  const hidden = repository({ownsBerlin: true})
  for (const list of await Promise.all([hidden.getProjects(), hidden.getProjectNavigation(), hidden.getProjectSlugs()])) {
    assert.ok(!list.some(item => item.slug === 'berlin-driving-simulator'))
  }
  assert.equal(await hidden.getProjectBySlug('berlin-driving-simulator'), null)
  const cms = {...berlin.berlinDrivingProject, _id: 'cms-project-id', title: 'CMS-managed Berlin'}
  const visible = repository({ownsBerlin: true, visibleBerlin: cms})
  assert.equal((await visible.getProjects()).filter(item => item.slug === cms.slug).length, 1)
  assert.equal(await visible.getProjectBySlug(cms.slug), cms)
})

test('the friendly launch route resolves the standalone module graph with creator credit and a way back', async () => {
  const config = require('../next.config.js')
  const rewrite = (await config.rewrites()).find(item => item.source === berlin.berlinDrivingProject.experiencePath)
  assert.ok(rewrite)
  const html = fs.readFileSync(path.join(root, 'public', rewrite.destination), 'utf8')
  const base = new URL(html.match(/<base href="([^"]+)"/)[1], 'http://portfolio.test/play/berlin')
  const imports = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports
  assert.ok(imports['three/webgpu'].endsWith('/three.webgpu.js'))
  for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, 'public', new URL(match[1], base).pathname)), `missing ${match[1]}`)
  }
  for (const target of Object.values(imports)) {
    assert.ok(fs.existsSync(path.join(root, 'public', new URL(target, base).pathname)), `missing ${target}`)
  }
  assert.match(html, /href="https:\/\/mrdoob.github.io\/slop-newyork\/"[^>]*>Original NYC version by Mr\. Doob/)
  assert.match(html, /href="\/berlin-driving-simulator" aria-label="Back to Berlin Driving Simulator project"/)
  assert.doesNotMatch(html, /localhost:|127\.0\.0\.1:/)
})

test('downloadable map data retains its complete source hash and upstream license', () => {
  const exported = path.join(root, 'public/experiments/berlin')
  const manifest = JSON.parse(fs.readFileSync(path.join(exported, 'export-manifest.json'), 'utf8'))
  const data = gunzipSync(fs.readFileSync(path.join(exported, 'data/berlin.json.gz')))
  assert.equal(createHash('sha256').update(data).digest('hex'), manifest.dataSha256)
  assert.match(fs.readFileSync(path.join(exported, 'LICENSE'), 'utf8'), /Copyright \(c\) 2026 Mr.doob/)
  assert.match(fs.readFileSync(path.join(exported, 'data/README.txt'), 'utf8'), /OpenStreetMap contributors, ODbL 1.0/)
})
