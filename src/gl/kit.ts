import * as THREE from 'three'
import { crows, type CrowKey } from '../assets'

/**
 * Building blocks for the blockout scenes: materials, primitive props,
 * lights, haze, and the crow cutout. Units are metres; the floor is y = 0.
 */
export const BLUE = 0x2f7bff
export const INK = 0xedeef2
export const NIGHT = 0x020308

type Parent = THREE.Object3D

export const mat = (color: number, roughness = 0.8, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })

/** Self-lit surface. With a texture, the texture is what glows. */
export const glow = (color: number, intensity = 1.5, map?: THREE.Texture) =>
  new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, emissiveMap: map ?? null, roughness: 1 })

export const M = {
  floor: () => mat(0x0b0e18, 0.38, 0.25),
  wall: () => mat(0x10131f, 0.95),
  wood: () => mat(0x2a211c, 0.6),
  leather: () => mat(0x15171f, 0.42, 0.05),
  metal: () => mat(0x8a90a0, 0.3, 0.9),
  dark: () => mat(0x05060b, 0.9),
  gold: () => mat(0xd9b45a, 0.28, 1),
  glass: () => mat(0xbfd4ff, 0.08, 0.1, { transparent: true, opacity: 0.32 }),
}

function place<T extends THREE.Object3D>(parent: Parent, obj: T, x: number, y: number, z: number, shadow = true): T {
  obj.position.set(x, y, z)
  if (obj instanceof THREE.Mesh) obj.castShadow = obj.receiveShadow = shadow
  parent.add(obj)
  return obj
}

export const box = (p: Parent, w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true) =>
  place(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, shadow)

export const cyl = (p: Parent, rTop: number, rBottom: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 24) =>
  place(p, new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), m), x, y, z)

export const ball = (p: Parent, r: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  place(p, new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m), x, y, z)

/** Upright panel facing +z. */
export const panel = (p: Parent, w: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0) =>
  place(p, new THREE.Mesh(new THREE.PlaneGeometry(w, h), m), x, y, z, false)

export function ground(scene: Parent, m: THREE.Material = M.floor(), size = 60) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m)
  g.rotation.x = -Math.PI / 2
  g.receiveShadow = true
  scene.add(g)
  return g
}

export function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export interface RigOptions {
  env: THREE.Texture
  /** Key light position and what it points at. */
  key: [number, number, number]
  aim?: [number, number, number]
  keyColor?: number
  keyPower?: number
  keyAngle?: number
  /** Blue rim light position (it also aims at `aim`). */
  rim?: [number, number, number]
  rimPower?: number
  ambient?: number
  fog?: number
}

/** The house lighting: dark room, one soft-shadowed key, blue rim from behind. */
export function rig(scene: THREE.Scene, o: RigOptions) {
  scene.background = new THREE.Color(NIGHT)
  scene.fog = new THREE.FogExp2(NIGHT, o.fog ?? 0.035)
  scene.environment = o.env
  scene.environmentIntensity = 0.22
  scene.add(new THREE.HemisphereLight(0x33487a, 0x05060b, o.ambient ?? 0.35))

  const aim = o.aim ?? [0, 1, 0]
  const key = new THREE.SpotLight(o.keyColor ?? 0xfff1dc, o.keyPower ?? 5, 0, o.keyAngle ?? 0.5, 0.7, 0)
  key.position.set(...o.key)
  key.target.position.set(...aim)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0015
  key.shadow.radius = 3
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 30
  scene.add(key, key.target)

  const rim = new THREE.SpotLight(BLUE, o.rimPower ?? 9, 0, 0.6, 0.8, 0)
  rim.position.set(...(o.rim ?? [-2.5, 3.5, -4]))
  rim.target.position.set(...aim)
  scene.add(rim, rim.target)
  return { key, rim }
}

/** Visible light shaft: a soft additive cone from a lamp down to the floor. */
export function haze(p: Parent, from: [number, number, number], to: [number, number, number], radius = 1.6, color = 0xdfe8ff, strength = 0.22) {
  const a = new THREE.Vector3(...from)
  const b = new THREE.Vector3(...to)
  const len = a.distanceTo(b)
  const geo = new THREE.CylinderGeometry(0.08, radius, len, 28, 1, true)
  geo.translate(0, -len / 2, 0)
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.5); float fall = smoothstep(0.0, 0.25, vUv.y) * (0.35 + 0.65 * vUv.y);
        gl_FragColor = vec4(uColor, edge * fall * uStrength); }`,
  })
  const cone = new THREE.Mesh(geo, m)
  cone.position.copy(a)
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), b.clone().sub(a).normalize())
  p.add(cone)
  return cone
}

const blobTexture = canvasTexture(128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.35)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.fillRect(0, 0, 128, 128)
})

export interface CrowOptions {
  x?: number
  /** Height of the surface the crow stands or sits on. */
  y?: number
  z?: number
  /** Height of the cutout in metres. */
  h: number
  /** Mirror it to face the other way. */
  flip?: boolean
  /** Soft blob under the feet. Off when a desk or chair hides them. */
  contact?: boolean
}

/**
 * The crow: an image cutout on an upright plane, lit by the scene's lights,
 * casting a shaped shadow, with a soft contact shadow under it. If the image
 * is missing this shows the labelled silhouette instead (see assets.ts).
 */
export function crow(parent: Parent, key: CrowKey, o: CrowOptions) {
  const { texture, aspect, placeholder } = crows[key]
  const group = new THREE.Group()
  group.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0)

  const geo = new THREE.PlaneGeometry(1, 1)
  geo.translate(0, 0.5, 0)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: texture,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.85,
      // The placeholder glows a little so its label stays readable in the dark.
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: placeholder ? 0.5 : 0.1,
    }),
  )
  mesh.scale.set(o.h * aspect * (o.flip ? -1 : 1), o.h, 1)
  mesh.castShadow = true
  mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: texture, alphaTest: 0.4 })
  group.add(mesh)

  if (o.contact !== false) {
    const w = o.h * aspect * 1.25
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.45),
      new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false }),
    )
    blob.rotation.x = -Math.PI / 2
    blob.position.y = 0.012
    group.add(blob)
  }
  parent.add(group)
  return group
}

/** A coin lying flat, centred on its position. */
export function coin(p: Parent, m: THREE.Material, x: number, y: number, z: number, r = 0.11) {
  return cyl(p, r, r, 0.022, m, x, y, z, 18)
}

/** A neat pile of coins, `n` high. */
export function coinStack(p: Parent, m: THREE.Material, x: number, y: number, z: number, n: number, r = 0.11) {
  const stack = cyl(p, r, r, 0.024 * n, m, x, y + 0.012 * n, z, 18)
  return stack
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
