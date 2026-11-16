# صفايح صور من فوق بـ Blender (WM10.1، I-064): الإضاءة ثابتة بالعالم، فلما الطيارة تميل يتغير ضوؤها وشكلها مثل الحقيقة.
#   طيارة: venv/bin/python tools/bl_sheet.py air  <glb> <out.png> <طول م> <yaw> [حجم الإطار] [عينات]
#          18 ميلان (−180…+160 كل 20°) × 3 أنف (−35، 0، +35) = 54 إطار بشبكة 8×7؛ الإطار i = pitchIdx*18 + rollIdx
#   دبابة: venv/bin/python tools/bl_sheet.py tank <glb> <hull.png> <tur.png> <طول م> <yaw> <abrams|t72> [حجم] [عينات]
#          جسم وبرج بنفس الإطار؛ يطبع محور البرج (نسبة من الصورة) حتى يلف البرج حوله باللعبة
import bpy, bmesh, sys, math, mathutils, json
a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
mode = a[0]
# حدود البرج بإحداثيات glTF (نفس اللي بـ theater/src/main.ts) ومحور دورانه [x, z]
TURRET = {
  'abrams': ((0, -0.7), lambda x, y, z: (y > 1.3 and abs(x) < 1.9 and -3.7 < z < 1.95) or (y > 1.12 and abs(x) < 0.2 and z > 1.9)),
  't72': ((0, 0.85), lambda x, y, z: (y > 0.9 and math.hypot(x, z - 0.85) < 1.75) or (y > 1.25 and abs(x) < 2.05 and -1 < z < 3) or (y > 0.9 and abs(x) < 0.3 and z < 0.85)),
}
def load(src):
  bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=src)
  return [o for o in bpy.context.scene.objects if o.type == 'MESH']
def rig(objs, yaw):
  fix = bpy.data.objects.new('fix', None); bpy.context.scene.collection.objects.link(fix)
  for o in list(bpy.context.scene.objects):
    if o.parent is None and o is not fix: o.parent = fix
  att = bpy.data.objects.new('att', None); bpy.context.scene.collection.objects.link(att); fix.parent = att
  fix.rotation_euler = (0, 0, yaw); bpy.context.view_layer.update()
  return fix, att
def bounds(objs):
  mn = mathutils.Vector((1e9,) * 3); mx = mathutils.Vector((-1e9,) * 3)
  for o in objs:
    for c in o.bound_box: w = o.matrix_world @ mathutils.Vector(c); mn = mathutils.Vector(map(min, mn, w)); mx = mathutils.Vector(map(max, mx, w))
  return mn, mx
def scene(L, size, spp, shadow):
  sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = spp; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
  sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = size; sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
  sc.view_settings.view_transform = 'Standard'
  cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
  cam.data.type = 'ORTHO'; cam.data.ortho_scale = L * 1.18; cam.location = (0, 0, 200); cam.data.clip_end = 1000
  sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun); sun.data.energy = 5.2; sun.data.angle = math.radians(4); sun.rotation_euler = (math.radians(35), math.radians(-20), math.radians(-30))
  w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = (.55, .62, .72, 1); bg.inputs[1].default_value = .55
  if shadow: bpy.ops.mesh.primitive_plane_add(size=L * 3, location=(0, 0, 0)); bpy.context.object.is_shadow_catcher = True
  return sc
def render(path): bpy.ops.render.render(); bpy.data.images['Render Result'].save_render(path)

if mode == 'air':
  src, out, L, yaw = a[1], a[2], float(a[3]), float(a[4]); size = int(a[5]) if len(a) > 5 else 256; spp = int(a[6]) if len(a) > 6 else 32
  objs = load(src); fix, att = rig(objs, yaw)
  mn, mx = bounds(objs); s = L / max(mx.x - mn.x, mx.y - mn.y); fix.scale = (s, s, s); bpy.context.view_layer.update()
  mn, mx = bounds(objs); c = (mn + mx) / 2; fix.location = (-c.x, -c.y, -c.z); bpy.context.view_layer.update()
  sc = scene(L, size, spp, False)
  import os, tempfile; tmp = tempfile.mkdtemp(); frames = []
  for pi, pitch in enumerate((-35, 0, 35)):
    for ri in range(18):
      roll = -180 + ri * 20
      att.rotation_mode = 'XYZ'; att.rotation_euler = (math.radians(roll), math.radians(-pitch), 0)   # جسم الطيارة: لف حول x ثم أنف حول y (موجب = يرفع)
      f = os.path.join(tmp, f'{pi}_{ri}.png'); render(f); frames.append(f)
  # تركيب الشبكة 8×7
  img = bpy.data.images.new('sheet', size * 8, size * 7, alpha=True); import array
  px = array.array('f', [0.0] * (size * 8 * size * 7 * 4))
  for i, f in enumerate(frames):
    im = bpy.data.images.load(f); src_px = array.array('f', im.pixels[:]); col, row = i % 8, 6 - i // 8   # صورة Blender تبدي من تحت
    for y in range(size):
      o = ((row * size + y) * size * 8 + col * size) * 4; px[o:o + size * 4] = src_px[y * size * 4:(y + 1) * size * 4]
    bpy.data.images.remove(im)
  img.pixels = px; img.filepath_raw = out; img.file_format = 'PNG'; img.save()
  print('OK', out, len(frames))

if mode == 'tank':
  src, outH, outT, L, yaw, kind = a[1], a[2], a[3], float(a[4]), float(a[5]), a[6]; size = int(a[7]) if len(a) > 7 else 512; spp = int(a[8]) if len(a) > 8 else 48
  piv, f = TURRET[kind]
  for part in ('hull', 'tur'):
    objs = load(src)
    for o in objs:   # نشيل المثلثات حسب الجزء (إحداثيات glTF: x=X، y=Z، z=−Y بـ Blender)
      bm = bmesh.new(); bm.from_mesh(o.data); Mw = o.matrix_world; kill = []
      for fc in bm.faces:
        c = Mw @ fc.calc_center_median(); isTur = f(c.x, c.z, -c.y)
        if isTur != (part == 'tur'): kill.append(fc)
      bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(o.data); bm.free()
    if part == 'hull':
      objs_all = objs
    fix, att = rig(objs, yaw)
    pv = mathutils.Vector((piv[0], -piv[1], 0))   # محور البرج بـ Blender قبل التحويل
    if part == 'hull':
      mn, mx = bounds(objs); s = L / max(mx.x - mn.x, mx.y - mn.y); fix.scale = (s, s, s); bpy.context.view_layer.update(); mn, mx = bounds(objs); off = mathutils.Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)); keep = (s, off)
    s, off = keep; fix.scale = (s, s, s); fix.location = off; bpy.context.view_layer.update()
    pw = fix.matrix_world @ pv
    sc = scene(L, size, spp, part == 'hull'); render(outH if part == 'hull' else outT)   # البرج بدون ظل أرض (ظله يترسم باللعبة)
  print('PIVOT', json.dumps({'kind': kind, 'u': .5 + pw.x / (L * 1.18), 'v': .5 - pw.y / (L * 1.18)}))
