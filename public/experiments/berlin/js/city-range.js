// Ground-level play only needs nearby city cells. Expand the view for flying
// and panoramic cameras so the aerial map stays continuous.
export function cityDrawDistance(altitude, kind) {
  const groundRange = kind === 'buildings' ? 1800 : 1400;
  return Math.min(18000, groundRange + Math.max(0, altitude - 35) * 20);
}

export function cityCellVisible(cell, cameraPosition) {
  const dx = cell.x - cameraPosition.x, dz = cell.z - cameraPosition.z;
  const limit = cityDrawDistance(cameraPosition.y, cell.kind) + cell.r;
  return dx * dx + dz * dz <= limit * limit;
}
