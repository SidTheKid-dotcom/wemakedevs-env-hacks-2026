"""Render VACHAN's desk props with Blender (Cycles): one transparent PNG per object, or a turntable.

Usage: blender -b -P props/render_props.py -- <out_dir> [name ...]
       name may end in "@turn" to render 16 frames rotating -30..+30 degrees (for mouse-driven turning).
Look: soft clay-and-real-material objects on a kraft desk, seen nearly from above (15 degrees),
warm key light from the top left, soft fill from the right, contact shadow on a shadow catcher.
"""
import math
import random
import sys

import bmesh
import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["/tmp/props"]
OUT, ONLY = ARGS[0], ARGS[1:]
TILT = math.radians(15)  # nearly straight down, like the paper it lies on (oryzo-style flat lay)


# ---------- scene ----------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 96
    s.cycles.use_denoising = True
    s.render.film_transparent = True
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    s.view_settings.view_transform = "Standard"  # keeps peel and leaf colours true
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.8, 0.68, 0.52, 1)  # warm bounce from the kraft desk
    bg.inputs[1].default_value = 0.55
    s.world = world
    light("key", "SUN", 2.6, (math.radians(42), 0, math.radians(140)), angle=12)
    light("fill", "AREA", 220, (math.radians(65), 0, math.radians(-60)), loc=(6, -4, 6), size=8)
    bpy.ops.mesh.primitive_plane_add(size=60)
    bpy.context.object.is_shadow_catcher = True


def light(name, kind, energy, rot, loc=(0, 0, 10), angle=None, size=None):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    if angle is not None:
        data.angle = math.radians(angle)
    if size is not None:
        data.size = size
    o = bpy.data.objects.new(name, data)
    o.location, o.rotation_euler = loc, rot
    bpy.context.scene.collection.objects.link(o)
    if kind == "AREA":  # aim at the origin
        o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


# ---------- materials ----------
def mat(name, color, rough=0.5, bump=0.0, bump_scale=20.0, color2=None, spots=12.0, mix=0.55, **inputs):
    """Principled material with optional noise speckle (color2) and bump."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    for k, v in inputs.items():
        b.inputs[k].default_value = v
    if color2:
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = spots
        noise.inputs["Detail"].default_value = 6
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = mix, mix + 0.12
        mixn = nt.nodes.new("ShaderNodeMix")
        mixn.data_type = "RGBA"
        mixn.inputs["A"].default_value = (*color, 1)
        mixn.inputs["B"].default_value = (*color2, 1)
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], mixn.inputs["Factor"])
        nt.links.new(mixn.outputs["Result"], b.inputs["Base Color"])
    if bump:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = bump_scale
        tex.inputs["Detail"].default_value = 10
        bn = nt.nodes.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = bump
        nt.links.new(tex.outputs["Fac"], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], b.inputs["Normal"])
    return m


def veins(m, strength=0.35):
    """Leaf veins: a wave texture along the blade, as bump."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 9
    wave.inputs["Distortion"].default_value = 2
    bn = nt.nodes.new("ShaderNodeBump")
    bn.inputs["Strength"].default_value = strength
    nt.links.new(wave.outputs["Fac"], bn.inputs["Height"])
    nt.links.new(bn.outputs["Normal"], b.inputs["Normal"])
    return m


# ---------- mesh helpers ----------
def smooth(o, levels=2):
    o.modifiers.new("sub", "SUBSURF").levels = levels
    o.modifiers["sub"].render_levels = levels
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def displace(o, strength, size, kind="CLOUDS"):
    t = bpy.data.textures.new(o.name + "_t", kind)
    t.noise_scale = size
    d = o.modifiers.new("disp", "DISPLACE")
    d.texture, d.strength = t, strength
    return o


def add(o, m):
    o.data.materials.append(m)
    return o


def disc(radius, z, cuts=80):
    """A round, evenly subdivided surface (a grid cut to a circle), so displacement looks like soil."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=cuts, y_subdivisions=cuts, size=radius * 2, location=(0, 0, z))
    o = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.xy.length > radius], context="VERTS")
    bm.to_mesh(o.data)
    return o


def crumbs(n, spread, z, color, size=0.05, seed=3, bump=0.6):
    random.seed(seed)
    m = mat("crumb", color, 0.95, bump=bump, bump_scale=40)
    for _ in range(n):
        a, r = random.uniform(0, 6.28), spread * math.sqrt(random.random())
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=size * random.uniform(0.5, 1.5),
                                              location=(r * math.cos(a), r * math.sin(a), z))
        o = bpy.context.object
        o.scale = (1, random.uniform(0.7, 1.3), random.uniform(0.5, 0.9))
        o.rotation_euler = [random.uniform(0, 6.28) for _ in range(3)]
        add(o, m)


def blade(length, width, curl=0.6, bend=-0.2, tip=0.8, cuts=16):
    """A leaf or peel blade: pointed outline, curled across its width, bent along its length."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.object
    o.scale = (width, length, 1)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=cuts)
    bpy.ops.object.mode_set(mode="OBJECT")
    for v in o.data.vertices:
        t = v.co.y / length + 0.5  # 0 at the base, 1 at the tip
        profile = math.sin(math.pi * min(max(t, 0.0), 1.0)) ** tip * (1 - 0.35 * t)
        v.co.x *= max(profile, 0.02)
        v.co.z = bend * t * t * length + curl * (v.co.x / max(width, 1e-3)) ** 2 * width
        v.co.y += length / 2  # the base sits at the origin, so the blade grows out from where it is placed
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.015
    return smooth(o, 1)


# ---------- props ----------
def pot():
    """Terracotta pot with a rolled rim, full of crumbly compost with a few scraps on top."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1, depth=1.2, end_fill_type="NGON")
    o = bpy.context.object
    for v in o.data.vertices:
        if v.co.z < 0:  # taper to the base
            v.co.x *= 0.76
            v.co.y *= 0.76
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES")  # open top
    bm.to_mesh(o.data)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.07
    smooth(o, 2)
    clay = mat("clay", (0.62, 0.33, 0.2), 0.75, bump=0.25, bump_scale=60, color2=(0.55, 0.29, 0.18), spots=8)
    add(o, clay)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.02, minor_radius=0.09, major_segments=96, location=(0, 0, 0.6))
    add(smooth(bpy.context.object), clay)
    soil = disc(0.98, 0.48)
    displace(soil, 0.16, 0.14, "VORONOI")
    add(soil, mat("soil", (0.1, 0.065, 0.04), 0.95, bump=1.0, bump_scale=55, color2=(0.2, 0.13, 0.08), spots=30, mix=0.6))
    crumbs(70, 0.85, 0.56, (0.15, 0.1, 0.06), 0.045, seed=5)
    crumbs(18, 0.8, 0.58, (0.32, 0.22, 0.12), 0.035, seed=6)
    random.seed(9)
    scrap = mat("scrap", (0.45, 0.3, 0.14), 0.8, bump=0.3)
    for _ in range(5):  # small dry-leaf scraps: it is compost
        s = blade(0.32, 0.18, curl=0.4)
        a, r = random.uniform(0, 6.28), random.uniform(0.2, 0.75)
        s.location = (r * math.cos(a), r * math.sin(a), 0.6)
        s.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), random.uniform(0, 6.28))
        add(s, scrap)


def banana():
    """An opened banana peel: four petals curling out from a stem, brown tips and speckles."""
    skin = mat("banana", (0.86, 0.62, 0.1), 0.5, bump=0.2, bump_scale=30, color2=(0.3, 0.18, 0.06), spots=7, mix=0.58)
    for i, ang in enumerate((-55, -5, 45, 170)):
        o = blade(1.7 if i < 3 else 1.1, 0.42, curl=2.6, bend=0.28, tip=0.6)
        add(o, skin)
        o.location = (0, 0, 0.18)
        o.rotation_euler = (math.radians(-8), math.radians(180), -math.radians(ang))  # U side down, tips lift
    bpy.ops.mesh.primitive_cylinder_add(radius=0.11, depth=0.45, location=(0, -0.05, 0.32), rotation=(math.radians(70), 0, 0))
    add(smooth(bpy.context.object, 1), mat("stem", (0.28, 0.2, 0.09), 0.8, bump=0.4))


def eggshell():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.6)
    o = bpy.context.object
    o.scale = (1, 1, 1.3)
    bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0.05), plane_no=(0, 0, 1), clear_outer=True)
    random.seed(4)
    for v in bm.verts:  # a cracked rim
        if v.co.z > -0.02:
            v.co.z -= random.uniform(0, 0.14)
    bm.to_mesh(o.data)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.025
    smooth(o, 1)
    add(o, mat("egg", (0.8, 0.56, 0.36), 0.42, bump=0.08, bump_scale=80, color2=(0.86, 0.68, 0.5), spots=25, mix=0.5))
    o.rotation_euler = (math.radians(65), 0, math.radians(30))


def tea():
    random.seed(7)
    leaf = mat("tea", (0.12, 0.08, 0.04), 0.35, bump=0.3, color2=(0.22, 0.17, 0.07), spots=20)
    for _ in range(90):
        a, r = random.uniform(0, 6.28), 0.55 * math.sqrt(random.random())
        s = blade(random.uniform(0.18, 0.3), random.uniform(0.07, 0.11), curl=random.uniform(0.5, 1.5), cuts=4)
        s.location = (r * math.cos(a), r * math.sin(a), random.uniform(0, 0.22) * (1 - r))
        s.rotation_euler = [random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(0, 6.28)]
        add(s, leaf)


def onion():
    o = blade(1.6, 1.0, curl=2.0, bend=-0.6, tip=0.6)
    add(o, mat("onion", (0.74, 0.43, 0.28), 0.35, **{"Transmission Weight": 0.4}, bump=0.1, bump_scale=6))
    o.rotation_euler = (0, math.radians(15), math.radians(25))


def seedling(stage):
    """stage 1 (two seed leaves) .. 4 (six true leaves); the base of the stem sits at the origin."""
    green = veins(mat("leaf", (0.16, 0.44, 0.14), 0.38, **{"Subsurface Weight": 0.15}))
    young = veins(mat("cotyledon", (0.36, 0.58, 0.2), 0.4))
    h = {1: 0.45, 2: 0.85, 3: 1.2, 4: 1.55}[stage]
    curve = bpy.data.curves.new("stem", "CURVE")
    curve.dimensions, curve.bevel_depth, curve.bevel_resolution = "3D", 0.035, 4
    sp = curve.splines.new("BEZIER")
    sp.bezier_points.add(1)
    sp.bezier_points[0].co, sp.bezier_points[1].co = (0, 0, 0), (0.05, 0, h)
    for p in sp.bezier_points:
        p.handle_left_type = p.handle_right_type = "AUTO"
    stem = bpy.data.objects.new("stem", curve)
    bpy.context.scene.collection.objects.link(stem)
    curve.materials.append(mat("stemm", (0.42, 0.56, 0.25), 0.5))
    pairs = {1: [(h, 0.3, young)], 2: [(h, 0.55, green), (h * 0.55, 0.28, young)],
             3: [(h, 0.55, green), (h * 0.65, 0.72, green)], 4: [(h, 0.5, green), (h * 0.72, 0.78, green), (h * 0.45, 0.85, green)]}
    for k, (z, size, m) in enumerate(pairs[stage]):
        for side in (-1, 1):
            leaf = blade(size, size * 0.5, curl=0.5, bend=-0.25, tip=0.75)
            add(leaf, m)
            leaf.location = (0.05, 0, z)
            leaf.rotation_euler = (math.radians(35), 0, math.radians(side * 90 + k * 55))  # rise 35 degrees from the stem


def cup():
    white = mat("ceramic", (0.93, 0.91, 0.87), 0.18, **{"Coat Weight": 0.6})
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.6, depth=0.08)
    add(smooth(bpy.context.object, 1), white)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.95, depth=1.0, location=(0, 0, 0.55), end_fill_type="NGON")
    o = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES")  # open top, so the coffee shows
    bm.to_mesh(o.data)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.07
    add(smooth(o, 1), white)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.9, depth=0.02, location=(0, 0, 0.92))
    add(bpy.context.object, mat("coffee", (0.06, 0.03, 0.015), 0.06, bump=0.05, bump_scale=8))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.07, location=(1.12, 0, 0.6), rotation=(math.radians(90), 0, 0))
    add(smooth(bpy.context.object), white)
    crumbs(40, 1.35, 0.06, (0.1, 0.06, 0.04), 0.035, seed=11)


def paperclip():
    curve = bpy.data.curves.new("clip", "CURVE")
    curve.dimensions, curve.bevel_depth, curve.bevel_resolution = "3D", 0.05, 6
    sp = curve.splines.new("POLY")
    pts = [(0.3, -1.5), (0.3, 1.2), (0, 1.5), (-0.3, 1.2), (-0.3, -1.7), (0, -2.0), (0.5, -1.7), (0.5, 1.6),
           (0, 2.0), (-0.5, 1.6), (-0.5, -0.8)]
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, 0, 1)
    o = bpy.data.objects.new("clip", curve)
    bpy.context.scene.collection.objects.link(o)
    curve.materials.append(mat("steel", (0.78, 0.78, 0.8), 0.18, Metallic=1.0))
    o.rotation_euler.z = math.radians(-12)


def dry_leaf(seed):
    random.seed(seed)
    tones = [(0.58, 0.37, 0.17), (0.66, 0.47, 0.22), (0.47, 0.29, 0.14)]
    o = blade(2.2, 1.1, curl=random.uniform(0.3, 0.7), bend=-0.15, tip=0.7)
    add(o, veins(mat("dry", tones[seed % 3], 0.75, color2=(0.36, 0.22, 0.1), spots=6, mix=0.58), 0.5))
    o.rotation_euler.z = random.uniform(-0.5, 0.5)


def soil_scatter():
    crumbs(160, 1.6, 0.0, (0.16, 0.11, 0.07), 0.045, seed=21)
    crumbs(50, 1.2, 0.0, (0.3, 0.21, 0.13), 0.03, seed=22)


def paper_ball():
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1)
    o = bpy.context.object
    displace(o, 0.35, 0.35, "VORONOI")
    add(o, mat("paper", (0.9, 0.86, 0.77), 0.85, bump=0.2, bump_scale=90, color2=(0.78, 0.72, 0.62), spots=40, mix=0.62))


PROPS = {
    # pixel sizes are about twice the largest display size (sharp at device pixel ratio 2)
    "pot": (pot, 1000), "banana": (banana, 360), "eggshell": (eggshell, 280), "tea": (tea, 280), "onion": (onion, 280),
    "seedling-1": (lambda: seedling(1), 520), "seedling-2": (lambda: seedling(2), 520),
    "seedling-3": (lambda: seedling(3), 520), "seedling-4": (lambda: seedling(4), 520),
    "cup": (cup, 640), "paperclip": (paperclip, 420),
    "leaf-1": (lambda: dry_leaf(1), 480), "leaf-2": (lambda: dry_leaf(2), 480), "leaf-3": (lambda: dry_leaf(3), 480),
    "soil": (soil_scatter, 700), "paper-ball": (paper_ball, 480),
}


def render(name, px, frame=None, margin=1.2):
    """Frame the scene with an ortho camera TILT from vertical and render one PNG.

    frame=(centre_z, size) fixes the framing, so a sequence (seedling stages, turntable) keeps one scale.
    """
    s = bpy.context.scene
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objects() for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, size = (lo + hi) / 2, max(hi.x - lo.x, hi.y - lo.y, (hi.z - lo.z) * 1.3)
    if frame:
        centre, size = Vector((0, 0, frame[0])), frame[1]
    if "cam" not in bpy.data.objects:
        cam = bpy.data.cameras.new("cam")
        cam.type = "ORTHO"
        s.collection.objects.link(bpy.data.objects.new("cam", cam))
    c = bpy.data.objects["cam"]
    c.data.ortho_scale = size * margin
    c.location = centre + Vector((0, -math.sin(TILT), math.cos(TILT))) * 30
    c.rotation_euler = (TILT, 0, 0)
    s.camera = c
    s.render.resolution_x = s.render.resolution_y = px
    s.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)


def objects():
    return [o for o in bpy.context.scene.objects if o.type in ("MESH", "CURVE") and not o.is_shadow_catcher]


def settle():
    """Rest everything on the shadow catcher, never below it."""
    bpy.context.view_layer.update()
    floor = min((o.matrix_world @ Vector(c)).z for o in objects() for c in o.bound_box)
    for o in objects():
        o.location.z += 0.01 - floor


for spec in PROPS if not ONLY else ONLY:
    name, turn = spec.split("@")[0], spec.endswith("@turn")
    build, px = PROPS[name]
    reset()
    build()
    settle()
    if not turn:
        render(name, px, frame=(0.75, 2.4) if name.startswith("seedling") else None)
    else:  # mouse-driven turntable: 16 frames from -30 to +30 degrees around the vertical axis
        bpy.ops.object.empty_add(location=(0, 0, 0))
        pivot = bpy.context.object
        for o in objects():
            if o.parent is None:
                o.parent = pivot
        bpy.context.view_layer.update()
        pts = [o.matrix_world @ Vector(c) for o in objects() for c in o.bound_box]
        size = max(max(p.x for p in pts) - min(p.x for p in pts), max(p.z for p in pts) * 1.3) * 1.15
        for i in range(16):
            pivot.rotation_euler.z = math.radians(-30 + i * 4)
            render(f"{name}-turn-{i:02d}", px, frame=(max(p.z for p in pts) / 2, size))
    print("rendered", spec)
