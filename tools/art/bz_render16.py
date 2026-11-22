# «منطقة القتال» I-166: رسم المجسمات بـBlender (Cycles) بـ16 اتجاه، ظل حقيقي على الأرض، البدن والبرج منفصلين، ونسخة محروقة
import bpy, bmesh, sys, math, mathutils, json, os
from bpy_extras.object_utils import world_to_camera_view
a = sys.argv[sys.argv.index('--')+1:]; M = a[0]; F0 = float(a[1]); ZCUT = float(a[2]); OUT = a[3]; S = int(a[4]) if len(a) > 4 else 192; EL = 50; EXP = float(a[5]) if len(a) > 5 else .55
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/home/user/Wariq3/prototypes/theater/models/{M}.glb')
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
sc.view_layers[0].cycles.use_denoising = False; sc.render.film_transparent = True; sc.render.resolution_x = S; sc.render.resolution_y = S
sc.view_settings.view_transform = 'Standard'; sc.view_settings.exposure = EXP
meshes = [o for o in sc.objects if o.type == 'MESH']
# كل شي بكائن وحد، بإحداثيات العالم
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]; bpy.ops.object.join(); body = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# تطبيع: الطول ~10 وحدات، المركز على الأصل، الأرض z=0
bb = [body.matrix_world @ mathutils.Vector(c) for c in body.bound_box]; mn = mathutils.Vector([min(p[i] for p in bb) for i in range(3)]); mx = mathutils.Vector([max(p[i] for p in bb) for i in range(3)])
k = 10 / max(mx.x - mn.x, mx.y - mn.y); body.location = (-(mn.x + mx.x) / 2 * k, -(mn.y + mx.y) / 2 * k, -mn.z * k); body.scale = (k, k, k); bpy.ops.object.transform_apply(location=True, scale=True)
zc = (ZCUT - mn.z) * k if ZCUT > -50 else None
body.rotation_mode = 'XYZ'
# البرج: كل شي فوق ارتفاع سطح البدن
tur = None
if zc is not None:
    bpy.ops.object.mode_set(mode='EDIT'); bm = bmesh.from_edit_mesh(body.data)
    for f in bm.faces: f.select = all(v.co.z > zc for v in f.verts)
    bmesh.update_edit_mesh(body.data); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
    tur = [o for o in sc.objects if o.type == 'MESH' and o is not body][0]; tur.rotation_mode = 'XYZ'
    vs = [v.co for v in tur.data.vertices if v.co.z < zc + .6] or [v.co for v in tur.data.vertices]
    piv = mathutils.Vector((sum(v.x for v in vs) / len(vs), sum(v.y for v in vs) / len(vs), 0))
else: piv = mathutils.Vector((0, 0, 0))
# الأرض تلقط الظل بس
bpy.ops.mesh.primitive_plane_add(size=60); pl = bpy.context.active_object; pl.is_shadow_catcher = True
# إضاءة: شمس قوية مايلة من الشمال الغربي + سماء
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 5.5; sun.angle = math.radians(4); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so); so.rotation_euler = (math.radians(38), 0, math.radians(-135))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 1.1; w.node_tree.nodes['Background'].inputs[0].default_value = (.85, .88, 1, 1)
cam = bpy.data.cameras.new('c'); cam.type = 'ORTHO'; cam.ortho_scale = 13; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
el = math.radians(EL); D = 60; co.location = (0, -D * math.cos(el), D * math.sin(el) + 1); co.rotation_euler = (math.radians(90 - EL), 0, 0)
piv_t = None
def shot(objs, rot, path):
    for o in [body] + ([tur] if tur else []): o.hide_render = o not in objs
    for o in objs: o.rotation_euler = (0, 0, rot)
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
os.makedirs(OUT, exist_ok=True)
# الإطار i: المقدمة باتجاه i*22.5° على الشاشة (0 = يمين، عقرب الساعة)؛ F0 يصحح وين المقدمة بالملف (+Y = 90)
toff = []
def px(w): v = world_to_camera_view(sc, co, w); return (v.x * S, (1 - v.y) * S)
o0 = px(mathutils.Vector((0, 0, 0)))
for i in range(16):
    th = math.radians(F0) - i * math.radians(22.5)
    shot([body] + ([] if tur else []), th, f'{OUT}/{M}_h{i:02d}.png')
    bpy.context.view_layer.update(); pw = body.matrix_world @ mathutils.Vector((piv.x, piv.y, 0)); q = px(pw); toff.append([round(q[0] - o0[0], 2), round(q[1] - o0[1], 2)])
if tur:
    tur.location = (-piv.x, -piv.y, 0); bpy.ops.object.select_all(action='DESELECT'); tur.select_set(True); bpy.context.view_layer.objects.active = tur; bpy.ops.object.transform_apply(location=True)
    for i in range(16):
        th = math.radians(F0) - i * math.radians(22.5); body.hide_render = True; tur.hide_render = False; tur.rotation_euler = (0, 0, th); sc.render.filepath = f'{OUT}/{M}_t{i:02d}.png'; bpy.ops.render.render(write_still=True)
# المحروقة (بدن + برج سوا، لون فحم): مادة وحدة لكل القطع
ch = bpy.data.materials.new('char'); ch.use_nodes = True; bs = ch.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value = (.03, .026, .022, 1); bs.inputs['Roughness'].default_value = .95
for ob in [body] + ([tur] if tur else []):
    for i in range(len(ob.material_slots)): ob.material_slots[i].material = ch
for i in range(0, 16, 2):
    th = math.radians(F0) - i * math.radians(22.5); body.hide_render = False; body.rotation_euler = (0, 0, th)
    if tur: tur.hide_render = False; tur.location = mathutils.Matrix.Rotation(th, 3, 'Z') @ piv; tur.rotation_euler = (0, 0, th + .5)
    sc.render.filepath = f'{OUT}/{M}_w{i//2:02d}.png'; bpy.ops.render.render(write_still=True)
# معلومات للعبة: مركز البرج (بوحدات الطول 10) وارتفاع القطع
json.dump({'piv': [piv.x, piv.y], 'zcut': zc, 'el': EL, 'ortho': 13, 'S': S, 'o0': o0, 'toff': toff}, open(f'{OUT}/{M}.json', 'w'))
print('DONE', M, 'piv', piv, 'zc', zc)
