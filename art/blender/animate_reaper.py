"""Blender-authored action library: anticipation, contact, recoil and phase rupture.
NLA track names merge every rigid pivot into one glTF clip. No runtime attack posing.
"""
import bpy, math, re, json
from mathutils import Vector, Quaternion, Euler

FPS = 100

def author_reaper(root, Mesh, node, xyz, ROOT):
    torso = bpy.data.objects['reaper_torso']
    # The scythe wrist pivot follows the right hand through every pose.
    bpy.context.view_layer.update()
    scythe=bpy.data.objects['reaper_scythe'];world=scythe.matrix_world.copy()
    scythe.parent=bpy.data.objects['reaper_arm_right'];scythe.matrix_world=world
    bpy.context.view_layer.update()
    # Exposed vertebrae connect the cowl while it twists during the rupture.
    neck=Mesh()
    neck.tube([(0,4.2,0),(0,4.65,.02),(0,5.45,.05)],[.16,.13,.11],'oldbone',8)
    for i in range(6):
        y=4.3+i*.18
        neck.ellipsoid((0,y,.015),(.21,.08,.16),'bone',8,4)
    neck.object('reaper_neck',torso,pivot=(0,2,0))
    # Folded funerary wings become a much wider, torn skeletal silhouette in phase II.
    for side in [-1, 1]:
        pivot = (side * .58, 3.9, -.48)
        wing = node('reaper_mantle_' + ('left' if side < 0 else 'right'), torso,
                    (side * .58, 1.9, -.48))
        m = Mesh()
        for i in range(4):
            tip = (side * (.95 + i * .14), 6.25 - i * .63, -1.12 - i * .35)
            bend = (side * (1.05 + i * .09), 4.85 - i * .25, -.78)
            m.tube([pivot, bend, tip], [.13, .085, .008], 'bone', 7)
            if i < 3:
                m.face([pivot, bend, tip, (side * 1.05, 3.85 - i * .25, -1.9),
                        (side * .7, 3.25 - i * .5, -1.05)], 'cloth', .78 + .05 * i)
        m.object('reaper_membrane_' + str(side), wing, pivot=pivot)
    jaw = node('reaper_jaw', bpy.data.objects['reaper_head'], (0, -.3, .57))
    m = Mesh()
    m.tube([(-.3, 5.2, .56), (-.26, 4.85, .66), (0, 4.69, .74),
            (.26, 4.85, .66), (.3, 5.2, .56)], [.05, .065, .07, .065, .05], 'bone', 6)
    for i in range(6):
        x=(i-2.5)*.068
        m.tube([(x, 4.82, .73), (x, 5.02, .74)], [.025,.001], 'bone', 5)
    m.object('reaper_lower_jaw', jaw, pivot=(0,5.25,.57))
    m = Mesh(); m.ellipsoid((0,3.37,1.04),(.18,.34,.12),'eye',10,6)
    m.object('reaper_heart_eyes',torso,pivot=(0,2,0))
    names=['body','torso','head','cloak','scythe','arm_left','arm_right','mantle_left','mantle_right','jaw']+[f'leg_{i}' for i in range(8)]
    objects={name:bpy.data.objects['reaper_'+name] for name in names}
    rest={name:o.location.copy() for name,o in objects.items()}
    source=(ROOT/'src/enemies/BossAI.ts').read_text()
    attacks={}
    for kind in ['slash','heavy','lunge','sweep','hunt','eruption','reave','dive','loom']:
        block=re.search(r'\b'+kind+r':\s*\{(.*?)\}',source,re.S).group(1)
        attacks[kind]={k:float(re.search(k+r':\s*([\d.]+)',block).group(1)) for k in ['windup','duration','recovery']}
    basis=Quaternion((1,0,0),math.pi/2)
    smooth=lambda x: max(0,min(1,x))**2*(3-2*max(0,min(1,x)))
    def pose(kind,phase,t):
        p={n:dict(r=[0.,0.,0.],d=[0.,0.,0.],s=[1.,1.,1.]) for n in names}
        def rot(n,x=0,y=0,z=0):p[n]['r']=[x,y,z]
        def move(n,x=0,y=0,z=0):p[n]['d']=[x,y,z]
        opened=1 if phase==2 else 0
        if kind=='phase':opened=smooth((t-.85)/1.05)
        rot('mantle_left',-.25*opened,.3*opened,1.18*opened)
        rot('mantle_right',-.25*opened,-.3*opened,-1.18*opened)
        for n in ['mantle_left','mantle_right']:p[n]['s']=[1+.25*opened,1+.5*opened,1+.2*opened]
        p['jaw']['s']=[1+.2*opened,1+.4*opened,1]
        move('jaw',y=-.18*opened,z=.18*opened)
        rot('jaw',.72*opened)
        rot('head',-.12*opened,0,.22*opened)
        if kind in ['idle','walk']:
            # Seamless breathing/gait cycles; asymmetry comes from bent limb silhouettes.
            cycle=t*math.tau/(2.4 if kind=='idle' else .8)
            move('body',y=math.sin(cycle)*(.04 if kind=='idle' else .09))
            rot('head',-.12*opened,math.sin(cycle)*.045,.22*opened+math.sin(cycle)*.055)
            rot('cloak',math.sin(cycle)*.05)
            for i in range(8):
                a=cycle+(i%2)*math.pi+(math.pi if i<4 else 0)
                rot(f'leg_{i}',0,math.sin(a)*(.2 if kind=='walk' else .025),
                    (-1 if i<4 else 1)*max(0,math.sin(a))*(.15 if kind=='walk' else 0))
        elif kind in ['phase','wake']:
            length=3.4 if kind=='phase' else 2.7
            tension=math.sin(math.pi*t/length)
            move('body',y=.35*tension)
            rot('torso',-.22*tension,0,.1*math.sin(t*7)*tension)
            rot('head',-.6*tension,0,.22*opened+.22*math.sin(t*5)*tension)
            rot('arm_left',-1.9*tension,0,-.65*tension)
            rot('arm_right',-1.2*tension,0,.65*tension)
            rot('scythe',-.18*tension,0,.3*tension)
            rot('jaw',.72*opened+.28*tension)
            for i in range(8):rot(f'leg_{i}',0,.08*math.sin(t*5+i)*tension,(-1 if i<4 else 1)*.19*tension)
        elif kind=='death':
            f=smooth(t/2.6);move('body',y=-.9*f);rot('torso',1.35*f);rot('scythe',0,0,-1.2*f)
            rot('mantle_left',0,0,-.3*f);rot('mantle_right',0,0,.3*f)
            for i in range(8):rot(f'leg_{i}',0,0,(1 if i<4 else -1)*.7*f)
        else:
            data=attacks[kind];w=data['windup'];d=1.62 if kind=='slash' and phase==2 else data['duration']
            r=data['recovery']*(.8 if phase==2 else 1);a=t-w
            anticipation=smooth(t/w) if a<0 else 1
            recover=1-smooth((a-d)/r) if a>d else 1
            rot('torso',-.12*anticipation*recover)
            if kind in ['slash','heavy']:
                beats=[.32] if kind=='heavy' else [.12,.72]+([1.32] if phase==2 else [])
                cut=-.8*anticipation
                if a>=0:
                    cut=0
                    for beat in beats:
                        if beat-.18<=a<=beat:
                            cut=-.8+2.1*smooth((a-beat+.18)/.18);break
                        if beat<a<beat+.3:
                            cut=1.3*(1-smooth((a-beat)/.3));break
                rot('scythe',cut*(1.05 if kind=='heavy' else .7),cut*.35,0)
                rot('arm_right',cut*.48,0,.08)
                rot('arm_left',-.5*anticipation*recover,0,-.24*anticipation*recover)
                rot('torso',cut*.09,cut*.15)
            elif kind=='dive':
                if a<0:
                    move('body',y=-.55*anticipation);rot('torso',.2*anticipation)
                elif a<1.05:
                    h=6.8*math.sin(math.pi*a/1.05)
                    move('body',y=h);rot('torso',-.22*math.sin(math.pi*a/1.05))
                    rot('scythe',-1.3*math.sin(math.pi*a/1.05))
                else:
                    f=1-smooth((a-1.05)/.65);move('body',y=-.7*f)
                    rot('torso',.65*f);rot('scythe',1.12*f)
                fold=math.sin(math.pi*max(0,min(1,a/1.05))) if a>=0 else -.35*anticipation
                for i in range(8):rot(f'leg_{i}',0,0,(1 if i<4 else -1)*.75*fold)
                rot('arm_left',-1.65*max(0,fold));rot('arm_right',-.9*max(0,fold))
            elif kind=='reave':
                throw=smooth((a+.12)/.34) if a<.22 else 1-smooth((a-2.85)/.25)
                rot('scythe',-.45*anticipation+1.4*throw,.55*anticipation-.95*throw)
                rot('arm_right',-.4*anticipation+1.25*throw,0,.2)
                rot('arm_left',-.65*anticipation*recover,0,-.5*anticipation*recover)
            elif kind=='lunge':
                rot('torso',(-.25 if a<0 else .35)*anticipation*recover)
                rot('scythe',.3*anticipation*recover,0,-.65*anticipation*recover)
                rot('arm_right',.2*anticipation*recover)
            else:
                f=anticipation*recover
                if kind=='loom':
                    # Arms weave in opposition; each snap releases a crossing crescent.
                    snap=sum(math.exp(-((a-b)/.11)**2) for b in [.15,.65,1.2,1.7]) if a>=0 else 0
                    rot('arm_left',-1.4*f+snap*.7,0,-.9*f)
                    rot('arm_right',-1.2*f-snap*.3,0,.6*f)
                    rot('head',-.2,.28*math.sin(t*3)*f,.25)
                    rot('scythe',-.2*f,0,.6*f)
                else:
                    rot('arm_left',-1.8*f,0,-.35*f)
                    rot('arm_right',-.8*f,0,.3*f)
                    rot('scythe',-.4*f,math.sin(math.pi*max(0,a)/max(d,.1))*.8)
                    rot('torso',-.23*f);rot('head',-.24*f,0,.1*f)
        return p
    clips=[]
    for phase in [1,2]:
        for kind in ['idle','walk']+list(attacks):
            if kind=='loom' and phase==1:continue
            duration=2.4 if kind=='idle' else .8 if kind=='walk' else attacks[kind]['windup']+(1.62 if kind=='slash' and phase==2 else attacks[kind]['duration'])+attacks[kind]['recovery']*(.8 if phase==2 else 1)
            clips.append((f'reaper_{kind}_{phase}',kind,phase,duration))
    clips += [('reaper_phase','phase',2,3.4),('reaper_wake','wake',1,2.7),('reaper_death','death',2,2.6)]
    bpy.context.scene.render.fps=FPS
    for clip,kind,phase,duration in clips:
        for o in objects.values():
            o.animation_data_create();o.animation_data.action=bpy.data.actions.new(clip+'__'+o.name)
            o.rotation_mode='QUATERNION'
        frames=sorted(set(list(range(0,round(duration*FPS)+1,2))+[round(duration*FPS)]))
        for frame in frames:
            p=pose(kind,phase,frame/FPS)
            for name,o in objects.items():
                v=p[name];q=Euler(v['r'],'XYZ').to_quaternion()
                o.location=rest[name]+Vector(xyz(v['d']))
                o.rotation_quaternion=basis@q@basis.inverted()
                o.scale=(v['s'][0],v['s'][2],v['s'][1])
                for path in ['location','rotation_quaternion','scale']:o.keyframe_insert(path,frame=frame)
        for o in objects.values():
            action=o.animation_data.action;track=o.animation_data.nla_tracks.new();track.name=clip
            track.strips.new(clip,0,action);o.animation_data.action=None;track.mute=True
    for name,o in objects.items():
        o.location=rest[name];o.rotation_quaternion=(1,0,0,0);o.scale=(1,1,1)
    bpy.context.scene.frame_set(0);bpy.context.scene.frame_end=480
    (ROOT/'art/blender/reaper-animation-manifest.json').write_text(json.dumps({
        'fps':FPS,'clips':{name:duration for name,_,_,duration in clips},
        'contacts':{'slash':[.12,.72],'slash_phase2':[.12,.72,1.32],'heavy':[.32],'dive':[1.05],'reave_release':[.22],'loom':[.15,.65,1.2,1.7]},
        'timing_source':'src/enemies/BossAI.ts','authoring':'Blender NLA tracks; local pivot transforms baked at 50 Hz'},indent=2))
