"""Original castle monster and Hollow Reaper asset library. Run with Blender 4.5 --background --python.
All dimensions are metres; helper coordinates are game X / up / Z.
Exports vertex-painted, texture-free glTF assets with named animation pivots.
"""
import bpy, math, random, json, os, sys
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/models'
REVIEW = ROOT / 'art/review/monsters'
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

def chain(m,points,radius=.08,c='iron'):
 for i,p in enumerate(points):
  ring=[]
  for j in range(9):
   a=j*math.tau/8
   ring.append((p[0]+math.sin(a)*radius,p[1]+math.cos(a)*radius*1.35,p[2]+(math.sin(a)*radius*.4 if i%2 else 0)))
  m.tube(ring,[.018]*len(ring),c,5)

def robe(m,top,bottom,height,radius,c='cloth',panels=18):
 for i in range(panels):
  a=i*math.tau/panels;b=(i+1)*math.tau/panels
  ya=bottom+(.25 if i%3==0 else -.06 if i%3==1 else .1);yb=bottom+(.25 if (i+1)%3==0 else -.06 if (i+1)%3==1 else .1)
  p0=(math.sin(a)*radius,ya,math.cos(a)*radius*.68)
  p1=(math.sin(b)*radius,yb,math.cos(b)*radius*.68)
  p2=(math.sin(b)*radius*.58,top,math.cos(b)*radius*.51)
  p3=(math.sin(a)*radius*.58,top,math.cos(a)*radius*.51)
  mid=(math.sin((a+b)/2)*radius*.91,bottom+height*.47,math.cos((a+b)/2)*radius*.57)
  m.face([p0,p1,mid],c,.78+(i%4)*.07);m.face([p1,p2,mid],c,.84+(i%3)*.06);m.face([p2,p3,mid],c,.94);m.face([p3,p0,mid],c,.9)

def hollow_hood(m):
 # The opening has a thick cloth rim, a recessed lining, and a closed rear shell.
 outline=[(0,6.97),(.6,6.62),(.96,6.15),(1.05,5.6),(.86,4.98),(.5,4.69),(0,4.56),(-.5,4.69),(-.86,4.98),(-1.05,5.6),(-.96,6.15),(-.6,6.62)]
 front=[(x,y,1.05+.08*math.cos(x*2)) for x,y in outline]
 lip=[(x*.82,5.6+(y-5.6)*.85,.92) for x,y in outline]
 back=[(x*.75,5.72+(y-5.6)*1.05,-.51) for x,y in outline]
 inner=[(x*.56,5.6+(y-5.6)*.73,.02) for x,y in outline]
 for i in range(len(front)):
  j=(i+1)%len(front)
  m.face([front[i],front[j],lip[j],lip[i]],'clothEdge',.78+(i%3)*.07)
  ridge=tuple((Vector(front[i])+Vector(front[j])+Vector(back[i])+Vector(back[j]))/4+Vector((0,.035,-.07)))
  m.face([front[i],back[i],ridge],'cloth',.94);m.face([back[i],back[j],ridge],'cloth',.82);m.face([back[j],front[j],ridge],'cloth',.92);m.face([front[j],front[i],ridge],'cloth',1.0)
  m.face([lip[i],lip[j],inner[j],inner[i]],'lining')
  m.face([back[i],back[j],(0,5.7,-.79)],'cloth',.82)
 m.face(list(reversed(inner)),'black')
 # A folded tip falls backwards rather than forming a rigid cone.
 m.tube([(0,6.77,-.1),(.08,7.12,-.48),(.19,6.9,-.95)],[.27,.17,.01],'cloth',7)
 for side in [-1,1]:m.tube([(side*.9,5.27,1.07),(side*.62,4.75,1.0),(side*.85,4.38,.6)],[.11,.075,.01],'cloth',6)

def reaper():
 root=asset('reaper');body=node('reaper_body',root)
 m=Mesh();m.ellipsoid((0,1.15,-.73),(1.33,.77,1.62),'lining',14,7,.055)
 for i in range(7):
  a=(i-3)*.23;m.tube([(-1.1,1.25,-.8+i*.31),(0,1.9,-.8+i*.31),(1.1,1.25,-.8+i*.31)],[.1,.14,.1],'oldbone',7)
 m.object('reaper_abdomen',body)
 torso=node('reaper_torso',body,(0,2,0))
 cloak=Mesh();robe(cloak,4.42,.48,3.94,1.55)
 # Heavy, irregular fabric trails behind the upper body.
 for i in range(8):
  x=(i-3.5)*.32;z=-.64-.1*math.cos(i);bottom=.25+(i%3)*.3
  cloak.face([(x-.2,bottom,z-.35),(x+.2,bottom+.12,z-.4),(x*.68+.15,4.48,-.31),(x*.68-.15,4.48,-.31)],'clothEdge' if i%4==0 else 'cloth',.81+(i%3)*.06)
 cloak.object('reaper_cloak',torso,pivot=(0,2,0))
 ribs=Mesh()
 for i in range(5):
  y=2.8+i*.25
  for side in [-1,1]:ribs.tube([(side*.05,y+.08,.99),(side*.47,y-.02,1.01),(side*.63,y-.17,.86)],[.05,.07,.035],'oldbone',7)
 ribs.tube([(0,2.75,.99),(0,4.1,.97)],[.07,.09],'bone',7)
 for side in [-1,1]:
  ribs.ellipsoid((side*1.02,4.24,0),(.56,.25,.44),'oldbone',9,4,.1)
  for i in range(3):ribs.tube([(side*(.8+i*.19),4.32,-.09),(side*(.9+i*.28),4.68+(i%2)*.19,-.28)],[.13,.003],'bone',6)
 chain(ribs,[(x*.16,4.22-abs(x)*.08,.91) for x in range(-5,6)],.063)
 ribs.object('reaper_ribs',torso,pivot=(0,2,0))
 head=node('reaper_head',torso,(0,3.55,0))
 hood=Mesh();hollow_hood(hood);hood.object('reaper_hood',head,pivot=(0,5.55,0))
 face=Mesh();face.ellipsoid((0,5.36,.44),(.32,.5,.16),'oldbone',10,6)
 for s in [-1,1]:
  face.ellipsoid((s*.18,5.55,.592),(.18,.15,.022),'black',9,4)
  face.tube([(s*.28,5.24,.54),(s*.2,4.97,.55),(s*.07,4.91,.56)],[.08,.07,.04],'bone',6)
 for i in range(5):face.tube([((i-2)*.085,5.19,.6),((i-2)*.085,5.06+(i%2)*.045,.61)],[.03,.018],'bone',5)
 face.object('reaper_skull',head,pivot=(0,5.55,0))
 eyes=Mesh()
 for side in [-1,1]:eyes.ellipsoid((side*.18,5.565,.627),(.073,.035,.014),'eye',8,4)
 eyes.object('reaper_eyes',head,pivot=(0,5.55,0))
 for side in [-1,1]:
  arm=node('reaper_arm_'+('left' if side<0 else 'right'),torso,(side*1.08,2.17,0))
  a=Mesh();a.tube([(side*1.07,4.17,0),(side*1.5,3.39,.19),(side*1.68,2.64,.58)],[.22,.16,.105],'cloth',9)
  a.tube([(side*1.68,2.73,.54),(side*1.82,2.3,.75)],[.1,.07],'oldbone',7)
  for finger in range(4):
   x=side*(1.77+finger*.065);a.tube([(x,2.42,.72),(x+side*.03,2.15,.88),(x-side*.07,2.02,.95)],[.03,.023,.003],'bone',6)
  a.object('reaper_sleeve_'+str(side),arm,pivot=(side*1.08,4.17,0))
 for side in [-1,1]:
  for i in range(4):
   z=(i-1.5)*.69;hip=(side*.8,1.2,z-.35);knee=(side*(2.5+math.sin(i)*.3),1.8,z*1.6-.3);foot=(side*(3.25+math.sin(i)*.2),.05,z*2.0)
   leg=Mesh();leg.tube([hip,knee,foot],[.17,.13,.025],'oldbone',8)
   leg.tube([(side*.85,1.3,z-.4),(knee[0],knee[1]+.11,knee[2])],[.19,.105],'bone',7)
   leg.ellipsoid(knee,(.18,.2,.18),'iron',8,4)
   leg.object('reaper_leg_'+str((0 if side<0 else 4)+i),body,pivot=hip)
 weapon=Mesh();weapon.tube([(1.72,.58,.9),(1.67,3,.75),(1.43,5.4,.34),(1.29,7.0,.05)],[.087,.075,.085,.064],'wood',10)
 # Ferrules follow the curved shaft, including while the scythe rotates into contact.
 shaft=[(1.72,.58,.9),(1.67,3,.75),(1.43,5.4,.34),(1.29,7.0,.05)]
 def shaft_at(y):
  a,b=next((a,b) for a,b in zip(shaft,shaft[1:]) if a[1]<=y<=b[1])
  t=(y-a[1])/(b[1]-a[1]);return (a[0]+(b[0]-a[0])*t,y,a[2]+(b[2]-a[2])*t)
 for y in [1.7,2.0,2.3,4.4,4.7,6.7]:weapon.tube([shaft_at(y),shaft_at(y+.13)],[.11,.11],'iron',9)
 # Forged crescent with a hooked tip and a visibly sharp cutting edge.
 outline=[(1.33,7.04),(.6,7.25),(-.55,7.18),(-1.77,6.78),(-2.74,6.1),(-3.31,5.22),(-3.51,4.52),(-2.76,5.32),(-1.85,5.91),(-.75,6.34),(.36,6.55),(1.31,6.58)]
 prism(weapon,outline,.13,'iron',.09)
 edge=[(1.31,6.6),(.36,6.57),(-.75,6.36),(-1.85,5.93),(-2.76,5.34),(-3.51,4.52)]
 weapon.tube([(x,y,.177) for x,y in edge],[.035]*len(edge),'steel',6)
 for i in range(6):
  x=.1-i*.43;y=6.8-i*.105
  weapon.face([(x-.025,y-.13,.18),(x+.035,y+.11,.18),(x+.11,y+.16,.18),(x+.018,y-.11,.18)],'black')
 weapon.object('reaper_scythe',torso,pivot=(1.62,2.7,.74))
 return root


def armor():
 root=asset('armor');body=node('armor_body',root,(0,1.15,0))
 m=Mesh();robe(m,1.57,.35,1.22,.49,'cloth',12);m.object('armor_tattered_tabard',body,pivot=(0,1.15,0))
 m=Mesh()
 # Curved overlapping cuirass plates, collar, and riveted waist scales.
 m.ellipsoid((0,1.91,0),(.55,.66,.3),'iron',12,7)
 for s in [-1,1]:
  prism(m,[(s*.035,1.58),(s*.45,1.69),(s*.49,2.17),(s*.13,2.34)],.07,'steel',.265)
 for i in range(3):
  y=1.27+i*.14;prism(m,[(-.42,y),(.42,y),(.46,y+.13),(-.46,y+.13)],.08,'iron',.29)
  for s in [-1,1]:m.ellipsoid((s*.32,y+.07,.349),(.026,.026,.014),'gold',6,3)
 m.tube([(-.4,2.29,0),(0,2.39,.1),(.4,2.29,0)],[.1,.12,.1],'steel',8)
 # Defaced crown heraldry and an old chain sunk into the breastplate.
 relief(m,0,1.97,.36,.3,'rust');chain(m,[(i*.07,2.28-.05*abs(i),.36) for i in range(-4,5)],.041)
 m.object('armor_cuirass',body,pivot=(0,1.15,0))
 head=node('armor_head',body,(0,1.43,0))
 m=Mesh();m.ellipsoid((0,2.68,0),(.34,.44,.31),'iron',12,6)
 prism(m,[(-.29,2.73),(.29,2.73),(.23,2.89),(-.23,2.89)],.045,'steel',.245)
 prism(m,[(-.285,2.64),(.285,2.64),(.29,2.73),(-.29,2.73)],.052,'black',.285)
 prism(m,[(-.28,2.61),(-.2,2.35),(0,2.3),(.2,2.35),(.28,2.61)],.04,'steel',.29)
 for i in range(5):m.box(((i-2)*.072,2.48,.32),(.02,.17,.015),'black')
 for s in [-1,1]:m.tube([(s*.23,2.96,0),(s*.32,3.27,-.03),(s*.4,3.31,-.1)],[.08,.045,.005],'oldbone',6)
 m.object('armor_helmet',head,pivot=(0,2.58,0))
 eyes=Mesh()
 for s in [-1,1]:eyes.ellipsoid((s*.14,2.689,.32),(.073,.017,.012),'eye',8,3)
 eyes.object('armor_eyes',head,pivot=(0,2.58,0))
 for s in [-1,1]:
  label='left' if s<0 else 'right';pivot=(s*.58,2.19,0);arm=node('armor_arm_'+label,body,(s*.58,1.04,0))
  m=Mesh();m.tube([pivot,(s*.72,1.61,0),(s*.69,1.16,.09)],[.19,.14,.12],'iron',9)
  m.ellipsoid((s*.64,2.22,0),(.32,.25,.36),'steel',10,5)
  for i in range(3):m.tube([(s*(.51+i*.13),2.4,-.04),(s*(.61+i*.18),2.73+(i%2)*.08,-.13)],[.075,.002],'iron',6)
  m.ellipsoid((s*.7,1.19,.1),(.17,.19,.17),'steel',8,4)
  if s<0:
   outline=[(-1.02,1.99),(-.37,1.99),(-.31,1.51),(-.68,.81),(-1.06,1.51)]
   prism(m,outline,.12,'iron',.39)
   m.tube([(x,y,.47) for x,y in outline+[outline[0]]],[.038]*6,'steel',6)
   relief(m,-.69,1.56,.466,.35,'rust')
  else:
   m.tube([(.7,.99,.13),(.7,1.44,.13)],[.055,.055],'wood',8)
   m.tube([(.39,1.41,.13),(1.0,1.41,.13)],[.046,.046],'steel',6)
   prism(m,[(.61,1.47),(.79,1.47),(.77,2.93),(.7,3.35),(.63,2.93)],.055,'steel',.13)
   m.face([(.7,1.49,.166),(.7,3.35,.166),(.63,2.93,.166),(.61,1.47,.166)],'iron')
  m.object('armor_gauntlet_'+label,arm,pivot=pivot)
  leg=Mesh();hip=(s*.25,1.22,0)
  leg.tube([hip,(s*.26,.68,.05),(s*.28,.22,0)],[.19,.15,.13],'iron',9)
  leg.ellipsoid((s*.26,.68,.16),(.18,.22,.1),'steel',8,4)
  leg.ellipsoid((s*.28,.13,.16),(.19,.13,.32),'steel',10,4)
  leg.object('armor_leg_'+label,root,pivot=hip)
 return root

def spider():
 root=asset('spider');body=node('spider_body',root)
 m=Mesh();m.ellipsoid((0,.76,-.39),(.66,.5,.81),'lining',14,8,.04)
 for i in range(4):
  z=-.97+i*.32;m.tube([(-.49,.85,z),(0,1.24,z),(.49,.85,z)],[.065,.12,.065],'iron',8)
  for s in [-1,1]:m.tube([(s*.4,1.06,z),(s*.65,1.42,z-.14)],[.085,.004],'oldbone',6)
 m.ellipsoid((0,.7,.4),(.48,.35,.47),'iron',12,6)
 m.object('spider_carapace',body)
 head=node('spider_head',body,(0,.78,.64))
 m=Mesh()
 for s in [-1,1]:
  m.tube([(s*.19,.7,.75),(s*.33,.46,1.04),(s*.22,.21,1.18),(s*.08,.4,1.1)],[.12,.08,.03,.002],'bone',7)
  for i in range(3):
   m.ellipsoid((s*(.12+i*.115),.8+(i%2)*.11,.805-i*.047),(.09-i*.017,.09-i*.017,.047),'black',8,4)
 m.object('spider_fangs',head,pivot=(0,.78,.64))
 eyes=Mesh()
 for s in [-1,1]:
  for i in range(3):eyes.ellipsoid((s*(.12+i*.115),.8+(i%2)*.11,.853-i*.047),(.058-i*.011,.051-i*.009,.019),'eye',8,4)
 eyes.object('spider_eyes',head,pivot=(0,.78,.64))
 for s in [-1,1]:
  for i in range(4):
   z=(i-1.5)*.33;hip=(s*.39,.7,z);knee=(s*(1.0+.2*math.sin(i)),1.02,z*2);foot=(s*(1.48+.13*math.sin(i)),.035,z*2.7+.1)
   leg=Mesh();leg.tube([hip,knee,foot],[.098,.08,.009],'iron',7)
   leg.tube([(hip[0],hip[1]+.065,hip[2]),(knee[0],knee[1]+.045,knee[2])],[.061,.04],'steel',6)
   leg.ellipsoid(knee,(.11,.12,.11),'oldbone',8,4)
   leg.object('spider_leg_'+str((0 if s<0 else 4)+i),body,pivot=hip)
 return root

def spire():
 m=Mesh()
 for i in range(7):
  a=i*math.tau/7;x,z=math.sin(a)*.6,math.cos(a)*.6;h=1.5+(i%3)*.36
  m.tube([(x*.85,0,z*.85),(x*.7,h*.45,z*.7),(x*.38,h,z*.38)],[.24,.15,.002],'iron' if i%2 else 'oldbone',5)
 m.tube([(0,0,0),(.13,1.42,-.08),(0,2.7,0)],[.32,.19,.001],'bone',6)
 asset('grave_spire',m)

reaper();armor();spider();spire()
# A solid, hooked projectile blade, authored around its flight centre.
m=Mesh()
outline=[(-.95,-.12),(-.62,.57),(-.08,.96),(.58,.81),(.96,.32),(.72,.41),(.28,.44),(-.18,.28),(-.54,-.15),(-.66,-.83)]
prism(m,outline,.1,'steel')
m.tube([(x,y,.065) for x,y in outline[:5]],[.035]*5,'bone',6)
asset('widow_blade',m)
sys.path.insert(0,str(Path(__file__).parent))
from animate_reaper import author_reaper
author_reaper(ASSETS['reaper'],Mesh,node,xyz,ROOT)
# Eyes are separate emissive meshes; there are no runtime textures or extra lights.
eyeMat=MAT.copy();eyeMat.name='Embers inside empty sockets';eyeNode=eyeMat.node_tree.nodes.get('Principled BSDF')
eyeNode.inputs['Emission Color'].default_value=rgba('ff183e');eyeNode.inputs['Emission Strength'].default_value=2.8
for obj in bpy.data.objects:
 if obj.type=='MESH' and obj.name.endswith('_eyes'):obj.data.materials[0]=eyeMat
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
bpy.ops.export_scene.gltf(filepath=str(OUT/'castle-creatures.glb'),export_format='GLB',use_selection=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_optimize_animation_keep_anim_object=True)
(ROOT/'art/blender/monsters-manifest.json').write_text(json.dumps(stats,indent=2))
for i,root in enumerate(ASSETS.values()):root.location=(i*11,0,0)
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.shading.color_type='VERTEX';area.spaces.active.region_3d.view_distance=32;area.spaces.active.region_3d.view_location=Vector((14,0,3))
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art/blender/monsters-library.blend'),compress=True)
for root in ASSETS.values():root.location=(0,0,0)
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
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
print('MONSTER_LIBRARY_COMPLETE',len(ASSETS),flush=True)
