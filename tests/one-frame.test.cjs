const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
function load(file) {
  const result = {exports: {}}
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText
  new Function('exports', js)(result.exports)
  return result.exports
}
const m = load('../src/components/one-frame/model.ts')
const content = load('../src/content/one-frame.ts')
const playing = () => ({...m.createFlight(), phase: 'playing'})
const tick = (s, input = {}, seconds = 1) => { for (let i = 0; i < seconds * 60; i++) m.stepFlight(s, {...m.EMPTY_INPUT, ...input}, 1 / 60) }

test('pause stops movement, boost use, objectives, and elapsed time', () => {
  const s = playing(); tick(s, {forward: 1, boost: true})
  s.phase = 'paused'; const before = structuredClone(s)
  tick(s, {forward: 1, boost: true}, 4)
  assert.deepEqual(s, before)
})

test('boost is faster, drains energy, and cannot move outside the world', () => {
  const normal = playing(), boosted = playing()
  tick(normal, {forward: 1}, 2); tick(boosted, {forward: 1, boost: true}, 2)
  assert.ok(boosted.position.z < normal.position.z - 15)
  assert.ok(boosted.energy < .7)
  tick(boosted, {}, 6); assert.equal(boosted.energy, 1)
  tick(boosted, {lift: 1, strafe: 1, forward: 1, boost: true}, 100)
  assert.ok(boosted.position.x <= 48 && boosted.position.y <= 51 && boosted.position.z >= -351)
})

test('collision substeps stop a boosted flight through a thin obstacle', () => {
  const s = playing(); s.position = {x: 0, y: 10, z: 3}; s.velocity.z = -29
  m.stepFlight(s, {...m.EMPTY_INPUT, forward: 1, boost: true}, .1, [{x: 0, z: 1, width: 4, depth: .2, height: 20}])
  assert.ok(s.position.z > 1.8)
  assert.equal(s.collisions, 1)
})

test('the memory bus cannot advance a player who has not collected every request', () => {
  const s = playing(); s.position = {...m.MEMORY_EXIT}; tick(s)
  assert.equal(s.chapter, 0)
  for (const p of m.PACKETS) { s.position = {...p}; tick(s, {}, .1) }
  assert.equal(s.packets, 255)
  s.position = {...m.MEMORY_EXIT}; tick(s, {}, .1)
  assert.equal(s.chapter, 1)
})

test('one uninterrupted forward run collects the eight signals in order and reaches the bus', () => {
  for (const boost of [false, true]) for (const fps of [60, 10]) {
    const s = playing(), collected = []
    for (let frame = 0; frame < 15 * fps && s.chapter === 0; frame++) {
      const before = s.packets, z = s.position.z
      m.stepFlight(s, {...m.EMPTY_INPUT, forward: 1, boost}, 1 / fps)
      assert.ok(s.position.z <= z, 'the route must never require reversing')
      for (let i = 0; i < 8; i++) if (!m.has(before, i) && m.has(s.packets, i)) collected.push(i)
    }
    assert.deepEqual(collected, [0, 1, 2, 3, 4, 5, 6, 7])
    assert.equal(s.chapter, 1, `forward-only flight must clear memory: boost=${boost}, fps=${fps}`)
  }
})

test('memory guidance follows the route order instead of switching to a nearby later pickup', () => {
  const s = playing(); s.position = {...m.PACKETS[6]}
  assert.equal(m.target(s).label, 'Data 1')
  s.packets = 7
  assert.equal(m.target(s).label, 'Data 4')
})

test('passing through either branch starts its work; it finishes after leaving without a key switch', () => {
  for (const first of [0, 1]) {
    const s = playing(); s.chapter = 1; s.packets = 255
    const p = m.BRANCHES[first]
    s.position = {...p, z: p.z + 10}
    tick(s, {forward: 1, boost: true}, 1.5)
    assert.equal(s.branches[first], 1)
    assert.equal(s.branches[1 - first], 0)
    assert.ok(m.distance(s.position, p) > 6, 'work must finish without hovering')
    s.velocity = {x: 0, y: 0, z: 0}; s.position = {...m.BRANCH_EXIT}; tick(s)
    assert.equal(s.chapter, 1, 'one branch cannot unlock the exit')
    s.position = {...m.BRANCHES[1 - first]}; tick(s, {}, .1)
    s.position = {...m.BRANCH_EXIT}; tick(s)
    assert.equal(s.chapter, 2)
    assert.deepEqual(s.branches, [1, 1])
  }
})

test('memory and both branch gates can be completed in one continuous forward run', () => {
  for (const boost of [false, true]) {
    const s = playing()
    for (let frame = 0; frame < 25 * 60 && s.chapter < 2; frame++) m.stepFlight(s, {...m.EMPTY_INPUT, forward: 1, boost}, 1 / 60)
    assert.equal(s.chapter, 2)
    assert.deepEqual(s.branches, [1, 1])
  }
})

test('queued branch work remains sequential and manual pause freezes it', () => {
  const s = playing(); s.chapter = 1; s.packets = 255; s.position = {...m.BRANCHES[0]}; tick(s, {}, .1)
  s.position = {...m.BRANCHES[1]}; tick(s, {}, .1)
  assert.ok(s.branches[0] > .2 && s.branches[0] < 1)
  assert.equal(s.branches[1], Number.EPSILON)
  s.phase = 'paused'; const before = structuredClone(s); tick(s, {}, 3); assert.deepEqual(s, before)
  s.phase = 'playing'; tick(s, {}, 2); assert.deepEqual(s.branches, [1, 1])
})

test('depth collection works in either order and display completion is gated', () => {
  for (const order of [[0, 1, 2], [2, 0, 1]]) {
    const s = playing(); s.chapter = 2; s.position = {...m.DISPLAY}; tick(s); assert.equal(s.phase, 'playing')
    for (const i of order) { s.position = {...m.FRAGMENTS[i]}; tick(s, {}, .1) }
    assert.equal(s.fragments, 7)
    s.position = {...m.DISPLAY}; tick(s, {}, .1); assert.equal(s.phase, 'ending')
    tick(s, {}, 10); assert.equal(s.phase, 'complete')
  }
})

test('a complete expedition is reachable using steering and movement, without teleporting', () => {
  const s = playing()
  for (let frame = 0; frame < 18000 && s.phase !== 'complete'; frame++) {
    m.alignToTarget(s)
    m.stepFlight(s, {...m.EMPTY_INPUT, forward: 1}, 1 / 60)
  }
  assert.equal(s.phase, 'complete')
  assert.equal(s.packets, 255); assert.deepEqual(s.branches, [1, 1]); assert.equal(s.fragments, 7)
})

test('each new flight starts at the beginning independently of a previous run', () => {
  const previous = playing(); tick(previous, {forward: 1}, 17)
  assert.equal(previous.chapter, 2)
  const fresh = m.createFlight()
  assert.equal(fresh.phase, 'intro'); assert.equal(fresh.chapter, 0); assert.equal(fresh.elapsed, 0)
  assert.equal(fresh.packets, 0); assert.equal(fresh.fragments, 0)
  assert.deepEqual(fresh.branches, [0, 0]); assert.deepEqual(fresh.position, {x: 0, y: 12, z: 28})
  assert.deepEqual(fresh.velocity, {x: 0, y: 0, z: 0})
})

test('Sanity ownership prevents duplicate or hidden local fallback projects', () => {
  const p = content.oneFrameProject
  assert.equal(content.includeOneFrame([], p, false)[0], p)
  assert.deepEqual(content.includeOneFrame([], p, true), [])
  const cms = {...p, _id: 'sanity-generated-id', title: 'CMS title'}
  assert.deepEqual(content.includeOneFrame([cms], p, true), [cms])
  assert.deepEqual(content.includeOneFrame([cms], p, false), [cms])
  assert.equal(p.experiencePath, '/time-frame')
  assert.notEqual(`/${p.slug}`, p.experiencePath)
})
