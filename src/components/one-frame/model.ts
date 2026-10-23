/** The small, inspectable simulation behind One Frame. Distances and time are artistic scales. */
export type Point = {x: number; y: number; z: number}
export type Phase = 'intro' | 'playing' | 'paused' | 'ending' | 'complete'
export type Input = {forward: number; strafe: number; lift: number; turn: number; pitch: number; boost: boolean; brake: boolean}
export type Obstacle = {x: number; z: number; width: number; depth: number; height: number}
export type Flight = {
  phase: Phase; chapter: number; position: Point; velocity: Point; yaw: number; pitch: number
  elapsed: number; endingTime: number; energy: number; packets: number; branch: number
  branches: [number, number]; fragments: number; collisions: number
}

// A shallow, level S-curve: its full width fits inside the pickup corridor.
// Holding forward from the checkpoint reaches every signal, including at boost speed.
export function memoryRoutePoint(t: number): Point {
  return {x: Math.sin(t * Math.PI * 2) * 3.2, y: 12, z: 28 - t * 130}
}
export const PACKETS: Point[] = Array.from({length: 8}, (_, i) => memoryRoutePoint((20 + i * 13) / 130))
export const MEMORY_EXIT: Point = {x: 0, y: 12, z: -102}
export const BRANCHES: Point[] = [{x: -4, y: 12, z: -160}, {x: 4, y: 12, z: -190}]
export const BRANCH_EXIT: Point = {x: 0, y: 13, z: -222}
export const FRAGMENTS = [
  {x: -17, y: 13, z: -265, depth: .8, name: 'Far surface'},
  {x: 16, y: 19, z: -284, depth: .5, name: 'Middle surface'},
  {x: -4, y: 12, z: -307, depth: .2, name: 'Near surface'},
]
export const DISPLAY: Point = {x: 0, y: 15, z: -341}
export const EMPTY_INPUT: Input = {forward: 0, strafe: 0, lift: 0, turn: 0, pitch: 0, boost: false, brake: false}
export const has = (mask: number, bit: number) => Boolean(mask & (1 << bit))
export const count = (mask: number) => mask.toString(2).split('1').length - 1
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export function createFlight(): Flight {
  return {phase: 'intro', chapter: 0, position: {x: 0, y: 12, z: 28}, velocity: {x: 0, y: 0, z: 0},
    yaw: 0, pitch: 0, elapsed: 0, endingTime: 0, energy: 1, packets: 0, branch: 0,
    branches: [0, 0], fragments: 0, collisions: 0}
}

export function resetPosition(state: Flight) {
  state.position = state.chapter === 0 ? {x: 0, y: 12, z: 28} : state.chapter === 1 ? {x: 0, y: 14, z: -120} : {x: 0, y: 14, z: -238}
  state.velocity = {x: 0, y: 0, z: 0}; state.yaw = 0; state.pitch = 0; state.energy = 1
}

export function target(state: Flight): {position: Point; label: string; detail: string} {
  if (state.chapter === 0) {
    const pending = PACKETS.map((position, i) => ({position, i})).filter(p => !has(state.packets, p.i))
    if (pending.length) return {position: pending[0].position, label: `Data ${pending[0].i + 1}`, detail: `${count(state.packets)} / 8 gathered`}
    return {position: MEMORY_EXIT, label: 'NEXT', detail: 'Next stage'}
  }
  if (state.chapter === 1) {
    const i = state.branches.findIndex(p => p === 0)
    if (i < 0) return {position: BRANCH_EXIT, label: 'NEXT', detail: state.branches.every(p => p >= 1) ? 'Both paths complete · fly through to continue' : 'Both gates activated · keep flying to the exit'}
    return {position: BRANCHES[i], label: `Path ${i === 0 ? 'A' : 'B'}`, detail: 'Fly through the glowing ring · no need to stop'}
  }
  const pending = FRAGMENTS.map((position, i) => ({position, i})).filter(p => !has(state.fragments, p.i))
  pending.sort((a, b) => distance(state.position, a.position) - distance(state.position, b.position))
  if (pending.length) return {position: pending[0].position, label: pending[0].position.name, detail: `${count(state.fragments)} / 3 depth samples`}
  return {position: DISPLAY, label: 'FINISH', detail: 'Finish the picture'}
}

/** One instruction, one GPU fact, and a counter for the rings on screen. */
export function missionGuide(state: Flight) {
  if (state.chapter === 0) return {
    stage: 'Get data', collected: count(state.packets), total: 8,
    action: state.packets === 255 ? 'Fly through NEXT.' : 'Collect the 8 glowing rings.',
    lesson: 'Your GPU gets shapes and colours from memory to build the picture on your screen.',
  }
  if (state.chapter === 1) {
    const next = state.branches.findIndex(p => p === 0)
    return {
      stage: 'Do the maths', collected: state.branches.filter(p => p > 0).length, total: 2,
      action: next < 0 ? 'Fly through NEXT.' : next === 0 && state.branches[1] === 0 ? 'Fly through A, then B.' : `Fly through ${next === 0 ? 'A' : 'B'}.`,
      lesson: 'A GPU has lots of tiny workers doing maths at the same time to draw the picture faster.',
    }
  }
  return {
    stage: 'Draw the picture', collected: count(state.fragments), total: 3,
    action: state.fragments === 7 ? 'Fly through FINISH.' : 'Collect the 3 surface rings.',
    lesson: 'Your GPU shows the closest surface and hides what’s behind it.',
  }
}

export function alignToTarget(state: Flight) {
  const p = target(state).position, dx = p.x - state.position.x, dy = p.y - state.position.y, dz = p.z - state.position.z
  state.yaw = Math.atan2(-dx, -dz)
  state.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -.85, .85)
}

/** Fixed-size substeps prevent tunnelling through objects after a slow frame. */
export function stepFlight(state: Flight, input: Input, seconds: number, obstacles: Obstacle[] = []) {
  if (state.phase === 'ending') { state.endingTime += Math.min(seconds, .1); if (state.endingTime >= 9) state.phase = 'complete'; return }
  if (state.phase !== 'playing') return
  const duration = clamp(seconds, 0, .1), steps = Math.max(1, Math.ceil(duration / (1 / 90))), dt = duration / steps
  for (let n = 0; n < steps; n++) {
    state.elapsed += dt
    state.yaw += input.turn * dt * 1.45
    state.pitch = clamp(state.pitch + input.pitch * dt, -.95, .95)
    const boosting = input.boost && state.energy > .02 && (input.forward !== 0 || input.strafe !== 0 || input.lift !== 0)
    state.energy = clamp(state.energy + dt * (boosting ? -.19 : .12), 0, 1)
    const speed = input.brake ? 3 : boosting ? 29 : 15
    const x = -Math.sin(state.yaw) * Math.cos(state.pitch) * input.forward + Math.cos(state.yaw) * input.strafe
    const y = Math.sin(state.pitch) * input.forward + input.lift
    const z = -Math.cos(state.yaw) * Math.cos(state.pitch) * input.forward - Math.sin(state.yaw) * input.strafe
    const normal = Math.max(1, Math.hypot(x, y, z)), ease = 1 - Math.exp(-dt * (input.brake ? 12 : 5))
    state.velocity.x += (x / normal * speed - state.velocity.x) * ease
    state.velocity.y += (y / normal * speed - state.velocity.y) * ease
    state.velocity.z += (z / normal * speed - state.velocity.z) * ease
    const next = {x: state.position.x + state.velocity.x * dt, y: state.position.y + state.velocity.y * dt, z: state.position.z + state.velocity.z * dt}
    const hit = obstacles.some(o => next.y < o.height + .8 && Math.abs(next.x - o.x) < o.width / 2 + .8 && Math.abs(next.z - o.z) < o.depth / 2 + .8)
    if (hit) {
      if (Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) > 7) state.collisions++
      state.velocity.x *= -.3; state.velocity.z *= -.3; state.velocity.y *= -.3
    } else {
      state.position = {x: clamp(next.x, -48, 48), y: clamp(next.y, 3, 51), z: clamp(next.z, -351, 48)}
    }
    checkObjectives(state, dt)
    if (state.phase !== 'playing') break
  }
}

function checkObjectives(state: Flight, dt: number) {
  if (state.chapter === 0) {
    PACKETS.forEach((p, i) => {
      if (!has(state.packets, i) && distance(state.position, p) < 4.4) {
        state.packets |= 1 << i
      }
    })
    if (state.packets === 255 && distance(state.position, MEMORY_EXIT) < 6) {
      state.chapter = 1
    }
  } else if (state.chapter === 1) {
    // Entering a ring latches its work. It keeps running after the player leaves;
    // only one branch's 16 lanes execute at a time, with any other work queued.
    BRANCHES.forEach((p, i) => {
      if (state.branches[i] === 0 && distance(state.position, p) < 6) {
        state.branches[i] = Number.EPSILON
      }
    })
    const running = state.branches[state.branch] > 0 && state.branches[state.branch] < 1
      ? state.branch : state.branches.findIndex(p => p > 0 && p < 1)
    if (running >= 0) {
      state.branch = running
      state.branches[running] = Math.min(1, state.branches[running] + dt / .8)
    }
    if (state.branches.every(p => p >= 1) && distance(state.position, BRANCH_EXIT) < 6) {
      state.chapter = 2
    }
  } else {
    FRAGMENTS.forEach((p, i) => {
      if (!has(state.fragments, i) && distance(state.position, p) < 4.8) {
        state.fragments |= 1 << i
      }
    })
    if (state.fragments === 7 && distance(state.position, DISPLAY) < 7) {
      state.phase = 'ending'; state.endingTime = 0; state.velocity = {x: 0, y: 0, z: 0}
    }
  }
}

