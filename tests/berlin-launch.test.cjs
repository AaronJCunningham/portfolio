const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../public/experiments/berlin/js', name), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('exports', code)(exports);
  return exports;
}
const { isMobileDevice, createLaunchSession, launchBerlin } = load('launch.js');
const { RenderBudget } = load('render-budget.js');
const { cityDrawDistance, cityCellVisible } = load('city-range.js');
function fixture() {
  let timeout;
  const failures = [], stopped = [], ready = [];
  const session = createLaunchSession({ onFailure: reason => failures.push(reason), onReady: () => ready.push(true),
    setTimer: fn => { timeout = fn; return 1; }, clearTimer: () => { timeout = null; } });
  session.onStop(() => stopped.push(true));
  return { session, failures, stopped, ready, expire: () => timeout?.() };
}
test('phones and iPads are detected without blocking a narrow window or a touch laptop', () => {
  for (const nav of [{ userAgent: 'iPhone' }, { userAgent: 'Android' },
    { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }, { userAgentData: { mobile: true } }]) {
    assert.equal(isMobileDevice(nav), true);
  }
  assert.equal(isMobileDevice({ userAgent: 'Windows NT', maxTouchPoints: 10 }, true), false);
  assert.equal(isMobileDevice({ userAgent: 'Macintosh', maxTouchPoints: 0 }), false);
});
test('mobile, missing WebGPU and an unavailable adapter never import city data', async () => {
  let imports = 0;
  for (const [nav, reason] of [
    [{ userAgent: 'iPhone', gpu: { requestAdapter: () => assert.fail('mobile must not query GPU') } }, 'mobile'],
    [{}, 'unsupported'], [{ gpu: { requestAdapter: async () => null } }, 'unsupported'],
    [{ gpu: { requestAdapter: async () => ({ isFallbackAdapter: true }) } }, 'unsupported']
  ]) {
    const f = fixture();
    await launchBerlin({ nav, coarsePointer: false, session: f.session, loadApp: () => { imports++; } });
    assert.deepEqual(f.failures, [reason]);
  }
  assert.equal(imports, 0);
});
const capable = { gpu: { requestAdapter: async () => ({}) } };
test('network/import and initialization failures reach the fallback and clean up once', async () => {
  for (const loadApp of [async () => { throw Error('download failed'); },
    async () => ({ initApp: async () => { throw Error('GPU allocation failed'); } })]) {
    const f = fixture();
    await launchBerlin({ nav: capable, coarsePointer: false, session: f.session, loadApp });
    f.session.fail('again');
    assert.deepEqual(f.failures, ['load']);
    assert.equal(f.stopped.length, 1);
    assert.equal(f.session.ready(), false);
  }
});
test('timed-out imports cannot later start the scene or hide the fallback', async () => {
  const f = fixture(); let completeImport; let started = false;
  const pending = launchBerlin({ nav: capable, coarsePointer: false, session: f.session,
    loadApp: () => new Promise(resolve => { completeImport = resolve; }) });
  await Promise.resolve();
  f.expire();
  completeImport({ initApp: () => { started = true; } });
  await pending;
  assert.deepEqual(f.failures, ['timeout']);
  assert.equal(started, false);
  assert.equal(f.session.ready(), false);
});
test('successful startup clears the timer; later device loss still stops the scene', async () => {
  const f = fixture();
  await launchBerlin({ nav: capable, coarsePointer: false, session: f.session,
    loadApp: async () => ({ initApp: async session => session.ready() }) });
  f.expire();
  assert.equal(f.ready.length, 1);
  assert.deepEqual(f.failures, []);
  f.session.fail('device');
  assert.deepEqual(f.failures, ['device']);
  assert.equal(f.stopped.length, 1);
});
test('the loading deadline counts time in the foreground, not time in a background tab', () => {
  let clock = 0, pending, delay;
  const session = createLaunchSession({ onFailure: () => {}, onReady: () => {}, timeoutMs: 120000,
    now: () => clock, setTimer: (fn, ms) => { pending = fn; delay = ms; }, clearTimer: () => { pending = null; } });
  clock = 30000;
  session.setPaused(true);
  assert.equal(pending, null);
  clock = 300000;
  session.setPaused(false);
  assert.equal(delay, 90000);
  pending();
  assert.equal(session.stopped, true);
});
function frames(budget, fps, seconds) {
  for (let i = 0; i < fps * seconds; i++) budget.sample(1 / fps);
}
test('render budget lowers resolution for sustained slow rendering, with a readable floor', () => {
  const budget = new RenderBudget();
  frames(budget, 25, 2);
  assert.equal(budget.scale, 1);
  frames(budget, 25, 2);
  assert.equal(budget.scale, 0.9);
  frames(budget, 25, 60);
  assert.equal(budget.scale, 0.7);
  assert.ok(budget.pixelRatio(3840, 2160) ** 2 * 3840 * 2160 <= 1920 * 1080);
});
test('render budget targets near 60fps instead of accepting a sustained 45–50fps', () => {
  const budget = new RenderBudget();
  frames(budget, 50, 4);
  assert.equal(budget.scale, 0.9);
  budget.reset();
  frames(budget, 57, 9);
  assert.equal(budget.scale, 0.9);
});
test('city cells disappear at distance, return after teleporting, and expand for aerial views', () => {
  const cell = { x: 3500, z: 0, r: 400, kind: 'buildings' };
  assert.equal(cityCellVisible(cell, { x: 0, y: 5, z: 0 }), false);
  assert.equal(cityCellVisible(cell, { x: 3000, y: 5, z: 0 }), true);
  assert.equal(cityCellVisible(cell, { x: 0, y: 400, z: 0 }), true);
  assert.equal(cityCellVisible({ ...cell, x: 2150 }, { x: 0, y: 5, z: 0 }), true, 'keep cells whose edges are close');
  assert.equal(cityDrawDistance(10000, 'buildings'), 18000);
  assert.ok(cityDrawDistance(5, 'ground') < cityDrawDistance(5, 'buildings'));
});
test('resolution recovery is conservative and background gaps do not reduce quality', () => {
  const budget = new RenderBudget();
  for (let i = 0; i < 20; i++) budget.sample(2);
  assert.equal(budget.scale, 1);
  frames(budget, 25, 10);
  assert.equal(budget.scale, 0.7);
  frames(budget, 60, 9);
  assert.equal(budget.scale, 0.7);
  frames(budget, 60, 7);
  assert.equal(budget.scale, 0.8);
});
test('entry page gates large modules and keeps a working non-JavaScript exit', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/experiments/berlin/index.html'), 'utf8');
  assert.doesNotMatch(html, /rel="modulepreload"|src="\.\/js\/main\.js/);
  assert.match(html, /import\('\.\/js\/launch\.js/);
  assert.match(html, /id="fallback-retry" href="\/play\/berlin"/);
  assert.match(html, /class="fallback-back" href="\/berlin-driving-simulator"/);
});
