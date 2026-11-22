# «منطقة القتال» I-166: الجندي (مجسم بحركات Mixamo) بـ8 اتجاهات × حالات: ركض، رمي واقف، رمي جاثي، موت
import bpy, sys, math, mathutils, os, json
OUT = sys.argv[sys.argv.index('--')+1]; S = 96; EL = 50
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/home/user/Wariq3/prototypes/theater/models/soldier.glb')
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name.startswith('Icosphere')]: bpy.data.objects.remove(o)   # كرة مساعدة مخفية بالملف
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 16; sc.cycles.use_denoising = False; sc.view_layers[0].cycles.use_denoising = False
sc.render.film_transparent = True; sc.render.resolution_x = S; sc.render.resolution_y = S; sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = .6
arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]; root = arm
while root.parent: root = root.parent
root.rotation_mode = 'XYZ'; r0 = root.rotation_euler.copy()
# تطبيع الطول لـ1.8 م، والجندي على الأرض بنص الإطار، ويلف حول مركزه (Empty)
def body_pts():
    bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get(); P = []
    for o in [o for o in sc.objects if o.type == 'MESH' and o.name != 'gun']:
        oe = o.evaluated_get(dg); me = oe.to_mesh(); P += [oe.matrix_world @ v.co for v in me.vertices]; oe.to_mesh_clear()
    return P
sc.frame_set(1); P = body_pts(); zmin = min(p.z for p in P); zmax = max(p.z for p in P); kk = 1.8 / (zmax - zmin)
piv = bpy.data.objects.new('piv', None); sc.collection.objects.link(piv); piv.location = (0, 0, 0)
root.parent = piv; piv.scale = (kk, kk, kk); bpy.context.view_layer.update()
P = body_pts(); cx = sum(p.x for p in P) / len(P); cy = sum(p.y for p in P) / len(P); zmin = min(p.z for p in P)
root.location = root.location - mathutils.Vector((cx, cy, zmin)) / kk; bpy.context.view_layer.update()
piv.rotation_mode = 'XYZ'
P2 = body_pts(); print('DBG zmin', min(p.z for p in P2), 'zmax', max(p.z for p in P2), 'cx', sum(p.x for p in P2)/len(P2), 'cy', sum(p.y for p in P2)/len(P2), 'root', tuple(root.location), 'rootpar', root.parent.name if root.parent else None, 'kk', kk)
mt = bpy.data.materials.new('gunm'); mt.use_nodes = True; mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.025, .025, .022, 1)
bpy.ops.mesh.primitive_cube_add(size=1); gun = bpy.context.active_object; gun.name = 'gun'; gun.data.materials.append(mt)
hb = [b for b in arm.pose.bones if 'RightHand' in b.name and not any(q in b.name for q in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'))][0]
def place_gun():   # البندقية بيد الجندي: من مكان عظمة اليد الحقيقي كل إطار، طولها 0.9 م
    bpy.context.view_layer.update(); M = arm.matrix_world @ hb.matrix; loc, rot, _ = M.decompose()
    gun.matrix_world = mathutils.Matrix.LocRotScale(loc + rot @ mathutils.Vector((0, .25, 0)) * 1, rot, mathutils.Vector((.045, .9, .07)))
bpy.ops.mesh.primitive_plane_add(size=20); bpy.context.active_object.is_shadow_catcher = True
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 5; so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(38), 0, math.radians(-135))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 1.1
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 3.6; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
el = math.radians(EL); D = 30; co.location = (0, -D * math.cos(el), D * math.sin(el) + .55); co.rotation_euler = (math.radians(90 - EL), 0, 0)
A = {a.name.split('_GLTF')[0]: a for a in bpy.data.actions}
ST = [('run', 'run', 6), ('shoot', 'simple shoot', 4), ('crouch', 'crouch shoot', 4), ('die', 'simple death', 6)]
os.makedirs(OUT, exist_ok=True)
# اتجاه وجه الجندي بالملف: نجرّب ونصحح بـF0 (Mixamo يواجه -Y بالعادة بعد الاستيراد)
F0 = float(sys.argv[sys.argv.index('--')+2]) if len(sys.argv) > sys.argv.index('--')+2 else 0
for key, an, nf in ST:
    act = A[an]; arm.animation_data_create(); arm.animation_data.action = act; f0, f1 = act.frame_range
    for d in range(8):
        piv.rotation_euler = (0, 0, math.radians(F0) - d * math.radians(45))
        for k in range(nf):
            fr = f0 + (f1 - f0) * (k / max(1, nf - 1) if key == 'die' else k / nf); sc.frame_set(int(round(fr))); place_gun()
            sc.render.filepath = f'{OUT}/inf_{key}_{d}_{k}.png'; bpy.ops.render.render(write_still=True)
print('DONE inf')
