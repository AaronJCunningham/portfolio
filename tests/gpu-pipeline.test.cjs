const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const filename = path.join(__dirname, '../src/components/community/tools/gpu-pipeline-model.ts')
const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const model = { exports: {} }
new Function('exports', js)(model.exports)
const { createFrame, resolveDepth, operationCounts, blendColor, projectView, rasterize, warpActivity, warpSlots, STAGES } = model.exports

test('seven stages follow the pipeline and the torus has valid indexed geometry', () => {
  assert.deepEqual(STAGES.map(s => s.id), ['command', 'vertex', 'raster', 'fragment', 'depth', 'blend', 'present'])
  const frame = createFrame(64, 40)
  assert.equal(frame.vertices.length, 384)
  assert.equal(frame.indices.length / 3, 768)
  assert.ok(frame.indices.every(i => i >= 0 && i < 384))
  assert.ok(frame.fragments.length > frame.winners.length)
  assert.equal(frame.winners.length + frame.rejected.length, frame.fragments.length)
  assert.ok(frame.fragments.every(f => f.depth >= 0 && f.depth <= 1 && f.pixel >= 0 && f.pixel < 2560))
})

test('perspective shrinks distant coordinates and maps near/far depth correctly', () => {
  assert.ok(projectView([1, 0, -2], 1)[0] > projectView([1, 0, -4], 1)[0])
  assert.ok(Math.abs(projectView([0, 0, -.1], 1)[2]) < 1e-12)
  assert.ok(Math.abs(projectView([0, 0, -20], 1)[2] - 1) < 1e-12)
})

test('shared triangle edges cover a square once per pixel, in either winding', () => {
  const vertices = [[-1,-1], [1,-1], [1,1], [-1,1]].map(([x,y]) => ({ projected:[x,y,.5], view:[x,y,-2], normal:[0,0,1] }))
  for (const indices of [[0,1,2,0,2,3], [2,1,0,3,2,0]]) {
    const fragments = rasterize(vertices, indices, 4, 4)
    assert.equal(fragments.length, 16)
    assert.equal(new Set(fragments.map(f => f.pixel)).size, 16)
  }
})

test('the closer fragment wins regardless of submission order', () => {
  const near = { pixel: 1, depth: .2 }, far = { pixel: 1, depth: .8 }, other = { pixel: 2, depth: .6 }
  for (const fragments of [[near,far,other], [other,far,near]]) {
    const result = resolveDepth(fragments)
    assert.deepEqual(result.winners, [near,other])
    assert.deepEqual(result.rejected, [far])
  }
})

test('live task totals reconcile with actual geometry and fragments at every offered resolution', () => {
  for (const [w,h] of [[32,20], [64,40], [96,60]]) {
    const frame = createFrame(w,h), base = operationCounts(frame), branch = operationCounts(frame,true)
    assert.equal(base.total, 1 + w*h + 384 + 768 + 3*frame.fragments.length + 2*frame.winners.length)
    assert.equal(branch.total - base.total, frame.fragments.length)
    assert.equal(base.tasks.pixelWrites, new Set(frame.fragments.map(f=>f.pixel)).size)
    assert.deepEqual(createFrame(w,h),frame)
  }
  assert.throws(() => createFrame(0,40), RangeError)
  assert.throws(() => createFrame(129,40), RangeError)
  assert.throws(() => createFrame(1.5,40), RangeError)
})

test('blending endpoints and half opacity match the displayed equation', () => {
  assert.deepEqual(blendColor([1,.5,0],0,[0,0,1]), [0,0,1])
  assert.deepEqual(blendColor([1,.5,0],1,[0,0,1]), [1,.5,0])
  assert.deepEqual(blendColor([1,.5,0],.5,[0,0,1]), [.5,.25,.5])
})

test('divergent paths mask complementary lanes; padding is not counted as useful work', () => {
  for (const phase of [0,1]) {
    assert.equal(Array.from({length:32},(_,i)=>warpActivity(i,true,phase)).filter(Boolean).length,16)
    assert.ok(Array.from({length:32},(_,i)=>warpActivity(i,false,phase)).every(Boolean))
  }
  assert.deepEqual(warpSlots(32,false), {groups:1,slots:32,utilization:1})
  assert.deepEqual(warpSlots(32,true), {groups:1,slots:64,utilization:.5})
  assert.equal(warpSlots(33,false).slots,64)
  assert.equal(warpSlots(0,true).utilization,0)
})
