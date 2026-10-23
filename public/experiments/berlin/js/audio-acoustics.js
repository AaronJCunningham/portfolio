// Cheap outdoor obstruction using the same static building bounds as movement. Nearby bounds are cached;
// only audible voices trace them, a few times per second. This deliberately avoids mesh raycasts or audio-rate DSP.
function thickness(c, ax, ay, az, bx, by, bz) {
  let minX = c.minX, maxX = c.maxX, minZ = c.minZ, maxZ = c.maxZ;
  if (c.obb) {
    const o = c.obb;
    const x0 = ax - o.cx, z0 = az - o.cz, x1 = bx - o.cx, z1 = bz - o.cz;
    ax = x0 * o.cs - z0 * o.sn; az = x0 * o.sn + z0 * o.cs;
    bx = x1 * o.cs - z1 * o.sn; bz = x1 * o.sn + z1 * o.cs;
    minX = -o.hx; maxX = o.hx; minZ = -o.hz; maxZ = o.hz;
  }
  const minY = c.minY ?? 0, maxY = c.maxY;
  // A chase camera can briefly enter a conservative collision box. Do not silence the entire city in that case.
  if (ax > minX && ax < maxX && az > minZ && az < maxZ && ay > minY && ay < maxY) return 0;
  if (bx > minX && bx < maxX && bz > minZ && bz < maxZ && by > minY && by < maxY) return 0;
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let enter = 0, exit = 1;
  if (Math.abs(dx) < 1e-7) {
    if (ax <= minX || ax >= maxX) return 0;
  } else {
    const a = (minX - ax) / dx, b = (maxX - ax) / dx;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
  }
  if (Math.abs(dz) < 1e-7) {
    if (az <= minZ || az >= maxZ) return 0;
  } else {
    const a = (minZ - az) / dz, b = (maxZ - az) / dz;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
  }
  if (Math.abs(dy) < 1e-7) {
    if (ay <= minY || ay >= maxY) return 0;
  } else {
    const a = (minY - ay) / dy, b = (maxY - ay) / dy;
    enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
  }
  return Math.max(0, exit - enter) * Math.hypot(dx, dy, dz);
}

class CityAcoustics {
  constructor(controllerManager) {
    this.controllers = controllerManager;
    this.buildings = [];
    this.nextRefresh = 0;
    this.x = Infinity;
    this.z = Infinity;
  }

  update(listener, now) {
    if (now < this.nextRefresh && Math.hypot(listener.x - this.x, listener.z - this.z) < 20) return;
    this.x = listener.x; this.z = listener.z;
    this.nextRefresh = now + 0.5;
    this.buildings.length = 0;
    // Obstructions near the listener dominate street-level sound; distant geometry need not join this cache.
    for (const c of this.controllers.nearColliders(this.x, this.z, 200)) {
      if (c.maxY > 3 && c.maxX - c.minX > 2 && c.maxZ - c.minZ > 2) this.buildings.push(c);
    }
  }

  obstruction(source, listener, height = 0) {
    const dx = source.x - listener.x, dz = source.z - listener.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 3) return 0;
    const sideX = -dz / distance * 0.9, sideZ = dx / distance * 0.9;
    let blocked = 0;
    // A small aperture smooths corners: one centre path and two neighbouring paths approximate partial cover.
    for (let ray = -1; ray <= 1; ray++) {
      const ox = sideX * ray, oz = sideZ * ray;
      let depth = 0;
      for (const c of this.buildings) {
        depth = Math.max(depth, thickness(c, listener.x + ox, listener.y, listener.z + oz,
          source.x + ox, source.y + height, source.z + oz));
        if (depth > 10) break;
      }
      blocked += 1 - Math.exp(-depth * 0.45);
    }
    return blocked / 3;
  }
}

export { CityAcoustics };
