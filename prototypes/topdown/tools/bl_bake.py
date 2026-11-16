# خبز صورة من فوق بـ Blender (Cycles): إضاءة شمس + سما، ظلال ناعمة، إطباق محيطي، خلفية شفافة، وظل على الأرض (shadow catcher)
# venv/bin/python tools/bl_bake.py <glb> <out.png> <طول بالمتر> <yaw راديان> [حجم] [عينات] [shadow 0/1] [heading درجات]
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out, L, yaw = a[0], a[1], float(a[2]), float(a[3]); size = int(a[4]) if len(a) > 4 else 512; spp = int(a[5]) if len(a) > 5 else 64; shadow = (a[6] == '1') if len(a) > 6 else True; head = float(a[7]) if len(a) > 7 else 0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
import os
hide = [x for x in os.environ.get('HIDE', '').split(',') if x]
kill = []
for o in bpy.context.scene.objects:
    anc, q = [], o
    while q: anc.append(q.name); q = q.parent
    if any(n.startswith(h) for n in anc for h in hide): kill.append(o)
for o in kill: bpy.data.objects.remove(o, do_unlink=True)   # نجمع أول وبعدين نمسح (حتى الأبناء ما يفقدون آباءهم قبل الفحص)
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
root = bpy.data.objects.new('root', None); bpy.context.scene.collection.objects.link(root)
for o in bpy.context.scene.objects:
    if o.parent is None and o is not root: o.parent = root
bpy.context.view_layer.update()
def bounds():
    mn = mathutils.Vector((1e9,) * 3); mx = mathutils.Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box: w = o.matrix_world @ mathutils.Vector(c); mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
    return mn, mx
root.rotation_euler = (0, 0, yaw + math.radians(head)); bpy.context.view_layer.update()
mn, mx = bounds(); s = L / max(mx.x - mn.x, mx.y - mn.y) if head == 0 else None
if s is None:   # الطول يتحسب بدون لف
    root.rotation_euler = (0, 0, yaw); bpy.context.view_layer.update(); mn, mx = bounds(); s = L / max(mx.x - mn.x, mx.y - mn.y)
    root.rotation_euler = (0, 0, yaw + math.radians(head))
root.scale = (s, s, s); bpy.context.view_layer.update(); mn, mx = bounds()
root.location = (-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z); bpy.context.view_layer.update()
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = spp; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = size; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'
# كاميرا متعامدة من فوق: فوق الصورة = شمال (+y)، والمجسم قدّامه +x (شرق) بعد yaw
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = L * 1.18; cam.location = (0, 0, 200); cam.rotation_euler = (0, 0, 0); cam.data.clip_end = 1000
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 5.2; sun.data.angle = math.radians(4); sun.rotation_euler = (math.radians(35), math.radians(-20), math.radians(-30))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.55, .62, .72, 1); bg.inputs[1].default_value = .55
if shadow:
    bpy.ops.mesh.primitive_plane_add(size=L * 3, location=(0, 0, 0)); pl = bpy.context.object; pl.is_shadow_catcher = True
bpy.ops.render.render(); bpy.data.images['Render Result'].save_render(out)
print('OK', out, 'scale', s)
