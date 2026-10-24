// A bounded sidestep on the existing walking track. No extra rigs, meshes or
// scene-wide collision queries: obstacle checks run only when a car threatens someone.
const HOP_TIME = 0.48;
const smooth = t => t * t * (3 - 2 * t);

export function resetPedestrianReaction(p) {
  p.reaction = null;
  p.reactionCooldown = 0;
  p.reactionAir = 0;
}

// Call after the ordinary track position is written; freeze track progress
// while reacting. Returns true only on the first frame of a new fright.
export function updatePedestrianReaction(p, car, dt, now, clearPath) {
  let started = false;
  if (!p.reaction && car?.active && now >= (p.reactionCooldown || 0)) {
    const dx = p.x - car.x, dz = p.z - car.z;
    // Most of the crowd costs just this squared-distance check.
    if (dx * dx + dz * dz < 625) {
      const speed = Math.hypot(car.vx, car.vz);
      if (speed > 2.5) {
        const fx = car.vx / speed, fz = car.vz / speed;
        const ahead = dx * fx + dz * fz;
        const side = dx * fz - dz * fx;
        if (ahead > -car.halfL - 0.3 && ahead < car.halfL + Math.min(14, speed * 0.65)
          && Math.abs(side) < car.halfW + 1.35) {
          const sign = side < 0 ? -1 : 1;
          // Prefer the side already occupied; never leap across the car's path.
          for (const distance of [2.0, 1.4, 0.85]) {
            const x = fz * sign * distance, z = -fx * sign * distance;
            if (!clearPath(p.x, p.z, p.x + x, p.z + z)) continue;
            p.reaction = { x, z, age: 0, returnTime: 0, heading: Math.atan2(x, z) };
            p.reactionCooldown = now + 5;
            p.v = 0;
            started = true;
            break;
          }
        }
      }
    }
  }
  const r = p.reaction;
  p.reactionAir = 0;
  if (!r) return false;
  r.age += dt;
  const hop = Math.min(1, r.age / HOP_TIME);
  let offset = smooth(hop);
  p.reactionAir = 0.55 * Math.sin(Math.PI * hop);
  // Wait until the car clears the original path before walking back to it.
  const carClear = !car?.active || (p.x - car.x) ** 2 + (p.z - car.z) ** 2 > 49;
  if (r.age > HOP_TIME + 0.8 && carClear) r.returnTime = Math.min(1, r.returnTime + dt / 1.25);
  else if (!carClear) r.returnTime = Math.max(0, r.returnTime - dt * 3);
  offset *= 1 - smooth(r.returnTime);
  p.x += r.x * offset;
  p.z += r.z * offset;
  p.reactionHeading = r.returnTime > 0 ? r.heading + Math.PI : r.heading;
  if (r.returnTime >= 1) p.reaction = null;
  return started;
}
