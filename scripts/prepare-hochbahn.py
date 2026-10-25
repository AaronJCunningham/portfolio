"""Extract the shared U1/U3 Hochbahn from cached public OSM route relations.

Inputs: .cache/berlin-hochbahn/{u1-west,u1-east,kottbusser-platform,u3}.json
Download URLs and hashes are retained in the small public dataset. No change
to the approved building database or to the separate geometry trial.
"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/berlin-hochbahn'
PUBLIC = ROOT / 'public/experiments/berlin'
SOURCES = [('u1-west', 2669206, True), ('u1-east', 2669205, True),
           ('kottbusser-platform', 7030144, True), ('u3', 2669208, True)]
elements, sources = {}, []
for file, rid, full in SOURCES:
    raw = (CACHE / f'{file}.json').read_bytes()
    sources.append({'url': f'https://api.openstreetmap.org/api/0.6/relation/{rid}' + ('/full.json' if full else '.json'),
                    'sha256': hashlib.sha256(raw).hexdigest()})
    for e in json.loads(raw)['elements']:
        elements[(e['type'], e['id'])] = e

def project(node):
    return [round((node['lon'] - 13.405) * 111319.49 * math.cos(math.radians(52.52)), 2),
            round((52.52 - node['lat']) * 111319.49, 2)]

def points(ids):
    return [project(elements[('node', nid)]) for nid in ids]

routes, way_ids = [], set()
for rid in [2669206, 2669205]:
    rel = elements[('relation', rid)]
    ways = [elements[('way', m['ref'])] for m in rel['members'] if m['type'] == 'way' and not m['role']]
    ways = [w for w in ways if w.get('tags', {}).get('railway') == 'subway'
            and w.get('tags', {}).get('tunnel', 'no') == 'no']
    ids = []
    for i, way in enumerate(ways):
        nodes = list(way['nodes'])
        if not ids:
            if len(ways) > 1 and nodes[0] in ways[1]['nodes']:
                nodes.reverse()
            ids.extend(nodes)
        else:
            if nodes[-1] == ids[-1]:
                nodes.reverse()
            assert nodes[0] == ids[-1], f'Unjoined route at way {way["id"]}'
            ids.extend(nodes[1:])
        way_ids.add(way['id'])
    pts = points(ids)
    if pts[0][0] > pts[-1][0]:
        pts.reverse()
    routes.append({'relation': rid, 'wayIds': [w['id'] for w in ways], 'points': pts})

u3_ways = {m['ref'] for m in elements[('relation', 2669208)]['members'] if m['type'] == 'way' and not m['role']}
assert set(routes[0]['wayIds']) - {345088360, 807043957} <= u3_ways, 'U3 shares the viaduct; only the terminal track differs'

names = ['Warschauer Straße', 'Schlesisches Tor', 'Görlitzer Bahnhof', 'Kottbusser Tor',
         'Prinzenstraße', 'Hallesches Tor', 'Möckernbrücke', 'Gleisdreieck']
stations = {name: {'name': name, 'stops': [], 'platforms': []} for name in names}
seen = set()
for rid in [2669206, 2669205, 2669208]:
    name = None
    for member in elements[('relation', rid)]['members']:
        e = elements[(member['type'], member['ref'])]
        if member['role'].startswith('stop'):
            name = e.get('tags', {}).get('name')
            if name in stations:
                stations[name]['stops'].append(project(e))
        if member['role'].startswith('platform') and name in stations:
            key = (e['type'], e['id'])
            if key in seen:
                continue
            seen.add(key)
            if e['type'] == 'way':
                rings = [('outer', points(e['nodes']))]
            else:
                rings = [(m['role'], points(elements[('way', m['ref'])]['nodes'])) for m in e['members']]
            outer = [p for role, p in rings if role == 'outer']
            assert len(outer) == 1
            stations[name]['platforms'].append({'osmId': f'{e["type"][0]}{e["id"]}', 'ring': outer[0],
                'holes': [p for role, p in rings if role == 'inner']})

data = {
    'meta': {'name': 'U1 / U3 elevated railway', 'license': 'ODbL-1.0',
        'attribution': '© OpenStreetMap contributors', 'origin': [13.405, 52.52],
        'sources': sources, 'routes': ['https://www.bvg.de/de/verbindungen/linienuebersicht/u1',
                                    'https://www.bvg.de/de/verbindungen/linienuebersicht/u3'],
        'structureReference': 'https://www.radbahn.berlin/en/reallabor/testfeld',
        'scope': 'Warschauer Straße to the tunnel ramp west of Gleisdreieck; underground segments omitted.',
        'dimensions': 'Mapped track centre lines and platform outlines; simplified structural sections and vertical profile. Oberbaum deck height matches the existing landmark.'},
    'tracks': routes, 'stations': list(stations.values()),
    'terminalTracks': [{'osmId': f'w{wid}', 'points': points(elements[('way', wid)]['nodes'])}
        for wid in sorted(u3_ways - way_ids) if ('way', wid) in elements
        and elements[('way', wid)].get('tags', {}).get('tunnel', 'no') == 'no'
        and all(p[0] > 2800 and 1400 < p[1] < 2000 for p in points(elements[('way', wid)]['nodes']))],
    # These existing generic building/roof masses describe the same structures.
    # Their source records stay intact; only rendering is replaced by the viaduct.
    'replacedBuildingIds': ['w335239790', 'w291310007', 'w12770220',
        'w43704344', 'w345088322', 'w288514441', 'w738323475', 'w311559051',
        'w37739169', 'w382253029', 'w382253030', 'w538716777', 'w16110464', 'w167972418'],
}
encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
(PUBLIC / 'data/hochbahn.json').write_text(encoded + '\n')
(PUBLIC / 'js/hochbahn-data.js').write_text('// Generated by scripts/prepare-hochbahn.py; OSM / ODbL-1.0.\nexport const HOCHBAHN = ' + encoded + ';\n')
print(f'{len(way_ids)} mapped track ways, {len(stations)} stations, '
      f'{sum(len(s["platforms"]) for s in stations.values())} platforms; {len(encoded.encode())} bytes')
