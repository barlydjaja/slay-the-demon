"""Original last-machine and support-drone asset library. Run with Blender 4.5 --background --python.
All dimensions are metres; helper coordinates are game X / up / Z.
Exports vertex-painted, texture-free glTF assets with named animation pivots.
"""
import bpy, math, random, json, os, sys
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
REVIEW = ROOT / 'art/review/machine'
OUT.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)
random.seed(1203)
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

PALETTE.update(stone='607884', stoneLight='8ca0a5', dark='283d48', mortar='374e5a', edge='9ca8a6',
 wood='514037', woodlight='83654c', iron='304653', gold='ab8d52', moss='536e59', cloth='614c61',
 glassBlue='599cac', glassGold='b49a66', glassRed='986574', bone='c6c2a6', black='172c37')
bsdf.inputs['Roughness'].default_value=.79

def prism(m, outline, depth, color, z=0):
 # An extruded architectural silhouette, including actual arch/window openings.
 front=[(x,y,z+depth/2) for x,y in outline];back=[(x,y,z-depth/2) for x,y in outline]
 m.face(front,color);m.face(list(reversed(back)),color,.87)
 for i in range(len(outline)):
  j=(i+1)%len(outline);m.face([front[i],back[i],back[j],front[j]],color,.92)

def relief(m,x,y,z,size=.5,c='gold'):
 # Four-lobed heraldic leaf surrounding a central diamond.
 for i in range(4):
  a=i*math.pi/2;pts=[]
  for dx,dy in [(0,0),(-.22,.38),(0,.8),(.22,.38)]:
   pts.append((x+(dx*math.cos(a)-dy*math.sin(a))*size,y+(dx*math.sin(a)+dy*math.cos(a))*size,z))
  m.face(pts,c)
 m.ellipsoid((x,y,z+.012),(.13*size,.13*size,.035),c,6,3)

PALETTE.update(cloth='272633',clothEdge='4c4859',lining='11131c',bone='b4b4a7',oldbone='737e7b',
 iron='39444e',steel='71808a',rust='75514a',gold='988260',eye='ff516a',black='090d16',skin='5c6667')
bsdf.inputs['Roughness'].default_value=.84

def node(name,parent,pivot=(0,0,0)):
 obj=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(obj);obj.parent=parent;obj.location=xyz(pivot);return obj

bpy.context.preferences.filepaths.save_version = 0
REVIEW = ROOT / 'art/review/machine'
REVIEW.mkdir(parents=True, exist_ok=True)
MAT.name = 'Machine · worn blue enamel and brass'
PALETTE.update(blue='39768e', edge='72a4af', iron='344752', gold='b6a06b', black='101e29', rust='845b48', eye='a4eff7')
bsdf.inputs['Roughness'].default_value=.64

def part(name,parent,pivot,build):
 m=Mesh();build(m);return m.object(name,parent,pivot)

def robot():
 root=asset('robot');pose=node('robot_pose',root);body=node('robot_body',pose,(0,.88,0))
 m=Mesh();m.box((0,1,0),(.93,.88,.63),'blue');m.box((0,1.33,0),(.84,.12,.65),'edge')
 m.box((0,.57,0),(.8,.13,.62),'iron');m.box((0,.96,.33),(.43,.38,.035),'black')
 m.ellipsoid((0,.96,.365),(.145,.145,.035),'gold',12,6)
 for x in [-.32,.32]:
  for y in [.72,1.23]:m.ellipsoid((x,y,.335),(.033,.033,.025),'gold',8,4)
 m.box((-.33,1.08,.323),(.08,.23,.014),'rust');m.box((0,1.06,-.4),(.58,.57,.25),'iron')
 for x in [-.16,0,.16]:m.box((x,1.08,-.535),(.06,.29,.03),'gold')
 m.tube([(0,1.44,0),(0,1.6,0)],[.18,.18],'iron',12);m.object('robot_chest',body,(0,.88,0))
 h=Mesh();h.box((0,1.86,0),(1.37,.88,.84),'blue');h.box((0,2.23,-.01),(1.24,.11,.79),'edge')
 h.box((0,1.58,.405),(1.14,.21,.08),'iron');h.box((0,1.89,.429),(1.11,.45,.09),'black')
 for x in [-.72,.72]:h.ellipsoid((x,1.81,0),(.07,.18,.18),'iron',10,6)
 for x in [-.36,-.18,0,.18,.36]:h.box((x,1.59,.453),(.06,.06,.025),'black')
 h.box((.49,2.15,.44),(.08,.12,.018),'rust');h.tube([(.34,2.24,-.15),(.34,2.59,-.15)],[.025,.025],'iron',8)
 h.ellipsoid((.34,2.61,-.15),(.065,.065,.065),'gold',10,5)
 head=h.object('robot_head',body,(0,1.86,0))
 e=Mesh()
 for x in [-.28,.28]:e.box((x,1.915,.489),(.13,.19,.025),'eye')
 e.object('robot_eyes',head,(0,1.86,0))
 e=Mesh();e.ellipsoid((0,.96,.402),(.065,.065,.02),'eye',12,6);e.object('robot_core',body,(0,.88,0))
 for side,x in [('left',-.28),('right',.28)]:
  m=Mesh();m.ellipsoid((x,.52,0),(.17,.17,.17),'iron',10,5)
  m.box((x,.37,0),(.3,.3,.31),'blue');m.box((x,.18,.1),(.37,.21,.5),'edge');m.box((x,.055,.1),(.38,.06,.51),'iron')
  m.object('robot_leg_'+side,pose,(x,.62,0))
 for side,x in [('left',-.63),('right',.63)]:
  m=Mesh();m.ellipsoid((x,1.23,0),(.16,.16,.16),'iron',10,5);m.box((x,1.06,0),(.29,.42,.35),'blue')
  m.ellipsoid((x,.8,.04),(.16,.16,.16),'iron',10,5);m.box((x,1.18,.19),(.18,.055,.025),'gold')
  arm=m.object('robot_arm_'+side,body,(x,1.28,0))
  if side=='right':
   m=Mesh();m.tube([(x,.8,-.025),(x,.8,.325)],[.05,.05],'iron',8)
   m.box((x,.8,.34),(.43,.13,.1),'gold');m.box((x,.8,.83),(.17,.06,.9),'edge')
   m.tube([(x,.8,1.28),(x,.8,1.52)],[.105,0],'edge',4)
   sword=m.object('robot_sword',arm,(x,.8,.1))
   e=Mesh();e.box((x-.065,.815,.84),(.025,.038,.88),'eye');e.object('robot_blade_glow',sword,(x,.8,.1))
 return root

def drone():
 root=asset('wisp_drone');m=Mesh();m.ellipsoid((0,.12,0),(.22,.16,.28),'blue',12,7)
 m.ellipsoid((0,.14,.22),(.16,.12,.065),'gold',12,6)
 for side in [-1,1]:
  m.tube([(side*.15,.16,0),(side*.38,.2,-.08)],[.035,.025],'iron',8)
  # Closed toroidal rotor guard, with shared vertices after welding (no tube end seams).
  def ringpoint(t,u):
   return (side*.4+(.22+.025*math.cos(u))*math.sin(t), .22+.025*math.sin(u), -.07+(.22+.025*math.cos(u))*math.cos(t))
  for i in range(24):
   for j in range(8):
    t0=i*math.tau/24;t1=(i+1)*math.tau/24;u0=j*math.tau/8;u1=(j+1)*math.tau/8
    m.face([ringpoint(t0,u0),ringpoint(t1,u0),ringpoint(t1,u1),ringpoint(t0,u1)],'gold')
  m.box((side*.4,.22,-.07),(.34,.02,.055),'edge')
 m.object('drone_housing',root)
 e=Mesh();e.ellipsoid((0,.14,.283),(.09,.07,.02),'eye',12,6);e.object('drone_eye',root)
 return root
robot();drone()
# Bevel the metal at authoring time; apply modifiers so runtime geometry matches Blender.
for obj in list(bpy.data.objects):
 if obj.type!='MESH':continue
 import bmesh
 bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
 bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 bevel=obj.modifiers.new('Worn enamel edges','BEVEL');bevel.width=.018;bevel.segments=2;bevel.limit_method='ANGLE'
 bpy.ops.object.modifier_apply(modifier=bevel.name);obj.select_set(False)
glow=MAT.copy();glow.name='Machine · cyan optics';shader=glow.node_tree.nodes.get('Principled BSDF')
shader.inputs['Emission Color'].default_value=rgba('83ddeb');shader.inputs['Emission Strength'].default_value=2.4
for name in ['robot_eyes','robot_core','robot_blade_glow','drone_eye']:bpy.data.objects[name].data.materials[0]=glow
# Measured GLB export, editable source library, and Cycles studio review.
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
bpy.ops.export_scene.gltf(filepath=str(OUT/'last-machine.glb'),export_format='GLB',use_selection=True)
(ROOT/'art/blender/machine-manifest.json').write_text(json.dumps(stats,indent=2))
for i,root in enumerate(ASSETS.values()):root.location=(i*11,0,0)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.shading.color_type='VERTEX';area.spaces.active.region_3d.view_distance=32;area.spaces.active.region_3d.view_location=Vector((14,0,3))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/machine-library.blend'),compress=True)
for root in ASSETS.values():root.location=(0,0,0)
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
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
print('MACHINE_LIBRARY_COMPLETE',len(ASSETS),flush=True)
