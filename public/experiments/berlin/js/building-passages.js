import { ADALBERT_PASSAGE_PARTS } from './building-passage-data.js';

// This is a ground-level road through the NKZ, not an underground tunnel.
// Source: https://www.openstreetmap.org/way/65425836 (maxheight=4).
export function isSurfaceRoad(road) {
  return !road.tunnel || road.id === 'w65425836';
}

export function connectBuildingPassage(graph, roads) {
  const road = roads.find(r => r.id === 'w65425836');
  if (!graph || !road) return graph;
  const endpoint = (x, z) => {
    for (let i = 0; i < graph.nodes.length; i += 2) {
      if (Math.abs(graph.nodes[i] - x) < 0.01 && Math.abs(graph.nodes[i + 1] - z) < 0.01) return i / 2;
    }
    return -1;
  };
  const a = endpoint(road.pts[0], road.pts[1]), b = endpoint(...road.pts.slice(-2));
  const name = graph.names.indexOf(road.name);
  if (a < 0 || b < 0 || name < 0 || graph.links.some(link => (link[0] === a && link[1] === b) || (link[0] === b && link[1] === a))) return graph;
  return { ...graph, links: [...graph.links, [a, b, name, road.width, road.lanes, 0, road.pts.slice(2, -2)]] };
}

export function* buildingsWithPassages(buildings) {
  for (const source of buildings) {
    const parts = ADALBERT_PASSAGE_PARTS[source.id];
    if (!parts) { yield source; continue; }
    for (const [i, part] of parts.entries()) {
      yield { ...source, ...part, id: `${source.id}:passage:${i}`,
        styleSeed: source.styleSeed || source.id, part: true, buildingPassage: true };
    }
  }
}
