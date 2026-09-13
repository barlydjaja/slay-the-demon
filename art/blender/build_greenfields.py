"""Original Greenfields asset library. Run with Blender 4.5 --background --python.
All dimensions are metres; helper coordinates are game X / up / Z.
Exports vertex-painted, texture-free glTF assets with named animation pivots.
"""
import bpy, math, random, json, os, sys
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
REVIEW = ROOT / 'art/review'
OUT.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
random.seed(417)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for datablock in list(bpy.data.materials): bpy.data.materials.remove(datablock)

def linear(c): return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
def rgba(hex): return tuple(linear(int(hex[i:i+2],16)/255) for i in (0,2,4))+(1,)
PALETTE = dict(wood='755034', woodlight='b28755', bark='64513b', cream='eadbb6', stone='869088', stoneLight='aeb2a2', dark='2f4542', roof='b16343', rooflight='d88e62', teal='447b79', leaf='41744a', leaflight='789b48', leafgold='a6b657', grass='679747', skin='c49976', hair='e6e1c9', eye='ffe298', iron='465658', soil='aa9372', flower='f6d16c', purple='9e86ad')
PALETTE.update(leaf='304f49', leaflight='526755', leafgold='788065', grass='495f50', soil='777568', roof='675d59', rooflight='8a786c', stone='646f70', stoneLight='929790', wood='514b40', woodlight='81725b')
MAT=bpy.data.materials.new('Meadow · vertex-painted'); MAT.use_nodes=True
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

def oak(name='oak',gold=False):
 m=Mesh(); m.tube([(0,0,0),(.1,1.2,.03),(-.1,2.6,0),(.15,4.1,-.2),(.2,5.7,-.3)],[.55,.4,.33,.2,.035],'bark',9)
 for i in range(6):
  a=i*math.tau/6;dx,dz=math.sin(a),math.cos(a)
  m.tube([(0,.2,0),(dx*.7,.12,dz*.7),(dx*1.3,.01,dz*1.3)],[.22,.14,.015],'bark')
 for i in range(9):
  a=i*2.4;r=1.2+(i%3)*.55;y=3.5+(i%4)*.46; x,z=math.sin(a)*r,math.cos(a)*r
  m.tube([(0,2.4,0),(x*.65,y-.6,z*.65),(x,y,z)],[.2,.12,.03],'bark')
  m.ellipsoid((x,y+.8,z),(1.5+(i%2)*.3,.85,1.3),'leafgold' if gold else ['leaf','leaflight'][i%2],10,5,.15)
  for j in range(9):
   b=j*math.tau/9;m.leaf((x+math.cos(b)*1.2,y+.75,z+math.sin(b)*1.1),(.55,.5),'leaflight',b)
 m.ellipsoid((.1,5.7,-.2),(1.5,1.05,1.4),'leafgold' if gold else 'leaflight',10,5,.15)
 return asset(name,m)

def birch():
 m=Mesh()
 for k in range(3):
  x=(k-1)*.3;z=(k%2)*.25
  m.tube([(x,0,z),(x+.12,2,z),(x-.2,4,z+.2),(x+.15,6.5,z+.1)],[.18,.14,.09,.025],'cream',7)
  for j in range(10):m.box((x+.12, j*.53+.3,z+.12),(.17,.035,.07),'bark',yaw=j*.7)
  for j in range(4):
   a=k*2.3+j*1.9;xx=x+math.sin(a)*1.0;zz=z+math.cos(a)*1.1;yy=3+j*.83
   m.tube([(x,yy-.5,z),(xx,yy,zz)],[.055,.008],'bark',5)
   m.ellipsoid((xx,yy+.45,zz),(1,.5,.85),'leafgold' if j%2 else 'leaflight',9,4,.14)
 return asset('birch',m)

def pine():
 m=Mesh();m.tube([(0,0,0),(.1,3,0),(0,7.8,.1)],[.35,.17,.005],'bark',8)
 for j in range(7):
  y=1.6+j*.82;r=2.2-j*.28
  for i in range(8):
   a=i*math.tau/8+(j%2)*.3;x,z=math.sin(a)*r,math.cos(a)*r
   m.tube([(0,y+.45,0),(x*.7,y+.18,z*.7),(x,y-.1,z)],[.09,.04,.005],'bark',5)
   for f in range(3):
    b=a+(f-1)*.36
    m.face([(0,y+.95,0),(math.sin(b-.24)*r,y-.02,math.cos(b-.24)*r),(math.sin(b)*r*.95,y+.2,math.cos(b)*r*.95),(math.sin(b+.24)*r,y-.02,math.cos(b+.24)*r)],'leaf' if j%2 else 'leaflight',.9+j*.025)
 return asset('pine',m)

def rock(name='boulder',moss=True):
 m=Mesh();m.ellipsoid((0,.6,0),(1.35,.95,1), 'stone',8,5,.22)
 m.ellipsoid((.75,.22,.55),(.55,.4,.5),'stoneLight',7,4,.17)
 if moss:
  for i in range(5): m.ellipsoid((-.45+random.random()*.8,.99+random.random()*.22,(random.random()-.5)*.8),(.43,.12,.37),'leaflight',7,3,.18)
 return asset(name,m)

def plants():
 m=Mesh()
 for i in range(7):
  a=i*2.4;r=.14*(i%3);x,z=math.sin(a)*r,math.cos(a)*r;h=.3+random.random()*.45
  m.face([(x-.04,0,z),(x+.04,0,z),(x+math.sin(a)*.12,h*.65,z+math.cos(a)*.12)],'grass')
  m.face([(x+.04,0,z),(x+math.sin(a)*.2,h,z+math.cos(a)*.2),(x+math.sin(a)*.12,h*.65,z+math.cos(a)*.12)],'leaflight')
 asset('grass_tuft',m)
 m=Mesh()
 for i in range(7):
  a=i*2.4
  for j in range(5):
   t=(j+1)/6;r=t*.65;x,z=math.sin(a)*r,math.cos(a)*r;y=math.sin(t*math.pi*.85)*.65
   for s in [-1,1]:
    b=a+s*.65;l=(1-t)*.32
    m.face([(x,y,z),(x+math.sin(b)*l,y+.08,z+math.cos(b)*l),(x+math.sin(a)*.16,y+.04,z+math.cos(a)*.16)],'leaflight' if j%2 else 'leaf')
 asset('fern',m)
 for name,color in [('wildflowers','flower'),('bluebells','purple')]:
  m=Mesh()
  for i in range(5):
   x,z=(random.random()-.5)*.7,(random.random()-.5)*.7;h=.38+random.random()*.45
   m.tube([(x,0,z),(x+.04,h,z)],[.014,.008],'grass',4)
   for j in range(5):
    a=j*math.tau/5;cx=x+math.sin(a)*.12;cz=z+math.cos(a)*.12
    m.face([(x,h-.02,z),(cx-math.cos(a)*.09,h,cz+math.sin(a)*.09),(cx+math.sin(a)*.07,h+.025,cz+math.cos(a)*.07),(cx+math.cos(a)*.09,h,cz-math.sin(a)*.09)],color)
   m.ellipsoid((x,h+.025,z),(.055,.05,.055),'roof',6,3)
   m.leaf((x,h*.4,z),(.2,.22),'leaflight',i*1.3)
  asset(name,m)
 m=Mesh();m.tube([(0,0,0),(.03,.7,0),(.02,1.35,.02)],[.04,.025,.012],'grass',6)
 for y,a in [(.4,.7),(.65,3.8),(.9,1.5)]:m.leaf((0,y,0),(.32,.35),'leaf',a)
 m.ellipsoid((.02,1.32,.05),(.16,.17,.075),'wood',9,5)
 for i in range(12):
  a=i*math.tau/12;x=math.sin(a)*.23;y=1.32+math.cos(a)*.23;m.face([(0,1.32,.04),(x-math.cos(a)*.08,y+math.sin(a)*.08,.055),(math.sin(a)*.38,1.32+math.cos(a)*.38,.02),(x+math.cos(a)*.08,y-math.sin(a)*.08,.055)],'flower')
 asset('sunflower',m)
 m=Mesh()
 for i in range(7):m.ellipsoid(((random.random()-.5)*.9,.3+random.random()*.3,(random.random()-.5)*.9),(.45,.38,.42),'leaf' if i%2 else 'leaflight',8,4,.12)
 for i in range(12):m.ellipsoid(((random.random()-.5)*1.1,.4+random.random()*.35,(random.random()-.5)*1.1),(.045,.05,.045),'rooflight',5,3)
 asset('berry_bush',m)
 m=Mesh()
 for i in range(9):
  x,z=(random.random()-.5)*.6,(random.random()-.5)*.6;h=.6+random.random()*.8
  m.tube([(x,0,z),(x+.1,h,z)],[.014,.012],'grass',4)
  if i%2:m.tube([(x+.1,h*.7,z),(x+.1,h,z)],[.047,.04],'wood',6)
  else:m.leaf((x,.1,z),(.12,h),'leaflight',i)
 asset('reeds',m)

def roof(m,x,y,z,w,d,color='roof'):
 rise=w*.4
 for side in [-1,1]:
  # Staggered individual shingles, with a softened lower lip and irregular color.
  for row in range(6):
   u=(row+.5)/6;xx=x+side*(w*.5*u);yy=y+rise*(1-u)
   for k in range(10):
    zz=z-d/2+(k+.5)*d/10+(row%2)*.035
    m.box((xx,yy,zz),(w/12+.06,.09,d/10+.055),color if (row+k)%4 else 'rooflight',tilt=0)
    # A shallow pitched quad caps each flat shingle to form the roof plane.
    a=w*.5*row/6;b=w*.5*(row+1)/6
    m.face([(x+side*a,y+rise*(1-row/6)+.08,zz-d/20),(x+side*b,y+rise*(1-(row+1)/6)+.08,zz-d/20),(x+side*b,y+rise*(1-(row+1)/6)+.08,zz+d/20+.03),(x+side*a,y+rise*(1-row/6)+.08,zz+d/20+.03)],color,random.uniform(.88,1.12))
 for front in [-1,1]:
  zz=z+front*d/2
  m.face([(x-w/2,y,zz),(x+w/2,y,zz),(x,y+rise,zz)],'cream')
  for side in [-1,1]:m.tube([(x,y+rise+.06,zz+front*.04),(x+side*w/2,y,zz+front*.04)],[.09,.09],'wood',4)
 m.tube([(x,y+rise+.15,z-d*.52),(x,y+rise+.15,z+d*.52)],[.12,.12],'rooflight',7)

def window(m,x,y,z):
 m.box((x,y,z),(1.05,1.15,.12),'woodlight');m.box((x,y,z+.07),(.84,.95,.06),'dark')
 m.box((x,y,z+.11),(.66,.77,.02),'eye')
 for xx in [-.21,.21]:m.box((x+xx,y,z+.13),(.055,.85,.055),'wood')
 m.box((x,y,z+.13),(.78,.055,.055),'wood')
 for s in [-1,1]:
  m.box((x+s*.69,y,z),(.32,1.18,.11),'teal',yaw=s*.18)
  for j in range(4):m.box((x+s*.69,y-.4+j*.27,z+.06),(.3,.045,.08),'woodlight')
 m.box((x,y-.69,z+.17),(1.35,.22,.4),'wood')
 for j in range(5):
  m.ellipsoid((x+(j-2)*.23,y-.5,z+.2),(.19,.13,.17),'leaflight',6,3)
  m.ellipsoid((x+(j-2)*.23,y-.4,z+.23),(.08,.05,.08),'flower' if j%2 else 'purple',5,3)

def cottage(name='cottage',long=False):
 m=Mesh(); w=5.2 if long else 4.8;d=4.4
 # Uneven foundation courses and plaster infill between exposed timbers.
 for row in range(2):
  for k in range(8):m.box((-w/2+(k+.5)*w/8,.16+row*.24,d/2+.02),(w/8-.02,.23,.35),'stone' if k%2 else 'stoneLight')
 m.box((0,1.9,0),(w,3.15,d),'cream')
 for xx in [-w/2,0,w/2]:m.box((xx,1.94,d/2+.04),(.16,3.2,.2),'wood')
 for yy in [.48,3.42]:m.box((0,yy,d/2+.05),(w+.15,.16,.2),'wood')
 for xx in [-w/2,w/2]:
  for zz in [-d/2,d/2]:m.box((xx,1.9,zz),(.22,3.35,.22),'wood')
  m.tube([(xx,1.1,-d/2),(xx,3.3,d/2)],[.075,.075],'wood',4)
 for xx in [-1.55,1.55]:window(m,xx,2.05,d/2+.12)
 for side in [-1,1]:
  detail=Mesh();window(detail,0,2.05,0);m.merge(detail,(side*(w/2+.12),0,0),side*math.pi/2)
 m.box((0,1.38,d/2+.13),(1.08,2,.16),'dark')
 for i in range(6):m.box((-.44+i*.176,1.32,d/2+.23),(.15,1.86,.09),'woodlight' if i%2 else 'wood')
 for yy in [.65,1.83]:m.box((0,yy,d/2+.3),(1,.095,.065),'iron')
 m.ellipsoid((.3,1.26,d/2+.35),(.065,.065,.04),'flower',8,4)
 for i in range(2):m.box((0,.17+i*.12,d/2+.5-i*.15),(1.75,.22,1.05-i*.2),'stoneLight')
 roof(m,0,3.5,0,w+1,5.4,'teal' if long else 'roof')
 # Chimney courses, a timber-framed attic and porch awning.
 for j in range(8):m.box((-1.55,4.4+j*.21,-.9),(.62,.2,.72),'stoneLight' if j%3 else 'stone')
 m.box((-1.55,6.08,-.9),(.79,.13,.88),'stone')
 m.box((-1.55,6.16,-.9),(.48,.035,.55),'dark')
 window(m,0,4.25,2.75)
 for xx in [-.86,.86]:m.tube([(xx,.25,3.1),(xx,2.8,3.1)],[.08,.07],'wood',6)
 for i in range(8):m.box((-.93+i*.265,2.9,2.94),(.27,.07,1.5),'woodlight',tilt=.13)
 # Side lean-to / firewood adds an asymmetrical lived-in silhouette.
 if long:
  m.box((3.2,1.08,-.6),(1.6,1.7,2.3),'cream')
  for i in range(9):m.box((3.18,2.1,-1.7+i*.27),(1.85,.09,.28),'roof',tilt=.1)
 else:
  for j in range(4):
   for i in range(3):m.tube([(-2.8+i*.23,.3+j*.19,-.6),(-2.8+i*.23,.3+j*.19,.4)],[.1,.09],'woodlight',7)
 return asset(name,m)

def well():
 m=Mesh()
 for row in range(3):
  for i in range(12):
   a=(i+(row%2)*.5)*math.tau/12
   m.box((math.sin(a),.15+row*.26,math.cos(a)),(.55,.24,.34),'stone' if (i+row)%3 else 'stoneLight',yaw=a)
 for s in [-1,1]:m.tube([(s*1.25,0,0),(s*1.25,2.85,0)],[.11,.09],'wood',6)
 m.tube([(-1.45,1.95,0),(1.5,1.95,0)],[.1,.1],'woodlight',8)
 m.tube([(.2,1.95,0),(.2,.8,0)],[.018,.018],'woodlight',5)
 for i in range(10):
  a=i*math.tau/10;m.box((.2+math.sin(a)*.22,.7,math.cos(a)*.22),(.13,.35,.06),'wood',yaw=a)
 roof(m,0,2.83,0,3.4,2.6,'teal')
 m.ellipsoid((0,.17,0),(.8,.04,.8),'teal',16,3)
 return asset('well',m)

def windmill():
 m=Mesh();m.tube([(0,.15,0),(0,.7,0),(0,4.9,0),(0,6.6,0)],[1.7,1.65,1.2,.95],'cream',12)
 for y in [.4,2.8,5.05]:
  for i in range(12):
   a=i*math.tau/12;m.box((math.sin(a)*(1.68-y*.11),y,math.cos(a)*(1.68-y*.11)),(.75,.12,.14),'wood',yaw=a)
 m.tube([(0,6.4,0),(0,8.3,0)],[1.7,.03],'roof',12)
 window(m,0,3.4,1.42);m.box((0,1.1,1.55),(.9,1.9,.12),'wood')
 root=asset('windmill',m); sails=Mesh()
 for i in range(4):
  a=i*math.pi/2
  def P(x,y,z):return(x*math.cos(a)-y*math.sin(a),x*math.sin(a)+y*math.cos(a)+5.9,z+1.8)
  sails.tube([P(0,.1,0),P(0,3.6,0)],[.08,.06],'woodlight',5)
  for j in range(7):
   y=1.05+j*.35
   sails.face([P(.06,y,.03),P(.94,y,.03),P(.94,y+.3,.06),P(.06,y+.3,.06)],'cream',1-(j%2)*.09)
   sails.tube([P(-.06,y,0),P(.98,y,0)],[.025,.025],'wood',4)
 sails.ellipsoid((0,5.9,1.9),(.24,.24,.2),'wood',10,5)
 sails.object('windmill_sails',root,(0,5.9,1.8));return root

def props():
 m=Mesh()
 for x in [-1.45,0,1.45]:m.box((x,.65,0),(.14,1.3,.18),'woodlight');m.tube([(x,1.3,0),(x,1.5,0)],[.12,.005],'wood',4)
 for y in [.46,1.02]:m.box((0,y,0),(3,.13,.12),'wood')
 asset('fence',m)
 m=Mesh();m.tube([(0,0,0),(.05,2.9,0)],[.09,.065],'wood',7)
 m.box((.25,2.35,0),(1.45,.44,.14),'woodlight',yaw=.06)
 m.face([(.98,2.13,-.07),(1.25,2.35,-.07),(.98,2.57,-.07)],'woodlight')
 # A sun crest, readable without baked text.
 m.ellipsoid((.2,2.37,.09),(.14,.14,.025),'flower',10,4)
 asset('signpost',m)
 m=Mesh();m.tube([(0,0,0),(0,2.85,0)],[.075,.06],'wood',6)
 m.tube([(0,2.8,0),(.65,2.8,0),(.65,2.5,0)],[.05,.04,.03],'iron',5)
 m.box((.65,2.18,0),(.38,.56,.36),'eye')
 for xx in [.44,.86]:
  for z in [-.19,.19]:m.tube([(xx,1.89,z),(xx,2.48,z)],[.023,.023],'iron',4)
 m.tube([(.65,2.47,0),(.65,2.72,0)],[.34,.035],'iron',4)
 m.box((.65,1.86,0),(.47,.08,.44),'iron');asset('lantern',m)
 m=Mesh();m.tube([(0,.03,0),(0,.48,0),(0,.94,0)],[.34,.415,.34],'wood',12)
 for i in range(12):
  a=i*math.tau/12;r=.4
  m.tube([(math.sin(a)*r*.83,.04,math.cos(a)*r*.83),(math.sin(a)*r,.5,math.cos(a)*r),(math.sin(a)*r*.83,.95,math.cos(a)*r*.83)],[.11,.11,.1],'woodlight' if i%3 else 'wood',4)
 for y in [.15,.8]:
  for i in range(12):
   a=i*math.tau/12;m.box((math.sin(a)*.415,y,math.cos(a)*.415),(.23,.075,.04),'iron',yaw=a)
 m.ellipsoid((0,.97,0),(.32,.025,.32),'wood',12,3);asset('barrel',m)
 m=Mesh();m.box((0,.45,0),(.9,.9,.9),'wood')
 for x in [-.48,.48]:
  for z in [-.48,.48]:m.box((x,.45,z),(.11,1,.11),'woodlight')
 for y in [.04,.88]:
  for z in [-.49,.49]:m.box((0,y,z),(.98,.1,.08),'woodlight')
 for z in [-.5,.5]:m.tube([(-.43,.12,z),(.43,.81,z)],[.05,.05],'woodlight',4)
 asset('crate',m)
 m=Mesh()
 for i in range(7):m.box((-.8+i*.26,.75,0),(.24,.12,2.1),'woodlight')
 for x in [-1,1]:
  for y in [1,1.35]:m.box((x,y,0),(.1,.23,2.15),'wood')
  for z in [-.8,.8]:
   # Open spoke wheels with an octagonal rim.
   for i in range(12):
    a=i*math.tau/12;b=(i+1)*math.tau/12
    m.tube([(x,.53+math.sin(a)*.52,z+math.cos(a)*.52),(x,.53+math.sin(b)*.52,z+math.cos(b)*.52)],[.055,.055],'wood',5)
    if i%2==0:m.tube([(x,.53,z),(x,.53+math.sin(a)*.5,z+math.cos(a)*.5)],[.025,.025],'woodlight',4)
 m.tube([(-.6,.65,0),(-.6,.52,3)],[.065,.05],'wood',5);m.tube([(.6,.65,0),(.6,.52,3)],[.065,.05],'wood',5)
 asset('cart',m)
 m=Mesh()
 for i in range(5):m.ellipsoid(((i-2)*.42,.08,random.uniform(-.23,.23)),(.38,.1,.3),'stoneLight' if i%2 else 'stone',7,3,.15)
 asset('stepping_stones',m)

def ruins():
 m=Mesh()
 for s in [-1,1]:
  for j in range(6):m.box((s*1.85,.33+j*.56,0),(.85,.53,1),'stoneLight' if j%2 else 'stone',yaw=random.uniform(-.04,.04))
 for i in range(9):
  a=math.pi*i/8
  x=math.cos(a)*1.86;y=3.13+math.sin(a)*1.9
  m.box((x,y,0),(.73,.8,1.1),'stoneLight' if i%2 else 'stone')
 for j in range(8):
  x=random.uniform(-2.3,2.3);z=random.uniform(-.8,.8)
  m.ellipsoid((x,.15,z),(.45,.22,.35),'stone',6,3,.2)
 for j in range(5):m.leaf((-1.85+random.random()*.3,j*.52, .58),(.33,.4),'leaflight',j)
 asset('ruined_arch',m)
 m=Mesh()
 for i in range(5):m.box((i*.38-1.1,.4+(i%2)*.09,0),(.4,.65,.86),'stone',yaw=(i-2)*.02)
 m.ellipsoid((.8,.21,.6),(.6,.31,.5),'stoneLight',7,4,.2)
 for i in range(4):m.ellipsoid((i*.38-1.1,.76,0),(.31,.06,.4),'leaflight',6,3,.12)
 asset('broken_wall',m)
 m=Mesh();m.box((0,.17,0),(1.8,.34,1.65),'stone');m.box((0,.42,0),(1.35,.2,1.25),'stoneLight')
 m.tube([(0,.55,0),(.1,1.7,0),(0,2.4,0)],[.5,.42,.3],'stone',6)
 for i in range(4):
  a=i*2.4;x,z=math.sin(a)*.32,math.cos(a)*.32
  m.tube([(x,2.2,z),(x+.08,2.8+(i%2)*.25,z)],[.19,0],'purple',5)
 asset('shrine',m)
 m=Mesh();m.ellipsoid((0,1.5,0),(5.5,3.9,3.5),'leaflight',10,6,.22)
 for i in range(7):m.ellipsoid(((i-3)*1.25,1+(i%3)*.9,-.5),(1.7,2.2,1.6),'stone' if i%3 else 'leaf',7,5,.25)
 asset('ridge',m)
 # A small reflective-looking pool, lily pads and individually modelled shore stones.
 m=Mesh()
 for i in range(40):
  a=i*math.tau/40;r=1+random.uniform(-.04,.04)
  m.ellipsoid((math.sin(a)*5.5*r,.08,math.cos(a)*3.4*r),(.42+random.random()*.3,.2,.4),'stoneLight' if i%3 else 'stone',7,4,.2)
 for i in range(11):
  x=random.uniform(-3.8,3.8);z=random.uniform(-2.3,2.3)
  m.ellipsoid((x,.025,z),(.24,.015,.2),'leaf',9,3)
  if i%3==0:m.ellipsoid((x,.065,z),(.08,.045,.08),'cream',6,3)
 root=asset('pond',m); water=Mesh();water.ellipsoid((0,-.025,0),(5.4,.025,3.3),'teal',40,3)
 ob=water.object('pond_water',root);watermat=MAT.copy();watermat.name='Pond · polished water';watermat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.2;watermat.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=.18;ob.data.materials[0]=watermat


def human(name,elder=False,child=False):
 m=Mesh();height=1.9;coat='teal' if elder else 'rooflight'
 # Flared, folded cloth, belt, boots, collar and asymmetrical satchel.
 m.tube([(0,.12,0),(0,.45,0),(0,1,0),(0,1.42,0)],[.36,.42,.31,.34],coat,12)
 for i in range(8):
  a=i*math.tau/8;m.tube([(math.sin(a)*.37,.2,math.cos(a)*.37),(math.sin(a)*.3,.92,math.cos(a)*.3)],[.022,.008],'dark' if i%3==0 else coat,4)
 for s in [-1,1]:
  m.ellipsoid((s*.2,.12,.12),(.17,.13,.27),'wood',10,5)
  m.tube([(s*.32,1.33,0),(s*.45,1.05,.04),(s*.48,.73,.16)],[.16,.145,.1],coat,8)
  m.ellipsoid((s*.48,.71,.17),(.105,.14,.095),'skin',9,5)
 m.ellipsoid((0,1.72,.01),(.29,.36,.26),'skin',14,9)
 m.ellipsoid((0,1.97,-.04),(.31,.16,.25),'hair' if elder else 'wood',12,6)
 for s in [-1,1]:
  m.ellipsoid((s*.285,1.76,.005),(.065,.12,.045),'skin',8,5)
  m.ellipsoid((s*.105,1.79,.25),(.035,.027,.02),'dark',8,4)
  m.tube([(s*.055,1.87,.24),(s*.18,1.86,.23)],[.023,.027],'hair' if elder else 'wood',5)
 m.ellipsoid((0,1.7,.28),(.06,.09,.07),'skin',8,5)
 m.box((0,.98,.312),(.58,.09,.04),'wood');m.box((.1,.98,.35),(.1,.13,.035),'flower')
 m.tube([(-.25,1.42,.22),(.3,.84,.28)],[.04,.035],'woodlight',5)
 m.ellipsoid((.34,.69,.13),(.2,.25,.17),'woodlight',9,5)
 if elder:
  for s in [-1,1]:m.ellipsoid((s*.24,1.71,-.07),(.12,.27,.2),'hair',10,6)
  for i in range(7):
   x=(i-3)*.058
   m.tube([(x,1.59,.25),(x*.85,1.39,.31),(x*.3,1.11,.24)],[.075,.064,.01],'hair',6)
  for s in [-1,1]:m.tube([(0,1.61,.32),(s*.2,1.58,.27)],[.045,.024],'hair',5)
  m.tube([(.63,.03,.2),(.61,1.5,.2),(.7,2.4,.23),(.56,2.56,.23)],[.04,.045,.036,.025],'wood',7)
  m.ellipsoid((.55,2.56,.23),(.09,.11,.075),'flower',8,5)
  for i in range(5):m.ellipsoid((-.17+i*.08,1.37,.29),(.035,.035,.025),'flower',6,3)
  m.box((-.18,1.06,.31),(.16,.7,.04),'cream')
 else:
  m.box((0,.65,.32),(.48,.7,.045),'cream')
  for s in [-1,1]:m.ellipsoid((s*.24,1.94,-.04),(.14,.15,.19),'wood',9,5)
 if child:
  m.v=[(x*.73,y*.7,z*.73) for x,y,z in m.v]
 return asset(name,m)

def creatures():
 root=asset('wolf');m=Mesh()
 m.ellipsoid((0,1.05,-.12),(.52,.54,1.03),'dark',12,7,.025)
 m.ellipsoid((0,1.23,.36),(.67,.64,.62),'leaf',11,6,.09)
 for i in range(10):
  a=i*2.4;x,z=math.sin(a)*.45,math.cos(a)*.5+.2;y=1.42+random.random()*.2
  m.tube([(x,y,z),(x*1.4,y+.46,z-.2)],[.12,0],'bark',5)
 m.tube([(0,1.1,-.95),(.15,1.4,-1.5),(.35,1.8,-1.95)],[.22,.17,.015],'dark',7)
 body=m.object('wolf_body',root)
 head=Mesh();eyes=Mesh();head.ellipsoid((0,1.43,.98),(.4,.39,.47),'dark',12,7)
 head.ellipsoid((0,1.24,1.38),(.25,.23,.42),'bark',10,6)
 head.ellipsoid((0,1.3,1.72),(.19,.12,.11),'dark',10,5)
 for s in [-1,1]:
  head.tube([(s*.25,1.65,.8),(s*.34,2.06,.72)],[.18,.005],'bark',5)
  eyes.ellipsoid((s*.3,1.48,1.27),(.07,.048,.035),'eye',8,4)
  for k in range(2):head.tube([(s*.21,1.15,1.25+k*.22),(s*.21,.98,1.25+k*.22)],[.038,0],'cream',5)
 head_obj=head.object('wolf_head',body,(0,1.4,.95))
 eyes_obj=eyes.object('wolf_eyes',head_obj,(0,1.4,.95));eyes_obj.location=(0,0,0)
 for i,(x,z) in enumerate([(-.4,-.63),(.4,-.63),(-.4,.55),(.4,.55)]):
  limb=Mesh();limb.tube([(x,.95,z),(x,.48,z+.12),(x,.15,z+.02)],[.17,.115,.095],'dark',7);limb.ellipsoid((x,.1,z+.13),(.15,.11,.26),'bark',9,5)
  for k in range(3):limb.tube([(x+(k-1)*.07,.09,z+.26),(x+(k-1)*.07,.035,z+.4)],[.035,0],'cream',4)
  limb.object('wolf_limb_'+str(i),body,(x,.9,z))
 root=asset('golem');m=Mesh();m.ellipsoid((0,1.7,0),(.92,.94,.63),'stone',9,6,.15)
 for s in [-1,1]:
  m.ellipsoid((s*.46,.45,0),(.41,.55,.47),'stone',8,5,.15);m.ellipsoid((s*.46,.12,.15),(.46,.22,.57),'dark',8,4,.08)
  m.tube([(s*.24,2.28,.5),(s*.34,1.77,.62),(s*.14,1.36,.55)],[.042,.035,.008],'eye',4)
 for i in range(8):m.ellipsoid(((random.random()-.5)*1.25,2.24+random.random()*.12,(random.random()-.5)*.7),(.32,.12,.27),'leaflight',7,3,.15)
 body=m.object('golem_body',root)
 h=Mesh();eyes=Mesh();h.ellipsoid((0,2.7,.02),(.53,.49,.47),'dark',8,6,.09)
 for s in [-1,1]:eyes.box((s*.21,2.72,.46),(.17,.075,.04),'eye');h.box((s*.21,2.87,.45),(.25,.13,.11),'stone')
 h.ellipsoid((-.13,3.11,-.02),(.5,.16,.44),'leaflight',8,4,.15)
 head_obj=h.object('golem_head',body,(0,2.65,0))
 eyes_obj=eyes.object('golem_eyes',head_obj,(0,2.65,0));eyes_obj.location=(0,0,0)
 for i,s in enumerate([-1,1]):
  arm=Mesh();arm.ellipsoid((s*1.08,2.2,0),(.55,.55,.53),'stoneLight',8,5,.16)
  arm.tube([(s*1.08,2.2,0),(s*1.3,1.44,.06),(s*1.34,.94,.22)],[.35,.36,.44],'stone',7)
  for k in range(3):arm.ellipsoid((s*1.33+(k-1)*.17,.71,.35),(.14,.24,.22),'dark',7,4)
  arm.ellipsoid((s*1.1,2.61,0),(.5,.12,.46),'leaf',7,3,.12)
  arm.object('golem_limb_'+str(i),body,(s*1.03,2.1,0))
 root=asset('thornling');m=Mesh();m.tube([(0,.2,0),(.1,.7,0),(0,1.25,0)],[.27,.33,.2],'bark',8)
 for s in [-1,1]:m.tube([(s*.16,.35,0),(s*.24,.08,.23),(s*.4,.02,.31)],[.12,.1,.015],'wood',6)
 body=m.object('thornling_body',root);h=Mesh();eyes=Mesh();h.ellipsoid((0,1.48,0),(.38,.33,.35),'dark',11,6)
 h.ellipsoid((0,1.8,0),(.84,.29,.76),'roof',12,6,.035)
 for i in range(7):
  a=i*math.tau/7;x,z=math.sin(a)*.56,math.cos(a)*.49
  h.ellipsoid((x,1.97,z),(.11,.025,.1),'cream',6,3)
  h.tube([(x,1.88,z),(x*1.25,2.21,z*1.2)],[.09,0],'bark',5)
 for s in [-1,1]:eyes.ellipsoid((s*.15,1.5,.32),(.065,.043,.033),'eye',8,4)
 head_obj=h.object('thornling_head',body,(0,1.48,0))
 eyes_obj=eyes.object('thornling_eyes',head_obj,(0,1.48,0));eyes_obj.location=(0,0,0)
 for i,s in enumerate([-1,1]):
  a=Mesh();a.tube([(s*.3,1.09,0),(s*.58,.8,.02),(s*.85,1.05,.12)],[.11,.07,.005],'bark',6)
  a.tube([(s*.59,.83,.03),(s*.8,.65,.1)],[.05,0],'woodlight',5)
  a.leaf((s*.45,.93,0),(.33,.35),'leaflight',s)
  a.object('thornling_limb_'+str(i),body,(s*.3,1.09,0))

PATH=[(35,0),(23,3),(14,9),(1,5),(-8,11),(-17,16),(-35,16)]
def path_x(z):
 for i in range(len(PATH)-1):
  za,xa=PATH[i];zb,xb=PATH[i+1]
  if z<=za and z>=zb:
   t=(za-z)/(za-zb);t=t*t*(3-2*t);return xa+(xb-xa)*t
 return PATH[0][1] if z>35 else PATH[-1][1]
def terrain_h(x,z):
 h=.5*math.sin(x*.12)*math.cos(z*.085)+.38*math.sin(z*.11)+1.65*math.exp(-((x+22)**2+(z+28)**2)/280)+1.5*math.exp(-((x-26)**2+(z-16)**2)/170)
 for xx,zz,r,level in [(16,-23,17,1.05),(-3.4,27,7,.22),(0,35,4,.15)]:
  distance=math.hypot(x-xx,z-zz)
  t=max(0,min(1,(distance-13)/7)) if xx==16 else max(0,min(1,distance/r))
  t=t*t*(3-2*t);h=level*(1-t)+h*t
 q=math.sqrt(((x+26)/6)**2+((z-18)/3.8)**2)
 if q<1.25:
  t=max(0,min(1,(q-.8)/.45));t=t*t*(3-2*t);h=-.75*(1-t)+h*t
 h+=max(0,abs(x)-37)**1.5*.085+max(0,-z-60)**1.4*.08
 return h

def terrain():
 width=105;rows=131
 heights=[round(terrain_h(ix-52,iz-80),5) for iz in range(rows) for ix in range(width)]
 verts=[(ix-52,heights[iz*width+ix],iz-80) for iz in range(rows) for ix in range(width)]
 colors=[]
 for x,y,z in verts:
  dist=abs(x-path_x(z));town=math.hypot(x-16,z+23);branch=abs(z-(x*.8-5)) if -24<x<7 else 100
  earth=max(0,1-dist/2.35,max(0,1-town/9),max(0,1-branch/1.35)*.75)
  n=.5+.5*math.sin(x*.49+math.sin(z*.33))*math.cos(z*.59+x*.17)
  base=(.22+n*.035,.30+n*.04,.25+n*.025);soil=(.43,.41,.34)
  mix=max(0,min(1,earth*1.45));rgb=tuple(base[k]*(1-mix)+soil[k]*mix for k in range(3))
  colors.append(tuple(linear(c) for c in rgb)+(1,))
 faces=[]
 for j in range(rows-1):
  for i in range(width-1):
   a=j*width+i;b=a+1;c=a+width+1;d=a+width;faces.extend([(a,d,c),(a,c,b)])
 mesh=bpy.data.meshes.new('terrain_mesh');mesh.from_pydata([xyz(p) for p in verts],[],faces);mesh.update()
 attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER');uv=mesh.uv_layers.new(name='UVMap')
 for poly in mesh.polygons:
  poly.use_smooth=True
  for li in poly.loop_indices:
   idx=mesh.loops[li].vertex_index;attr.data[li].color=colors[idx];uv.data[li].uv=((verts[idx][0]+52)/104,(verts[idx][2]+80)/130)
 mesh.materials.append(MAT);root=asset('terrain');ob=bpy.data.objects.new('terrain_mesh',mesh);bpy.context.collection.objects.link(ob);ob.parent=root
 root['heightfield']=json.dumps(dict(minX=-52,minZ=-80,columns=width,rows=rows,step=1,heights=heights),separators=(',',':'))
 return root

def fortifications():
 # Four-metre modules with foundations extending into uneven exported terrain.
 m=Mesh();m.box((0,1.3,0),(4,4.4,1.15),'dark')
 for row in range(6):
  for i in range(4):
   x=-1.5+i
   m.box((x,row*.58+.1,0),(.96,.55,1.25),'stone' if (row+i)%3 else 'stoneLight')
 m.box((0,3.39,0),(4.08,.2,1.38),'stoneLight')
 for x in [-1.65,-.55,.55,1.65]:m.box((x,3.78,0),(.7,.65,1.32),'stone')
 for x in [-1.85,1.85]:m.box((x,1.4,.74),(.25,3.2,.35),'wood')
 asset('village_wall',m)
 m=Mesh()
 for x in [-4.5,4.5]:
  m.box((x,1.6,0),(1,5.2,1.6),'stone');m.box((x,4.22,0),(1.25,.2,1.85),'stoneLight')
  m.box((x,4.55,0),(1,.65,1.6),'stone')
  for y in [.4,1.4,2.4,3.4]:m.box((x,y,.82),(1.05,.09,.08),'stoneLight')
 m.box((0,4.02,0),(8.1,.7,1.1),'wood');m.box((0,4.43,0),(10.4,.18,1.85),'woodlight')
 m.box((0,4.2,.59),(1.7,.54,.09),'dark')
 for x in [-.5,0,.5]:m.box((x,4.2,.65),(.08,.35,.05),'flower')
 for side in [-1,1]:
  # Open reinforced gate leaves lie along the passage; the opening is genuinely empty.
  for z in [-.4,-1.2,-2,-2.8]:m.box((side*3.82,1.4,z),(.2,2.8,.77),'wood')
  for y in [.4,2.35]:m.box((side*3.68,y,-1.6),(.13,.16,3.3),'iron')
 asset('village_gate',m)
 m=Mesh();m.box((0,1.8,0),(2.7,5.8,2.7),'stone')
 for y in [.3,1.3,2.3,3.3,4.3]:m.box((0,y,0),(2.77,.1,2.77),'stoneLight')
 m.box((0,4.8,0),(3.15,.35,3.15),'stoneLight')
 for x,z in [(-1.1,-1.1),(-1.1,1.1),(1.1,-1.1),(1.1,1.1)]:m.box((x,5.26,z),(.83,.65,.83),'stone')
 for z in [-1.36,1.36]:m.box((0,3.15,z),(.2,.65,.025),'dark')
 asset('village_tower',m)

# Build the complete reusable library.
oak();oak('golden_oak',True);birch();pine();rock();plants();cottage();cottage('longhouse',True);well();windmill();props();ruins();human('elder',True);human('villager');human('child',child=True);creatures();terrain();fortifications()
eye_mat=MAT.copy();eye_mat.name='Greenfields · embers in the undergrowth'
eye_shader=eye_mat.node_tree.nodes.get('Principled BSDF');eye_shader.inputs['Emission Color'].default_value=rgba('e3b879');eye_shader.inputs['Emission Strength'].default_value=2.1
for name in ['wolf_eyes','golem_eyes','thornling_eyes']:bpy.data.objects[name].data.materials[0]=eye_mat
bpy.context.view_layer.update()
for name,root in ASSETS.items():
 objects=[o for o in root.children_recursive if o.type=='MESH']
 triangles=0;coords=[];invalid=0
 for o in objects:
  o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
  for v in o.data.vertices:
   p=o.matrix_world@v.co;coords.append(p)
   if not all(math.isfinite(k) for k in p):invalid+=1
 lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)]
 assert invalid==0 and triangles>0,name
 stats[name]=dict(triangles=triangles,meshes=len(objects),bounds_blender=[lo,hi])
 print('VERIFIED',name,triangles,'triangles',flush=True)
bpy.ops.object.select_all(action='DESELECT')
for root in ASSETS.values():
 root.select_set(True)
 for o in root.children_recursive:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'greenfields-kit.glb'),export_format='GLB',use_selection=True,export_extras=True)
(ROOT/'art/blender/asset-manifest.json').write_text(json.dumps(stats,indent=2))
# Save an organized, editable library rather than an overlapping export staging scene.
for i,(name,root) in enumerate(ASSETS.items()):
 root.location=(i%6*14,i//6*14,0)
 if name=='terrain':root.location=(40,110,0);root.scale=(.2,.2,.2)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.shading.color_type='VERTEX'
   area.spaces.active.region_3d.view_distance=95
   area.spaces.active.region_3d.view_location=Vector((35,35,0))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/greenfields-library.blend'),compress=True)
for root in ASSETS.values():root.location=(0,0,0);root.scale=(1,1,1)
bpy.context.view_layer.update()

# Reproducible neutral studio verification, using the actual authored meshes.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
scene.cycles.use_denoising=True;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.32,.38,.4,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.55
scene.view_settings.view_transform='AgX'
for root in ASSETS.values():
 for o in root.children_recursive:o.hide_render=True
floor=bpy.data.materials.new('Review backdrop');floor.diffuse_color=(.19,.23,.25,1)
bpy.ops.mesh.primitive_plane_add(size=400);plane=bpy.context.object;plane.name='Review floor';plane.data.materials.append(floor)
ld=bpy.data.lights.new('Review softbox','AREA');lo=bpy.data.objects.new('Review softbox',ld);scene.collection.objects.link(lo);ld.energy=1400;ld.shape='DISK';ld.size=8
ld2=bpy.data.lights.new('Review fill','AREA');fill=bpy.data.objects.new('Review fill',ld2);scene.collection.objects.link(fill);ld2.energy=700;ld2.size=7
camd=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',camd);scene.collection.objects.link(cam);scene.camera=cam;camd.type='ORTHO'
selection=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for name,root in ASSETS.items():
 if selection and name not in selection:continue
 coords=[o.matrix_world@Vector(corner) for o in root.children_recursive if o.type=='MESH' for corner in o.bound_box]
 low=Vector([min(v[i] for v in coords) for i in range(3)]);high=Vector([max(v[i] for v in coords) for i in range(3)])
 center=(low+high)*.5;span=max(high-low);span=max(span,1)
 cam.location=center+Vector((1,-1.6,1.1))*span;direction=center-cam.location;cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camd.ortho_scale=span*1.5
 lo.location=center+Vector((-1,-1.6,2))*span;lo.rotation_euler=(center-lo.location).to_track_quat('-Z','Y').to_euler();ld.energy=180*span*span;ld.size=span*1.2
 fill.location=center+Vector((1,.3,1))*span;fill.rotation_euler=(center-fill.location).to_track_quat('-Z','Y').to_euler();ld2.energy=65*span*span;ld2.size=span
 plane.location.z=low.z-.035
 for o in root.children_recursive:o.hide_render=False
 scene.render.filepath=str(REVIEW/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 for o in root.children_recursive:o.hide_render=True
 print('RENDERED',name,flush=True)
print('ASSET_LIBRARY_COMPLETE',len(ASSETS),flush=True)
