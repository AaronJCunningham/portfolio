const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const root = 'public/experiments/berlin/js/';
function load(file, dependencies = {}) {
  const result = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(root + file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'exports', code)(name => {
    assert.ok(name in dependencies, `unexpected import: ${name}`);
    return dependencies[name];
  }, result.exports);
  return result.exports;
}
const { updatePedestrianReaction: update, resetPedestrianReaction: reset } = load('pedestrian-reactions.js');
const car = () => ({ active: true, x: 0, z: 0, vx: 0, vz: 12, halfW: 0.86, halfL: 2.18 });
const person = (x = 1, z = 5) => ({ x, z, v: 1.4 });
const clear = () => true;

test('an approaching car causes one grounded-to-airborne sidestep away from its path', () => {
  const p = person(), c = car();
  assert.equal(update(p, c, 0.016, 1, clear), true);
  assert.ok(p.x > 1 && p.reactionAir > 0);
  assert.equal(p.v, 0);
  let triggers = 1, maxAir = 0;
  for (let i = 1; i < 30; i++) {
    p.x = 1; p.z = 5; // normal track position written by traffic
    triggers += +update(p, c, 0.016, 1 + i * 0.016, clear);
    maxAir = Math.max(maxAir, p.reactionAir);
  }
  assert.equal(triggers, 1);
  assert.ok(maxAir > 0.5 && maxAir <= 0.55);
  assert.ok(p.x > 2.9);
  const left = person(-1);
  assert.equal(update(left, c, 0.016, 1, clear), true);
  assert.ok(left.x < -1);
});

test('stationary, distant, departing, and inactive cars do not frighten pedestrians', () => {
  for (const [p, c] of [[person(), { ...car(), vz: 0 }], [person(12), car()],
    [person(1, -5), car()], [person(), { ...car(), active: false }], [person(), null]]) {
    assert.equal(update(p, c, 0.016, 1, clear), false);
    assert.equal(p.reaction, undefined);
  }
  const reversing = person(1, -5);
  assert.equal(update(reversing, { ...car(), vz: -12 }, 0.016, 1, clear), true);
});

test('blocked landings are rejected, with a smaller hop when space is limited', () => {
  const blocked = person();
  assert.equal(update(blocked, car(), 0.016, 1, () => false), false);
  assert.equal(blocked.x, 1);
  const tight = person();
  assert.equal(update(tight, car(), 0.016, 1, (ax, az, bx) => bx - ax < 1.5), true);
  assert.equal(tight.reaction.x, 1.4);
});

test('waits for the car to clear, recovers smoothly, and does not retrigger during cooldown', () => {
  for (const dt of [1 / 60, 1 / 20]) {
    const p = person(), c = car();
    update(p, c, dt, 1, clear);
    for (let now = 1 + dt; now < 4; now += dt) {
      p.x = 1; p.z = 5; update(p, c, dt, now, clear);
    }
    assert.ok(p.reaction && p.x > 2.99, 'stay aside while car occupies the path');
    c.z = 25;
    let lastX = p.x;
    for (let now = 4; now < 5.5; now += dt) {
      p.x = 1; p.z = 5; update(p, c, dt, now, clear);
      assert.ok(Math.abs(p.x - lastX) < 0.13, 'no snap back to the path');
      lastX = p.x;
    }
    assert.equal(p.reaction, null);
    assert.equal(p.x, 1);
    assert.equal(update(p, car(), dt, 5.5, clear), false);
    assert.equal(update(p, car(), dt, 6.1, clear), true);
    reset(p);
    assert.equal(p.reaction, null); assert.equal(p.reactionAir, 0);
  }
});

const { createEventResources, loadScreamSample, playEvent } = load('audio-events.js', { './audio-synthesis.js': { setControlRate() {} } });
test('the local scream MP3 is fetched and decoded once, then reused as a short spatial event', async () => {
  const sources = [];
  const parameter = () => ({ value: 0, cancelScheduledValues() {}, setTargetAtTime() {} });
  const node = () => ({ connect(target) { return target; }, disconnect() {}, gain: parameter() });
  const ctx = {
    sampleRate: 24000, currentTime: 10, state: 'running',
    createBuffer(channels, length, rate) { const samples = new Float32Array(length); return { duration: length / rate, getChannelData: () => samples }; },
    createGain: node,
    createBufferSource() { const s = { ...node(), playbackRate: parameter(), start(t) { this.startAt = t; }, stop(t) { this.stopAt = t; } }; sources.push(s); return s; }
  };
  const resources = createEventResources(ctx, {});
  const mp3 = fs.readFileSync('public/experiments/berlin/audio/pedestrian-scream.mp3');
  assert.ok(mp3.subarray(0, 3).toString() === 'ID3' || (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0), 'valid MP3 tag or MPEG frame header');
  assert.ok(mp3.length < 25000);
  assert.equal(resources.screams.length, 0);
  playEvent(ctx, resources, 'scream', node());
  assert.equal(sources.length, 0, 'no empty or synthetic voice before the recording is ready');
  const channels = [new Float32Array([0, 0.8, -0.4, 0]), new Float32Array([0, -0.4, 0.2, 0])];
  const decoded = { duration: 0.65, numberOfChannels: 2, getChannelData: i => channels[i] };
  let requests = 0, decodes = 0;
  ctx.decodeAudioData = async bytes => { decodes++; assert.deepEqual(Buffer.from(bytes), mp3); return decoded; };
  await loadScreamSample(ctx, resources, async url => {
    requests++; assert.equal(url, '/experiments/berlin/audio/pedestrian-scream.mp3');
    return { ok: true, arrayBuffer: async () => mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength) };
  });
  assert.equal(resources.screams[0], decoded);
  assert.equal(Math.max(...channels.flatMap(c => [...c].map(Math.abs))), 0.5);
  const event = playEvent(ctx, resources, 'scream', node(), { seed: 4, intensity: 0.75 });
  assert.equal(sources.length, 1);
  assert.ok(event.endTime > 10.6 && event.endTime < 10.8);
  assert.equal(sources[0].buffer, decoded);
  assert.equal(sources[0].stopAt, event.endTime);
  event.dispose(true);
  assert.equal(sources[0].stopAt, 10);
  playEvent(ctx, resources, 'scream', node(), { seed: 7 });
  assert.equal(sources[1].buffer, decoded);
  assert.equal(requests, 1); assert.equal(decodes, 1);
});

test('a failed audio download leaves screams silent without disrupting other sounds', async () => {
  const resources = { screams: [], footsteps: ['existing'] };
  await assert.rejects(loadScreamSample({}, resources, async () => ({ ok: false, status: 404 })), /HTTP 404/);
  assert.deepEqual(resources, { screams: [], footsteps: ['existing'] });
});

const { CityAudioSystem } = load('audio-system.js', {
  './audio-synthesis.js': {}, './audio-events.js': {}, './audio-sources.js': {}, './audio-acoustics.js': {}
});
test('screams obey mute, visibility, range result, and global cooldown without queuing', () => {
  const oldDocument = global.document;
  global.document = { hidden: false };
  try {
    let emitted = 0;
    const system = { ready: true, enabled: true, haveListener: true, context: { state: 'running', currentTime: 10 },
      resources: { screams: [] }, lastScream: -Infinity, emit() { emitted++; return true; } };
    const scream = () => CityAudioSystem.prototype.scream.call(system, { ...person(), rig: { seed: 1 } });
    assert.equal(scream(), false);
    system.resources.screams = [{}];
    assert.equal(scream(), true); assert.equal(scream(), false);
    system.context.currentTime = 11;
    system.enabled = false; assert.equal(scream(), false);
    system.enabled = true; global.document.hidden = true; assert.equal(scream(), false);
    global.document.hidden = false; assert.equal(scream(), true);
    assert.equal(emitted, 2);
  } finally { global.document = oldDocument; }
});
