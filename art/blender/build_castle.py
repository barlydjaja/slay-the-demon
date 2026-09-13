"""Original Forgotten Kingdom architectural asset library. Run with Blender 4.5 --background --python.
All dimensions are metres; helper coordinates are game X / up / Z.
Exports vertex-painted, texture-free glTF assets with named animation pivots.
"""
import bpy, math, random, json, os, sys
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
REVIEW = ROOT / 'art/review/castle'
OUT.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)
random.seed(819)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials): bpy.data.materials.remove(datablock)

def linear(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgba(hex): return tuple(linear(int(hex[i:i+2],16)/255) for i in (0,2,4))+(1,)
PALETTE = dict(wood='755034', woodlight='b28755', bark='64513b', cream='eadbb6', stone='869088', stoneLight='aeb2a2', dark='2f4542', roof='b16343', rooflight='d88e62', teal='447b79', leaf='41744a', leaflight='789b48', leafgold='a6b657', grass='679747', skin='c49976', hair='e6e1c9', eye='ffe298', iron='465658', soil='aa9372', flower='f6d16c', purple='9e86ad')
MAT=bpy.data.materials.new('Castle · weathered vertex paint'); MAT.use_nodes=True
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

def archpoints(width,spring,rise,steps=24):
 pts=[]
 for i in range(steps+1):
  x=-width/2+width*i/steps
  y=spring+rise*math.sqrt(max(0,width*width-(abs(x)+width/2)**2))/(math.sqrt(3)*width/2)
  pts.append((x,y))
 return pts

def archband(m,width,spring,rise,thickness,depth,c,z=0):
 inner=archpoints(width,spring,rise);outer=archpoints(width+thickness*2,spring,rise+thickness)
 for i in range(len(inner)-1):
  # Radial wedge stones follow the pointed arch; narrow seams reveal the curvature.
  q=[inner[i],inner[i+1],outer[i+1],outer[i]];cx=sum(x for x,y in q)/4;cy=sum(y for x,y in q)/4
  q=[(cx+(x-cx)*.974,cy+(y-cy)*.987) for x,y in q]
  prism(m,q,depth,c if i%5 else 'stoneLight',z)
 for s in [-1,1]:m.box((s*(width/2+thickness/2),spring/2,z),(thickness,spring,depth),c)

def lathe(m,profile,c,sides=24,x=0,z=0):
 for j in range(len(profile)-1):
  r0,y0=profile[j];r1,y1=profile[j+1]
  for i in range(sides):
   a=i*math.tau/sides;b=(i+1)*math.tau/sides
   m.face([(x+r0*math.sin(a),y0,z+r0*math.cos(a)),(x+r0*math.sin(b),y0,z+r0*math.cos(b)),(x+r1*math.sin(b),y1,z+r1*math.cos(b)),(x+r1*math.sin(a),y1,z+r1*math.cos(a))],c,.95+(i%4)*.025)

def slab(m,x,y,z,w,d,h,c,chamfer=.13):
 # Chamfered octagonal edges, with a chipped corner and a flat walkable top.
 cut=min(w,d)*chamfer;outline=[(-w/2+cut,-d/2),(w/2-cut,-d/2),(w/2,-d/2+cut),(w/2,d/2-cut),(w/2-cut,d/2),(-w/2+cut,d/2),(-w/2,d/2-cut),(-w/2,-d/2+cut)]
 outline=list(reversed(outline))
 lower=[(x+a,y-h,z+b) for a,b in outline];edge=[(x+a,y-.035,z+b) for a,b in outline];top=[(x+a*.965,y,z+b*.965) for a,b in outline]
 m.face(list(reversed(lower)),c,.8);m.face(top,c)
 for i in range(8):
  k=(i+1)%8;m.face([lower[i],lower[k],edge[k],edge[i]],c,.83);m.face([edge[i],edge[k],top[k],top[i]],c,1.08)

def relief(m,x,y,z,size=.5,c='gold'):
 # Four-lobed heraldic leaf surrounding a central diamond.
 for i in range(4):
  a=i*math.pi/2;pts=[]
  for dx,dy in [(0,0),(-.22,.38),(0,.8),(.22,.38)]:
   pts.append((x+(dx*math.cos(a)-dy*math.sin(a))*size,y+(dx*math.sin(a)+dy*math.cos(a))*size,z))
  m.face(pts,c)
 m.ellipsoid((x,y,z+.012),(.13*size,.13*size,.035),c,6,3)

def column_mesh(height=5.8,broken=False):
 m=Mesh();slab(m,0,.24,0,1.75,1.75,.24,'dark');slab(m,0,.43,0,1.5,1.5,.2,'stoneLight')
 lathe(m,[(.67,.42),(.68,.51),(.53,.66),(.48,.82)],'stoneLight',12)
 for i in range(8):
  a=i*math.tau/8;x,z=math.sin(a)*.34,math.cos(a)*.34;top=height-.38
  if broken:top+=random.uniform(-.25,.28)
  m.tube([(x,.7,z),(x,top,z)],[.17,.13],'stone',8)
 if broken:
  m.ellipsoid((0,height-.28,0),(.49,.24,.49),'stoneLight',10,3,.15)
  for i in range(4):
   a=i*1.6;m.tube([(math.sin(a)*.3,height-.15,math.cos(a)*.3),(math.sin(a)*.35,height+.1,math.cos(a)*.35)],[.09,.022],'stoneLight',5)
 else:
  lathe(m,[(.48,height-.5),(.57,height-.35),(.68,height-.22),(.68,height-.08)],'stoneLight',12)
  slab(m,0,height+.13,0,1.6,1.6,.24,'stoneLight')
  for s in [-1,1]:relief(m,s*.43,height-.22,.56,.24,'moss')
 return m

def architecture():
 for k in range(3):
  m=Mesh();slab(m,0,0,0,1.48,1.48,.15,['526b77','4c626d','607680'][k],.04+k*.008)
  if k!=1:
   # Hairline cracks stay beneath the planar puddle surface.
   for points in [[(-.56,.002,-.64),(-.28,.002,-.31),(-.35,.002,-.08),(-.06,.002,.17)],[(-.28,.002,-.31),(.02,.002,-.39)]]:m.tube(points,[.006]*len(points),'mortar',3)
  asset('flagstone_'+str(k),m)
 m=Mesh()
 # The exposed diorama edge is a single weathered rock mass with a dressed lip.
 prism(m,[(-13.5,-.04),(13.5,-.04),(13.8,-.43),(13.35,-1.24),(10.1,-1.48),(6,-1.33),(1,-1.6),(-4,-1.35),(-9,-1.5),(-13.4,-1.12)],8,'dark')
 for z in [-3.91,3.91]:m.box((0,-.19,z),(27.2,.16,.16),'mortar')
 asset('foundation',m)
 asset('pillar',column_mesh());asset('pillar_broken',column_mesh(2.0,True))
 m=Mesh();w=8;spring=3.65;rise=2.05;opening=2.3;curve=archpoints(opening,spring,rise)
 # Stone wall with a real pointed window recess; no opaque plane behind the opening.
 prism(m,[(-4,0),(-opening/2,0),(-opening/2,6.5),(-4,6.2)],.92,'stone')
 prism(m,[(opening/2,0),(4,0),(4,6.3),(opening/2,6.5)],.92,'stone')
 prism(m,[(-opening/2,0),(opening/2,0),(opening/2,1.65),(-opening/2,1.65)],.92,'stone')
 for i in range(len(curve)-1):prism(m,[curve[i],curve[i+1],(curve[i+1][0],6.5),(curve[i][0],6.5)],.92,'stone')
 archband(m,opening,spring,rise,.21,1.08,'stoneLight')
 for s in [-1,1]:
  m.box((s*(opening/2+.11),(spring+1.65)/2,.08),(.22,spring-1.65,1.12),'stoneLight')
  # Incised courses and irregular vertical joints make continuous, worn masonry.
  for row in range(8):
   y=.48+row*.73;m.box((s*2.85,y,.466),(2.15,.026,.012),'mortar')
   x=s*(2.0+(row%3)*.48);m.box((x,y+.35,.47),(.026,.68,.018),'mortar')
 m.box((0,1.62,.08),(2.88,.2,1.3),'stoneLight')
 for y in [.22,6.15]:m.box((0,y,.48),(8,.12,.12),'mortar')
 # Thin Gothic mullions preserve the opening and cast recognisable shadows.
 for x in [-.38,.38]:m.tube([(x,1.7,.1),(x,4.4,.1)],[.055,.045],'stoneLight',6)
 archband(m,.7,4.2,.65,.07,.18,'stoneLight',.1)
 asset('wall_bay',m)
 m=Mesh();outline=[(-4,0),(4,0),(4,1.15),(3.25,1.2),(3.0,1.7),(2.3,1.58),(2.1,1.24),(1.2,1.38),(.65,.98),(-.1,1.03),(-.6,1.62),(-1.5,1.78),(-2.2,1.4),(-3,1.67),(-4,1.54)]
 prism(m,outline,.8,'stone')
 for y in [.28,.76]:m.box((0,y,.411),(8,.028,.025),'mortar')
 for x in [-3,-1.4,.6,2.5]:m.box((x,.5,.42),(.03,.46,.018),'mortar')
 asset('parapet',m)
 m=Mesh();prism(m,[(-2.5,0),(2.5,0),(2.5,2.7),(1.8,3.35),(.8,3.15),(.1,3.5),(-1.3,3.3),(-2.5,3.4)],1.3,'stone')
 for y in [.35,1.0,1.68,2.36,3.02]:m.box((0,y,.66),(5,.028,.02),'mortar')
 for j in range(6):m.box((-2.25+j*.8,.65+(j%3)*.69,.67),(.03,.6,.02),'mortar')
 asset('wall_fragment',m)
 m=Mesh();prism(m,[(-.7,0),(.7,0),(.62,1.4),(.38,1.8),(.32,4.9),(0,6.2),(-.32,4.9),(-.38,1.8),(-.62,1.4)],1.5,'mortar')
 for y in [.3,1.6,4.5]:m.box((0,y,.01),(1.4 if y<2 else .8,.15,1.65),'stoneLight')
 asset('buttress',m)
 for name,broken in [('portal',False),('portal_broken',True)]:
  m=Mesh();archband(m,8,4,4.35,.6,1.35,'stoneLight')
  for s in [-1,1]:
   p=column_mesh(4.65);m.merge(p,(s*4.65,0,0))
   relief(m,s*4.65,3.15,.72,.42,'gold')
  if broken:
   # Remove a section of the outer crown and leave projecting chipped wedges.
   keep=[i for i,f in enumerate(m.f) if not all(m.v[v][0]>1.8 and m.v[v][1]>7.2 for v in f)]
   m.f=[m.f[i] for i in keep];m.c=[m.c[i] for i in keep]
  else:relief(m,0,8.5,.78,.8,'gold')
  asset(name,m)
 m=Mesh()
 for x in [-3.9+i*.65 for i in range(13)]:
  m.tube([(x,.22,0),(x,6.2,0)],[.055,.055],'iron',6);prism(m,[(x-.13,.35),(x,0),(x+.13,.35)],.13,'iron')
 for y in [1,3.2,5.9]:m.box((0,y,0),(8,.16,.16),'iron')
 for x in [-3.25,-1.95,-.65,.65,1.95,3.25]:
  m.tube([(x-.25,3.3,.02),(x,3.7,.02),(x+.25,3.3,.02)],[.025]*3,'gold',5)
 relief(m,0,5.15,.13,.65,'gold');asset('portcullis',m)
 m=Mesh()
 for i in range(7):
  x=-1.1+(i+.5)*2.2/7;top=3.3-random.random()*.18
  prism(m,[(x-.148,0),(x+.148,0),(x+.148,top),(x+.05,top-.03),(x-.148,top)],.23,'wood' if i%3 else 'woodlight')
 for y in [.7,2.5]:
  m.box((0,y,.14),(2.12,.15,.055),'iron')
  for x in [-.88,-.4,.4,.88]:m.ellipsoid((x,y,.18),(.047,.047,.023),'gold',6,3)
 lathe(m,[(.16,0),(.16,.035)],'iron',12)
 m.tube([(.7,1.45,.18),(.8,1.32,.18),(.7,1.19,.18),(.6,1.32,.18),(.7,1.45,.18)],[.032]*5,'iron',7)
 asset('door_leaf',m)

def landmarks():
 m=Mesh();lathe(m,[(0,0),(1.02,0),(1.02,.16),(.86,.3),(.83,.46),(0,.46)],'dark',8)
 lathe(m,[(.65,.46),(.72,.58),(.65,.72),(.51,.86),(.4,2.2),(.65,2.52),(.42,2.7)],'stone',12)
 # A folded stone cloak, cut into deep angular pleats.
 for i in range(14):
  a=i*math.tau/14;b=(i+1)*math.tau/14;r=.65 if i%2 else .56
  m.face([(math.sin(a)*r,.65,math.cos(a)*r),(math.sin(b)*.61,.7,math.cos(b)*.61),(math.sin(b)*.42,2.46,math.cos(b)*.42),(math.sin(a)*.44,2.46,math.cos(a)*.44)],'stoneLight' if i%3==0 else 'stone',.9+(i%3)*.06)
 m.ellipsoid((0,2.98,0),(.38,.52,.34),'stone',10,6,.055)
 m.ellipsoid((0,2.94,.27),(.225,.29,.09),'dark',8,4)
 m.ellipsoid((-.035,2.96,.33),(.14,.21,.06),'stoneLight',7,4)
 m.tube([(-.36,2.45,0),(-.58,2.2,.24),(-.27,1.99,.48)],[.19,.17,.12],'stone',7)
 m.tube([(.36,2.45,0),(.58,2.2,.24),(.23,1.99,.48)],[.19,.17,.12],'stone',7)
 m.box((0,1.2,.5),(.12,1.64,.065),'mortar');m.box((0,1.97,.5),(.61,.12,.12),'stoneLight')
 m.ellipsoid((0,2.17,.5),(.1,.14,.1),'stoneLight',7,4)
 for i in range(6):m.ellipsoid(((random.random()-.5)*1.15,.49,(random.random()-.5)*.9),(.16,.055,.12),'moss',6,3)
 asset('sentinel_statue',m)
 m=Mesh();lathe(m,[(0,0),(2.65,0),(2.65,.15),(2.5,.28),(2.44,.5),(2.1,.61),(1.94,.61),(1.94,.27),(.45,.27)],'stone',32)
 lathe(m,[(.53,.26),(.53,.48),(.32,.62),(.23,1.32),(.6,1.52),(.98,1.6),(1.1,1.87),(.97,2.03),(.83,1.95),(.8,1.76),(.2,1.69)],'stoneLight',24)
 lathe(m,[(.22,1.7),(.22,2.4),(.42,2.53),(.38,2.65),(0,2.69)],'stone',16)
 for i in range(16):
  a=i*math.tau/16;x,z=math.sin(a)*2.3,math.cos(a)*2.3
  m.tube([(x,.63,z),(x*.96,.71,z*.96)],[.052,.035],'mortar',6)
 for i in range(12):
  x,z=(random.random()-.5)*3,(random.random()-.5)*3
  if math.hypot(x,z)>.7:m.ellipsoid((x,.29,z),(.18,.045,.12),'moss',7,3)
 asset('fountain',m)
 m=Mesh();m.tube([(0,0,0),(.12,1.1,.02),(-.22,2.3,0),(.18,3.5,-.2),(-.1,5.1,-.45)],[.42,.32,.23,.13,.025],'wood',10)
 for i in range(8):
  a=i*2.42;y=1.3+i*.39;x,z=math.sin(a)*(1.3+i*.04),math.cos(a)*(.7+i*.05)
  m.tube([(0,y,0),(x*.5,y+.7,z*.5),(x,y+1.03,z),(x*1.2,y+1.5,z*.9)],[.14,.085,.04,.006],'wood',7)
  m.tube([(x*.5,y+.7,z*.5),(x*.45+.35,y+1.38,z*.8)],[.05,.005],'woodlight',5)
 for i in range(6):
  a=i*math.tau/6;m.tube([(0,.22,0),(math.sin(a)*.6,.09,math.cos(a)*.6),(math.sin(a),.015,math.cos(a))],[.15,.075,.008],'wood',7)
 asset('dead_tree',m)
 m=Mesh()
 for x in [-1.0,1.0]:
  prism(m,[(x-.16,0),(x+.16,0),(x+.13,.65),(x+.35,.82),(x+.35,.94),(x-.35,.94),(x-.35,.82),(x-.13,.65)],.92,'wood')
  m.tube([(x,.1,-.45),(x,.1,.45)],[.08,.08],'woodlight',7)
 m.box((0,.46,0),(2.25,.1,.1),'woodlight');slab(m,0,1.02,0,2.8,1.3,.14,'wood')
 for j in range(8):
  x=-.95+(j%4)*.54;z=(j//4-.5)*.43;y=1.08+(j%3)*.05
  m.box((x,y,z),(.4,.075,.32),'cloth' if j%2 else 'woodlight',yaw=j*.34)
  m.box((x,y+.042,z),(.36,.012,.28),'bone',yaw=j*.34)
 m.tube([(.85,1.12,.1),(.9,1.55,.07)],[.015,.004],'bone',5)
 for j in range(5):m.leaf((.87,1.17+j*.05,.08),(.13,.14),'bone',.5)
 asset('scribe_desk',m)
 m=column_mesh(4.2,True);r=Mesh()
 # Rotate the carved shaft into a fallen fragment, including a broken crown.
 for f,(c,s) in zip(m.f,m.c):r.face([(m.v[i][0],.67+m.v[i][2],m.v[i][1]-1.8) for i in f],c,s)
 asset('fallen_column',r)
 m=Mesh()
 for x in [-1.75,1.75]:
  prism(m,[(x-.14,0),(x+.14,0),(x+.14,1.55),(x+.08,1.72),(x,1.83),(x-.14,1.6)],.82,'wood')
  m.tube([(x,.94,.45),(x,1.0,.14),(x,1.07,-.24)],[.08,.065,.08],'woodlight',8)
 m.box((0,.67,.05),(3.7,.18,.75),'woodlight');m.box((0,1.04,-.36),(3.4,.88,.13),'wood')
 for x in [-1.35,-.67,0,.67,1.35]:
  carving=Mesh();archband(carving,.48,.9,.4,.05,.1,'woodlight',-.26);m.merge(carving,(x,0,0))
  relief(m,x,1.12,-.28,.21,'gold')
 m.box((0,.3,0),(3.55,.13,.12),'wood')
 asset('chapel_pew',m)
 m=Mesh();slab(m,0,.15,0,4.5,1.65,.15,'dark');slab(m,0,1.17,0,4.4,1.6,.19,'stoneLight')
 for s in [-1,1]:prism(m,[(s*1.75-.24,.15),(s*1.75+.24,.15),(s*1.75+.2,1.0),(s*1.75-.2,1.0)],1.18,'stone')
 m.box((0,.63,0),(3.15,.84,.88),'mortar')
 for x in [-1.02,0,1.02]:relief(m,x,.65,.46,.46,'stoneLight')
 m.box((0,1.184,.01),(1.1,.013,1.5),'cloth')
 for x in [-.49,.49]:m.box((x,1.195,0),(.025,.01,1.45),'gold')
 asset('chapel_altar',m)
 m=Mesh();curve=archpoints(2.55,2.0,2.2);prism(m,[(-1.275,0),(1.275,0)]+list(reversed(curve)),.08,'dark')
 for coln in [-1,0,1]:
  x=coln*.73
  for row in range(3):
   y=.22+row*.63
   q=[(x-.31,y),(x+.31,y),(x+.31,y+.53),(x-.31,y+.53)]
   prism(m,q,.09,['glassBlue','glassGold','glassRed'][(row+coln)%3],.04)
 for i in range(12):
  a=i*math.tau/12;b=(i+1)*math.tau/12
  pts=[(0,2.73),(.6*math.sin(a),2.73+.6*math.cos(a)),(.6*math.sin(b),2.73+.6*math.cos(b))]
  prism(m,pts,.1,['glassBlue','glassGold','glassRed'][i%3],.04)
 archband(m,2.55,2,2.2,.12,.18,'stoneLight')
 for x in [-.365,.365]:m.tube([(x,.02,.15),(x,2.03,.15)],[.035,.035],'gold',6)
 for y in [.16,.76,1.39,2.03]:m.box((0,y,.13),(2.4,.038,.06),'gold')
 for i in range(12):
  a=i*math.tau/12;m.tube([(0,2.73,.14),(.62*math.sin(a),2.73+.62*math.cos(a),.14)],[.025,.025],'gold',5)
 asset('stained_window',m)
 m=Mesh();lathe(m,[(0,0),(1.45,0),(1.45,.16),(1.28,.28),(1.22,.34),(.95,.45),(.93,.63),(.71,.7)],'stone',12)
 for i in range(8):
  a=i*math.tau/8;x,z=math.sin(a)*.88,math.cos(a)*.88
  m.ellipsoid((x,.51,z),(.11,.12,.11),'gold',6,3)
 root=asset('sanctuary',m)
 jewel=Mesh();jewel.ellipsoid((0,1.3,0),(.37,.58,.37),'glassBlue',6,2);jewel.object('sanctuary_crystal',root,pivot=(0,1.3,0))
 m=Mesh();slab(m,0,.2,0,2.4,2.2,.2,'dark');slab(m,0,.85,0,1.65,1.5,.18,'stoneLight')
 for s in [-1,1]:
  m.tube([(s*.74,.2,0),(s*.74,1.32,0)],[.13,.1],'stone',8)
  prism(m,[(s*.87-.12,0),(s*.87+.12,0),(s*.87+.12,3.9),(s*.87,4.3),(s*.87-.12,3.9)],.3,'stone')
 prism(m,[(-.73,.83),(.73,.83),(.73,3.3),(0,4.1),(-.73,3.3)],.26,'mortar',-.63)
 archband(m,1.07,2.35,1.1,.12,.2,'stoneLight',-.43);relief(m,0,2.14,-.41,.51,'gold')
 m.box((0,.87,.05),(1.25,.07,1.25),'cloth')
 asset('broken_throne',m)

def details():
 m=Mesh();lathe(m,[(0,0),(.28,0),(.28,.09),(.14,.19),(.055,.3),(.052,1.35),(.14,1.47),(.22,1.6),(.24,1.78),(.2,1.8),(.09,1.6)],'iron',12)
 for i in range(4):
  a=i*math.tau/4;m.tube([(.22*math.sin(a),1.65,.22*math.cos(a)),(.26*math.sin(a),1.95,.26*math.cos(a))],[.028,.014],'gold',6)
 asset('torch_stand',m)
 m=Mesh();lathe(m,[(0,0),(.16,0),(.15,.025),(.07,.035),(.065,.46),(.03,.49),(0,.47)],'bone',9)
 for i in range(5):
  a=i*1.3;y=.26+random.random()*.12;m.tube([(.066*math.sin(a),.46,.066*math.cos(a)),(.074*math.sin(a),y,.074*math.cos(a))],[.024,.009],'bone',5)
 m.tube([(0,.47,0),(.01,.53,0)],[.012,.007],'black',5);asset('candle',m)
 for k in range(3):
  m=Mesh()
  for j in range(4):
   x,z=(random.random()-.5)*1.4,(random.random()-.5)*1.1;w=.3+random.random()*.6;d=.3+random.random()*.4
   m.ellipsoid((x,.16+random.random()*.1,z),(w,.19+random.random()*.17,d),'mortar' if j%2 else 'stoneLight',7,3,.22)
  asset('rubble_'+str(k),m)
 m=Mesh()
 for branch in range(4):
  x=(branch-1.5)*.26;h=1.35+(branch%2)*.55
  m.tube([(x,0,0),(x+.11,h*.5,.02),(x-.12,h,.04)],[.018,.012,.004],'wood',5)
  for i in range(8):
   y=i*h/8;side=-1 if i%2 else 1;m.leaf((x+side*.12,y,.055),(.35,.3),'moss' if i%3 else 'stone',side*.5)
 asset('ivy',m)
 m=Mesh()
 # A torn banner with a wind-shaped silhouette and woven lower points.
 for row in range(9):
  for coln in range(6):
   x=-.85+coln*1.7/6;y=.3+row*.28;xx=x+1.7/6;yy=y+.28
   if row==0 and coln in [0,3]:continue
   wave=lambda a,b:.12*math.sin(b*1.4+a*.8)
   m.face([(x,y,wave(x,y)),(xx,y,wave(xx,y)),(xx,yy,wave(xx,yy)),(x,yy,wave(x,yy))],'cloth',.92+(coln%3)*.03)
 m.tube([(-1,2.9,0),(1,2.9,0)],[.046,.046],'gold',8);relief(m,0,1.83,.17,.65,'gold')
 asset('torn_banner',m)
 m=Mesh();m.ellipsoid((0,.34,0),(.32,.14,.11),'woodlight',8,4);m.tube([(.23,.35,0),(.35,.64,0),(.48,.59,0)],[.085,.075,.07],'woodlight',6)
 for x in [-.21,.21]:
  for z in [-.075,.075]:m.tube([(x,.34,z),(x,.1,z)],[.031,.025],'wood',5)
 m.tube([(-.31,.38,0),(-.46,.45,0)],[.05,.008],'wood',5)
 for z in [-.13,.13]:m.tube([(-.45,.06,z),(-.2,.015,z),(.2,.015,z),(.46,.06,z)],[.03]*4,'woodlight',6)
 m.ellipsoid((.42,.64,.065),(.016,.02,.011),'black',6,3);asset('wooden_horse',m)
 m=Mesh()
 for r,w,c in [(10.65,.09,'gold'),(7.54,.055,'stoneLight'),(3.1,.07,'gold')]:
  for i in range(96):
   a=i*math.tau/96;b=(i+1)*math.tau/96;m.face([(math.sin(a)*r,.018,math.cos(a)*r),(math.sin(a)*(r+w),.018,math.cos(a)*(r+w)),(math.sin(b)*(r+w),.018,math.cos(b)*(r+w)),(math.sin(b)*r,.018,math.cos(b)*r)],c)
 for i in range(12):
  a=i*math.tau/12;p=[(math.sin(a)*4,.019,math.cos(a)*4),(math.sin(a+.12)*5.5,.019,math.cos(a+.12)*5.5),(math.sin(a)*7.2,.019,math.cos(a)*7.2),(math.sin(a-.12)*5.5,.019,math.cos(a-.12)*5.5)];m.face(p,'mortar')
 for i in range(8):
  a=i*math.tau/8;m.face([(0,.019,0),(math.sin(a-.13)*1.7,.019,math.cos(a-.13)*1.7),(math.sin(a)*2.7,.019,math.cos(a)*2.7),(math.sin(a+.13)*1.7,.019,math.cos(a+.13)*1.7)],'stoneLight')
 asset('floor_medallion',m)
 m=Mesh()
 m.box((0,-.01,0),(.12,.04,8),'mortar')
 for z in [-3,-1,1,3]:
  m.face([(-.17,.014,z),(0,.014,z+.25),(.17,.014,z),(0,.014,z-.25)],'stoneLight')
 asset('floor_border',m)

architecture();landmarks();details()
sys.path.insert(0,str(Path(__file__).parent))
from build_threshold import author_threshold
author_threshold(asset,Mesh,archband,relief,xyz)
bpy.context.view_layer.update()
# Weld authoring seams and bevel the substantial props in Blender before export.
import bmesh
for name in ['scribe_desk','chapel_altar','broken_throne','door_leaf','wall_bay','wall_fragment']:
 for obj in ASSETS[name].children_recursive:
  if obj.type!='MESH':continue
  bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(obj.data);bm.free()
  bpy.context.view_layer.objects.active=obj
  mod=obj.modifiers.new('Worn stone and timber edges','BEVEL');mod.width=.022;mod.segments=1;mod.limit_method='ANGLE';mod.angle_limit=.65
  bpy.ops.object.modifier_apply(modifier=mod.name)
for name,root in ASSETS.items():
 objects=[o for o in root.children_recursive if o.type=='MESH'];triangles=0;coords=[]
 for o in objects:
  o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
  for v in o.data.vertices:
   p=o.matrix_world@v.co;coords.append(p);assert all(math.isfinite(k) for k in p),name
 lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)]
 assert triangles>0;stats[name]=dict(triangles=triangles,meshes=len(objects),bounds_blender=[lo,hi]);print('VERIFIED',name,triangles,flush=True)
bpy.ops.object.select_all(action='DESELECT')
for root in ASSETS.values():
 root.select_set(True)
 for obj in root.children_recursive:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'castle-kit.glb'),export_format='GLB',use_selection=True,export_extras=True,export_animation_mode='NLA_TRACKS',export_frame_range=False)
(ROOT/'art/blender/castle-manifest.json').write_text(json.dumps(stats,indent=2))
for i,(name,root) in enumerate(ASSETS.items()):
 root.location=(i%6*16,i//6*16,0)
 if name in ['floor_medallion','foundation']:root.scale=(.3,.3,.3)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.shading.color_type='VERTEX';area.spaces.active.region_3d.view_distance=100;area.spaces.active.region_3d.view_location=Vector((40,40,0))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/castle-library.blend'),compress=True)
for root in ASSETS.values():root.location=(0,0,0);root.scale=(1,1,1)
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.resolution_x=600;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.23,.3,.35,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.55;scene.view_settings.view_transform='AgX'
for root in ASSETS.values():
 for o in root.children_recursive:o.hide_render=True
floor=bpy.data.materials.new('Studio backdrop');floor.diffuse_color=(.14,.19,.23,1)
bpy.ops.mesh.primitive_plane_add(size=400);plane=bpy.context.object;plane.data.materials.append(floor)
ld=bpy.data.lights.new('Softbox','AREA');lo=bpy.data.objects.new('Softbox',ld);scene.collection.objects.link(lo)
fd=bpy.data.lights.new('Cool fill','AREA');fill=bpy.data.objects.new('Cool fill',fd);scene.collection.objects.link(fill);fd.color=(.66,.82,1)
cd=bpy.data.cameras.new('Asset review');cam=bpy.data.objects.new('Asset review',cd);scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
selection=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for name,root in ASSETS.items():
 if selection and name not in selection:continue
 coords=[o.matrix_world@Vector(v) for o in root.children_recursive if o.type=='MESH' for v in o.bound_box]
 low=Vector([min(p[i] for p in coords) for i in range(3)]);high=Vector([max(p[i] for p in coords) for i in range(3)])
 center=(low+high)*.5;span=max(max(high-low),.5)
 cam.location=center+Vector((1,-1.65,1.15))*span;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=span*1.4
 lo.location=center+Vector((-1,-1.6,2))*span;lo.rotation_euler=(center-lo.location).to_track_quat('-Z','Y').to_euler();ld.energy=180*span*span;ld.size=span*1.1
 fill.location=center+Vector((1,.3,1))*span;fill.rotation_euler=(center-fill.location).to_track_quat('-Z','Y').to_euler();fd.energy=55*span*span;fd.size=span
 plane.location.z=low.z-.025
 for o in root.children_recursive:o.hide_render=False
 scene.render.filepath=str(REVIEW/(name+'.png'));bpy.ops.render.render(write_still=True)
 for o in root.children_recursive:o.hide_render=True
 print('RENDERED',name,flush=True)
print('CASTLE_LIBRARY_COMPLETE',len(ASSETS),flush=True)
