import * as THREE from 'three'
import { fx } from '../fx-config'

/**
 * The entry screen: a deep field of particles with a glowing particle sphere
 * and two orbiting rings at its centre. Rendered at full resolution (no
 * pixelation) with its own light treatment: grain, faint diagonal scanlines,
 * red/blue split toward the edges, and a soft bloom from additive glow.
 *
 * The cursor shifts the camera (near particles move more than far ones) and
 * pushes nearby particles away. `exit()` flies the camera through the sphere.
 */
const BLUE = new THREE.Color('#2F7BFF')
const PALE = new THREE.Color('#8CB4FF')
const WARM = new THREE.Color('#E8C98A')

const POINT_VERT = /* glsl */ `
attribute float aSize;
attribute float aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uDrift;
uniform float uScale;
uniform vec2 uMouse;     // NDC
uniform float uAspect;
uniform float uPush;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vec3 p = position;
  float s = aSeed * 6.2831;
  p += vec3(sin(uTime * 0.11 + s), cos(uTime * 0.13 + s * 1.7), sin(uTime * 0.07 + s * 2.3)) * uDrift;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  // Push away from the cursor, in screen space.
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vec2 d = ndc - uMouse;
  d.x *= uAspect;
  float fall = exp(-dot(d, d) / 0.035);
  ndc += normalize(d + 1e-5) * vec2(1.0 / uAspect, 1.0) * uPush * fall;
  gl_Position.xy = ndc * gl_Position.w;
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  vColor = aColor;
  vTwinkle = 0.75 + 0.25 * sin(uTime * (1.0 + aSeed * 3.0) + s);
}`

const POINT_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  // Flat-topped dot with a soft edge: small points stay visible, big ones read as bokeh.
  float a = smoothstep(0.5, 0.18, r) * vTwinkle * uOpacity;
  gl_FragColor = vec4(vColor * a, a);
}`

const ENTRY_POST_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform vec2 uRes;
uniform float uTime;
uniform float uGrain;
uniform float uScan;
uniform float uSplit;
uniform float uZoom;     // 0..1 radial zoom blur during the exit
uniform float uFlash;    // 0..1 brightening at the end of the exit
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 dir = uv - 0.5;
  float edge = dot(dir, dir) * 4.0;
  vec2 off = dir * uSplit * edge / uRes.x * 2.0;
  vec3 col = vec3(texture2D(tScene, uv + off).r, texture2D(tScene, uv).g, texture2D(tScene, uv - off).b);
  if (uZoom > 0.001) {
    vec3 acc = col;
    for (int i = 1; i < 10; i++) {
      float f = float(i) / 10.0 * uZoom * 0.35;
      acc += texture2D(tScene, uv - dir * f).rgb;
    }
    col = acc / 10.0 * (1.0 + uZoom);
  }
  col += (hash(gl_FragCoord.xy + fract(uTime) * vec2(37.0, 91.0)) - 0.5) * uGrain;
  float diag = step(mod(gl_FragCoord.x + gl_FragCoord.y, 4.0), 1.0);
  col *= 1.0 - uScan * diag;
  col *= 1.0 - 0.45 * edge;
  col = mix(col, vec3(0.86, 0.91, 1.0), uFlash);
  gl_FragColor = vec4(col, 1.0);
}`

/** `scale` sets how big the points draw: the deep field is drawn bigger than the fine sphere. */
function points(positions: number[], colors: THREE.Color[], sizes: number[], drift: number, scale = 1) {
  const n = positions.length / 3
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors.flatMap((c) => [c.r, c.g, c.b]), 3))
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1))
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(Array.from({ length: n }, Math.random), 1))
  const mat = new THREE.ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uDrift: { value: drift },
      uScale: { value: 300 },
      uMouse: { value: new THREE.Vector2(9, 9) },
      uAspect: { value: 1 },
      uPush: { value: 0 },
      uOpacity: { value: 1 },
      uSizeK: { value: scale },
    },
  })
  return new THREE.Points(geo, mat)
}

function fieldColour(r: number) {
  if (r < 0.14) return BLUE.clone().multiplyScalar(0.8 + Math.random() * 0.6)
  if (r < 0.26) return PALE.clone().multiplyScalar(0.7 + Math.random() * 0.5)
  if (r < 0.28) return WARM.clone().multiplyScalar(0.8 + Math.random() * 0.4)
  const g = 0.35 + Math.random() * 0.6
  return new THREE.Color(g, g, g * 1.05)
}

export function createEntry(reduced: boolean) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#020308')
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 120)
  camera.position.set(0, 0, 10.5)

  // Deep field
  const fp: number[] = []
  const fc: THREE.Color[] = []
  const fs: number[] = []
  for (let i = 0; i < fx.entry.field; i++) {
    // A wide, flat band through the middle of the frame, thinning out above and below.
    const z = -45 + Math.random() * 52
    const spread = 14 + (z + 45) * 0.05
    const gauss = Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * Math.cos(Math.random() * Math.PI * 2)
    fp.push((Math.random() * 2 - 1) * spread * 2.4, gauss * spread * (Math.random() < 0.8 ? 0.22 : 0.6), z)
    fc.push(fieldColour(Math.random()))
    fs.push(Math.random() < 0.05 ? 2.6 + Math.random() * 3.5 : 0.7 + Math.random() * 1.3)
  }
  const field = points(fp, fc, fs, reduced ? 0 : 0.35)
  scene.add(field)

  // Sphere and rings
  const orb = new THREE.Group()
  scene.add(orb)
  const sp: number[] = []
  const sc: THREE.Color[] = []
  const ss: number[] = []
  const shell = Math.round(fx.entry.sphere * 0.62)
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < shell; i++) {
    const y = 1 - (i / (shell - 1)) * 2
    const rr = Math.sqrt(1 - y * y)
    const a = golden * i
    const R = 1.25 * (1 + (Math.random() - 0.5) * 0.04)
    sp.push(Math.cos(a) * rr * R, y * R, Math.sin(a) * rr * R)
    sc.push(Math.random() < 0.12 ? PALE.clone() : new THREE.Color(0.9, 0.93, 1).multiplyScalar(0.75 + Math.random() * 0.5))
    ss.push(0.9 + Math.random() * 1.3)
  }
  const sphere = points(sp, sc, ss, reduced ? 0 : 0.008, 0.36)
  orb.add(sphere)

  const ring = (count: number, radius: number, width: number, tiltX: number, tiltZ: number) => {
    const rp: number[] = []
    const rc: THREE.Color[] = []
    const rs: number[] = []
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const rad = radius + (Math.random() - 0.5) * width
      rp.push(Math.cos(a) * rad, (Math.random() - 0.5) * width * 0.4, Math.sin(a) * rad)
      rc.push(Math.random() < 0.2 ? PALE.clone().multiplyScalar(1.2) : new THREE.Color(1, 1, 1))
      rs.push(1 + Math.random() * 1.5)
    }
    const r = points(rp, rc, rs, reduced ? 0 : 0.01, 0.42)
    const holder = new THREE.Group()
    holder.rotation.set(tiltX, 0, tiltZ)
    holder.add(r)
    orb.add(holder)
    return r
  }
  const ringA = ring(Math.round(fx.entry.sphere * 0.24), 1.3, 0.3, 1.2, 0.35)
  const ringB = ring(Math.round(fx.entry.sphere * 0.14), 1.32, 0.2, 0.25, -0.5)

  // Soft bloom behind the sphere
  const glowTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(160,195,255,0.28)')
    grad.addColorStop(0.3, 'rgba(47,123,255,0.12)')
    grad.addColorStop(1, 'rgba(2,3,8,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    return new THREE.CanvasTexture(c)
  })()
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  glow.scale.setScalar(6)
  scene.add(glow)

  const all = [field, sphere, ringA, ringB]
  const post = new THREE.ShaderMaterial({
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: ENTRY_POST_FRAG,
    depthTest: false,
    uniforms: {
      tScene: { value: null as THREE.Texture | null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uGrain: { value: fx.entry.grain },
      uScan: { value: fx.entry.scan },
      uSplit: { value: fx.entry.split },
      uZoom: { value: 0 },
      uFlash: { value: 0 },
    },
  })

  const view = { x: 0, y: 0 }
  const state = { fly: 0, zoom: 0, flash: 0 }

  return {
    scene,
    camera,
    post,
    state,
    resize(w: number, h: number) {
      camera.aspect = w / h
      camera.fov = w / h < 0.8 ? 72 : 55
      camera.updateProjectionMatrix()
      for (const p of all) {
        const u = (p.material as THREE.ShaderMaterial).uniforms
        u.uAspect.value = w / h
        u.uScale.value = h * 0.05 * u.uSizeK.value
      }
      post.uniforms.uRes.value.set(w, h)
    },
    /** mouse: NDC (−1..1) or null when there is no cursor. */
    update(time: number, dt: number, mouse: { x: number; y: number } | null, lean: { x: number; y: number }) {
      const t = reduced ? 0 : time
      const follow = 1 - Math.exp(-dt / 0.5)
      view.x += (lean.x - view.x) * follow
      view.y += (lean.y - view.y) * follow
      // Fly-through: from 9 units out to straight through the sphere.
      const z = 10.5 - state.fly * 12.5
      camera.position.set(view.x * 1.6 * (1 - state.fly), view.y * 0.9 * (1 - state.fly), z)
      camera.lookAt(0, 0, z - 10)
      if (!reduced) {
        orb.rotation.y = t * 0.12
        orb.rotation.x = Math.sin(t * 0.07) * 0.15
        ringA.parent!.rotation.y = t * 0.35
        ringB.parent!.rotation.y = -t * 0.22
      }
      for (const p of all) {
        const u = (p.material as THREE.ShaderMaterial).uniforms
        u.uTime.value = t
        if (mouse) u.uMouse.value.set(mouse.x, mouse.y)
        else u.uMouse.value.set(9, 9)
        u.uPush.value = reduced ? 0 : fx.entry.push
      }
      post.uniforms.uTime.value = t
      post.uniforms.uZoom.value = state.zoom
      post.uniforms.uFlash.value = state.flash
    },
  }
}

export type Entry = ReturnType<typeof createEntry>
