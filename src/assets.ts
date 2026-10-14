import * as THREE from 'three'
import { available, plates } from 'virtual:crow-assets'

/**
 * Asset manifest. Everything lives in public/assets/ and is produced from
 * assets-raw/ by `npm run assets` (see README).
 *
 *   public/assets/crow/   crow cutouts (one per pose) and the walk cycle
 *   public/assets/bg/     one backplate per screen plus its depth map
 *
 * Missing crow poses fall back to crow-hero.png; if that is missing too, a
 * dark silhouette labelled with the filename stands in. A missing backplate
 * becomes a dark labelled card.
 */
export const CROW_DIR = '/assets/crow/'
export const BG_DIR = '/assets/bg/'

export const CROW_FILES = {
  /** Standing, facing the camera. Used wherever no specific pose exists yet. */
  hero: 'crow-hero.png',
  /** Seated. Screens 02, 05, 06, 09. Until it exists, he stands beside the chair. */
  seated: 'crow-seated.png',
  /** Presenting on stage. Screen 03. */
  stage: 'crow-stage.png',
  /** Holding a phone. Screen 04. */
  phone: 'crow-phone.png',
  /** Raising a glass. Screen 08. */
  toast: 'crow-toast.png',
  /** At a laptop. Screen 09. */
  laptop: 'crow-laptop.png',
  /** Holding a coin. Screen 10. */
  coin: 'crow-coin.png',
} as const

export type CrowKey = keyof typeof CROW_FILES

export interface CrowTexture {
  texture: THREE.Texture
  /** width / height */
  aspect: number
  placeholder: boolean
}

export interface Plate {
  id: string
  texture: THREE.Texture
  depth: THREE.Texture
  /** width / height of the photo */
  aspect: number
  /** Depth at a point, 0 = far, 1 = near. u, v in 0–1 from the top-left. */
  sample(u: number, v: number): number
  placeholder: boolean
}

export interface WalkCycle {
  video: HTMLVideoElement
  /** True when the video carries its own alpha (WebM VP9); false = keyed in the shader. */
  alpha: boolean
  fps: number
  frames: number
  /** Frame to rest on when he stops. */
  stand: number
  aspect: number
  /** Where his soles are, as a fraction of the frame height from the top. */
  feet: number
}

/** Poses actually present on disk. */
export const hasPose = (key: CrowKey) => available.includes(CROW_FILES[key])

export const crows = {} as Record<CrowKey, CrowTexture>
export const plateMap = new Map<string, Plate>()
export let walk: WalkCycle | null = null

// ---------------------------------------------------------------------------
// Placeholders
// ---------------------------------------------------------------------------

/** A figure in a suit, in silhouette, wearing its filename. */
function silhouette(file: string): CrowTexture {
  const w = 512
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')!
  const body = new Path2D(
    'M256 60 C312 60 344 104 344 158 C344 204 322 240 292 256 L296 286 ' +
      'C372 300 430 330 444 400 L470 640 L418 650 L404 470 L396 700 L388 980 L424 1004 L424 1016 L286 1016 L272 720 L256 720 ' +
      'L240 720 L226 1016 L88 1016 L88 1004 L124 980 L116 700 L108 470 L94 650 L42 640 L68 400 ' +
      'C82 330 140 300 216 286 L220 256 C190 240 168 204 168 158 C168 104 200 60 256 60 Z',
  )
  c.fillStyle = '#141a30'
  c.fill(body)
  c.lineWidth = 8
  c.strokeStyle = '#2f7bff'
  c.stroke(body)
  c.fillStyle = '#edeef2'
  c.fillRect(96, 520, 320, 92)
  c.fillStyle = '#020308'
  c.textAlign = 'center'
  c.font = '500 22px "JetBrains Mono", monospace'
  c.fillText('PLACEHOLDER', 256, 554)
  c.font = '500 30px "JetBrains Mono", monospace'
  c.fillText(file, 256, 592, 300)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, aspect: w / h, placeholder: true }
}

function missingPlate(id: string): Plate {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 900
  const c = canvas.getContext('2d')!
  const g = c.createLinearGradient(0, 0, 0, 900)
  g.addColorStop(0, '#05070f')
  g.addColorStop(0.62, '#0d1430')
  g.addColorStop(0.63, '#141a2c')
  g.addColorStop(1, '#05070f')
  c.fillStyle = g
  c.fillRect(0, 0, 1600, 900)
  c.fillStyle = '#edeef2'
  c.font = '500 34px "JetBrains Mono", monospace'
  c.textAlign = 'center'
  c.fillText(`${id}.jpg missing: run "npm run assets"`, 800, 300)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const depth = new THREE.DataTexture(new Uint8Array([40, 40, 40, 255]), 1, 1)
  depth.needsUpdate = true
  // Flat wall, then a floor that comes toward the camera.
  return { id, texture, depth, aspect: 16 / 9, sample: (_u, v) => (v < 0.62 ? 0.15 : 0.15 + (v - 0.62) * 2), placeholder: true }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

const loader = new THREE.TextureLoader()
const loadTexture = (url: string) =>
  new Promise<THREE.Texture | null>((resolve) => loader.load(url, resolve, undefined, () => resolve(null)))

async function loadCrow(key: CrowKey): Promise<CrowTexture> {
  const file = CROW_FILES[key]
  // Missing poses borrow the hero cutout.
  const use = available.includes(file) ? file : available.includes(CROW_FILES.hero) ? CROW_FILES.hero : null
  if (!use) return silhouette(file)
  const texture = await loadTexture(CROW_DIR + use)
  if (!texture) return silhouette(file)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const img = texture.image as HTMLImageElement
  return { texture, aspect: img.width / img.height, placeholder: false }
}

async function loadPlate(id: string): Promise<Plate> {
  const photo = plates.find((f) => f === `${id}.jpg` || f === `${id}.png`)
  if (!photo) return missingPlate(id)
  const [texture, depth] = await Promise.all([loadTexture(BG_DIR + photo), loadTexture(`${BG_DIR}${id}-depth.png`)])
  if (!texture) return missingPlate(id)
  texture.colorSpace = THREE.SRGBColorSpace
  const img = texture.image as HTMLImageElement

  // Keep a CPU copy of the depth map so scenes can stand things on the floor.
  let data: Uint8ClampedArray | null = null
  let dw = 1
  let dh = 1
  if (depth) {
    const di = depth.image as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = dw = di.width
    canvas.height = dh = di.height
    const c = canvas.getContext('2d', { willReadFrequently: true })!
    c.drawImage(di, 0, 0)
    data = c.getImageData(0, 0, dw, dh).data
  }
  const flat = new THREE.DataTexture(new Uint8Array([40, 40, 40, 255]), 1, 1)
  flat.needsUpdate = true
  return {
    id,
    texture,
    depth: depth ?? flat,
    aspect: img.width / img.height,
    sample(u, v) {
      if (!data) return 0.15
      const x = Math.min(dw - 1, Math.max(0, Math.round(u * (dw - 1))))
      const y = Math.min(dh - 1, Math.max(0, Math.round(v * (dh - 1))))
      return data[(y * dw + x) * 4] / 255
    },
    placeholder: false,
  }
}

async function loadWalk(): Promise<WalkCycle | null> {
  const hasWebm = available.includes('walk.webm')
  const hasMp4 = available.includes('walk.mp4')
  if (!hasWebm && !hasMp4) return null
  const meta = available.includes('walk.json')
    ? await fetch(CROW_DIR + 'walk.json').then((r) => r.json()).catch(() => null)
    : null

  const video = document.createElement('video')
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  // In the page but invisible: browsers pause muted videos they think nobody can see.
  video.setAttribute('aria-hidden', 'true')
  video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1'
  document.body.append(video)
  // Safari plays VP9 but not its alpha channel, so it gets the green MP4 and the shader key.
  const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)
  const alpha = hasWebm && !safari && video.canPlayType('video/webm; codecs="vp9"') !== ''
  const src = alpha ? 'walk.webm' : hasMp4 ? 'walk.mp4' : 'walk.webm'

  const ok = await new Promise<boolean>((resolve) => {
    const done = (v: boolean) => {
      video.onloadeddata = video.onerror = null
      resolve(v)
    }
    video.onloadeddata = () => done(true)
    video.onerror = () => done(false)
    window.setTimeout(() => done(video.readyState >= 2), 6000)
    video.src = CROW_DIR + src
  })
  if (!ok) return null
  return {
    video,
    alpha,
    fps: meta?.fps ?? 24,
    frames: meta?.frames ?? Math.round(video.duration * 24),
    stand: meta?.stand ?? 0,
    aspect: video.videoWidth / video.videoHeight,
    feet: meta?.feet ?? 0.98,
  }
}

/** Loads every cutout, plate and the walk cycle (or their placeholders). Call once, before building scenes. */
export async function loadAssets() {
  const keys = Object.keys(CROW_FILES) as CrowKey[]
  const ids = Array.from({ length: 12 }, (_, i) => `bg-${String(i + 1).padStart(2, '0')}`)
  const [w, cuts, plateList] = await Promise.all([loadWalk(), Promise.all(keys.map(loadCrow)), Promise.all(ids.map(loadPlate))])
  keys.forEach((k, i) => (crows[k] = cuts[i]))
  plateList.forEach((p) => plateMap.set(p.id, p))
  walk = w
}
