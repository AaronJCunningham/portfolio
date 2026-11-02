// Berlin Ringbahn geography. © OpenStreetMap contributors, ODbL 1.0.
// Preserve the legacy GEO interface without parsing a city-sized JavaScript literal.
import { loadCompressedJson } from './compressed-data.js';
import { BERLIN_DATA_PROMISE } from './berlin-geodata.js';
const [grid, berlin] = await Promise.all([
  loadCompressedJson(new URL('../data/berlin-grid.json.gz', import.meta.url)),
  BERLIN_DATA_PROMISE
]);
if (grid.city !== 'Berlin' || !grid.roadGraph || !Array.isArray(grid.roadGraph.nodes)) {
  throw new Error('Invalid Berlin road geography.');
}
export const GEO = grid;
GEO.berlin = berlin;
