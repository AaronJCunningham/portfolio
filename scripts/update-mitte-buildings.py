"""Update the live simulator's simple buildings from Berlin LoD2.

No mesh/texture assets are added. The existing renderer still consumes its usual
footprint, height and optional mapped colour. Trial files are never written.
Run with .cache/berlin-mitte/venv/bin/python. --ringbahn extends the approved
Mitte result to the remaining Ringbahn interior, preserving Mitte verbatim.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import gzip,json,math,urllib.request,zipfile,sys,re,time
import xml.etree.ElementTree as ET
from collections import Counter
from pyproj import Transformer
from shapely.geometry import Polygon,MultiPolygon,box,mapping,shape
from shapely.ops import unary_union,transform
from shapely.strtree import STRtree
from shapely import make_valid

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public/experiments/berlin'
CACHE=ROOT/'.cache/berlin-mitte'
LIVE=CACHE/'live';LIVE.mkdir(parents=True,exist_ok=True)
ringbahn='--ringbahn' in sys.argv
scope='ringbahn' if ringbahn else 'mitte'
source_file=LIVE/('ringbahn-before.json.gz' if ringbahn else 'berlin-before.json.gz')
if not source_file.exists():source_file.write_bytes((PUBLIC/'data/berlin.json.gz').read_bytes())
data=json.loads(gzip.decompress(source_file.read_bytes()))
if ringbahn:assert data['meta'].get('mitteBuildingUpdate'),'Run the approved Mitte conversion first.'
if not ringbahn and '--apply' in sys.argv:
 current=json.loads(gzip.decompress((PUBLIC/'data/berlin.json.gz').read_bytes()))
 assert not current['meta'].get('ringbahnBuildingUpdate'),'Use --ringbahn to preserve the completed Ringbahn expansion.'
ring=lambda flat:list(zip(flat[::2],flat[1::2]))
def polys(p):
 if p.geom_type=='Polygon':return [p]
 return [q for g in getattr(p,'geoms',[]) for q in polys(g)]
def polygon(b):
 return make_valid(Polygon(ring(b['ring']),[ring(h) for h in b.get('holes',[])]))
area_record=next(a for a in data['meta']['areas'] if a['id']=='mitte')
mitte_area=unary_union([polygon(p) for p in area_record['polygons']])
area=unary_union([polygon(p) for p in data['meta']['ringbahn']['polygons']]).difference(mitte_area) if ringbahn else mitte_area
preserved_mitte=[b for b in data['buildings'] if b.get('accuracyArea')=='mitte']
locked_source_ids={ident for b in preserved_mitte for ident in b.get('sourceBuildingIds',[])} if ringbahn else set()
landmark_text=(PUBLIC/'js/landmarks.js').read_text()
protected_ids={ident for block in re.findall(r'sourceIds:\s*\[([^]]+)\]',landmark_text) for ident in re.findall(r"['\"]([wr]\d+)['\"]",block)} if ringbahn else set()
factor=111319.49*math.cos(math.radians(52.52))
to_utm=Transformer.from_crs(4326,25833,always_xy=True)
from_utm=Transformer.from_crs(25833,4326,always_xy=True)
def world(x,y):
 lon,lat=from_utm.transform(x,y)
 return (lon-13.405)*factor,(52.52-lat)*111319.49
region=transform(lambda x,z:to_utm.transform(13.405+x/factor,52.52-z/111319.49),area)
b=region.bounds
names=[f'LoD2_{x}_{y}.zip' for x in range(int(b[0]//1000),int(b[2]//1000)+1) for y in range(int(b[1]//1000),int(b[3]//1000)+1) if region.intersects(box(x*1000,y*1000,(x+1)*1000,(y+1)*1000))]
print(f'{scope}: {len(names)} source tiles, {sum((CACHE/n).exists() for n in names)} already cached',flush=True)
def fetch(name):
 p=CACHE/name
 if not p.exists():
  for attempt in range(3):
   try:
    with urllib.request.urlopen('https://gdi.berlin.de/data/a_lod2/atom/'+name,timeout=60) as response:content=response.read()
    assert content[:2]==b'PK',name
    part=p.with_suffix('.part');part.write_bytes(content)
    with zipfile.ZipFile(part) as archive:assert archive.testzip() is None,name
    part.replace(p)
    print('Downloaded',name,flush=True)
    break
   except Exception:
    if attempt==2:raise
    time.sleep(1+attempt)
 return {'file':name,'url':'https://gdi.berlin.de/data/a_lod2/atom/'+name,'sha256':sha256(p.read_bytes()).hexdigest()}
with ThreadPoolExecutor(max_workers=3) as pool:sources=list(pool.map(fetch,names))
NS={'b':'http://www.opengis.net/citygml/building/1.0','g':'http://www.opengis.net/gml','c':'http://www.opengis.net/citygml/1.0'}
GID='{'+NS['g']+'}id'
source_cache=LIVE/('ringbahn-official-footprints.json.gz' if ringbahn else 'official-footprints.json.gz')
if source_cache.exists():official=json.loads(gzip.decompress(source_cache.read_bytes()))
else:
 official=[];seen=set()
 for name in names:
  with zipfile.ZipFile(CACHE/name) as archive:
   xml=next(n for n in archive.namelist() if n.endswith(('.gml','.xml')))
   with archive.open(xml) as stream:
    for _,member in ET.iterparse(stream,events=['end']):
     if member.tag!='{'+NS['c']+'}cityObjectMember':continue
     parent=member.find('b:Building',NS)
     if parent is None:member.clear();continue
     parent_id=parent.get(GID);parts=[]
     for element in [parent,*parent.findall('.//b:BuildingPart',NS)]:
      ident=element.get(GID)
      if ident in seen or ident in locked_source_ids:continue
      seen.add(ident);grounds=[];walls=[];all_y=[]
      for bounded in element.findall('b:boundedBy',NS):
       surface=next(iter(bounded),None)
       if surface is None:continue
       kind=surface.tag.split('}')[-1]
       for poly in surface.findall('.//g:Polygon',NS):
        rings=[]
        for r in [poly.find('g:exterior/g:LinearRing',NS),*poly.findall('g:interior/g:LinearRing',NS)]:
         if r is None:continue
         values=list(map(float,r.findtext('g:posList',namespaces=NS).split()))
         points=list(zip(values[::3],values[1::3],values[2::3]));rings.append(points)
         all_y.extend(p[2] for p in points)
        if kind=='GroundSurface' and rings:
         p=make_valid(Polygon([(x,y) for x,y,_ in rings[0]], [[(x,y) for x,y,_ in h] for h in rings[1:]]))
         grounds.extend((g,min(p[2] for p in rings[0])) for g in polys(p) if g.area>=7)
        if kind=='WallSurface' and rings:walls.append((min(p[2] for p in rings[0]),max(p[2] for p in rings[0])))
      if grounds and all_y:parts.append((ident,grounds,walls,min(all_y),max(all_y)))
     base=min((g[1] for _,gs,_,_,_ in parts for g in gs),default=0)
     for ident,gs,walls,low,high in parts:
      for p,bottom in gs:
       if not region.intersects(p):continue
       # Use the actual wall top for a simple mass; no roof polygons or fittings.
       wall_top=max((hi for lo,hi in walls if lo<=bottom+.3),default=high)
       wp=transform(world,p)
       if not area.covers(wp.representative_point()):continue
       official.append({'id':ident,'parent':parent_id,'tile':name,'shape':mapping(wp),'base':round(max(0,bottom-base),2),'h':round(max(.5,wall_top-base),2),'date':parent.findtext('c:creationDate',default='',namespaces=NS)})
     member.clear()
  print('Parsed',name,flush=True)
 source_cache.write_bytes(gzip.compress(json.dumps(official,separators=(',',':')).encode(),mtime=0))
# Merge adjoining official pieces at practically the same height. The result is
# still a plain footprint extrusion, never the detailed LoD2 surface mesh.
from collections import defaultdict
groups=defaultdict(list)
for o in official:
 if o['base']<=1.5:groups[(o['parent'],round(o['h']))].append(o)
originals=data['buildings'];old_shapes=[polygon(b) for b in originals];old_tree=STRtree(old_shapes)
updated=[];stats=Counter();changes=[]
def flatten(coords,precision=2):return [round(v,precision) for xy in list(coords)[:-1] for v in xy]
references={'DEBE01YYK00002jD':('#dcd6c4','KW published facade reference'),'DEBE01YYK00005tt':('#765044','Former Jewish girls school published facade reference')}
for (parent,_),members in groups.items():
 source_shapes=[shape(o['shape']) for o in members]
 outline=unary_union(source_shapes).simplify(.6,preserve_topology=True)
 for segment,p in enumerate(polys(outline)):
  if p.area<7:continue
  if ringbahn and not area.covers(p.representative_point()):continue
  weights=[p.intersection(q).area for q in source_shapes]
  total=sum(weights)
  if not total:continue
  h=round(sum(o['h']*w for o,w in zip(members,weights))/total,2)
  if h<1:continue
  candidates=[]
  for index in old_tree.query(p):
   b=originals[index]
   if ringbahn and b.get('accuracyArea')=='mitte':continue
   if b.get('minHeight',0)>1.5:continue
   overlap=p.intersection(old_shapes[index]).area
   if overlap>max(2,min(p.area,old_shapes[index].area)*.3):candidates.append((overlap/max(p.area,old_shapes[index].area),int(index),overlap))
  match=max(candidates,default=None)
  old=originals[match[1]] if match else {}
  if old.get('id') in protected_ids:
   stats['landmarkVolumesSkipped']+=1
   continue
  source_ids=[o['id'] for o,w in zip(members,weights) if w>1]
  ident='lod2:'+source_ids[0]+':'+str(segment)
  b={'id':ident,'ring':flatten(p.exterior.coords),'holes':[flatten(r.coords) for r in p.interiors if Polygon(r).area>=4], 'h':h,'roofHeight':0,'roofShape':'flat','levels':max(1,round(h/3.5)),'name':old.get('name',''),'kind':old.get('kind','yes'),'heightSource':'Berlin LoD2 wall height','accuracyArea':scope,'geometrySource':'Berlin LoD2','sourceBuildingIds':source_ids,'sourceParent':parent}
  if old:
   b['osmId']=old['id'];b['styleSeed']=old['id']
   # Keep mapped floor counts when they describe this same mass, rather than
   # applying the parent house's five floors to a two-storey courtyard wing.
   if old['heightSource']=='building:levels' and match[0]>.75 and abs(h-old['h'])<4:b['levels']=old['levels']
   if old.get('colour'):b['colour']=old['colour'];b['appearanceSource']='OpenStreetMap building colour'
  if parent in references:
   b['colour'],b['appearanceSource']=references[parent]
   if parent=='DEBE01YYK00002jD' and h<12:b['levels']=2
   if parent=='DEBE01YYK00005tt' and h>15:b['levels']=5
  b['levels']=max(1,round(b['levels']));b['facadeLevels']=b['levels']
  if ringbahn:
   # A few near-touching corners collapse at centimetre precision. Retain more
   # source precision for those outlines without changing their shape or detail.
   for precision in (2,3,4,6,9):
    if precision>2:
     b['ring']=flatten(p.exterior.coords,precision)
     b['holes']=[flatten(r.coords,precision) for r in p.interiors if Polygon(r).area>=4]
    if Polygon(ring(b['ring']),[ring(h) for h in b['holes']]).is_valid:break
   else:raise ValueError('Invalid rounded outline: '+ident)
   if precision>2:stats['precisionRepairs']+=1
  stats['officialVolumes']+=1
  if b.get('colour'):stats['colours']+=1
  updated.append(b)
# Keep unmapped/newer OSM buildings and elevated open structures if the official
# dataset has no corresponding ground footprint. Outside Mitte stays untouched.
new_shapes=[polygon(b) for b in updated];new_tree=STRtree(new_shapes);kept=[]
for record,p in zip(originals,old_shapes):
 if ringbahn and (record.get('accuracyArea')=='mitte' or record['id'] in protected_ids):kept.append(record);continue
 if p.is_empty or not area.covers(p.representative_point()):kept.append(record);continue
 stats['processedExisting']+=1
 overlap=unary_union([new_shapes[i].intersection(p) for i in new_tree.query(p)]).area/max(p.area,1)
 if overlap>=.5:
  stats['replacedExisting']+=1
 else:
  record['accuracyArea']=scope;kept.append(record);stats['retainedUnmatched']+=1
# Append only the new building records; roads, traffic and other map layers are
# reused verbatim, and the runtime uses its existing instancing/streaming path.
data['buildings']=kept+updated
assert len({b['id'] for b in data['buildings']})==len(data['buildings']),'Duplicate building IDs'
if ringbahn:
 assert [b for b in data['buildings'] if b.get('accuracyArea')=='mitte']==preserved_mitte,'Mitte changed'
for record in updated:
 assert record['h']>=1 and math.isfinite(record['h']) and record['facadeLevels']>0
 assert all(len(r)>=6 and len(r)%2==0 and all(math.isfinite(v) for v in r) for r in [record['ring'],*record['holes']])
stats['oldFacadeEdges']=sum((len(b['ring'])+sum(map(len,b['holes'])) )//2 for b in originals)
stats['newFacadeEdges']=sum((len(b['ring'])+sum(map(len,b['holes'])) )//2 for b in data['buildings'])
def canonical(value):
 if isinstance(value,float) and value.is_integer():return int(value)
 if isinstance(value,list):return [canonical(v) for v in value]
 if isinstance(value,dict):return {k:canonical(v) for k,v in value.items()}
 return value
provenance={'scope':'Mitte locality boundary from the existing map','sourceUrl':'https://gdi.berlin.de/data/a_lod2/','license':'dl-de/zero-2-0','sources':sources,'stats':dict(stats),'method':'Simple extrusions of official ground outlines and wall heights. Adjacent pieces within the same rounded one-metre height band are merged. Existing shared facade shaders, instancing and streaming are reused. Unmatched OSM buildings retain their existing geometry.','simplificationMetres':.6,'preservedOutsideMitteSha256':sha256(json.dumps(canonical([b for b in kept if b.get('accuracyArea')!='mitte']),separators=(',',':'),ensure_ascii=False).encode()).hexdigest(),'appearance':'Mapped OSM building colours, plus published KW and school facade references. Other colours remain procedural.'}
if ringbahn:
 def digest(value):return sha256(json.dumps(canonical(value),separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
 provenance.pop('preservedOutsideMitteSha256')
 provenance.update({'scope':'Remaining interior of the existing S41/S42 Ringbahn boundary; approved Mitte buildings preserved verbatim',
  'preservedMitteSha256':digest(preserved_mitte),
  'preservedOtherBuildingsSha256':digest([b for b in kept if b.get('accuracyArea') not in ('mitte','ringbahn')]),
  'preservedMapLayersSha256':{key:digest(value) for key,value in data.items() if key not in ('meta','buildings')},
  'preservedLandmarkIds':sorted(protected_ids),
  'appearance':'Mapped OSM building colours where available. Other colours retain the existing procedural palette.'})
 localities=[(a['id'],unary_union([polygon(p) for p in a['polygons']])) for a in data['meta']['areas'] if a['id']!='mitte']
 by_area={ident:{'officialVolumes':0,'retainedUnmatched':0,'colours':0} for ident,_ in localities}
 for record in data['buildings']:
  if record.get('accuracyArea')!='ringbahn':continue
  point=polygon(record).representative_point()
  ident=next((ident for ident,shape in localities if shape.covers(point)),'boundary')
  counts=by_area.setdefault(ident,{'officialVolumes':0,'retainedUnmatched':0,'colours':0})
  counts['officialVolumes' if record.get('geometrySource')=='Berlin LoD2' else 'retainedUnmatched']+=1
  if record.get('colour'):counts['colours']+=1
 provenance['localities']=by_area
data['meta'][scope+'BuildingUpdate']=provenance
data['meta']['counts']['buildings']=len(data['buildings'])
data['meta']['counts']['buildingParts']=sum(bool(b.get('part')) for b in data['buildings'])
data['meta']['counts']['buildingCourtyards']=sum(bool(b.get('holes')) for b in data['buildings'])
raw=json.dumps(data,separators=(',',':'),ensure_ascii=False).encode()
(LIVE/('ringbahn-updated.json.gz' if ringbahn else 'berlin-updated.json.gz')).write_bytes(gzip.compress(raw,mtime=0))
(LIVE/(scope+'-update-report.json')).write_text(json.dumps(provenance,indent=2))
print(json.dumps(dict(stats)),flush=True)
if '--apply' in __import__('sys').argv:
 (PUBLIC/'data/berlin.json.gz').write_bytes(gzip.compress(raw,mtime=0))
 module=PUBLIC/'js/nyc-geodata.js';text=module.read_text();prefix,payload=text.split('export const GEO = ',1)
 geo=json.loads(payload.split(';\n',1)[0]);geo['berlin']=None
 # Keep each static source file below GitHub's 100 MiB limit. Imports resolve
 # before consumers run; the public GEO object remains exactly the same shape.
 import_line="import { BERLIN_DATA } from './berlin-geodata.js';\n"
 prefix=prefix.replace(import_line,'')
 (PUBLIC/'js/berlin-geodata.js').write_text('export const BERLIN_DATA = '+raw.decode()+';\n')
 module.write_text(prefix+import_line+'export const GEO = '+json.dumps(geo,separators=(',',':'),ensure_ascii=False)+';\nGEO.berlin = BERLIN_DATA;\n')
 manifest_path=PUBLIC/'export-manifest.json';manifest=json.loads(manifest_path.read_text());manifest['dataSha256']=sha256(raw).hexdigest();manifest[scope+'Buildings']={'source':provenance['sourceUrl'],'license':provenance['license'],'stats':dict(stats)};manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
 (PUBLIC/('data/'+scope+'-buildings.json')).write_text(json.dumps(provenance,indent=2)+'\n')
 print('Applied to the existing portfolio simulator.',flush=True)
