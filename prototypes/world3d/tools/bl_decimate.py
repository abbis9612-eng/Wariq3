# تخفيف مجسم ثقيل بـ Blender (Decimate) قبل models.mjs: venv/bin/python tools/bl_decimate.py in.glb out.glb <نسبة>
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out, ratio = a[0], a[1], float(a[2])
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
n0 = n1 = 0
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    n0 += len(o.data.polygons); m = o.modifiers.new('d', 'DECIMATE'); m.ratio = ratio
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='d'); n1 += len(o.data.polygons)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_apply=True)
print('OK faces', n0, '->', n1)
