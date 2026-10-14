import * as THREE from 'three'
import type { Meme } from '../memes'
import { canvasTexture } from './plate'

const AUTO_SPEED = -4.5 // deg per second while idle
const DRAG_SENS = 0.28 // deg per px
const IDLE_MS = 3500
const CLICK_SLOP = 6
/** A flick coasts for (release speed × this), capped at MAX_FLICK. */
const COAST_MS = 300
const MAX_FLICK = 120 // deg: a third of a turn
/** Ease-out time constants (ms) for settling after a flick and for key turns. */
const SETTLE_FLICK = 330
const SETTLE_STEP = 170
const RAD = Math.PI / 180

const FRAME_W = 0.92
const FRAME_H = FRAME_W * 1.25

/**
 * The meme ring, in 3D. Same feel as before it moved into WebGL: drag with
 * inertia capped at a third of a turn, settles on the nearest frame, slow
 * auto-rotate when idle, arrow keys step one frame.
 *
 * Input is fed in from outside (pointer events and keys only reach it while
 * the memes screen is active).
 */
export function createRing(memes: Meme[], reduced: boolean) {
  const n = memes.length
  const step = 360 / n
  const radius = FRAME_W / 2 / Math.tan(Math.PI / n) + FRAME_W * 0.16

  const group = new THREE.Group()
  const spinner = new THREE.Group()
  group.add(spinner)

  const backTexture = canvasTexture(200, 250, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w * 0.6, h)
    g.addColorStop(0, '#0d1a40')
    g.addColorStop(1, '#04060f')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    c.strokeStyle = 'rgba(237,238,242,.3)'
    c.lineWidth = 3
    c.strokeRect(1.5, 1.5, w - 3, h - 3)
    c.fillStyle = '#2f7bff'
    c.font = '500 20px "JetBrains Mono", monospace'
    c.textAlign = 'center'
    c.fillText('//////', w / 2, h / 2 + 6)
  })
  const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture, roughness: 0.9, emissive: 0xffffff, emissiveMap: backTexture, emissiveIntensity: 0.12 })

  const loader = new THREE.TextureLoader()
  const faces = memes.map((m, i) => {
    const texture = m.canvas ? new THREE.CanvasTexture(m.canvas) : loader.load(m.src!)
    texture.colorSpace = THREE.SRGBColorSpace
    const holder = new THREE.Group()
    holder.rotation.y = i * step * RAD
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(FRAME_W, FRAME_H),
      // Mostly self-lit so the memes stay readable whatever the scene lighting does.
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.55 }),
    )
    face.position.z = radius
    face.castShadow = true
    face.userData.index = i
    const back = new THREE.Mesh(new THREE.PlaneGeometry(FRAME_W, FRAME_H), backMaterial)
    back.position.z = radius - 0.004
    back.rotation.y = Math.PI
    holder.add(face, back)
    spinner.add(holder)
    return face
  })

  // ---- rotation state (degrees) ---------------------------------------------
  let rot = 0
  let vel = 0 // deg per ms
  let target: number | null = null
  let settle = SETTLE_STEP
  let dragging = false
  let moved = 0
  let lastX = 0
  let lastT = 0
  let idleAt = 0
  let paused = false

  const snap = (angle: number) => Math.round(angle / step) * step
  const turnTo = (angle: number, timeConstant: number) => {
    target = angle
    settle = timeConstant
    vel = 0
  }

  return {
    group,
    faces,
    count: n,
    /** Index of the frame currently facing the viewer. */
    get front() {
      return ((Math.round(-(target ?? rot) / step) % n) + n) % n
    },
    /** True if the last press turned into a drag (so it must not count as a click). */
    get wasDrag() {
      return moved > CLICK_SLOP
    },
    /** Stops the idle spin, e.g. while the lightbox is open or the ring has keyboard focus. */
    set paused(v: boolean) {
      paused = v
      if (!v) idleAt = performance.now() + IDLE_MS
    },

    update(dtSeconds: number) {
      const dt = Math.min(dtSeconds * 1000, 250)
      const now = performance.now()
      if (!dragging) {
        if (target !== null) {
          rot += (target - rot) * (1 - Math.exp(-dt / settle))
          if (Math.abs(target - rot) < 0.2) {
            rot = target
            target = null
            idleAt = now + IDLE_MS
          }
        } else if (!reduced && !paused && now > idleAt) {
          rot += (AUTO_SPEED * dt) / 1000
        }
      }
      spinner.rotation.y = rot * RAD
      // Frames dim as they turn away, on top of what the lighting already does.
      faces.forEach((f, i) => {
        const facing = Math.cos((i * step + rot) * RAD)
        ;(f.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25 + 0.85 * Math.max(0, facing) ** 1.5
      })
    },

    down(x: number, t: number) {
      dragging = true
      moved = 0
      vel = 0
      target = null
      lastX = x
      lastT = t
    },
    move(x: number, t: number) {
      if (!dragging) return
      const dx = x - lastX
      const dt = Math.max(1, t - lastT)
      lastX = x
      lastT = t
      moved += Math.abs(dx)
      rot += dx * DRAG_SENS
      vel = vel * 0.6 + ((dx * DRAG_SENS) / dt) * 0.4
    },
    up(t: number) {
      if (!dragging) return
      dragging = false
      if (t - lastT > 80) vel = 0
      // Heavy flywheel: coast a capped distance, ease out, land on a frame.
      const coast = Math.max(-MAX_FLICK, Math.min(MAX_FLICK, vel * COAST_MS))
      turnTo(snap(rot + coast), SETTLE_FLICK)
    },
    /** Turn by whole frames: +1 brings the next frame to the front. */
    stepBy(dir: number) {
      turnTo(snap(target ?? rot) - dir * step, SETTLE_STEP)
    },
    /** Bring frame `i` to the front by the shortest way round. */
    face(i: number) {
      const want = -i * step
      turnTo(want + Math.round((rot - want) / 360) * 360, SETTLE_STEP)
    },
    /** Current rotation in degrees (for tests and debugging). */
    get rotation() {
      return rot
    },
  }
}

export type Ring = ReturnType<typeof createRing>
