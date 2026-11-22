# I-173: شاص (تويوتا لاندكروزر 79 بيكب، DR1KING100K، CC BY) بدل التويوتا القديمة: ألوان حقيقية (أبيض مغبّر، تايرات سود، زجاج غامق)،
# بدون الداخل والسبير اللي بالصندوق، مصغّر لـ~45 ألف وجه للتلفون، وغبار بألوان الرؤوس (أكثر تحت). وجدول «أقل ارتفاع» للسبطانة حتى ما تعبر الكابينة.
# blender -b -P tools/zu23_truck.py -- j79.glb out_dir
import bpy, sys, mathutils, math, json, random, bmesh
a=sys.argv[sys.argv.index('--')+1:]; SRC=a[0]; OUT=a[1]
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=SRC)
sc=bpy.context.scene; random.seed(7)
# نثبّت مكان كل قطعة قبل ما نشيل الأبوين (وإلا ترجع لإحداثياتها الخام)
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
    if o.type=='MESH': o.select_set(True)
bpy.context.view_layer.objects.active=[o for o in sc.objects if o.type=='MESH'][0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.select_all(action='DESELECT')
DROP=('interior','plastic_int','wood')
def mats(o): return [s.material.name for s in o.material_slots if s.material]
def bb(o):
    ps=[o.matrix_world@v.co for v in o.data.vertices]; return mathutils.Vector([min(p[i] for p in ps) for i in range(3)]), mathutils.Vector([max(p[i] for p in ps) for i in range(3)])
meshes=[o for o in sc.objects if o.type=='MESH']
for o in list(meshes):
    mn,mx=bb(o); c=(mn+mx)/2; ms=mats(o)
    inBed=mx.x<0.8 and mn.x>-0.8 and mn.y>0.26 and mx.y<2.45 and mn.z>0.8 and not any('carpaint' in m for m in ms)   # السبير والصندوق اللي بالصندوق
    antenna=mx.z>2.06
    if any(m.startswith(DROP) for m in ms) or inBed or antenna or o.name.startswith('interior'):
        meshes.remove(o); bpy.data.objects.remove(o, do_unlink=True)
for o in [o for o in sc.objects if o.type!='MESH']: bpy.data.objects.remove(o, do_unlink=True)
# الألوان
COL={'carpaint':((0.78,0.75,0.68),0.55,0),'carpaint_second':((0.5,0.5,0.48),0.5,0),'black':((0.035,0.035,0.035),0.9,0),'black_gloss':((0.025,0.027,0.03),0.35,0),
 'chrome':((0.62,0.62,0.64),0.3,0.6),'material_22':((0.42,0.42,0.42),0.5,0.3),'Gravel_Tyre_Tread':((0.04,0.04,0.04),0.95,0),'Gravel_Tyre_Tread2':((0.04,0.04,0.04),0.95,0),
 'Gravel_Tyre_Wall':((0.045,0.045,0.045),0.95,0),'Gravel_Tyre_Wall2':((0.045,0.045,0.045),0.95,0),'brakedisk':((0.3,0.3,0.3),0.6,0.4),'rim_blur':((0.3,0.3,0.3),0.6,0),
 'diamont1':((0.5,0.5,0.5),0.5,0),'material':((0.05,0.05,0.05),0.9,0),'blue':((0.1,0.15,0.4),0.5,0),'red_toyota':((0.6,0.05,0.05),0.5,0),'white':((0.9,0.9,0.9),0.5,0),
 'redglass':((0.55,0.04,0.03),0.2,0),'orangeglass':((0.9,0.45,0.08),0.2,0),'clearglass':((0.07,0.08,0.09),0.1,0),'windowglass':((0.05,0.06,0.07),0.1,0),'metal_int':((0.35,0.35,0.35),0.5,0.3),'mirror':((0.3,0.32,0.34),0.2,0)}
for m in bpy.data.materials:
    if not m.use_nodes: continue
    b=m.node_tree.nodes.get('Principled BSDF'); c=COL.get(m.name)
    if not b or not c: continue
    for n in [n for n in m.node_tree.nodes if n.type=='TEX_IMAGE']: m.node_tree.nodes.remove(n)
    b.inputs['Base Color'].default_value=(*c[0],1); b.inputs['Roughness'].default_value=c[1]; b.inputs['Metallic'].default_value=c[2]
    vc=m.node_tree.nodes.new('ShaderNodeVertexColor'); vc.layer_name='Col'; mix=m.node_tree.nodes.new('ShaderNodeMix'); mix.data_type='RGBA'; mix.blend_type='MULTIPLY'; mix.inputs['Factor'].default_value=1
    mix.inputs[6].default_value=(*c[0],1); m.node_tree.links.new(vc.outputs['Color'], mix.inputs[7]); m.node_tree.links.new(mix.outputs[2], b.inputs['Base Color'])
# تصغير كل قطعة (حد أدنى حتى القطع الصغيرة ما تختفي)
tot0=sum(len(o.data.polygons) for o in meshes); TARGET=45000
for o in meshes:
    n=len(o.data.polygons); r=max(TARGET/tot0, min(1, 80/max(1,n)))
    if r<1: md=o.modifiers.new('d','DECIMATE'); md.ratio=r; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='d')
tot=sum(len(o.data.polygons) for o in meshes)
# غبار: تحت أكثر (التراب يطلع من التايرات)، وبقع عشوائية
DUST=mathutils.Vector((0.80,0.66,0.48))
for o in meshes:
    me=o.data; ca=me.color_attributes.new('Col','BYTE_COLOR','POINT'); M=o.matrix_world
    for v in me.vertices:
        p=M@v.co; f=min(1,max(0,(1.05-p.z)/0.7))*0.75+random.random()*0.12+(0.18 if p.z>1.9 else 0)
        col=mathutils.Vector((1,1,1)).lerp(DUST,min(0.9,f)); ca.data[v.index].color=(col.x,col.y,col.z,1)
# أرضية الصندوق ووسطه
fl=0.87; PIV=(0.0,1.42,fl)
# جدول أقل ارتفاع للسبطانة حسب الدوران (بإحداثيات بابيلون: r=0 قدّام، موجب لليمين +x)؛ المحور 0.68 فوق القاعدة و0.30 لقدّام
pts=[]
for o in meshes:
    for v in o.data.vertices: pts.append(o.matrix_world@v.co)
pts=pts[::3]
arc=[]
for k in range(72):
    r=math.radians(k*5-180); d=mathutils.Vector((math.sin(r)*-1, -math.cos(r), 0))   # بابيلون (sin r, cos r) ← بلندر (-x, -y)
    T=mathutils.Vector(PIV)+mathutils.Vector((0,0,0.68))+d*0.30; need=-0.2
    for p in pts:
        rel=p-T; al=rel.x*d.x+rel.y*d.y
        if al<0.15 or al>2.95: continue
        pe=math.hypot(rel.x-al*d.x, rel.y-al*d.y)
        if pe>0.32: continue
        need=max(need, math.atan2(rel.z+0.1, al))
    arc.append(round(need,3))
for o in meshes: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT+'/zu23_truck.glb', export_format='GLB', use_selection=True)
json.dump({'pivot':PIV,'arc_deg_from':-180,'arc_step':5,'arc':arc,'faces':tot,'faces0':tot0}, open(OUT+'/zu23_truck.json','w'))
print('DONE faces', tot0, '->', tot, 'arc', arc)
