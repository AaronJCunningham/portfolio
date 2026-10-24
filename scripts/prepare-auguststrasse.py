"""Bounded 80 m street study. Reuses this portfolio's cached official surfaces."""
from pathlib import Path
import json, math, hashlib
from shapely.geometry import Point, Polygon, LineString, box
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/berlin-mitte'
raw = json.loads((CACHE/'surfaces.json').read_text())
osm = json.loads((CACHE/'references/osm.json').read_text())
project = Transformer.from_crs(4326,25833,always_xy=True)
street = LineString([(60,185.4),(137,163.7)])
region = street.buffer(75,cap_style=2)
parents = {b['parent'] for b in raw['buildings'] if region.intersects(box(b['bounds'][0],b['bounds'][2],b['bounds'][3],b['bounds'][5]))}
raw['buildings'] = [b for b in raw['buildings'] if b['parent'] in parents]
raw['baseline'] = [b for b in raw['baseline'] if region.intersects(Polygon(b['ring'],b['holes']))]
raw['roads'] = [r for r in raw['roads'] if region.intersects(LineString(r['pts']))]
raw['areas'] = {'parks':[], 'water':[]}
base = {}
for b in raw['buildings']: base[b['parent']] = min(base.get(b['parent'],1000),b['bounds'][1])

# Addresses / storey counts are mapped OSM values, separate from appearance.
mapped = []
for e in osm['elements']:
    if e['type']!='way' or e['tags'].get('addr:street')!='Auguststraße': continue
    coords = [project.transform(p['lon'],p['lat']) for p in e['geometry']]
    mapped.append((Polygon([(x-391000,5821000-y) for x,y in coords]),e['tags'],e['id']))

profiles = {
 'DEBE01YYK00002jD': {'kind':'kw','address':'Auguststraße 69','colour':'#dcd6c4','floors':2,'confidence':'Reference-informed colour, two storeys and a simple entrance; window placement is approximate.'},
 'DEBE01YYK00005tt': {'kind':'school','address':'Auguststraße 11–13','colour':'#765044','floors':5,'confidence':'Reference-informed brick colour and window groups; simplified into five storeys.'},
}
fronts=[]
for b in raw['buildings']:
    for s in b['surfaces']:
        if s['kind']!='WallSurface':continue
        pts=s['rings'][0]; low=min(p[1] for p in pts); high=max(p[1] for p in pts)
        if low>base[b['parent']]+.15 or high-low<5:continue
        bottom=[p for p in pts if abs(p[1]-low)<.04]
        if len(bottom)<2:continue
        a,c=max(((a,c) for a in bottom for c in bottom),key=lambda ac:math.hypot(ac[0][0]-ac[1][0],ac[0][2]-ac[1][2]))
        if a[0]>c[0]:a,c=c,a
        dx,dz=c[0]-a[0],c[2]-a[2];length=math.hypot(dx,dz)
        mid=Point((a[0]+c[0])/2,(a[2]+c[2])/2)
        if length<2 or abs(dx*.963+dz*-.271)/length<.97 or street.distance(mid)>14 or not 55<mid.x<141:continue
        if b['parent'] not in profiles:
            poly,tags,ident=min(mapped,key=lambda m:m[0].distance(mid))
            number=tags.get('addr:housenumber','') if poly.distance(mid)<3 else ''
            levels=tags.get('building:levels') if number else None
            profiles[b['parent']]={'kind':'context','address':'Auguststraße '+number if number else 'Adjacent building', 'floors':int(levels) if levels else max(1,round((high-low)/3.6)), 'floorSource':'OpenStreetMap building:levels' if levels else 'Estimated from official height', 'colour':['#bdb6a6','#cdc5b1','#b7bab1','#c9bfae'][len(profiles)%4], 'confidence':'Simplified facade; mapped storeys where available. Colours and window placement are illustrative.'}
        front={'building':b['id'],'parent':b['parent'],'a':a,'b':c,'top':high,'length':length}
        # Outward normal points toward the mapped carriageway, not into houses.
        closest=street.interpolate(street.project(mid));nx,nz=closest.x-mid.x,closest.y-mid.y;d=math.hypot(nx,nz)
        front['normal']=[nx/d,nz/d]
        fronts.append(front)

# Keep inferred side details out of entrances, windows and businesses on the
# rest of Mitte. Only these front planes receive the detail layer.
for b in raw['buildings']:
    b['appearance'] = profiles.get(b['parent'])
    if b['appearance']: b['address']=b['appearance']['address']

# Small, flat-roofed volumes retain surveyed ground outlines and wall heights.
# Appearance is intentionally abstract: the source data controls scale, while
# inexpensive painted facades supply the original simulator's visual language.
volumes=[]
for index,b in enumerate(raw['buildings']):
    ground=[s for s in b['surfaces'] if s['kind']=='GroundSurface' and min(p[1] for p in s['rings'][0])<base[b['parent']]+1.5]
    front=[f for f in fronts if f['building']==b['id']]
    wall_top=max((f['top'] for f in front),default=b['bounds'][4])
    profile=profiles.get(b['parent'])
    for g in ground:
        shape=Polygon([(p[0],p[2]) for p in g['rings'][0]], [[(p[0],p[2]) for p in r] for r in g['rings'][1:]]).simplify(.15,preserve_topology=True)
        if shape.is_empty or shape.area<2 or wall_top-b['bounds'][1]<2:continue
        floors=profile['floors'] if front and profile else max(1,round((wall_top-b['bounds'][1])/3.6))
        source=(profile.get('floorSource','Architectural reference') if profile else 'Estimated from official height') if front else 'Estimated from official height'
        volumes.append({'building':index,'id':b['id'],'parent':b['parent'],'ring':list(shape.exterior.coords)[:-1],'holes':[list(r.coords)[:-1] for r in shape.interiors], 'base':b['bounds'][1], 'top':wall_top,'floors':floors,'floorSource':source,'streetFront':bool(front),'appearance':profile})
raw['simpleVolumes']=volumes

trees=[]
for e in osm['elements']:
    if e['type']=='node' and e['tags'].get('natural')=='tree':
        x,y=project.transform(e['lon'],e['lat']);p=[x-391000,5821000-y]
        if region.contains(Point(p)):trees.append({'position':p,'sourceId':e['id']})

raw['street'] = {'name':'Auguststraße','lengthM':80,'start':[60,185.4],'end':[137,163.7], 'fronts':fronts,'profiles':profiles,'trees':trees,
 'references':[
  {'title':'KW — current visitor page and facade photograph','url':'https://www.kw-berlin.de/de/besuch/information'},
  {'title':'School restoration — architects and detail photographs','url':'https://gruentuchernst.de/projekte/p303/'},
  {'title':'School facade after restoration','url':'https://commons.wikimedia.org/wiki/File:Ehemalige_J%C3%BCdische_M%C3%A4dchenschule_Berlin.jpg'},
  {'title':'Berlin heritage record — Auguststraße 69','url':'https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035057'}],
 'limitations':['Simple flat-roofed forms use official ground outlines and wall heights; this view deliberately simplifies roof shapes.','Mapped floor counts are used where available; other counts are estimated from height.','KW and school colours and main window patterns are reference-informed; neighbouring facades and street props are illustrative.','No reference photographs are redistributed or used as facade textures.']}
raw['places']=[
 {'name':'Along Auguststraße','street':'Auguststraße','position':[67,3,181.5],'direction':[.963,-.270]},
 {'name':'KW · Auguststraße 69','street':'Auguststraße','position':[113,3,172.5],'direction':[.26,-.966]},
 {'name':'Former Jewish girls’ school','street':'Auguststraße','position':[80,3,177],'direction':[-.27,.963]},
]
m=raw['manifest'];m.update({'name':'Auguststraße — 80 m simplified street study','areaKm2':round(region.area/1e6,4),'buildings':len(parents),'buildingParts':len(raw['buildings']),'baselineParts':len(raw['baseline']), 'detailScope':'80 m of Auguststraße; a narrow surrounding block supplies context.'})
m['appearanceReferences']=raw['street']['references'];m['appearanceLimitations']=raw['street']['limitations']
m['osmStreetExtract']={'endpoint':'https://overpass-api.de/api/interpreter','timestamp':osm.get('osm3s',{}).get('timestamp_osm_base'),'sha256':hashlib.sha256((CACHE/'references/osm.json').read_bytes()).hexdigest(),'license':'ODbL-1.0'}
m['sourceGeometryRepairs']=[r for r in m['sourceGeometryRepairs'] if r['building'] in {b['id'] for b in raw['buildings']}]
(CACHE/'surfaces-auguststrasse.json').write_text(json.dumps(raw,separators=(',',':'),ensure_ascii=False))
print(json.dumps({'buildings':len(parents),'parts':len(raw['buildings']),'facadePlanes':len(fronts),'profiles':len(profiles),'mappedTrees':len(trees)}))
