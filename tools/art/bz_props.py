# «منطقة القتال» I-166: أشياء الأرض (بيوت، نخل، شجر، سيارات متروكة) ببلندر من نفس زاوية الدبابات (50°) وبظل حقيقي
# blender -b --python bz_props.py -- <model> <out> [S] [exp]   ← يطلّع <model>_r0.png و _r1.png (تدوير 0° و 90°) و<model>.json
import bpy, sys, math, mathutils, json, os
a = sys.argv[sys.argv.index('--')+1:]; M = a[0]; OUT = a[1]; S = int(a[2]) if len(a) > 2 else 256; EXP = float(a[3]) if len(a) > 3 else .45; EL = 50
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/home/user/Wariq3/prototypes/theater/models/{M}.glb')
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
sc.view_layers[0].cycles.use_denoising = False; sc.render.film_transparent = True; sc.render.resolution_x = S; sc.render.resolution_y = S
sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = EXP
for o in [o for o in sc.objects if o.type == 'MESH' and not o.visible_get()]: bpy.data.objects.remove(o)
meshes = [o for o in sc.objects if o.type == 'MESH']
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]; bpy.ops.object.join(); body = bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bb = [body.matrix_world @ mathutils.Vector(c) for c in body.bound_box]; mn = mathutils.Vector([min(p[i] for p in bb) for i in range(3)]); mx = mathutils.Vector([max(p[i] for p in bb) for i in range(3)])
# تطبيع: أكبر بُعد (عرض/طول، أو الارتفاع ×.9 للنخل) = 10 وحدات، المركز على الأصل، الأرض z=0
k = 10 / max(mx.x - mn.x, mx.y - mn.y, (mx.z - mn.z) * .9); body.location = (-(mn.x + mx.x) / 2 * k, -(mn.y + mx.y) / 2 * k, -mn.z * k); body.scale = (k, k, k); bpy.ops.object.transform_apply(location=True, scale=True)
H = (mx.z - mn.z) * k; body.rotation_mode = 'XYZ'
bpy.ops.mesh.primitive_plane_add(size=80); pl = bpy.context.active_object; pl.is_shadow_catcher = True
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 5.5; sun.angle = math.radians(4); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(38), 0, math.radians(-135))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 1.1; w.node_tree.nodes['Background'].inputs[0].default_value = (.85, .88, 1, 1)
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 18; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
el = math.radians(EL); D = 80; zt = min(3.5, H * .35); co.location = (0, -D * math.cos(el), D * math.sin(el) + zt); co.rotation_euler = (math.radians(90 - EL), 0, 0)
os.makedirs(OUT, exist_ok=True)
for i, r in enumerate([0, 90]):
    body.rotation_euler = (0, 0, math.radians(r)); sc.render.filepath = f'{OUT}/{M}_r{i}.png'; bpy.ops.render.render(write_still=True)
from bpy_extras.object_utils import world_to_camera_view
v = world_to_camera_view(sc, co, mathutils.Vector((0, 0, 0)))
json.dump({'o0': [v.x * S, (1 - v.y) * S], 'H': H, 'S': S, 'ortho': 18}, open(f'{OUT}/{M}.json', 'w')); print('DONE', M, H)
