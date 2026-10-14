import * as THREE from 'three'
import { crows, type CrowKey, type Plate, type WalkCycle } from '../assets'

/**
 * Plate world: a photo backplate rebuilt as 3D from its depth map.
 *
 * The camera sits at the origin looking down −z with a fixed vertical field of
 * view (FOV_Y). Every pixel (u, v) of the photo lies on the ray through that
 * point of the frame; its depth map says how far along. Seen from the
 * origin the mesh looks exactly like the photo; move the camera and near
 * things slide past far ones: real parallax.
 *
 * Anything else in the scene (the crow, screens, the vault door) is placed
 * the same way: by pointing at a pixel of the photo and asking how deep the
 * photo is there.
 */
export const FOV_Y = 40
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV_Y / 2))

export interface PlateSpace {
  plate: Plate
  near: number
  far: number
  /** Distance of the photo at a pixel. */
  z(u: number, v: number): number
  /** 3D point of a pixel at a given distance (default: the photo's own depth there). */
  at(u: number, v: number, z?: number): THREE.Vector3
  /** Height in scene units of a fraction of the frame at distance z. */
  span(fraction: number, z: number): number
}

export function plateSpace(plate: Plate, near: number, far: number): PlateSpace {
  const zOf = (d: number) => 1 / (1 / far + d * (1 / near - 1 / far))
  const space: PlateSpace = {
    plate,
    near,
    far,
    z: (u, v) => zOf(plate.sample(u, v)),
    at(u, v, z = space.z(u, v)) {
      return new THREE.Vector3((2 * u - 1) * TAN * plate.aspect * z, (1 - 2 * v) * TAN * z, -z)
    },
    span: (fraction, z) => fraction * 2 * TAN * z,
  }
  return space
}

// ---------------------------------------------------------------------------
// The backplate mesh
// ---------------------------------------------------------------------------

export interface PlateLook {
  /** Atmospheric haze toward the back: colour and strength (0–1). */
  haze?: [string, number]
  /** Blur behind this distance (the crow's), for a touch of depth of field. */
  focusZ?: number
  /** Soft contact shadow on the floor: centre (u, v), radius (u, v), strength. */
  shadow?: { at: [number, number]; size: [number, number]; strength: number; cast?: [number, number] }
  /** Flickering or pulsing light in part of the photo: centre, radius, colour, strength, kind. */
  lights?: { at: [number, number]; radius: [number, number]; color: string; amount: number; kind: 'fire' | 'pulse' | 'screen' }[]
  /** A region to paint over with a flat colour (e.g. behind a door that will move): u0, v0, u1, v1. */
  hole?: { rect: [number, number, number, number]; color: string }
  /** Flat, scrolling plate (screen 07): no depth, texture repeats mirrored sideways. */
  scroll?: boolean
}

const PLATE_VERT = /* glsl */ `
uniform sampler2D uDepth;
uniform float uTan;
uniform float uAspect;
uniform float uNear;
uniform float uFar;
uniform float uFlat;      // 1 = ignore depth (scrolling plate)
uniform float uFlatZ;
varying vec2 vUv;
varying vec2 vScreen;
varying float vZ;
void main() {
  vec2 uv = uv;
  vScreen = uv;
  vUv = uv;
  float d = texture2D(uDepth, clamp(uv, 0.0, 1.0)).r;
  float z = mix(1.0 / (1.0 / uFar + d * (1.0 / uNear - 1.0 / uFar)), uFlatZ, uFlat);
  vZ = z;
  vec3 p = vec3((2.0 * uv.x - 1.0) * uTan * uAspect * z, (1.0 - 2.0 * (1.0 - uv.y)) * uTan * z, -z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`

const PLATE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uOverlay;     // optional: chart drawn on the wall (screen 07)
uniform vec4 uOverlayRect;      // v0, v1 of the wall band, horizontal scale, on/off
uniform float uScroll;          // horizontal offset in plate widths (screen 07)
uniform float uTime;
uniform float uExposure;
uniform vec3 uHazeColor;
uniform float uHaze;
uniform float uNear;
uniform float uFar;
uniform float uFocusZ;
uniform vec2 uTexel;
uniform vec4 uShadow;           // centre u, v, radius u, v (in screen uv)
uniform vec3 uShadowCast;       // offset u, v, strength
uniform float uShadowStrength;
uniform vec4 uLightA; uniform vec4 uLightAR; uniform vec3 uLightAC;   // centre/kind, radius/amount, colour
uniform vec4 uLightB; uniform vec4 uLightBR; uniform vec3 uLightBC;
uniform vec4 uHole; uniform vec3 uHoleColor;
varying vec2 vUv;
varying vec2 vScreen;
varying float vZ;

float mirror(float x) { float m = mod(x, 2.0); return m > 1.0 ? 2.0 - m : m; }

vec3 tap(vec2 uv) {
  return texture2D(uMap, vec2(mirror(uv.x + uScroll), 1.0 - clamp(1.0 - uv.y, 0.0, 1.0))).rgb;
}

float light(vec4 l, vec4 lr, vec2 uv) {
  vec2 d = (uv - l.xy) / max(lr.xy, vec2(1e-4));
  float m = exp(-dot(d, d) * 2.0);
  float t = uTime;
  float k = l.z < 0.5
    ? 0.75 + 0.18 * sin(t * 11.0) + 0.12 * sin(t * 17.3 + 1.0) + 0.08 * sin(t * 29.0)   // fire
    : (l.z < 1.5 ? 0.85 + 0.15 * sin(t * 2.2) : 0.9 + 0.1 * sin(t * 7.0) * sin(t * 2.3));  // pulse, screen
  return m * (k - 0.85) * lr.z * 4.0 + m * lr.z * 0.25;
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);         // photo coordinates, v down
  vec3 col = tap(vec2(uv.x, 1.0 - uv.y));

  // A touch of depth of field behind the subject.
  if (uFocusZ > 0.0) {
    float blur = clamp((vZ - uFocusZ) / uFocusZ, 0.0, 1.0) * 2.5;
    if (blur > 0.05) {
      vec2 o = uTexel * blur;
      vec3 b = tap(vec2(uv.x + o.x, 1.0 - uv.y)) + tap(vec2(uv.x - o.x, 1.0 - uv.y))
             + tap(vec2(uv.x, 1.0 - uv.y + o.y)) + tap(vec2(uv.x, 1.0 - uv.y - o.y));
      col = mix(col, b * 0.25, min(1.0, blur));
    }
  }

  // Chart drawn on the wall (screen 07): additive glow inside the wall band.
  if (uOverlayRect.w > 0.5 && uv.y > uOverlayRect.x && uv.y < uOverlayRect.y) {
    vec2 ouv = vec2((uv.x + uScroll) * uOverlayRect.z, (uv.y - uOverlayRect.x) / (uOverlayRect.y - uOverlayRect.x));
    vec4 o = texture2D(uOverlay, vec2(ouv.x, 1.0 - ouv.y));
    col += o.rgb * o.a;
  }

  // Region painted over (behind the vault door).
  if (uHole.z > uHole.x) {
    vec2 hv = vec2(vScreen.x, 1.0 - vScreen.y);
    float m = step(uHole.x, hv.x) * step(hv.x, uHole.z) * step(uHole.y, hv.y) * step(hv.y, uHole.w);
    col = mix(col, uHoleColor * (0.6 + 0.4 * (1.0 - hv.y)), m);
  }

  // Lights that flicker or pulse.
  vec2 suv = vec2(vScreen.x, 1.0 - vScreen.y);
  if (uLightAR.z > 0.0) {
    float l = light(uLightA, uLightAR, suv);
    col *= 1.0 + l;
    col += uLightAC * max(0.0, l) * 0.15;
  }
  if (uLightBR.z > 0.0) {
    float l = light(uLightB, uLightBR, suv);
    col *= 1.0 + l;
    col += uLightBC * max(0.0, l) * 0.15;
  }

  // Contact shadow (and a longer cast shadow away from the light).
  if (uShadowStrength > 0.0) {
    vec2 d = (suv - uShadow.xy) / uShadow.zw;
    float s = exp(-dot(d, d) * 2.2);
    vec2 d2 = (suv - uShadow.xy - uShadowCast.xy) / (uShadow.zw * vec2(1.6, 1.0));
    s = max(s, exp(-dot(d2, d2) * 2.5) * uShadowCast.z);
    col *= 1.0 - s * uShadowStrength;
  }

  // Haze on distant layers.
  float far = smoothstep(uNear * 1.5, uFar, vZ);
  col = mix(col, uHazeColor, far * uHaze);

  gl_FragColor = vec4(col * uExposure, 1.0);
}`

const KIND = { fire: 0, pulse: 1, screen: 2 } as const

export function plateMesh(space: PlateSpace, look: PlateLook = {}) {
  const { plate, near, far } = space
  // A little beyond the frame on every side, so parallax never shows an edge.
  const pad = 0.1
  const seg = look.scroll ? 2 : 220
  const geo = new THREE.PlaneGeometry(1, 1, seg, Math.round(seg / plate.aspect))
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, -pad + uv.getX(i) * (1 + 2 * pad), -pad + uv.getY(i) * (1 + 2 * pad))

  plate.texture.wrapS = look.scroll ? THREE.MirroredRepeatWrapping : THREE.ClampToEdgeWrapping
  plate.texture.wrapT = THREE.ClampToEdgeWrapping
  plate.depth.wrapS = plate.depth.wrapT = THREE.ClampToEdgeWrapping
  const light = (i: number) => look.lights?.[i]
  const lv = (i: number) => {
    const l = light(i)
    return {
      p: new THREE.Vector4(l?.at[0] ?? 0, l?.at[1] ?? 0, l ? KIND[l.kind] : 0, 0),
      r: new THREE.Vector4(l?.radius[0] ?? 1, l?.radius[1] ?? 1, l ? l.amount : -1, 0),
      c: new THREE.Color(l?.color ?? '#000000'),
    }
  }
  const A = lv(0)
  const B = lv(1)
  const s = look.shadow
  const h = look.hole
  const mat = new THREE.ShaderMaterial({
    vertexShader: PLATE_VERT,
    fragmentShader: PLATE_FRAG,
    uniforms: {
      uMap: { value: plate.texture },
      uDepth: { value: plate.depth },
      uOverlay: { value: null as THREE.Texture | null },
      uOverlayRect: { value: new THREE.Vector4(0, 0, 1, 0) },
      uScroll: { value: 0 },
      uTan: { value: TAN },
      uAspect: { value: plate.aspect },
      uNear: { value: near },
      uFar: { value: far },
      uFlat: { value: look.scroll ? 1 : 0 },
      uFlatZ: { value: far * 0.5 },
      uTime: { value: 0 },
      uExposure: { value: 1 },
      uHazeColor: { value: new THREE.Color(look.haze?.[0] ?? '#0b1530') },
      uHaze: { value: look.haze?.[1] ?? 0.12 },
      uFocusZ: { value: look.focusZ ?? 0 },
      uTexel: { value: new THREE.Vector2(1 / 1600, 1 / 900) },
      uShadow: { value: new THREE.Vector4(s?.at[0] ?? 0, s?.at[1] ?? 0, s?.size[0] ?? 1, s?.size[1] ?? 1) },
      uShadowCast: { value: new THREE.Vector3(s?.cast?.[0] ?? 0, s?.cast?.[1] ?? 0, s?.cast ? 0.6 : 0) },
      uShadowStrength: { value: s?.strength ?? 0 },
      uLightA: { value: A.p },
      uLightAR: { value: A.r },
      uLightAC: { value: A.c },
      uLightB: { value: B.p },
      uLightBR: { value: B.r },
      uLightBC: { value: B.c },
      uHole: { value: new THREE.Vector4(...(h?.rect ?? [0, 0, 0, 0])) },
      uHoleColor: { value: new THREE.Color(h?.color ?? '#000000') },
    },
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false
  return mesh
}

// ---------------------------------------------------------------------------
// The crow, composited into the plate
// ---------------------------------------------------------------------------

export interface CrowLight {
  /** Overall colour of the light falling on him. */
  tint: string
  /** Brightness multiplier on top of the tint (default 1.65). */
  exposure?: number
  /** Rim light colour and which way it comes from (screen direction, e.g. [1, 0.3] = from the right, a bit above). */
  rim: string
  rimFrom: [number, number]
  rimAmount?: number
  /** How far the feet darken toward the floor (ambient occlusion), 0–1. */
  feet?: number
  /** Haze in front of him, matching the plate. */
  haze?: [string, number]
}

const CROW_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const CROW_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uKey;           // 1 = pull alpha from a green screen
uniform vec3 uTint;
uniform vec3 uRim;
uniform vec2 uRimFrom;
uniform float uRimAmount;
uniform float uFeet;
uniform float uFeetAt;        // where the soles are, in v from the top
uniform vec3 uHazeColor;
uniform float uHaze;
uniform float uFlicker;
uniform float uTime;
uniform vec2 uTexel;
varying vec2 vUv;
vec4 px(vec2 uv) {
  vec4 c = texture2D(uMap, uv);
  if (uKey > 0.5) {
    float spill = c.g - max(c.r, c.b);
    c.a = 1.0 - smoothstep(0.04, 0.18, spill);
    c.g = min(c.g, max(c.r, c.b) + 0.015);
  }
  return c;
}
void main() {
  vec4 c = px(vUv);
  if (c.a < 0.4) discard;
  // Rim: an edge whose neighbour toward the light is empty catches that light.
  vec2 o = normalize(uRimFrom) * uTexel * 6.0;
  float rim = clamp(c.a - px(vUv + o).a, 0.0, 1.0);
  float rim2 = clamp(c.a - px(vUv + o * 2.5).a, 0.0, 1.0) * 0.5;
  vec3 col = c.rgb * uTint * (1.0 + uFlicker * (0.12 * sin(uTime * 11.0) + 0.08 * sin(uTime * 17.3)));
  col += uRim * max(rim, rim2) * uRimAmount;
  // Darker toward the soles: the floor bounces less light up there.
  col *= mix(1.0 - uFeet, 1.0, smoothstep(1.0 - uFeetAt, 1.0 - uFeetAt + 0.12, vUv.y));
  col = mix(col, uHazeColor, uHaze);
  gl_FragColor = vec4(col, 1.0);
}`

export interface CrowPlacement {
  /** Where his soles touch the floor, in photo coordinates. */
  feet: [number, number]
  /** Take the depth from this pixel instead (when the feet themselves are hidden behind a desk). */
  depthAt?: [number, number]
  /** His height as a fraction of the frame height. */
  height: number
  /** Mirror him. */
  flip?: boolean
}

function crowMaterial(map: THREE.Texture, key: boolean, feetAt: number, light: CrowLight, texel: [number, number]) {
  return new THREE.ShaderMaterial({
    vertexShader: CROW_VERT,
    fragmentShader: CROW_FRAG,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
    uniforms: {
      uMap: { value: map },
      uKey: { value: key ? 1 : 0 },
      uTint: { value: new THREE.Color(light.tint).multiplyScalar(light.exposure ?? 1.65) },
      uRim: { value: new THREE.Color(light.rim) },
      uRimFrom: { value: new THREE.Vector2(...light.rimFrom) },
      uRimAmount: { value: (light.rimAmount ?? 1.4) * 0.75 },
      uFeet: { value: light.feet ?? 0.35 },
      uFeetAt: { value: feetAt },
      uHazeColor: { value: new THREE.Color(light.haze?.[0] ?? '#0b1530') },
      uHaze: { value: light.haze?.[1] ?? 0.04 },
      uFlicker: { value: 0 },
      uTime: { value: 0 },
      uTexel: { value: new THREE.Vector2(...texel) },
    },
  })
}

/**
 * How far toward the camera a cutout is pulled, along its own sight line.
 * Scaling a point toward the camera keeps it exactly where it was on screen,
 * so he still stands on his spot at his size, but the floor just behind his
 * feet (which the depth map puts at almost the same distance) can no longer
 * poke through his legs. Real foreground (a desk) is much nearer and still
 * covers him.
 */
const PULL = 0.86

/**
 * Stands a crow cutout on the plate's floor at a believable size, lit to
 * match. Returns the mesh and the distance he stands at (for depth of field).
 */
export function placeCrow(space: PlateSpace, key: CrowKey, where: CrowPlacement, light: CrowLight) {
  const { texture, aspect } = crows[key]
  const [fu, fv] = where.feet
  const [du, dv] = where.depthAt ?? where.feet
  const z = space.z(du, dv)
  const foot = space.at(fu, fv, z)
  const h = space.span(where.height, z)
  const geo = new THREE.PlaneGeometry(1, 1)
  geo.translate(0, 0.5, 0)
  const img = texture.image as { width: number; height: number }
  const mesh = new THREE.Mesh(geo, crowMaterial(texture, false, 1, light, [1 / img.width, 1 / img.height]))
  mesh.scale.set(h * aspect * (where.flip ? -1 : 1) * PULL, h * PULL, 1)
  mesh.position.copy(foot).multiplyScalar(PULL)
  mesh.renderOrder = 2
  return { mesh, z: z * PULL, height: h * PULL }
}

/** The walk cycle on a plane, feet at the bottom edge of the subject. */
export function placeWalker(space: PlateSpace, walk: WalkCycle, where: CrowPlacement, light: CrowLight) {
  const tex = new THREE.VideoTexture(walk.video)
  tex.colorSpace = THREE.SRGBColorSpace
  const [fu, fv] = where.feet
  const z = space.z(...(where.depthAt ?? where.feet))
  const foot = space.at(fu, fv, z)
  const h = space.span(where.height, z) / walk.feet
  const geo = new THREE.PlaneGeometry(1, 1)
  // Put the soles (walk.feet down the frame) at the origin.
  geo.translate(0, 0.5 - (1 - walk.feet), 0)
  const mesh = new THREE.Mesh(geo, crowMaterial(tex, !walk.alpha, walk.feet, light, [1 / walk.video.videoWidth, 1 / walk.video.videoHeight]))
  mesh.scale.set(h * walk.aspect * PULL, h * PULL, 1)
  mesh.position.copy(foot).multiplyScalar(PULL)
  mesh.renderOrder = 2
  return { mesh, z, height: h }
}

// ---------------------------------------------------------------------------
// Live layers pinned to the photo
// ---------------------------------------------------------------------------

/**
 * A flat quad over four corners of the photo (top-left, top-right,
 * bottom-right, bottom-left), at the photo's depth there, nudged a little
 * toward the camera so it sits on the surface.
 */
export function plateQuad(space: PlateSpace, corners: [number, number][], material: THREE.Material, nudge = 0.985) {
  const pts = corners.map(([u, v]) => {
    const z = space.z(u, v) * nudge
    return space.at(u, v, z)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2))
  geo.setIndex([0, 3, 1, 1, 3, 2])
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, material)
  mesh.renderOrder = 1
  return mesh
}

/** Self-lit texture for screens and signs. */
export const screenMaterial = (map: THREE.Texture, opacity = 1) =>
  new THREE.MeshBasicMaterial({ map, transparent: opacity < 1, opacity, toneMapped: false })

export function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------------------------------------------------------------------------
// Dust: motes that only show where the photo is lit (so they gather in beams)
// ---------------------------------------------------------------------------

const DUST_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uSize;
varying vec2 vScreen;
varying float vSeed;
void main() {
  vec3 p = position;
  float s = aSeed * 6.2831;
  p.y = mod(p.y + uTime * (0.02 + aSeed * 0.04) + 20.0, 6.0) - 3.0;
  p.x += sin(uTime * 0.3 + s) * 0.08;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vScreen = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
  vSeed = aSeed;
  // The scene is rendered small (one pixel per block), so a mote is one or two pixels.
  gl_PointSize = max(1.0, uSize * (0.6 + aSeed) / max(-mv.z, 0.5));
}`

const DUST_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uAmount;
varying vec2 vScreen;
varying float vSeed;
void main() {
  vec3 bg = texture2D(uMap, vScreen).rgb;
  float lit = smoothstep(0.12, 0.45, dot(bg, vec3(0.3, 0.5, 0.2)));
  float tw = 0.6 + 0.4 * sin(uTime * (1.5 + vSeed * 3.0) + vSeed * 40.0);
  float a = lit * tw * uAmount;
  gl_FragColor = vec4(vec3(0.95, 0.97, 1.0) * a, a);
}`

export function dust(space: PlateSpace, count = 700, amount = 0.6) {
  const pos: number[] = []
  const seeds: number[] = []
  for (let i = 0; i < count; i++) {
    const z = space.near * 1.1 + Math.random() * (space.far - space.near) * 0.25
    const u = Math.random()
    const v = Math.random()
    const p = space.at(u, v, z)
    pos.push(p.x, ((v - 0.5) * -6) % 6, p.z)
    seeds.push(Math.random())
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))
  const pts = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: space.plate.texture }, uTime: { value: 0 }, uSize: { value: 3.2 }, uAmount: { value: amount } },
    }),
  )
  pts.frustumCulled = false
  pts.renderOrder = 3
  return pts
}

/** Deterministic random numbers, so scenes look the same on every load. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
