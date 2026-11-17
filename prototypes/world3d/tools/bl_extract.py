# يستخرج جزء من مجسم بالاسم (مثلاً صاروخ 5V55 من منصة S-400): venv/bin/python tools/bl_extract.py in.glb out.glb <بادئة الاسم>
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
src, out, pre = a[0], a[1], a[2]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
keep = set()
for o in bpy.context.scene.objects:
    q = o
    while q:
        if q.name.startswith(pre): keep.add(o.name); break
        q = q.parent
for o in list(bpy.context.scene.objects):
    if o.name not in keep: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='WEBP', export_apply=True, export_animations=False)
print('OK kept', len(keep))
