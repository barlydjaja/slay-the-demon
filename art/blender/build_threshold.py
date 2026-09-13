"""A deep gatehouse, lifting ironwork and softly vertex-faded shafts, all made in Blender."""
import bpy, math
from mathutils import Vector

def author_threshold(asset, Mesh, archband, relief, xyz):
    root=asset('exit_threshold')
    m=Mesh()
    for z in [0,-2.8,-5.6,-8.4]:
        archband(m,7.2,4.1,3.3,.32,.65,'stoneLight',z)
        for side in [-1,1]:
            m.box((side*3.86,2.1,z),(.68,4.2,.85),'stone')
            m.box((side*3.86,.3,z),(.94,.6,1.12),'mortar')
            m.box((side*3.86,4.1,z),(.94,.28,1),'edge')
    for side in [-1,1]:
        for i in range(14):
            for row in range(8):
                m.box((side*4.2,.4+row*.79,-i*.64),(.3,.75,.6),'mortar' if (i+row)%4==0 else 'stone')
        # Fixed carved masks anchor the chains and cast broken silhouettes.
        m.ellipsoid((side*3.9,5.05,.38),(.43,.62,.28),'stoneLight',10,6)
        for x in [-.16,.16]:m.ellipsoid((side*3.9+x,5.14,.64),(.09,.11,.028),'black',8,4)
        m.tube([(side*3.9,4.98,.6),(side*3.9,4.67,.54)],[.075,.02],'black',6)
    for i in range(16):
        for j in range(7):m.box(((j-3)*1.02,-.11,-i*.62),(1,.2,.6),'stone' if (i+j)%3 else 'mortar')
    m.object('threshold_vault',root)
    gate=bpy.data.objects.new('threshold_lift',None);bpy.context.collection.objects.link(gate);gate.parent=root
    m=Mesh()
    for i in range(13):
        x=(i-6)*.57
        m.tube([(x,.2,0),(x,7.5,0)],[.065,.065],'iron',8)
        m.tube([(x,.43,0),(x,0,0)],[.17,.001],'iron',6)
        if i%2:
            for y in [2.9,5.2]:
                pts=[(x,y+.42,.02),(x+.27,y,.02),(x,y-.42,.02),(x-.27,y,.02),(x,y+.42,.02)]
                m.tube(pts,[.045]*5,'iron',6)
    for y in [1,3.9,6.9]:m.box((0,y,0),(7.4,.16,.22),'iron')
    relief(m,0,5.1,.16,.7,'stoneLight')
    m.object('threshold_ironwork',gate)
    movers=[gate]
    for side in [-1,1]:
        weight=bpy.data.objects.new('threshold_counterweight_'+str(side),None);bpy.context.collection.objects.link(weight);weight.parent=root
        m=Mesh();m.box((side*4.4,7.6,-.65),(.55,1.1,.5),'iron')
        m.object('threshold_weight_'+str(side),weight);movers.append(weight)
        m=Mesh()
        for i in range(45):
            y=.3+i*.19
            pts=[(side*3.65+math.sin(a*math.tau/10)*.095,y+math.cos(a*math.tau/10)*.145, -.12+(.045*math.sin(a*math.tau/10) if i%2 else 0)) for a in range(11)]
            m.tube(pts,[.023]*11,'iron',5)
        m.object('threshold_chain_'+str(side),gate)
    # Long light curtains have transparent edges and ends, never an opaque rectangle.
    raymat=bpy.data.materials.new('Cold air · feathered light');raymat.use_nodes=True
    bsdf=raymat.node_tree.nodes.get('Principled BSDF');vc=raymat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color'
    raymat.node_tree.links.new(vc.outputs['Color'],bsdf.inputs['Base Color']);raymat.node_tree.links.new(vc.outputs['Alpha'],bsdf.inputs['Alpha'])
    bsdf.inputs['Emission Color'].default_value=(.32,.47,.56,1);bsdf.inputs['Emission Strength'].default_value=.4
    raymat.surface_render_method='BLENDED'
    for i in range(7):
        m=Mesh();x=(i-3)*.77
        for row in range(20):
            for col in range(8):
                pts=[]
                for r,c in [(row,col),(row+1,col),(row+1,col+1),(row,col+1)]:
                    t=r/20;u=c/8
                    pts.append((x*(.8+t*.9)+(u-.5)*(.25+t*.9),6.3*(1-t)+.1,-6.8+t*18))
                m.face(pts,'glassBlue')
        o=m.object('threshold_ray_'+str(i),root);o.data.materials.clear();o.data.materials.append(raymat)
        colors=o.data.color_attributes['Color']
        for poly in o.data.polygons:
            for li in poly.loop_indices:
                v=o.data.vertices[o.data.loops[li].vertex_index].co
                t=(6.4-v.z)/6.3; t=max(0,min(1,t));width=.25+t*.9
                u=(v.x-x*(.8+t*.9))/width+.5
                alpha=max(0,math.sin(math.pi*t))**.7*max(0,math.sin(math.pi*max(0,min(1,u))))**2*.09
                colors.data[li].color=(.5,.66,.76,alpha)
    bpy.context.scene.render.fps=100
    for o in movers:
        o.animation_data_create();action=bpy.data.actions.new('threshold_open__'+o.name);o.animation_data.action=action
        for t,h in [(0,0),(.35,.03),(.5,.19),(.7,.11),(2.7,5),(4,7.6),(4.4,7.6)]:
            o.location=Vector(xyz((0,h if o==gate else -.72*h,0)));o.keyframe_insert('location',frame=round(t*100))
        track=o.animation_data.nla_tracks.new();track.name='threshold_open';track.strips.new('threshold_open',0,action);track.mute=True;o.animation_data.action=None;o.location=(0,0,0)
    return root
