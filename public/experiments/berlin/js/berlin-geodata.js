// Exact approved city database, shared with the downloadable ODbL export.
import { loadCompressedJson } from './compressed-data.js';
export const BERLIN_DATA_PROMISE = loadCompressedJson(new URL('../data/berlin.json.gz', import.meta.url)).then(data => {
  if (!data.meta || !Array.isArray(data.buildings) || data.buildings.length !== data.meta.counts?.buildings ||
      !Array.isArray(data.roads) || !Array.isArray(data.trees)) throw new Error('Invalid Berlin city data.');
  return data;
});
