"""Download four official Berlin LoD2 tiles and prepare a bounded comparison.

Run with .cache/berlin-mitte/venv/bin/python after installing pyproj there.
Source CityGML stays in the ignored cache. No standalone checkout is used.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from datetime import datetime, timezone
import gzip
import json
import math
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pyproj import Transformer
from shapely.geometry import Polygon
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/berlin-mitte'
OUT = ROOT / 'public/experiments/berlin/mitte/data'
BASE = 'https://gdi.berlin.de/data/a_lod2/atom/'
TILES = [f'LoD2_{x}_{y}.zip' for x in (390, 391) for y in (5820, 5821)]
ORIGIN = (391000, 5821000, 32)
NS = {'b': 'http://www.opengis.net/citygml/building/1.0', 'g': 'http://www.opengis.net/gml', 'c': 'http://www.opengis.net/citygml/1.0', 'a': 'urn:oasis:names:tc:ciq:xsdschema:xAL:2.0'}
GID = '{http://www.opengis.net/gml}id'
project = Transformer.from_crs(4326, 25833, always_xy=True)
unproject = Transformer.from_crs(25833, 4326, always_xy=True)
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

def fetch(name):
    target = CACHE / name
    if not target.exists():
        with urllib.request.urlopen(BASE + name, timeout=60) as response:
            data = response.read()
        if not data.startswith(b'PK'):
            raise ValueError(f'{name}: server returned something other than a ZIP archive')
        target.write_bytes(data)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip():
            raise ValueError(f'Invalid archive: {name}')
    return {'file': name, 'url': BASE + name, 'bytes': target.stat().st_size, 'sha256': sha256(target.read_bytes()).hexdigest()}

with ThreadPoolExecutor(max_workers=3) as pool:
    sources = list(pool.map(fetch, TILES))

def points(ring):
    values = [float(v) for v in ring.findtext('g:posList', namespaces=NS).split()]
    assert len(values) % 3 == 0
    pts = [[round(values[i]-ORIGIN[0], 3), round(values[i+2]-ORIGIN[2], 3), round(ORIGIN[1]-values[i+1], 3)] for i in range(0, len(values), 3)]
    return pts[:-1] if pts[0] == pts[-1] else pts

buildings, seen, dates = [], set(), set()
repairs = []

def valid_surfaces(kind, rings, ident):
    # A few source rings cross themselves. Resolve their existing edges in the
    # surface plane; keep valid source surfaces and their vertices untouched.
    edge = rings[0]
    normal = [0.0, 0.0, 0.0]
    for a, b in zip(edge, edge[1:] + edge[:1]):
        normal[0] += (a[1]-b[1])*(a[2]+b[2])
        normal[1] += (a[2]-b[2])*(a[0]+b[0])
        normal[2] += (a[0]-b[0])*(a[1]+b[1])
    axis = max(range(3), key=lambda i: abs(normal[i]))
    if abs(normal[axis]) < 1e-8:
        repairs.append({'building': ident, 'kind': kind, 'action': 'omitted zero-area surface'})
        return []
    dims = [i for i in range(3) if i != axis]
    projected = [[(p[dims[0]], p[dims[1]]) for p in ring] for ring in rings]
    shape = Polygon(projected[0], projected[1:])
    if shape.is_valid:
        return [{'kind': kind, 'rings': rings}]
    fixed = make_valid(shape)
    def polygons(g):
        if g.geom_type == 'Polygon': return [g]
        return [p for child in getattr(g, 'geoms', []) for p in polygons(child)]
    origin = edge[0]
    originals = {(p[dims[0]],p[dims[1]]):p for ring in rings for p in ring}
    def lift(coords):
        lifted = []
        for u, v in list(coords)[:-1]:
            if (u,v) in originals:
                lifted.append(originals[(u,v)])
            else:
                p = [0,0,0]
                p[dims[0]],p[dims[1]] = u,v
                p[axis] = origin[axis] - sum(normal[i]*(p[i]-origin[i]) for i in dims)/normal[axis]
                lifted.append([round(n,6) for n in p])
        return lifted
    result = [{'kind':kind,'rings':[lift(poly.exterior.coords),*[lift(h.coords) for h in poly.interiors]]} for poly in polygons(fixed) if poly.area > 1e-8]
    repairs.append({'building':ident,'kind':kind,'action':'resolved intersecting source edges','pieces':len(result)})
    return result
for tile in TILES:
    with zipfile.ZipFile(CACHE / tile) as archive:
        xml = next(n for n in archive.namelist() if n.endswith(('.xml', '.gml')))
        with archive.open(xml) as stream:
            for _, member in ET.iterparse(stream, events=['end']):
                if member.tag != '{'+NS['c']+'}cityObjectMember':
                    continue
                parent = member.find('b:Building', NS)
                if parent is None:
                    member.clear()
                    continue
                parent_id = parent.get(GID)
                for building in [parent, *parent.findall('.//b:BuildingPart', NS)]:
                    ident = building.get(GID)
                    if ident in seen:
                        continue
                    surfaces = []
                    for bounded in building.findall('b:boundedBy', NS):
                        surface = next(iter(bounded), None)
                        if surface is None:
                            continue
                        kind = surface.tag.split('}')[-1]
                        for poly in surface.findall('.//g:Polygon', NS):
                            exterior = poly.find('g:exterior/g:LinearRing', NS)
                            if exterior is None:
                                continue
                            rings = [points(exterior), *[points(p) for p in poly.findall('g:interior/g:LinearRing', NS)]]
                            if len(rings[0]) >= 3:
                                surfaces.extend(valid_surfaces(kind, rings, ident))
                    if not surfaces:
                        continue
                    allpts = [p for s in surfaces for ring in s['rings'] for p in ring]
                    xs, ys, zs = ([p[i] for p in allpts] for i in range(3))
                    bounds = [min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)]
                    if not (-1000 <= (bounds[0]+bounds[3])/2 <= 1000 and -1000 <= (bounds[2]+bounds[5])/2 <= 1000):
                        continue
                    date = parent.findtext('c:creationDate', default='', namespaces=NS)
                    dates.add(date)
                    address = ' '.join(p.text for p in parent.findall('.//a:ThoroughfareName', NS) + parent.findall('.//a:ThoroughfareNumber', NS) if p.text)
                    height = building.findtext('b:measuredHeight', default='', namespaces=NS)
                    buildings.append({'id': ident, 'parent': parent_id, 'address': address, 'sourceTile': tile, 'sourceDate': date, 'measuredHeight': float(height) if height else None, 'bounds': bounds, 'surfaces': surfaces})
                    seen.add(ident)
                member.clear()

# Terrain is deliberately labelled as interpolation, not a surveyed terrain model.
ground_bins = {}
parent_bounds = {}
for b in buildings:
    if b['parent'] not in parent_bounds:
        parent_bounds[b['parent']] = list(b['bounds'])
    else:
        bounds = parent_bounds[b['parent']]
        for axis in range(3):
            bounds[axis] = min(bounds[axis], b['bounds'][axis])
            bounds[axis+3] = max(bounds[axis+3], b['bounds'][axis+3])
# Roof-level parts must not become terrain samples. Use the lowest base of
# each complete parent building, rather than the bases of individual volumes.
for bounds in parent_bounds.values():
    x, y, z, xx, yy, zz = bounds
    sample = ((x+xx)/2, (z+zz)/2, y)
    key = (math.floor(sample[0]/100), math.floor(sample[1]/100))
    ground_bins.setdefault(key, []).append(sample)

def terrain_height(x, z):
    gx, gz = math.floor(x/100), math.floor(z/100)
    candidates = [p for dx in range(-2,3) for dz in range(-2,3) for p in ground_bins.get((gx+dx,gz+dz), [])]
    if not candidates:
        return 3.0
    nearest = sorted(candidates, key=lambda p: (p[0]-x)**2+(p[1]-z)**2)[:5]
    pairs = [(1/max(25,(px-x)**2+(pz-z)**2),h) for px,pz,h in nearest]
    return round(sum(w*h for w,h in pairs)/sum(w for w,_ in pairs), 3)

terrain = {'step': 25, 'size': 81, 'min': -1000, 'heights': [terrain_height(x,z) for z in range(-1000,1001,25) for x in range(-1000,1001,25)]}
osm = json.loads(gzip.decompress((ROOT/'public/experiments/berlin/data/berlin.json.gz').read_bytes()))
coslat = math.cos(math.radians(52.52))
def map_points(flat):
    lon = [13.405 + flat[i]/(111319.49*coslat) for i in range(0,len(flat),2)]
    lat = [52.52 - flat[i]/111319.49 for i in range(1,len(flat),2)]
    east,north = project.transform(lon,lat)
    return [[round(e-ORIGIN[0],3),round(ORIGIN[1]-n,3)] for e,n in zip(east,north)]
def inside(pts):
    return any(-1000 <= x <= 1000 and -1000 <= z <= 1000 for x,z in pts)

roads, old = [], []
for road in osm['roads']:
    pts = map_points(road['pts'])
    if not road.get('tunnel') and inside(pts):
        roads.append({'id':road['id'],'name':road['name'],'kind':road['kind'],'width':road['width'],'pts':pts})
for b in osm['buildings']:
    pts = map_points(b['ring'])
    if inside(pts):
        old.append({'id':b['id'],'ring':pts,'holes':[map_points(h) for h in b['holes']], 'height':b['h'],'heightSource':b['heightSource'],'minHeight':b.get('minHeight',0)})
areas = {}
for key in ('parks','water'):
    areas[key] = []
    for area in osm[key]:
        if not area.get('ring'):
            continue
        ring = map_points(area['ring'])
        if inside(ring):
            areas[key].append({'ring':ring,'holes':[map_points(h) for h in area.get('holes',[])]})

places = []
for name,lon,lat in [('Rosenthaler Platz',13.4015,52.5299),('Ackerstraße',13.3980,52.5334),('Auguststraße',13.3973,52.5269),('Torstraße',13.3959,52.5302),('Hackescher Markt',13.4024,52.5227)]:
    east,north=project.transform(lon,lat)
    x,z=east-ORIGIN[0],ORIGIN[1]-north
    # Place each view on a mapped street, rather than guessing an entrance.
    nearest = None
    for road in roads:
        if name in ('Ackerstraße', 'Auguststraße', 'Torstraße') and road['name'] != name:
            continue
        if road['kind'] in ('footway','path','steps','cycleway'):
            continue
        for a,b in zip(road['pts'],road['pts'][1:]):
            dx,dz=b[0]-a[0],b[1]-a[1]
            if not dx*dx+dz*dz: continue
            t=max(0,min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)))
            px,pz=a[0]+dx*t,a[1]+dz*t
            d=(px-x)**2+(pz-z)**2
            if nearest is None or d < nearest[0]: nearest=(d,px,pz,dx,dz,road['name'])
    _,x,z,dx,dz,roadname=nearest
    places.append({'name':name,'street':roadname,'position':[round(x,3),terrain_height(x,z),round(z,3)],'direction':[dx/math.hypot(dx,dz),dz/math.hypot(dx,dz)]})

manifest = {'name':'Mitte building accuracy trial', 'areaKm2':4, 'boundsUTM':[390000,5820000,392000,5822000], 'originUTM':ORIGIN, 'crs':'EPSG:25833 + DHHN2016 height', 'sourceDates':sorted(dates), 'downloadedAt':datetime.now(timezone.utc).isoformat(), 'sources':sources, 'license':'Datenlizenz Deutschland – Zero – Version 2.0', 'licenseUrl':'https://www.govdata.de/dl-de/zero-2-0', 'sourceUrl':'https://daten.berlin.de/datensaetze/3d-gebaudemodelle-im-level-of-detail-2-lod-2-3c7c49af', 'buildingParts':len(buildings),'buildings':len({b['parent'] for b in buildings}), 'baselineParts':len(old), 'limitations':['LoD2 roof forms are generalized; façades have no photographic textures or window/door geometry.','Ground between buildings is interpolated from building bases.','The comparison uses neutral extrusions of the existing OSM building data, without invented shopfronts.','The textured mesh source could not be retrieved because its portal and tile endpoints returned maintenance pages.']}
payload={'manifest':manifest,'buildings':buildings,'baseline':old,'roads':roads,'areas':areas,'terrain':terrain,'places':places}
manifest['sourceGeometryRepairs'] = repairs
(CACHE/'surfaces.json').write_text(json.dumps(payload,separators=(',',':'),ensure_ascii=False))
print(json.dumps({'buildings':manifest['buildings'],'parts':len(buildings),'surfaces':sum(len(b['surfaces']) for b in buildings),'sourceMB':round(sum(s['bytes'] for s in sources)/1e6,2),'dates':sorted(dates)}))
