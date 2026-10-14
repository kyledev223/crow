import * as THREE from 'three'
import { available } from 'virtual:crow-assets'

/**
 * Asset manifest: the crow cutouts the 3D scenes expect, all in
 * public/assets/crow/. Drop source images into assets-raw/ and run
 * `npm run assets` to produce them (see README).
 *
 * Any file that is missing is replaced by a dark silhouette of a figure in a
 * suit, labelled with the filename it is standing in for.
 */
export const CROW_DIR = '/assets/crow/'

export const CROW_FILES = {
  /** Standing, centre stage. Screens 1, 7 (fallback), 11, 12. */
  hero: 'crow-hero.png',
  /** Seated. Screens 2, 5, 6. */
  seated: 'crow-seated.png',
  /** Presenting on stage. Screen 3. */
  stage: 'crow-stage.png',
  /** Holding a phone. Screen 4. */
  phone: 'crow-phone.png',
  /** Raising a glass. Screen 8. */
  toast: 'crow-toast.png',
  /** At a laptop. Screen 9. */
  laptop: 'crow-laptop.png',
  /** Holding a coin. Screen 10. */
  coin: 'crow-coin.png',
} as const

/** Walk cycle filmed on solid green, keyed out in the shader. Screen 7. */
export const WALK_VIDEO = 'walk.mp4'

export type CrowKey = keyof typeof CROW_FILES

export interface CrowTexture {
  texture: THREE.Texture
  /** width / height */
  aspect: number
  placeholder: boolean
}

export const crows = {} as Record<CrowKey, CrowTexture>
export let walkVideo: HTMLVideoElement | null = null

/** A figure in a suit, in silhouette, wearing its filename. */
function placeholder(file: string): CrowTexture {
  const w = 512
  const h = 1024
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const c = canvas.getContext('2d')!
  const body = new Path2D(
    // head, neck, shoulders, jacket, legs, shoes
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
  // beak, so it still reads as the crow
  c.fillStyle = '#141a30'
  const beak = new Path2D('M338 138 L420 172 L336 190 Z')
  c.fill(beak)
  c.stroke(beak)
  // shirt, lapels, tie
  c.fillStyle = '#c9cfdd'
  c.fill(new Path2D('M216 290 L256 400 L296 290 L270 270 L242 270 Z'))
  c.fillStyle = '#2f7bff'
  c.fill(new Path2D('M246 300 L266 300 L272 420 L256 448 L240 420 Z'))
  c.lineWidth = 4
  c.stroke(new Path2D('M216 290 L250 470 M296 290 L262 470'))
  // eye
  c.fillStyle = '#edeef2'
  c.beginPath()
  c.arc(296, 148, 13, 0, Math.PI * 2)
  c.fill()
  // label
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

function loadImage(file: string): Promise<CrowTexture> {
  if (!available.includes(file)) return Promise.resolve(placeholder(file))
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      CROW_DIR + file,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        const img = texture.image as HTMLImageElement
        resolve({ texture, aspect: img.width / img.height, placeholder: false })
      },
      undefined,
      () => resolve(placeholder(file)),
    )
  })
}

function loadVideo(file: string): Promise<HTMLVideoElement | null> {
  if (!available.includes(file)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'
    const done = (ok: boolean) => {
      video.onloadeddata = video.onerror = null
      resolve(ok ? video : null)
    }
    video.onloadeddata = () => done(true)
    video.onerror = () => done(false)
    window.setTimeout(() => done(video.readyState >= 2), 4000)
    video.src = CROW_DIR + file
  })
}

/** Loads every cutout (or its placeholder). Call once, before building scenes. */
export async function loadAssets() {
  const keys = Object.keys(CROW_FILES) as CrowKey[]
  const [video, ...textures] = await Promise.all([loadVideo(WALK_VIDEO), ...keys.map((k) => loadImage(CROW_FILES[k]))])
  keys.forEach((k, i) => (crows[k] = textures[i]))
  walkVideo = video
}
