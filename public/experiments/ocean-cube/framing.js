// Fit a sphere around the rotating cube, including wave displacement, within
// the narrower field of view. Using the scene's size also handles short phones.
export function getFittedDistance(width, height, verticalFov = 34) {
  const verticalHalfFov = verticalFov * Math.PI / 360;
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(width, 1) / Math.max(height, 1));
  return 3.7 / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)) * 1.08;
}
