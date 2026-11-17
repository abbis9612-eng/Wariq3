# يستخرج الأجزاء اللي مركزها داخل صندوق (إحداثيات Blender): venv/bin/python tools/bl_extract_box.py in.glb out.glb x0 x1 y0 y1 z0 z1
import bpy, sys, mathutils
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out = a[0], a[1]; x0, x1, y0, y1, z0, z1 = map(float, a[2:8])
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
keep = []
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    c = sum((o.matrix_world @ mathutils.Vector(v) for v in o.bound_box), mathutils.Vector()) / 8
    if x0 <= c.x <= x1 and y0 <= c.y <= y1 and z0 <= c.z <= z1: keep.append(o)
for o in list(bpy.context.scene.objects):
    if o not in keep and o.type == 'MESH': bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_apply=True, export_animations=False)
print('OK kept', len(keep))
