"""Render VACHAN's desk props with Blender (Cycles), one transparent PNG per object.

Usage: blender -b -P props/render_props.py -- <out_dir> [name ...]
Every prop is modelled from primitives here, lit by one warm sun from the top left,
seen from above with a 20 degree tilt, with a shadow catcher for a soft contact shadow.
"""
import math
import random
import sys

import bpy
import bmesh
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp/props"
ONLY = sys.argv[sys.argv.index("--") + 2:] if "--" in sys.argv else []


# ---------- scene ----------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 48
    s.cycles.use_denoising = True
    s.render.film_transparent = True
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    try:
        s.view_settings.view_transform = "Standard"  # keeps peel and leaf colours saturated
    except TypeError:
        pass
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.78, 0.66, 0.49, 1)  # kraft desk bounce
    bg.inputs[1].default_value = 0.7
    s.world = world
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy, sun.angle = 2.0, math.radians(10)
    o = bpy.data.objects.new("sun", sun)
    o.rotation_euler = (math.radians(40), 0, math.radians(135))  # from the top left
    s.collection.objects.link(o)
    bpy.ops.mesh.primitive_plane_add(size=40)
    bpy.context.object.is_shadow_catcher = True


def mat(name, color, rough=0.5, **inputs):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    for k, v in inputs.items():
        b.inputs[k].default_value = v
    return m


def speckle(m, color2, scale=12.0, mix=0.55):
    """Mix a second colour in noise spots (banana speckle, eggshell, paper)."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = mix, mix + 0.12
    mixn = nt.nodes.new("ShaderNodeMix")
    mixn.data_type = "RGBA"
    mixn.inputs["A"].default_value = b.inputs["Base Color"].default_value[:]
    mixn.inputs["B"].default_value = (*color2, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mixn.inputs["Factor"])
    nt.links.new(mixn.outputs["Result"], b.inputs["Base Color"])
    return m


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


def render(name, px=512, margin=1.15, frame=None):
    """Frame every visible object with an ortho camera tilted 20 degrees and render.

    frame=(centre_z, size) fixes the framing, so a sequence (seedling stages) keeps one scale.
    """
    s = bpy.context.scene
    objs = [o for o in s.objects if o.type in ("MESH", "CURVE") and not o.is_shadow_catcher]
    bpy.context.view_layer.update()
    floor = min((o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box)
    for o in objs:  # rest on the shadow catcher, never below it
        o.location.z += 0.01 - floor
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre, size = (lo + hi) / 2, max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    if frame:
        centre, size = Vector((0, 0, frame[0])), frame[1]
    cam = bpy.data.cameras.new("cam")
    cam.type, cam.ortho_scale = "ORTHO", size * margin
    c = bpy.data.objects.new("cam", cam)
    tilt = math.radians(20)
    c.location = centre + Vector((0, -math.sin(tilt), math.cos(tilt))) * 20
    c.rotation_euler = (tilt, 0, 0)
    s.collection.objects.link(c)
    s.camera = c
    s.render.resolution_x = s.render.resolution_y = px
    s.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)


# ---------- props ----------
def pot():
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1, depth=1.1, end_fill_type="NOTHING")
    o = bpy.context.object
    for v in o.data.vertices:  # taper to the base
        if v.co.z < 0:
            v.co.x *= 0.78
            v.co.y *= 0.78
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.06
    smooth(o, 1)
    add(o, mat("pot", (0.42, 0.29, 0.21), 0.55))
    bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.07, location=(0, 0, 0.55))
    add(smooth(bpy.context.object), mat("rim", (0.45, 0.31, 0.22), 0.5))
    soil = disc(0.97, 0.42)
    displace(soil, 0.1, 0.18)
    add(soil, speckle(mat("soil", (0.09, 0.06, 0.04), 0.95), (0.18, 0.12, 0.08), 30, 0.6))
    crumbs(18, 0.85, 0.48, (0.2, 0.14, 0.1))


def disc(radius, z, cuts=60):
    """A round, evenly subdivided surface (a grid cut to a circle), so displacement looks like soil."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=cuts, y_subdivisions=cuts, size=radius * 2, location=(0, 0, z))
    o = bpy.context.object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.xy.length > radius], context="VERTS")
    bm.to_mesh(o.data)
    return o


def crumbs(n, spread, z, color, size=0.05, seed=3):
    random.seed(seed)
    m = mat("crumb", color, 0.95)
    for _ in range(n):
        a, r = random.uniform(0, 6.28), spread * math.sqrt(random.random())
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=size * random.uniform(0.5, 1.4),
                                              location=(r * math.cos(a), r * math.sin(a), z))
        o = bpy.context.object
        o.rotation_euler = [random.uniform(0, 6.28) for _ in range(3)]
        add(o, m)


def strip(length, width, bend, curl=0.0):
    """A thin bent strip (peel segment, leaf blade)."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.object
    o.scale = (width, length, 1)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.subdivide(number_cuts=12)
    bpy.ops.object.mode_set(mode="OBJECT")
    for v in o.data.vertices:
        t = v.co.y / length + 0.5
        v.co.x *= math.sin(math.pi * min(max(t, 0.02), 0.98)) ** 0.6  # pointed ends
        v.co.z = bend * (t - 0.5) ** 2 * 4 + curl * v.co.x ** 2
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.02
    return smooth(o, 1)


def banana():
    m = speckle(mat("banana", (0.9, 0.7, 0.12), 0.6), (0.35, 0.22, 0.08), 9, 0.62)
    inner = mat("banana_in", (0.93, 0.88, 0.7), 0.7)
    for i, ang in enumerate((-35, 5, 40, 160)):
        o = strip(1.8 if i < 3 else 1.2, 0.42, -0.5, 0.6)
        o.data.materials.append(m)
        o.data.materials.append(inner)
        o.location = (0.7 * math.sin(math.radians(ang)), 0.7 * math.cos(math.radians(ang)), 0)
        o.rotation_euler = (0, 0, -math.radians(ang))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=0.35, location=(0, -0.1, 0.1))
    add(bpy.context.object, mat("stem", (0.3, 0.22, 0.1), 0.8))


def eggshell():
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=0.6)
    o = bpy.context.object
    o.scale = (1, 1, 1.3)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0.05),
                           plane_no=(0, 0, 1), clear_outer=True)
    random.seed(4)
    for v in bm.verts:  # cracked rim
        if v.co.z > -0.02:
            v.co.z -= random.uniform(0, 0.12)
    bm.to_mesh(o.data)
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.03
    smooth(o, 1)
    add(o, speckle(mat("egg", (0.78, 0.55, 0.36), 0.45), (0.85, 0.66, 0.48), 25, 0.5))
    o.rotation_euler = (math.radians(70), 0, math.radians(30))


def tea():
    random.seed(7)
    m = speckle(mat("tea", (0.13, 0.09, 0.05), 0.4), (0.22, 0.17, 0.08), 20)
    for _ in range(70):
        a, r = random.uniform(0, 6.28), 0.55 * math.sqrt(random.random())
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.09,
                                             location=(r * math.cos(a), r * math.sin(a), random.uniform(0, 0.25) * (1 - r)))
        o = bpy.context.object
        o.scale = (1, random.uniform(1.6, 2.6), 0.25)
        o.rotation_euler = [random.uniform(0, 6.28) for _ in range(3)]
        add(o, m)


def onion():
    o = strip(1.6, 0.9, -0.9, 1.6)
    add(o, mat("onion", (0.72, 0.42, 0.28), 0.4, **{"Transmission Weight": 0.35}))
    o.rotation_euler = (0, math.radians(15), math.radians(25))


def leaf_blade(length, width, color, curl=0.6):
    o = strip(length, width, -0.15, curl)
    return add(o, color)


def seedling(stage):
    """stage 1 sprout .. 4 six leaves; the base of the stem sits at the origin."""
    green, stem_m = mat("leaf", (0.18, 0.45, 0.16), 0.45), mat("stem", (0.4, 0.55, 0.25), 0.5)
    heights = {1: 0.5, 2: 0.9, 3: 1.25, 4: 1.6}
    h = heights[stage]
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=h, location=(0, 0, h / 2))
    add(bpy.context.object, stem_m)
    pairs = {1: [(h, 0.35)], 2: [(h, 0.6)], 3: [(h, 0.6), (h * 0.6, 0.75)], 4: [(h, 0.55), (h * 0.7, 0.8), (h * 0.4, 0.9)]}
    for k, (z, size) in enumerate(pairs[stage]):
        for side in (-1, 1):
            o = leaf_blade(size, size * 0.45, green)
            o.location = (side * size * 0.45, 0, z)
            o.rotation_euler = (math.radians(-15), math.radians(side * 25), math.radians(90 + k * 50))
    crumbs(10, 0.25, 0.0, (0.2, 0.14, 0.1), 0.04, seed=stage)


def cup():
    white = mat("ceramic", (0.92, 0.9, 0.86), 0.25, **{"Coat Weight": 0.6})
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1.6, depth=0.08)
    add(smooth(bpy.context.object, 1), white)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.95, depth=1.0, location=(0, 0, 0.55), end_fill_type="TRIFAN")
    o = bpy.context.object
    o.modifiers.new("thick", "SOLIDIFY").thickness = 0.07
    add(smooth(o, 1), white)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.9, depth=0.02, location=(0, 0, 0.92))
    add(bpy.context.object, mat("coffee", (0.07, 0.035, 0.02), 0.08))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.32, minor_radius=0.07, location=(1.12, 0, 0.6), rotation=(math.radians(90), 0, 0))
    add(smooth(bpy.context.object), white)
    crumbs(40, 1.35, 0.06, (0.1, 0.06, 0.04), 0.035, seed=11)


def paperclip():
    curve = bpy.data.curves.new("clip", "CURVE")
    curve.dimensions, curve.bevel_depth, curve.bevel_resolution = "3D", 0.05, 4
    sp = curve.splines.new("POLY")
    pts = [(0.3, -1.5), (0.3, 1.2), (0, 1.5), (-0.3, 1.2), (-0.3, -1.7), (0, -2.0), (0.5, -1.7), (0.5, 1.6),
           (0, 2.0), (-0.5, 1.6), (-0.5, -0.8)]
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, 0, 1)
    o = bpy.data.objects.new("clip", curve)
    bpy.context.scene.collection.objects.link(o)
    curve.materials.append(mat("steel", (0.75, 0.75, 0.78), 0.2, Metallic=1.0))
    o.rotation_euler.z = math.radians(-12)


def dry_leaf(seed):
    random.seed(seed)
    tones = [(0.55, 0.36, 0.18), (0.62, 0.45, 0.22), (0.45, 0.28, 0.14)]
    o = strip(2.2, 1.0, -0.4, random.uniform(0.6, 1.4))
    add(o, speckle(mat("dry", tones[seed % 3], 0.8), (0.35, 0.22, 0.1), 6, 0.55))
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=1.9, location=(0, -0.05, 0.12), rotation=(math.radians(90), 0, 0))
    add(bpy.context.object, mat("vein", (0.3, 0.2, 0.1), 0.8))
    o.rotation_euler.z = random.uniform(-0.5, 0.5)


def soil_scatter():
    crumbs(140, 1.6, 0.0, (0.17, 0.12, 0.08), 0.045, seed=21)
    crumbs(40, 1.2, 0.0, (0.28, 0.2, 0.13), 0.03, seed=22)


def paper_ball():
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1)
    o = bpy.context.object
    displace(o, 0.35, 0.35, "VORONOI")
    add(o, speckle(mat("paper", (0.9, 0.86, 0.77), 0.85), (0.8, 0.75, 0.65), 40, 0.6))


PROPS = {
    "pot": (pot, 640), "banana": (banana, 256), "eggshell": (eggshell, 192), "tea": (tea, 192), "onion": (onion, 192),
    "seedling-1": (lambda: seedling(1), 256), "seedling-2": (lambda: seedling(2), 256),
    "seedling-3": (lambda: seedling(3), 256), "seedling-4": (lambda: seedling(4), 256),
    "cup": (cup, 480), "paperclip": (paperclip, 200),
    "leaf-1": (lambda: dry_leaf(1), 320), "leaf-2": (lambda: dry_leaf(2), 320), "leaf-3": (lambda: dry_leaf(3), 320),
    "soil": (soil_scatter, 512), "paper-ball": (paper_ball, 320),
}

for name, (build, px) in PROPS.items():
    if ONLY and name not in ONLY:
        continue
    reset()
    build()
    render(name, px, frame=(0.9, 2.6) if name.startswith("seedling") else None)
    print("rendered", name)
