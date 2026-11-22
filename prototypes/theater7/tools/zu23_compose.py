# I-172: بيكب تويوتا (LM3D) + مدفع زو-23-2 (LuckySkink9661) — ثلاث قطع: الشاحنة، القاعدة اللي تلف، والسبطانتين اللي ترتفع
import bpy, sys, mathutils, math, json, bmesh
a=sys.argv[sys.argv.index('--')+1:]; TECH=a[0]; ZU=a[1]; OUT=a[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
def bbox(o):
    bb=[o.matrix_world@mathutils.Vector(c) for c in o.bound_box]; return mathutils.Vector([min(p[i] for p in bb) for i in range(3)]), mathutils.Vector([max(p[i] for p in bb) for i in range(3)])
def imp(path):
    before=set(sc.objects); bpy.ops.import_scene.gltf(filepath=path); new=[o for o in sc.objects if o not in before]
    for o in new:
        if o.type=='MESH': o.select_set(True)
    bpy.context.view_layer.objects.active=[o for o in new if o.type=='MESH'][0]
    bpy.ops.object.select_all(action='DESELECT')
    for o in new:
        if o.type=='MESH': o.select_set(True); 
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    meshes=[o for o in new if o.type=='MESH']
    for o in new:
        if o.type!='MESH': bpy.data.objects.remove(o, do_unlink=True)
    return meshes
# 1) الشاحنة بلا السلاح القديم
T=imp(TECH); KEEP_T={'Object_19','Object_25','Object_26','Object_9','Object_21','Object_18','Object_20'}
truck=[]
for o in T:
    if o.name in KEEP_T: truck.append(o)
    else: bpy.data.objects.remove(o, do_unlink=True)
# أرضية الصندوق: شعاع من فوق نص الصندوق
dg=bpy.context.evaluated_depsgraph_get(); floor=None
for o in truck:
    inv=o.matrix_world.inverted(); ok,loc,n,i=o.ray_cast(inv@mathutils.Vector((0,2.2,4)), (inv.to_3x3()@mathutils.Vector((0,0,-1))).normalized())
    if ok:
        z=(o.matrix_world@loc).z; floor=z if floor is None else max(floor,z)
print('FLOOR',floor)
# 2) المدفع: القسم العلوي بس
Z=imp(ZU); mount=[]; elev=[]
for o in Z:
    mn,mx=bbox(o); c=(mn+mx)/2
    keep = mn.z>=0.40 and abs(c.y)<0.9 and mn.x>-1.6 and not (c.z<0.55 and (abs(c.x+0.3)>0.7 or abs(c.y)>0.6))
    if not keep: bpy.data.objects.remove(o, do_unlink=True); continue
    (elev if (mn.x>0.30 and mn.z>0.93 and mx.z<1.25) else mount).append(o)
print('MOUNT',len(mount),'ELEV',len(elev))
def join(objs,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); j=bpy.context.view_layer.objects.active; j.name=name; return j
M=join(mount,'zu_mount'); E=join(elev,'zu_elev'); TR=join(truck,'truck')
# تخفيف: هدف ~18 ألف وجه للقاعدة و6 آلاف للسبطانات
def deci(o,target):
    n=len(o.data.polygons)
    if n>target: m=o.modifiers.new('d','DECIMATE'); m.ratio=target/n; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='d')
    print('FACES',o.name,n,'->',len(o.data.polygons))
deci(M,18000); deci(E,6000)
# 3) القياس والمكان: الشاحنة باللعبة ×0.8، فالمدفع ×1.25 حتى يطلع بحجمه الحقيقي؛ السبطانات (+x) لقدام الشاحنة (−y)
K=1.25; PIV=mathutils.Vector((-0.30,0,0.40)); TRN=mathutils.Vector((0.0,0,1.08))
rot=mathutils.Matrix.Rotation(-math.pi/2,4,'Z'); place=mathutils.Vector((0,2.25,floor))
for o in (M,E):
    o.data.transform(mathutils.Matrix.Translation(-PIV)); o.data.transform(mathutils.Matrix.Scale(K,4)); o.data.transform(rot)
trn=rot@((TRN-PIV)*K)   # مكان محور الارتفاع نسبة للقاعدة
E.data.transform(mathutils.Matrix.Translation(-trn))   # السبطانات حول محورها
# تصدير كل قطعة لحالها (أصلها = محور حركتها)
# القوام: كل صورة لحد 512 بكسل (للتلفون)، وتنحفظ JPEG
for im in bpy.data.images:
    if im.size[0] > 512 or im.size[1] > 512:
        f = 512 / max(im.size[0], im.size[1]); print('IMG', im.name, tuple(im.size)); im.scale(max(1, int(im.size[0] * f)), max(1, int(im.size[1] * f)))
def exp(o,path):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); o.location=(0,0,0)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_image_format='JPEG' if 'zu23_' in path and 'truck' not in path else 'AUTO')
exp(TR,OUT+'/zu23_truck.glb'); exp(M,OUT+'/zu23_mount.glb'); exp(E,OUT+'/zu23_elev.glb')
json.dump({'pivot':[place.x,place.y,place.z],'trunnion':[trn.x,trn.y,trn.z],'scale':K},open(OUT+'/zu23.json','w'))
# صورة المجمّع للفحص
M.location=place; E.location=place+trn
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=16; sc.cycles.use_denoising=False; sc.view_layers[0].cycles.use_denoising=False; sc.view_settings.view_transform='Standard'
sc.render.resolution_x=900; sc.render.resolution_y=500
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[1].default_value=1.0
sun=bpy.data.lights.new('s','SUN'); sun.energy=4; so=bpy.data.objects.new('s',sun); sc.collection.objects.link(so); so.rotation_euler=(math.radians(40),0,math.radians(-130))
cam=bpy.data.cameras.new('c'); cam.type='ORTHO'; cam.ortho_scale=9; co=bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co
for i,(loc,r) in enumerate([((-10,0.8,1.6),(math.radians(90),0,math.radians(-90))),((-6,-4,6),(math.radians(50),0,math.radians(-55))),((6,6,5),(math.radians(55),0,math.radians(135)))]):
    if i==2: E.rotation_euler=(math.radians(-35),0,0); M.rotation_euler=(0,0,math.radians(50)); E.location=place+mathutils.Matrix.Rotation(math.radians(50),3,'Z')@trn; E.rotation_euler=(0,0,0); E.rotation_mode='ZXY'; E.rotation_euler=(math.radians(0),math.radians(0),math.radians(50)); E.rotation_euler.x=0
    co.location=loc; co.rotation_euler=r; sc.render.filepath=f'{OUT}/comp_{i}.png'; bpy.ops.render.render(write_still=True)
print('DONE')
