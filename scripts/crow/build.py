"""
Blender side of `npm run crow`. Run by scripts/crow.mjs, not by hand:

  blender -b --factory-startup --python scripts/crow/build.py -- <src dir> <out.glb> <preview dir>

1. Takes the skinned mesh and rig from one Mixamo file (they all carry the
   same Meshy mesh, skinned to the same 41-bone rig).
2. Unwraps it and bakes a colour texture:
     - crow-apose.png is projected onto the bind pose from the front,
       orthographically. The projection is fitted to the model's front
       silhouette first (scale and offset, by overlap).
     - Wherever the front can't see (back, sides, under the beak) the
       surface falls back to flat region colours (head/hands, suit, shirt,
       tie, shoes), chosen by bone weights and position, blended smoothly.
3. Pulls the animation out of every Mixamo file as a named action.
4. Exports one .glb (mesh once + all clips) and renders front/side/back
   previews of the textured model.

Compression happens afterwards in scripts/crow.mjs.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_GLB, PREVIEW = argv[0], argv[1], argv[2]
TEX = int(os.environ.get("CROW_TEX", "2048"))

# Slug -> clip file (already renamed by crow.mjs). The first one found also provides the mesh.
CLIPS = ["idle", "sitting-idle", "cheering", "walking", "reaching", "looking-up", "toast", "typing", "looking-at-hand", "waving"]

# Fallback colours by region (sRGB). Index = region id stored in the vertex colours.
REGION = {
    "head": (0.035, 0.043, 0.075),  # blue-black feathers
    "hand": (0.040, 0.046, 0.080),
    "suit": (0.200, 0.205, 0.220),  # charcoal
    "shirt": (0.930, 0.935, 0.950),
    "tie": (0.184, 0.482, 1.000),  # #2F7BFF
    "shoe": (0.020, 0.020, 0.024),
}


def log(*a):
    print("[crow]", *a, flush=True)


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


# ---------------------------------------------------------------------------
# Scene and base rig
# ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30

clip_files = {c: os.path.join(SRC, c + ".fbx") for c in CLIPS if os.path.exists(os.path.join(SRC, c + ".fbx"))}
if not clip_files:
    raise SystemExit("no clip files found in " + SRC)
base_clip = next(iter(clip_files))
log("mesh and rig from", base_clip + ".fbx")

bpy.ops.import_scene.fbx(filepath=clip_files[base_clip])
arm = next(o for o in scene.objects if o.type == "ARMATURE")
mesh = next(o for o in scene.objects if o.type == "MESH")
arm.name = arm.data.name = "Crow"
mesh.name = mesh.data.name = "CrowBody"
base_action = arm.animation_data.action if arm.animation_data else None
arm.data.pose_position = "REST"
bpy.context.view_layer.update()

# Bind-pose vertex positions in world space (metres, Z up, facing -Y).
me = mesh.data
dg = bpy.context.evaluated_depsgraph_get()
ev = mesh.evaluated_get(dg).to_mesh()
P = np.array([(mesh.matrix_world @ v.co)[:] for v in ev.vertices], dtype=np.float64)
mesh.evaluated_get(dg).to_mesh_clear()
tris_idx = np.array([p.vertices[:] for p in me.polygons if len(p.vertices) == 3])
log("verts", len(P), "tris", len(tris_idx), "bbox", P.min(0).round(3), P.max(0).round(3))
zmin, zmax = P[:, 2].min(), P[:, 2].max()
H = zmax - zmin

# ---------------------------------------------------------------------------
# Source image: figure mask, then bleed the figure's colours into the background
# so samples right at the silhouette edge never pick up the grey backdrop.
# ---------------------------------------------------------------------------
img_path = os.path.join(SRC, "crow-apose.png")
src = bpy.data.images.load(img_path)
W, Hh = src.size
px = np.empty(W * Hh * 4, dtype=np.float32)
src.pixels.foreach_get(px)
rgba = px.reshape(Hh, W, 4)  # row 0 = bottom
rgb = rgba[:, :, :3].copy()
lum = rgb.mean(2)
sat = rgb.max(2) - rgb.min(2)


def dilate(m, r=1):
    o = m.copy()
    for _ in range(r):
        p = o.copy()
        p[1:] |= o[:-1]
        p[:-1] |= o[1:]
        p[:, 1:] |= o[:, :-1]
        p[:, :-1] |= o[:, 1:]
        o = p
    return o


def erode(m, r=1):
    return ~dilate(~m, r)


# Background: light, unsaturated, and connected to the border. Grown at half resolution.
s = 2
bg_like = ((lum > 0.42) & (sat < 0.08))[::s, ::s]
bg = np.zeros_like(bg_like)
bg[0, :] = bg[-1, :] = True
bg[:, 0] = bg[:, -1] = True
bg &= bg_like
for _ in range(3000):
    grown = dilate(bg) & bg_like
    if (grown == bg).all():
        break
    bg = grown
fg_half = erode(dilate(~bg, 1), 1)
fg = np.repeat(np.repeat(fg_half, s, 0), s, 1)[:Hh, :W]
fg = erode(fg, 2)  # stay off the anti-aliased edge
ys, xs = np.nonzero(fg)
log("figure bbox px x", xs.min(), xs.max(), "y", ys.min(), ys.max())

# Bleed: repeatedly average known neighbours into unknown pixels.
known = fg.copy()
col = np.where(known[..., None], rgb, 0)
for _ in range(48):
    acc = np.zeros_like(col)
    cnt = np.zeros(known.shape, np.float32)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
        k = np.roll(np.roll(known, dy, 0), dx, 1)
        c = np.roll(np.roll(col, dy, 0), dx, 1)
        acc += c * k[..., None]
        cnt += k
    new = (~known) & (cnt > 0)
    col[new] = acc[new] / cnt[new][:, None]
    known |= new
col[~known] = rgb[~known]
bled = bpy.data.images.new("crow-src-bled", W, Hh, alpha=False, float_buffer=True)
bled.colorspace_settings.name = "Non-Color"  # already sRGB-encoded values; decoded in the shader below
out = np.concatenate([col, np.ones((Hh, W, 1), np.float32)], 2)
bled.pixels.foreach_set(out.ravel())

# ---------------------------------------------------------------------------
# Fit the projection: model (x, z) -> image (u, v) in pixels, maximising the
# overlap between the model's front silhouette and the figure mask.
# ---------------------------------------------------------------------------
q = 4  # work at quarter resolution
mask_q = fg[::q, ::q]
mh, mw = mask_q.shape
rng = np.random.default_rng(1)
tri_pts = P[tris_idx]  # (T, 3, 3)
bary = rng.dirichlet((1, 1, 1), size=(len(tris_idx), 6))  # (T, 6, 3)
samples = np.einsum("tsk,tkd->tsd", bary, tri_pts).reshape(-1, 3)
samples = np.concatenate([samples, P])
sx_, sz_ = samples[:, 0], samples[:, 2]


def silhouette(params):
    a, b, c, d = params  # u = a*x + b, v = c*z + d (pixels, v from bottom)
    u = ((a * sx_ + b) / q).astype(np.int32)
    v = ((c * sz_ + d) / q).astype(np.int32)
    ok = (u >= 0) & (u < mw) & (v >= 0) & (v < mh)
    m = np.zeros((mh, mw), bool)
    m[v[ok], u[ok]] = True
    return erode(dilate(m, 1), 1)


def iou(params):
    m = silhouette(params)
    return (m & mask_q).sum() / max(1, (m | mask_q).sum())


x0, x1 = P[:, 0].min(), P[:, 0].max()
a = (xs.max() - xs.min()) / (x1 - x0)
c = (ys.max() - ys.min()) / (zmax - zmin)
params = np.array([a, xs.min() - a * x0, c, ys.min() - c * zmin], dtype=np.float64)
best = iou(params)
log("projection fit, bbox start: IoU %.4f" % best)
steps = np.array([a * 0.02, 8.0, c * 0.02, 8.0])
for _ in range(10):
    improved = False
    for i in range(4):
        for sgn in (1, -1):
            trial = params.copy()
            trial[i] += sgn * steps[i]
            # Keep scale changes centred on the figure so they don't drag it sideways.
            if i == 0:
                trial[1] -= sgn * steps[0] * (x0 + x1) / 2
            if i == 2:
                trial[3] -= sgn * steps[2] * (zmin + zmax) / 2
            score = iou(trial)
            if score > best:
                best, params, improved = score, trial, True
    if not improved:
        steps *= 0.5
log("projection fit, refined: IoU %.4f" % best, "params", params.round(3))
pa, pb, pc, pd = params

# Overlay for checking the fit by eye.
ov = np.zeros((mh, mw, 3), np.float32)
ov[..., 1] = mask_q
ov[..., 0] = silhouette(params)
ov_img = bpy.data.images.new("fit", mw, mh, alpha=False)
ov_img.pixels.foreach_set(np.concatenate([ov, np.ones((mh, mw, 1), np.float32)], 2).ravel())
ov_img.filepath_raw = os.path.join(PREVIEW, "projection-fit.png")
ov_img.file_format = "PNG"
ov_img.save()

# ---------------------------------------------------------------------------
# Regions, per vertex, from bone weights and height. Stored as a colour
# attribute; baked to a texture alongside the projection.
# ---------------------------------------------------------------------------
gname = {g.index: g.name.replace("mixamorig:", "") for g in mesh.vertex_groups}
nv = len(me.vertices)
weights = {}
for v in me.vertices:
    for g in v.groups:
        n = gname[g.group]
        weights.setdefault(n, np.zeros(nv))[v.index] = g.weight
W_ = lambda *names: sum((weights.get(n, np.zeros(nv)) for n in names), np.zeros(nv))
headw = W_("Head", "Neck")
handw = W_(*[n for n in weights if "Hand" in n])
footw = W_("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")
z = P[:, 2]
x = P[:, 0]
yv = P[:, 1]
rel = (z - zmin) / H  # 0 at the soles, 1 at the crown

region = np.full(nv, "suit", dtype=object)
# Shirt: a narrow front strip below the collar (the jacket's V), plus collar and cuffs.
front = yv < np.percentile(yv[(rel > 0.6) & (rel < 0.8)], 30)
vee = (rel > 0.66) & (rel < 0.84) & front & (np.abs(x) < (rel - 0.62) * 0.55)
region[vee] = "shirt"
region[vee & (np.abs(x) < 0.028)] = "tie"
region[(handw > 0.35) & (rel < 0.62)] = "hand"
region[(headw > 0.5) & (rel > 0.80)] = "head"
region[(footw > 0.5) & (rel < 0.07)] = "shoe"
log("regions", {k: int((region == k).sum()) for k in REGION})

ca = me.color_attributes.new("region", "FLOAT_COLOR", "POINT")
cols = np.array([REGION[r] for r in region], dtype=np.float32)
# Float colour attributes are linear.
ca.data.foreach_set("color", np.concatenate([srgb_to_linear(cols), np.ones((nv, 1), np.float32)], 1).ravel())

# ---------------------------------------------------------------------------
# UVs
# ---------------------------------------------------------------------------
bpy.context.view_layer.objects.active = mesh
for o in scene.objects:
    o.select_set(o == mesh)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0, scale_to_bounds=True)
bpy.ops.object.mode_set(mode="OBJECT")
log("uv unwrapped:", me.uv_layers.active.name)

# Smooth normals keep the hologram's rim light clean. The FBX carries custom
# split normals that would give every triangle corner its own vertex; drop them.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.customdata_custom_splitnormals_clear()
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.shade_smooth()
if "sharp_edge" in me.attributes:  # every edge comes in marked sharp
    me.attributes.remove(me.attributes["sharp_edge"])

# ---------------------------------------------------------------------------
# Bake material: projected image / region colours / visibility
# ---------------------------------------------------------------------------
mat = bpy.data.materials.new("CrowSkin")
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
N = nt.nodes.new
L = nt.links.new
out_node = N("ShaderNodeOutputMaterial")
emit = N("ShaderNodeEmission")
diff = N("ShaderNodeBsdfDiffuse")
diff.inputs["Color"].default_value = (1, 1, 1, 1)
geo = N("ShaderNodeNewGeometry")
sep = N("ShaderNodeSeparateXYZ")
L(geo.outputs["Position"], sep.inputs[0])
# u = (a*x + b) / W,  v = (c*z + d) / H
def lin(inp, k, off):
    m1 = N("ShaderNodeMath"); m1.operation = "MULTIPLY_ADD"
    L(inp, m1.inputs[0]); m1.inputs[1].default_value = k; m1.inputs[2].default_value = off
    return m1.outputs[0]
comb = N("ShaderNodeCombineXYZ")
L(lin(sep.outputs["X"], pa / W, pb / W), comb.inputs["X"])
L(lin(sep.outputs["Z"], pc / Hh, pd / Hh), comb.inputs["Y"])
tex = N("ShaderNodeTexImage")
tex.image = bled
tex.extension = "EXTEND"
tex.interpolation = "Cubic"
L(comb.outputs[0], tex.inputs["Vector"])
attr = N("ShaderNodeVertexColor")
attr.layer_name = "region"
target = N("ShaderNodeTexImage")
nt.nodes.active = target
mesh.data.materials.clear()
mesh.data.materials.append(mat)

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 4
scene.render.bake.margin = 12
scene.render.bake.margin_type = "EXTEND"


def bake(name, kind, source=None, samples=4):
    img = bpy.data.images.new(name, TEX, TEX, alpha=False, float_buffer=True)
    img.colorspace_settings.name = "Non-Color"
    target.image = img
    for l in list(nt.links):
        if l.to_node == out_node:
            nt.links.remove(l)
    if kind == "EMIT":
        for l in list(emit.inputs["Color"].links):
            nt.links.remove(l)
        L(source, emit.inputs["Color"])
        L(emit.outputs[0], out_node.inputs["Surface"])
    else:
        L(diff.outputs[0], out_node.inputs["Surface"])
    scene.cycles.samples = samples
    log("baking", name)
    if kind == "EMIT":
        bpy.ops.object.bake(type="EMIT")
    else:
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT"})
    a = np.empty(TEX * TEX * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(TEX, TEX, 4)[..., :3]


proj = bake("proj", "EMIT", tex.outputs["Color"])  # sRGB-encoded values (Non-Color pass-through)
reg = bake("region", "EMIT", attr.outputs["Color"])  # linear
reg = linear_to_srgb(reg)

# Visibility from the front: a sun shining along +Y, hard shadows. Lit = the
# projection can see it; the N·L falloff fades it out toward the silhouette.
sun_data = bpy.data.lights.new("front", "SUN")
sun_data.energy = 1.0
sun_data.angle = 0.0
sun = bpy.data.objects.new("front", sun_data)
sun.rotation_euler = (math.radians(90), 0, 0)
scene.collection.objects.link(sun)
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0
scene.world = world
vis = bake("vis", "DIFFUSE", samples=16).mean(2)
vis = vis / max(1e-6, np.percentile(vis, 99.5))
bpy.data.objects.remove(sun)

# ---------------------------------------------------------------------------
# Compose the final texture.
# ---------------------------------------------------------------------------
yy, xx = np.mgrid[0:TEX, 0:TEX]
rng2 = np.random.default_rng(7)


def value_noise(scale, seed):
    g = np.random.default_rng(seed).random((TEX // scale + 2, TEX // scale + 2)).astype(np.float32)
    fy, fx = yy / scale, xx / scale
    iy, ix = fy.astype(int), fx.astype(int)
    ty, tx = fy - iy, fx - ix
    ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
    a0 = g[iy, ix] * (1 - tx) + g[iy, ix + 1] * tx
    a1 = g[iy + 1, ix] * (1 - tx) + g[iy + 1, ix + 1] * tx
    return a0 * (1 - ty) + a1 * ty


# Fallback colours: half the named colour, half what the photo actually shows
# for that region where the front sees it clearly, so the seams match.
w_full = vis > 0.7
for name in ("suit", "shoe"):
    c = REGION[name]
    c = np.array(c, np.float32)
    sel = (np.abs(reg - c).sum(2) < 0.02) & w_full
    if sel.sum() > 500:
        seen = np.median(proj[sel], axis=0)
        reg[np.abs(reg - c).sum(2) < 0.02] = c * 0.5 + seen * 0.5
        log("region %-6s named %s photo %s" % (name, np.round(c, 3), np.round(seen, 3)))

# Region colours get a little life: fabric grain on the suit, a blue sheen in the feathers.
n1 = value_noise(6, 1)
n2 = value_noise(40, 2)
head_c = np.array(REGION["head"], np.float32)
is_dark = ((reg.sum(2) < 0.25) & (reg[..., 2] > reg[..., 0] + 0.012))[..., None]  # feathers, not shoes
sheen = np.array([0.10, 0.17, 0.42], np.float32) * (np.clip(n2 * 1.6 - 0.55, 0, 1) ** 2)[..., None]
fab = (n1 - 0.5)[..., None] * 0.035
reg_lit = np.clip(reg + fab + np.where(is_dark, sheen, 0), 0, 1)

w = np.clip((vis - 0.22) / (0.55 - 0.22), 0, 1)
w = (w * w * (3 - 2 * w))[..., None]
final = reg_lit * (1 - w) + proj * w
final = np.clip(final, 0, 1).astype(np.float32)

skin = bpy.data.images.new("crow-skin", TEX, TEX, alpha=False)
skin.pixels.foreach_set(np.concatenate([final, np.ones((TEX, TEX, 1), np.float32)], 2).ravel())
skin.filepath_raw = os.path.join(PREVIEW, "crow-skin.png")
skin.file_format = "PNG"
skin.save()
for name, arr in (("bake-visibility.png", np.repeat(w, 3, 2)), ("bake-regions.png", reg_lit)):
    im = bpy.data.images.new(name, TEX, TEX, alpha=False)
    im.pixels.foreach_set(np.concatenate([arr.astype(np.float32), np.ones((TEX, TEX, 1), np.float32)], 2).ravel())
    im.filepath_raw = os.path.join(PREVIEW, name)
    im.file_format = "PNG"
    im.save()
skin.reload()
skin.colorspace_settings.name = "sRGB"

# Final material: plain textured, unlit-looking. The site replaces it with the hologram shader anyway.
nt.nodes.clear()
o = N("ShaderNodeOutputMaterial")
bsdf = N("ShaderNodeBsdfPrincipled")
t = N("ShaderNodeTexImage")
t.image = skin
L(t.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.8
L(bsdf.outputs[0], o.inputs["Surface"])
me.color_attributes.remove(me.color_attributes["region"])

# ---------------------------------------------------------------------------
# Clips: one action per file, named by slug.
# ---------------------------------------------------------------------------
actions = {}
if base_action:
    base_action.name = base_clip
    actions[base_clip] = base_action
for slug, path in clip_files.items():
    if slug in actions:
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    a_obj = next(o for o in new if o.type == "ARMATURE")
    act = a_obj.animation_data.action
    act.name = slug
    actions[slug] = act
    for o in new:
        data = o.data
        bpy.data.objects.remove(o)
        if data is not None and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Armature):
                bpy.data.armatures.remove(data)
for slug, act in actions.items():
    act.use_fake_user = True
    log("clip %-16s frames %d-%d" % (slug, act.frame_range[0], act.frame_range[1]))

# Every action needs to be playable on the kept rig: give the rig an NLA strip per action.
arm.data.pose_position = "POSE"
ad = arm.animation_data or arm.animation_data_create()
ad.action = None
for slug, act in actions.items():
    track = ad.nla_tracks.new()
    track.name = slug
    strip = track.strips.new(slug, int(act.frame_range[0]), act)


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
for o in scene.objects:
    o.select_set(o in (arm, mesh))
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_anim_slide_to_zero=True,
    export_force_sampling=True,
    export_optimize_animation_size=True,
    export_reset_pose_bones=True,
    export_def_bones=False,
    export_skins=True,
    export_morph=False,
    export_image_format="WEBP",
    export_image_quality=88,
    export_materials="EXPORT",
    export_yup=True,
    export_apply=False,
)
log("exported", OUT_GLB)

# ---------------------------------------------------------------------------
# Turntable previews (bind pose): front, side, back.
# ---------------------------------------------------------------------------
ad.action = None
for tr in ad.nla_tracks:
    tr.mute = True
arm.data.pose_position = "REST"
scene.render.engine = "BLENDER_WORKBENCH"
shading = scene.display.shading
shading.light = "FLAT"
shading.color_type = "TEXTURE"
shading.background_type = "WORLD"
world.color = (0.02, 0.025, 0.04)
scene.render.resolution_x, scene.render.resolution_y = 600, 1000
scene.render.film_transparent = False
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = H * 1.12
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
mid = Vector((0, 0, (zmin + zmax) / 2))
for name, ang in (("front", 0), ("side", 90), ("back", 180), ("three-quarter", 35)):
    r = math.radians(ang)
    cam.location = mid + Vector((math.sin(r) * 6, -math.cos(r) * 6, 0))
    cam.rotation_euler = (math.radians(90), 0, r)
    scene.render.filepath = os.path.join(PREVIEW, "turntable-%s.png" % name)
    bpy.ops.render.render(write_still=True)
    log("preview", name)
