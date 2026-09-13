"""Render actual NLA attack/phase poses from the editable Blender library."""
import bpy, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'art/blender/monsters-library.blend'))
root=bpy.data.objects['reaper'];root.location=(0,0,0)
for o in bpy.data.objects:
 if o.type=='MESH':o.hide_render=o not in root.children_recursive
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=840;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.095,.14,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
scene.view_settings.view_transform='AgX'
mat=bpy.data.materials.new('Dark studio');mat.diffuse_color=(.022,.028,.04,1)
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(mat)
center=Vector((0,0,3.5))
for name,pos,color,power,size in [('Moon',(-5,-7,11),(.7,.83,1),1900,5),('Blood rim',(5,3,8),(.75,.12,.27),2400,4),('Hood fill',(1,-5,5),(.65,.7,.85),250,3)]:
 d=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler();d.color=color;d.energy=power;d.shape='DISK';d.size=size
cd=bpy.data.cameras.new('Action review');cam=bpy.data.objects.new('Action review',cd);scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO';cd.ortho_scale=11.7
cam.location=(8,-16,9);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
for name,clip,time in [('phase-one','reaper_idle_1',0),('phase-two','reaper_phase',2.1),('widow-loom','reaper_loom_2',1.6+.65),('gallows-contact','reaper_dive_2',1.2+1.08),('execution-contact','reaper_heavy_2',1.3+.32)]:
 for o in root.children_recursive:
  if o.animation_data:
   for track in o.animation_data.nla_tracks:track.mute=track.name!=clip
 scene.frame_set(round(time*100));bpy.context.view_layer.update()
 scene.render.filepath=str(ROOT/'art/review/monsters'/('motion-'+name+'.png'));bpy.ops.render.render(write_still=True)
 print('REVIEWED',clip,time,flush=True)
