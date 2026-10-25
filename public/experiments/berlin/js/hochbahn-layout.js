// Metres in the simulator's existing x-east / z-south frame. Track and platform
// positions are mapped; this lightweight vertical profile is a visual model.
const PROFILE = [[-2659, 0.3], [-2370, 14.2], [-2050, 14.2], [-1550, 8.8],
  [-950, 7.5], [1500, 6.2], [2450, 6.2], [2670, 8], [2714, 10.2], [2850, 10.2], [3000, 9.4]];

export function railHeight(x) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [a, h0] = PROFILE[i - 1], [b, h1] = PROFILE[i];
    if (x <= b) return h0 + (h1 - h0) * Math.max(0, Math.min(1, (x - a) / (b - a)));
  }
  return PROFILE.at(-1)[1];
}

export function resampleTrack(points, spacing = 8) {
  const out = [];
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    const steps = Math.ceil(length / spacing);
    for (let j = 0; j < steps; j++) out.push({ x: a[0] + dx * j / steps, z: a[1] + dz * j / steps, s: distance + length * j / steps });
    distance += length;
  }
  const end = points.at(-1);
  out.push({ x: end[0], z: end[1], s: distance });
  return out;
}

export function nearestTrackPoint(points, x, z) {
  let best = null, d2 = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz;
    if (l2 < 0.0001) continue;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    const px = a[0] + dx * t, pz = a[1] + dz * t, d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < d2) { d2 = d; best = { x: px, z: pz, ux: dx / Math.sqrt(l2), uz: dz / Math.sqrt(l2), distance: Math.sqrt(d) }; }
  }
  return best;
}

export function onOberbaumDeck(x, z) {
  const dx = x - 2752.094, dz = z - 2031.748;
  const c = Math.cos(2.482), s = Math.sin(2.482);
  const localX = c * dx - s * dz, localZ = s * dx + c * dz;
  return localX > -23 && localX < -2 && localZ > -75 && localZ < 121;
}

export function platformFrame(ring) {
  const points = ring.slice(0, -1);
  const x = points.reduce((s, p) => s + p[0], 0) / points.length;
  const z = points.reduce((s, p) => s + p[1], 0) / points.length;
  let xx = 0, zz = 0, xz = 0;
  for (const p of points) { xx += (p[0] - x) ** 2; zz += (p[1] - z) ** 2; xz += (p[0] - x) * (p[1] - z); }
  const angle = Math.atan2(2 * xz, xx - zz) / 2, ux = Math.cos(angle), uz = Math.sin(angle);
  const along = points.map(p => (p[0] - x) * ux + (p[1] - z) * uz);
  const across = points.map(p => -(p[0] - x) * uz + (p[1] - z) * ux);
  return { x, z, ux, uz, min: Math.min(...along), max: Math.max(...along), width: Math.max(...across) - Math.min(...across) };
}
