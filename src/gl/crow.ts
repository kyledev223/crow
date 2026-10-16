import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { fx } from '../fx-config'
import { shared } from './points'

/**
 * The crow: one rigged model (public/assets/crow/crow.glb, built by
 * `npm run crow`) drawn as a hologram, with all ten clips on one mixer.
 * There is a single crow; each screen borrows him (engine.ts reparents him
 * into the active scene) and the clips crossfade on the way.
 *
 * Hologram: his baked texture, brightened so it reads on black; slow
 * horizontal bands drifting up; a blue fresnel rim; legs that fade into the
 * floor glow; a flicker every few seconds; a top-to-bottom scan when he
 * materialises, and a dissolve when he leaves.
 */
export type ClipName =
  | 'idle'
  | 'sitting-idle'
  | 'cheering'
  | 'walking'
  | 'reaching'
  | 'looking-up'
  | 'toast'
  | 'typing'
  | 'looking-at-hand'
  | 'waving'

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
uniform float uGlitch;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
void main() {
  vUv = uv;
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vW = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  if (uGlitch > 0.0) {
    float band = floor(world.y * 9.0 + floor(uTime * 20.0) * 3.1);
    float tear = step(0.6, fract(sin(band * 12.9898) * 43758.5453));
    mvPosition.x += (fract(sin(band * 78.233) * 12345.678) - 0.5) * 0.5 * tear * uGlitch;
  }
  gl_Position = projectionMatrix * mvPosition;
  vN = normalize(transformedNormal);
  vV = -mvPosition.xyz;
}`

const FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uTime;
uniform float uBright;
uniform float uRim;
uniform vec3 uRimColor;
uniform float uBands;
uniform float uBandDepth;
uniform float uBandSpeed;
uniform float uFloorY;
uniform float uFloorFade;
uniform float uTopY;
uniform float uFlicker;
uniform float uMaterialize;
uniform float uDissolve;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  float y = vW.y;
  // Materialise: a scan line sweeps from the crown down to the soles.
  float span = uTopY - uFloorY + 0.25;
  float front = uTopY + 0.05 - uMaterialize * span;
  if (y < front) discard;
  if (uDissolve > 0.0 && hash(floor(vW.xy * 160.0) + floor(vW.z * 40.0)) < uDissolve) discard;

  vec3 base = texture2D(map, vUv).rgb;
  vec3 n = normalize(vN);
  vec3 v = normalize(vV);
  // abs(): some of the scan's normals face inward; treat both sides alike.
  float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
  // A tight rim: only the true silhouette glows, the suit keeps its colour.
  float fres = pow(1.0 - ndv, 4.5);

  // A soft light from the camera so his form reads, then lift.
  vec3 col = base * uBright * (0.62 + 0.5 * ndv);
  // Soft knee on the highlights so the white shirt stays a shirt, not a lamp.
  col /= 1.0 + max(col.r, max(col.g, col.b)) * 0.9;
  // Blue-black feathers keep a hint of blue.
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  col += uRimColor * 0.025 * (1.0 - smoothstep(0.0, 0.12, lum));

  // Fine horizontal bands drifting upward.
  float band = fract((y - uTime * uBandSpeed) * uBands);
  float bright = smoothstep(0.0, 0.22, band) * smoothstep(1.0, 0.6, band);
  col *= 1.0 - uBandDepth * (1.0 - bright);
  // A slower, brighter band that sweeps up every few seconds.
  float sweepY = mix(uFloorY - 0.3, uTopY + 0.3, fract(uTime * 0.11));
  col += uRimColor * 0.22 * exp(-pow((y - sweepY) * 8.0, 2.0));

  // Rim.
  col += uRimColor * fres * uRim;

  // Legs fade into the glow on the floor.
  float h = clamp((y - uFloorY) / uFloorFade, 0.0, 1.0);
  h = h * h * (3.0 - 2.0 * h);
  col = mix(uRimColor * (0.55 + 0.45 * bright), col, 0.25 + 0.75 * h);

  // Flicker: a quick dip with a little line noise.
  col *= 1.0 - uFlicker * (0.35 + 0.65 * hash(vec2(floor(y * 70.0), floor(uTime * 40.0))));

  // The scan front glows.
  col += uRimColor * 3.0 * exp(-(y - front) * 28.0) * step(0.001, 1.0 - uMaterialize);

  gl_FragColor = vec4(col * uOpacity, 1.0);
}`

export interface Crow {
  root: THREE.Group
  mesh: THREE.SkinnedMesh
  uniforms: Record<string, THREE.IUniform>
  bone(name: string): THREE.Bone
  play(name: ClipName, fade?: number): void
  current: ClipName | null
  /** Hangs something off a bone; returns a function that takes it off again. */
  attach(boneName: string, obj: THREE.Object3D, offset: THREE.Vector3, rotation?: THREE.Euler): () => void
  /** World position of a bone (Mixamo name without the prefix, e.g. "LeftHand"). */
  boneWorld(name: string, out: THREE.Vector3): THREE.Vector3
  update(dt: number, time: number): void
  /** World height of his crown (for the scan). */
  topY(): number
}

export async function loadCrow(url: string, reduced: boolean): Promise<Crow> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(url)

  const root = new THREE.Group()
  root.name = 'crow'
  root.add(gltf.scene)
  let mesh: THREE.SkinnedMesh | null = null
  gltf.scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh
  })
  if (!mesh) throw new Error('crow.glb has no skinned mesh')
  const skinned = mesh as THREE.SkinnedMesh
  const map = (skinned.material as THREE.MeshStandardMaterial).map!
  map.anisotropy = 4

  const uniforms: Record<string, THREE.IUniform> = {
    map: { value: map },
    uTime: shared.uTime,
    uBright: { value: fx.holo.brightness },
    uRim: { value: fx.holo.rim },
    uRimColor: { value: new THREE.Color(fx.palette.blue).multiplyScalar(1.1) },
    uBands: { value: fx.holo.bands },
    uBandDepth: { value: fx.holo.bandDepth },
    uBandSpeed: { value: reduced ? 0 : fx.holo.bandSpeed },
    uFloorY: { value: 0 },
    uFloorFade: { value: fx.holo.floorFade },
    uTopY: { value: 2 },
    uFlicker: { value: 0 },
    uMaterialize: { value: 1 },
    uDissolve: { value: 0 },
    uGlitch: { value: 0 },
    uOpacity: { value: 1 },
  }
  skinned.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms })
  // Animated far from his bind pose, the rest-pose bounds would cull him by mistake.
  skinned.frustumCulled = false

  const bones = new Map<string, THREE.Bone>()
  skinned.skeleton.bones.forEach((b) => bones.set(b.name.replace(/^mixamorig:?/, ''), b))
  const hips = bones.get('Hips')!
  const head = bones.get('Head')!

  // ---- clips ------------------------------------------------------------------
  const mixer = new THREE.AnimationMixer(gltf.scene)
  const clips = new Map<string, THREE.AnimationClip>()
  for (const clip of gltf.animations) clips.set(clip.name, prepareClip(clip, hips.position.clone(), clip.name !== 'sitting-idle'))
  const actions = new Map<string, THREE.AnimationAction>()
  let current: ClipName | null = null

  function play(name: ClipName, fade = 0.6) {
    if (current === name) return
    const clip = clips.get(name)
    if (!clip) return console.warn(`crow.glb has no clip "${name}"`)
    let next = actions.get(name)
    if (!next) {
      next = mixer.clipAction(clip)
      next.setLoop(THREE.LoopRepeat, Infinity)
      actions.set(name, next)
    }
    const prev = current ? actions.get(current) : null
    next.reset().setEffectiveWeight(1).play()
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, true)
    else actions.forEach((a) => a !== next && a.stop())
    current = name
  }

  // ---- flicker ---------------------------------------------------------------
  let nextFlicker = 2 + Math.random() * fx.holo.flickerEvery
  let flickerT = -1

  const tmp = new THREE.Vector3()
  return {
    root,
    mesh: skinned,
    uniforms,
    get current() {
      return current
    },
    bone: (name) => bones.get(name)!,
    boneWorld: (name, out) => bones.get(name)!.getWorldPosition(out),
    play,
    attach(boneName, obj, offset, rotation) {
      const b = bones.get(boneName)!
      b.updateWorldMatrix(true, false)
      const s = b.getWorldScale(tmp).x / root.getWorldScale(new THREE.Vector3()).x
      obj.scale.setScalar(1 / s)
      obj.position.copy(offset).multiplyScalar(1 / s)
      if (rotation) obj.rotation.copy(rotation)
      b.add(obj)
      return () => b.remove(obj)
    },
    update(dt, time) {
      mixer.update(dt)
      if (reduced) return
      // A flicker every few seconds: two quick dips.
      if (time > nextFlicker && flickerT < 0) flickerT = 0
      if (flickerT >= 0) {
        flickerT += dt
        const f = flickerT < 0.06 ? 1 : flickerT < 0.11 ? 0.15 : flickerT < 0.16 ? 0.8 : 0
        uniforms.uFlicker.value = f * 0.55
        if (flickerT > 0.18) {
          flickerT = -1
          uniforms.uFlicker.value = 0
          nextFlicker = time + fx.holo.flickerEvery * (0.5 + Math.random())
        }
      }
    },
    topY() {
      head.getWorldPosition(tmp)
      return tmp.y + 0.3 * root.scale.y
    },
  }
}

/**
 * Makes a Mixamo clip behave on the site:
 *  - in place: the hips keep their sway but lose any travel (a few clips walk
 *    off or start offset), so every clip stays centred on his spot;
 *  - seamless: the last half second of every track blends into its first
 *    frame, so LoopRepeat wraps without a pop.
 */
function prepareClip(clip: THREE.AnimationClip, restHips: THREE.Vector3, inPlace: boolean) {
  const hipsTrack = clip.tracks.find((t) => /Hips\.position$/.test(t.name))
  if (hipsTrack) {
    const rest = restHips.toArray()
    const up = rest.map(Math.abs).indexOf(Math.max(...rest.map(Math.abs)))
    const { times, values } = hipsTrack
    const count = times.length
    for (let axis = 0; axis < 3; axis++) {
      if (axis === up) continue
      const raw = Array.from({ length: count }, (_, i) => values[i * 3 + axis])
      const meanAll = raw.reduce((a, b) => a + b, 0) / count
      for (let i = 0; i < count; i++) {
        // Travel = the slow-moving average over ~1.2s; keep only the sway around it.
        let sum = 0
        let k = 0
        for (let j = 0; j < count; j++) {
          if (Math.abs(times[j] - times[i]) <= 0.6) {
            sum += raw[j]
            k++
          }
        }
        const travel = inPlace ? sum / k : meanAll
        values[i * 3 + axis] = raw[i] - travel + rest[axis]
      }
    }
  }

  const T = clip.duration
  const B = Math.min(0.5, T * 0.25)
  const qa = new THREE.Quaternion()
  const qb = new THREE.Quaternion()
  for (const track of clip.tracks) {
    const { times, values } = track
    const size = values.length / times.length
    const first = Array.from(values.slice(0, size))
    for (let i = 0; i < times.length; i++) {
      const t = times[i]
      if (t < T - B) continue
      let w = (t - (T - B)) / B
      w = w * w * (3 - 2 * w)
      if (size === 4) {
        qa.fromArray(values, i * 4)
        qb.fromArray(first)
        if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w)
        qa.slerp(qb, w).toArray(values, i * 4)
      } else {
        for (let c = 0; c < size; c++) values[i * size + c] += (first[c] - values[i * size + c]) * w
      }
    }
  }
  return clip
}
