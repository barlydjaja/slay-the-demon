"""Original Firstlight restoration component library. Run with Blender 4.5 --background --python.
All dimensions are metres; helper coordinates are game X / up / Z.
Exports vertex-painted, texture-free glTF assets with named animation pivots.
"""
import bpy, math, random, json, os, sys
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
REVIEW = ROOT / 'art/review/firstlight'
OUT.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)
random.seed(1609)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials): bpy.data.materials.remove(datablock)

def linear(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgba(hex): return tuple(linear(int(hex[i:i+2],16)/255) for i in (0,2,4))+(1,)
PALETTE = dict(wood='755034', woodlight='b28755', bark='64513b', cream='eadbb6', stone='869088', stoneLight='aeb2a2', dark='2f4542', roof='b16343', rooflight='d88e62', teal='447b79', leaf='41744a', leaflight='789b48', leafgold='a6b657', grass='679747', skin='c49976', hair='e6e1c9', eye='ffe298', iron='465658', soil='aa9372', flower='f6d16c', purple='9e86ad')
MAT=bpy.data.materials.new('Creatures · painted cloth bone and iron'); MAT.use_nodes=True
bsdf=MAT.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Roughness'].default_value=.88
vc=MAT.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name='Color'; MAT.node_tree.links.new(vc.outputs['Color'],bsdf.inputs['Base Color'])
MAT.diffuse_color=(.65,.7,.5,1); MAT.use_backface_culling=False
ASSETS={}; stats={}
def xyz(v): return (v[0],-v[2],v[1])
def col(c): return PALETTE.get(c,c)
class Mesh:
 def __init__(self): self.v=[]; self.f=[]; self.c=[]
 def face(self,points,color,shade=1):
  n=len(self.v); self.v.extend(points); self.f.append(tuple(range(n,n+len(points)))); self.c.append((col(color),shade))
 def box(self,p,d,c, yaw=0, tilt=0):
  x,y,z=p; w,h,l=[t/2 for t in d]; verts=[]
  for a,b,k in [(-w,-h,-l),(w,-h,-l),(w,h,-l),(-w,h,-l),(-w,-h,l),(w,-h,l),(w,h,l),(-w,h,l)]:
   b,k=b*math.cos(tilt)-k*math.sin(tilt),b*math.sin(tilt)+k*math.cos(tilt)
   a,k=a*math.cos(yaw)+k*math.sin(yaw),-a*math.sin(yaw)+k*math.cos(yaw)
   verts.append((x+a,y+b,z+k))
  for inds in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]: self.face([verts[i] for i in inds],c,random.uniform(.94,1.04))
 def ellipsoid(self,p,s,c,seg=12,rings=7,noise=0):
  grid=[]
  for j in range(rings+1):
   lat=-math.pi/2+j*math.pi/rings; row=[]
   for i in range(seg):
    a=i*math.tau/seg; n=1 if j in (0,rings) else 1+random.uniform(-noise,noise)
    row.append((p[0]+math.cos(a)*math.cos(lat)*s[0]*n,p[1]+math.sin(lat)*s[1]*n,p[2]+math.sin(a)*math.cos(lat)*s[2]*n))
   grid.append(row)
  for j in range(rings):
   for i in range(seg):
    k=(i+1)%seg
    pts=[grid[j][i],grid[j][k],grid[j+1][k],grid[j+1][i]]
    if j==0: pts=pts[1:]
    if j==rings-1: pts=pts[:3]
    self.face(list(reversed(pts)),c,random.uniform(.91,1.06))
 def tube(self,points,radii,c,sides=7):
  rings=[]
  for i,p in enumerate(points):
   tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
   tangent.normalize(); a=tangent.cross(Vector((0,0,1)))
   if a.length<.01:a=tangent.cross(Vector((1,0,0)))
   a.normalize(); b=tangent.cross(a).normalized()
   rings.append([tuple(Vector(p)+radii[i]*(a*math.cos(t*math.tau/sides)+b*math.sin(t*math.tau/sides))) for t in range(sides)])
  for j in range(len(rings)-1):
   for i in range(sides):self.face([rings[j][i],rings[j][(i+1)%sides],rings[j+1][(i+1)%sides],rings[j+1][i]],c, .92+(i%3)*.055)
  self.face(list(reversed(rings[0])),c);self.face(rings[-1],c)
 def leaf(self,p,size,c,yaw=0):
  x,y,z=p; w,h=size
  raw=[(-w*.5,0,0),(0,h*.42,.08),(w*.5,0,0),(0,h,-.06)]
  pts=[(x+a*math.cos(yaw)+k*math.sin(yaw),y+b,z-a*math.sin(yaw)+k*math.cos(yaw)) for a,b,k in raw]
  self.face([pts[0],pts[1],pts[3]],c,.96);self.face([pts[1],pts[2],pts[3]],c,1.05)
 def merge(self,other,offset=(0,0,0),yaw=0):
  for face,(color,shade) in zip(other.f,other.c):
   pts=[]
   for i in face:
    x,y,z=other.v[i];pts.append((offset[0]+x*math.cos(yaw)+z*math.sin(yaw),offset[1]+y,offset[2]-x*math.sin(yaw)+z*math.cos(yaw)))
   self.face(pts,color,shade)
 def object(self,name,parent=None,pivot=(0,0,0)):
  mesh=bpy.data.meshes.new(name);mesh.from_pydata([xyz((v[0]-pivot[0],v[1]-pivot[1],v[2]-pivot[2])) for v in self.v],[],self.f);mesh.update()
  attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
  for poly,(color,shade) in zip(mesh.polygons,self.c):
   base=rgba(color)
   # Subtle vertex paint variation; lighting and contact shadows remain dynamic.
   for loop in poly.loop_indices: attr.data[loop].color=tuple(min(1,max(0,x*shade)) for x in base[:3])+(1,)
  uv=mesh.uv_layers.new(name='UVMap')
  for poly in mesh.polygons:
   axis=max(range(3),key=lambda i:abs(poly.normal[i]));axes=[i for i in range(3) if i!=axis]
   for li in poly.loop_indices:
    v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v[axes[0]]*.25,v[axes[1]]*.25)
  mesh.materials.append(MAT)
  obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.parent=parent;obj.location=xyz(pivot)
  if parent:
   bpy.context.view_layer.update();obj.location-=parent.matrix_world.translation
  return obj

def asset(name, mesh=None):
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);ASSETS[name]=root
 if mesh:mesh.object(name+'_mesh',root)
 return root


PALETTE.update(copper='b77848', gold='c0a469', black='263b43', steel='657c83')
m=Mesh()
# A toothed sunwheel with a true central aperture and separately shaped spokes.
for i in range(48):
 a=i*math.tau/48;b=(i+1)*math.tau/48;r=.61 if i%4 in [1,2] else .52
 previous=.61 if (i-1)%4 in [1,2] else .52
 if previous!=r:
  m.face([(math.sin(a)*previous,.65+math.cos(a)*previous,-.095),(math.sin(a)*r,.65+math.cos(a)*r,-.095),(math.sin(a)*r,.65+math.cos(a)*r,.095),(math.sin(a)*previous,.65+math.cos(a)*previous,.095)],'copper')
 for z in [-.095,.095]:
  m.face([(math.sin(a)*.36,.65+math.cos(a)*.36,z),(math.sin(a)*r,.65+math.cos(a)*r,z),(math.sin(b)*r,.65+math.cos(b)*r,z),(math.sin(b)*.36,.65+math.cos(b)*.36,z)],'gold')
 m.face([(math.sin(a)*r,.65+math.cos(a)*r,-.095),(math.sin(b)*r,.65+math.cos(b)*r,-.095),(math.sin(b)*r,.65+math.cos(b)*r,.095),(math.sin(a)*r,.65+math.cos(a)*r,.095)],'copper')
 m.face([(math.sin(a)*.36,.65+math.cos(a)*.36,-.095),(math.sin(b)*.36,.65+math.cos(b)*.36,-.095),(math.sin(b)*.36,.65+math.cos(b)*.36,.095),(math.sin(a)*.36,.65+math.cos(a)*.36,.095)],'copper')
for i in range(6):
 a=i*math.tau/6;m.tube([(math.sin(a)*.13,.65+math.cos(a)*.13,0),(math.sin(a)*.39,.65+math.cos(a)*.39,0)],[.045,.055],'copper',6)
m.tube([(math.sin(i*math.tau/32)*.14,.65+math.cos(i*math.tau/32)*.14,0) for i in range(33)],[.037]*33,'steel',6)
asset('sunwheel',m)
m=Mesh();m.tube([(0,.2,-.43),(0,.2,.43)],[.15,.15],'steel',12)
for z in [-.34,.34]:m.tube([(0,.2,z-.035),(0,.2,z+.035)],[.28,.28],'gold',16)
points=[]
for i in range(281):
 a=i*math.tau/20;z=-.27+i*.54/280;points.append((math.sin(a)*.205,.25+math.cos(a)*.205,z))
m.tube(points,[.0175]*len(points),'copper',6)
m.tube([(0,.43,.27),(.22,.55,.35),(.34,.47,.44)],[.023,.023,.023],'copper',7)
asset('winding',m)
bpy.context.view_layer.update()
for name,root in ASSETS.items():
 objects=[o for o in root.children_recursive if o.type=='MESH'];triangles=0;coords=[]
 for o in objects:
  o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
  for v in o.data.vertices:
   p=o.matrix_world@v.co;coords.append(p);assert all(math.isfinite(k) for k in p),name
 lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)]
 assert 0<triangles<30000;stats[name]=dict(triangles=triangles,meshes=len(objects),bounds_blender=[lo,hi]);print('VERIFIED',name,triangles,flush=True)
bpy.ops.object.select_all(action='DESELECT')
for root in ASSETS.values():
 root.select_set(True)
 for obj in root.children_recursive:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'firstlight-kit.glb'),export_format='GLB',use_selection=True)
(ROOT/'art/blender/firstlight-manifest.json').write_text(json.dumps(stats,indent=2))
for i,root in enumerate(ASSETS.values()):root.location=(i*11,0,0)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.shading.color_type='VERTEX';area.spaces.active.region_3d.view_distance=32;area.spaces.active.region_3d.view_location=Vector((14,0,3))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/firstlight-library.blend'),compress=True)
for root in ASSETS.values():root.location=(0,0,0)
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=650;scene.render.resolution_y=650;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.15,.2,.3,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.3;scene.view_settings.view_transform='AgX'
for root in ASSETS.values():
 for o in root.children_recursive:o.hide_render=True
floor=bpy.data.materials.new('Studio backdrop');floor.diffuse_color=(.035,.048,.07,1)
bpy.ops.mesh.primitive_plane_add(size=400);plane=bpy.context.object;plane.data.materials.append(floor)
ld=bpy.data.lights.new('Softbox','AREA');lo=bpy.data.objects.new('Softbox',ld);scene.collection.objects.link(lo);ld.color=(.8,.88,1)
fd=bpy.data.lights.new('Cold rim','AREA');fill=bpy.data.objects.new('Cold rim',fd);scene.collection.objects.link(fill);fd.color=(.4,.66,1)
cd=bpy.data.cameras.new('Monster review');cam=bpy.data.objects.new('Monster review',cd);scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
selection=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for name,root in ASSETS.items():
 if selection and name not in selection:continue
 coords=[o.matrix_world@Vector(v) for o in root.children_recursive if o.type=='MESH' for v in o.bound_box]
 low=Vector([min(p[i] for p in coords) for i in range(3)]);high=Vector([max(p[i] for p in coords) for i in range(3)])
 center=(low+high)*.5;span=max(max(high-low),.5)
 lo.location=center+Vector((-1,-1.6,2))*span;lo.rotation_euler=(center-lo.location).to_track_quat('-Z','Y').to_euler();ld.energy=145*span*span;ld.size=span*.85
 fill.location=center+Vector((1,.5,1.25))*span;fill.rotation_euler=(center-fill.location).to_track_quat('-Z','Y').to_euler();fd.energy=120*span*span;fd.size=span*.8
 plane.location.z=low.z-.025
 for o in root.children_recursive:o.hide_render=False
 for suffix,direction in ([('',(.75,-1.8,.8)),('-front',(0,-2,.3)),('-back',(-.8,1.8,.7))] if name=='reaper' else [('',(.75,-1.8,1.0))]):
  cam.location=center+Vector(direction)*span;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=span*1.23
  scene.render.filepath=str(REVIEW/(name+suffix+'.png'));bpy.ops.render.render(write_still=True)
 for o in root.children_recursive:o.hide_render=True
 print('RENDERED',name,flush=True)
print('FIRSTLIGHT_LIBRARY_COMPLETE',len(ASSETS),flush=True)
