import * as THREE from 'three'
import { crows, hasPose, plateMap, walk, type CrowKey } from '../assets'
import type { Stage } from './engine'
import {
  canvasTexture,
  dust,
  placeCrow,
  placeWalker,
  plateMesh,
  plateQuad,
  plateSpace,
  screenMaterial,
  seeded,
  type CrowLight,
  type CrowPlacement,
  type PlateLook,
  type PlateSpace,
} from './plate'
import type { Ring } from './ring'

/**
 * The twelve scenes, in page order. Each one is a photo backplate rebuilt in
 * 3D from its depth map (plate.ts), the crow composited onto its floor, dust
 * that catches the light, and live layers only where they add life.
 *
 * Positions are in photo coordinates: u across, v down, both 0–1. To move
 * the crow, change `feet` (where his soles touch the floor) and `height`
 * (fraction of the frame he fills).
 */
export interface SceneDeps {
  ring: Ring
  openVideo(): void
  openMeme(index: number): void
}

const MONO = '"JetBrains Mono", monospace'
const ANTON = 'Anton, Impact, sans-serif'

interface Base {
  scene: THREE.Scene
  space: PlateSpace
  plate: THREE.Mesh
  set(name: string, value: unknown): void
  tick(time: number): void
}

function base(id: string, near: number, far: number, look: PlateLook = {}, dustAmount = 0.55): Base {
  const space = plateSpace(plateMap.get(id)!, near, far)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#020308')
  const plate = plateMesh(space, look)
  scene.add(plate)
  const motes = dust(space, 650, dustAmount)
  scene.add(motes)
  const pu = (plate.material as THREE.ShaderMaterial).uniforms
  const du = (motes.material as THREE.ShaderMaterial).uniforms
  return {
    scene,
    space,
    plate,
    set: (name, value) => (pu[name].value = value),
    tick(t) {
      pu.uTime.value = t
      du.uTime.value = t
    },
  }
}

/**
 * The crow in his pose for this screen. If that pose's file doesn't exist
 * yet he stands in as crow-hero; for seated scenes that means standing
 * beside the chair (`standing`) instead of in it (`seated`).
 */
function addCrow(b: Base, pose: CrowKey, standing: CrowPlacement, light: CrowLight, seated?: CrowPlacement, shadow = true) {
  const real = pose === 'hero' || hasPose(pose)
  const key: CrowKey = real ? pose : 'hero'
  const where = real && seated ? seated : standing
  const c = placeCrow(b.space, key, where, light)
  b.scene.add(c.mesh)
  b.set('uFocusZ', c.z * 1.25)
  if (shadow) contactShadow(b, where, crows[key].aspect)
  return c
}

function contactShadow(b: Base, where: CrowPlacement, crowAspect: number, strength = 0.6, cast: [number, number] = [0, 0.012]) {
  const w = ((where.height * crowAspect) / b.space.plate.aspect) * 0.55
  b.set('uShadow', new THREE.Vector4(where.feet[0], where.feet[1] + 0.004, w, w * b.space.plate.aspect * 0.12))
  b.set('uShadowCast', new THREE.Vector3(cast[0], cast[1], 0.6))
  b.set('uShadowStrength', strength)
}

const crowTick = (mesh: THREE.Mesh, t: number) => ((mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t)

function stage(b: Base, focus: number): Stage {
  return { scene: b.scene, space: b.space, focus, plate: b.plate }
}

// ---------------------------------------------------------------------------
// 01 THE CROW: spotlit floor, coins
// ---------------------------------------------------------------------------
function hero(): Stage {
  const b = base('bg-01', 2.6, 28, { haze: ['#0d1834', 0.18] }, 0.75)
  const c = addCrow(b, 'hero', { feet: [0.5, 0.775], height: 0.46 }, {
    tint: '#cfd8ea', rim: '#5d8dff', rimFrom: [-1, 0.15], rimAmount: 1.3, feet: 0.4,
  })
  return { ...stage(b, 0.5), update: (t) => (b.tick(t), crowTick(c.mesh, t)) }
}

// ---------------------------------------------------------------------------
// 02 WHY THE NAME: the office
// ---------------------------------------------------------------------------
function office(): Stage {
  const b = base('bg-02', 2.2, 30, {
    haze: ['#0b1530', 0.12],
    lights: [{ at: [0.235, 0.4], radius: [0.07, 0.07], color: '#ffb070', amount: 0.35, kind: 'pulse' }],
  })
  const c = addCrow(
    b, 'seated',
    { feet: [0.69, 0.8], depthAt: [0.6, 0.55], height: 0.58 },
    { tint: '#d6c6b2', rim: '#ffb46a', rimFrom: [-1, 0.35], rimAmount: 1.2, feet: 0.2 },
    { feet: [0.5, 0.66], depthAt: [0.5, 0.52], height: 0.44 },
    false,
  )
  return { ...stage(b, 0.6), update: (t) => (b.tick(t), crowTick(c.mesh, t)) }
}

// ---------------------------------------------------------------------------
// 03 ON STAGE: the big screen plays the keynote
// ---------------------------------------------------------------------------
function onStage({ openVideo }: SceneDeps): Stage {
  const b = base('bg-03', 2.4, 34, { haze: ['#0d1a3c', 0.22] }, 0.8)
  const c = addCrow(b, 'stage', { feet: [0.7, 0.645], height: 0.4 }, {
    tint: '#bcc8e6', rim: '#4d86ff', rimFrom: [1, 0.4], rimAmount: 1.4, feet: 0.3,
  })
  const slide = canvasTexture(1280, 720, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#0a1430')
    g.addColorStop(1, '#040814')
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    x.strokeStyle = 'rgba(47,123,255,.6)'
    x.lineWidth = 4
    x.strokeRect(24, 24, w - 48, h - 48)
    x.fillStyle = '#edeef2'
    x.font = `170px ${ANTON}`
    x.fillText('COUPON', 90, 300)
    x.fillText('CROWS', 90, 470)
    x.fillStyle = '#8cb4ff'
    x.font = `500 34px ${MONO}`
    x.fillText('////// KEYNOTE · ONE SLIDE', 96, 550)
    x.fillStyle = '#edeef2'
    x.beginPath()
    x.arc(990, 360, 120, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = '#0a1430'
    x.beginPath()
    x.moveTo(950, 290)
    x.lineTo(1065, 360)
    x.lineTo(950, 430)
    x.fill()
    x.fillStyle = '#edeef2'
    x.font = `500 28px ${MONO}`
    x.fillText('CLICK TO PLAY', 888, 540)
  })
  const screen = plateQuad(b.space, [[0.19, 0.17], [0.81, 0.17], [0.81, 0.59], [0.19, 0.59]], screenMaterial(slide, 0.92))
  b.scene.add(screen)
  const mat = screen.material as THREE.MeshBasicMaterial
  return {
    ...stage(b, 0.6),
    clickables: [{ object: screen, onClick: openVideo }],
    update(t) {
      b.tick(t)
      crowTick(c.mesh, t)
      mat.opacity = 0.86 + Math.sin(t * 2.1) * 0.04 + (Math.random() < 0.02 ? -0.12 : 0)
    },
  }
}

// ---------------------------------------------------------------------------
// 04 THE POST: penthouse, night
// ---------------------------------------------------------------------------
function post(): Stage {
  const b = base('bg-04', 2.4, 34, { haze: ['#0b1736', 0.16] })
  const c = addCrow(b, 'phone', { feet: [0.63, 0.86], height: 0.66 }, {
    tint: '#bdc8e0', rim: '#ffb070', rimFrom: [1, 0.25], rimAmount: 1.0, feet: 0.35,
  })
  return { ...stage(b, 0.6), update: (t) => (b.tick(t), crowTick(c.mesh, t)) }
}

// ---------------------------------------------------------------------------
// 05 THE INTERVIEW: fireside, the fire flickers
// ---------------------------------------------------------------------------
function interview(): Stage {
  const b = base('bg-05', 2.2, 28, {
    haze: ['#1a1410', 0.1],
    lights: [{ at: [0.47, 0.46], radius: [0.15, 0.14], color: '#ffb060', amount: 0.55, kind: 'fire' }],
  })
  const c = addCrow(
    b, 'seated',
    { feet: [0.395, 0.865], height: 0.68 },
    { tint: '#dcc0a2', rim: '#ff9a50', rimFrom: [1, 0.1], rimAmount: 1.3, feet: 0.35 },
    { feet: [0.2, 0.8], depthAt: [0.2, 0.62], height: 0.44 },
  )
  ;(c.mesh.material as THREE.ShaderMaterial).uniforms.uFlicker.value = 1
  return { ...stage(b, 0.4), update: (t) => (b.tick(t), crowTick(c.mesh, t)) }
}

// ---------------------------------------------------------------------------
// 06 BROADCAST: monitors, ticker, ON AIR
// ---------------------------------------------------------------------------
function broadcast(): Stage {
  const b = base('bg-06', 2.3, 30, { haze: ['#0b1736', 0.14] })
  const c = addCrow(
    b, 'seated',
    { feet: [0.615, 0.66], depthAt: [0.55, 0.5], height: 0.4 },
    { tint: '#b6c4e4', rim: '#4d86ff', rimFrom: [1, 0.3], rimAmount: 1.4, feet: 0.2 },
    { feet: [0.5, 0.62], depthAt: [0.5, 0.5], height: 0.33 },
    false,
  )

  const r = seeded(21)
  const draw: ((x: CanvasRenderingContext2D, w: number, h: number) => void)[] = [
    (x, w, h) => {
      x.strokeStyle = '#2f7bff'
      x.lineWidth = 6
      x.beginPath()
      for (let px = 0, y = h * 0.8; px <= w; px += 18) x.lineTo(px, (y -= 2 + (r() - 0.35) * 20))
      x.stroke()
    },
    (x, w, h) => {
      x.fillStyle = '#edeef2'
      x.font = `130px ${ANTON}`
      x.textAlign = 'center'
      x.fillText('WIRE NEWS', w / 2, h / 2 + 40)
    },
    (x, _w, h) => {
      for (let i = 0; i < 14; i++) {
        x.fillStyle = i % 3 ? '#2f7bff' : '#8cb4ff'
        const bh = 30 + r() * (h - 80)
        x.fillRect(30 + i * 40, h - 30 - bh, 26, bh)
      }
    },
    (x, w, h) => {
      x.fillStyle = '#edeef2'
      x.font = `150px ${ANTON}`
      x.textAlign = 'center'
      x.fillText('LIVE', w / 2, h / 2 + 52)
    },
    (x, w, h) => {
      for (let i = 0; i < 420; i++) {
        x.fillStyle = r() < 0.2 ? '#edeef2' : '#1a46c8'
        x.fillRect(r() * w, r() * h, 7, 7)
      }
    },
    (x, w, h) => {
      x.strokeStyle = '#edeef2'
      x.lineWidth = 8
      x.beginPath()
      x.arc(w / 2, h / 2, 80, 0, Math.PI * 2)
      x.stroke()
      x.fillStyle = '#2f7bff'
      x.font = `120px ${ANTON}`
      x.textAlign = 'center'
      x.fillText('C', w / 2, h / 2 + 44)
    },
  ]
  const cols = [0.195, 0.372, 0.628, 0.805]
  const rows = [0.195, 0.312, 0.432]
  const monitors: THREE.MeshBasicMaterial[] = []
  draw.forEach((fn, i) => {
    const cx = i % 3
    const ry = Math.floor(i / 3)
    const tex = canvasTexture(600, 300, (x, w, h) => {
      x.fillStyle = '#050a1c'
      x.fillRect(0, 0, w, h)
      fn(x, w, h)
    })
    const g = 0.004
    const m = screenMaterial(tex, 0.82)
    monitors.push(m)
    b.scene.add(
      plateQuad(b.space, [[cols[cx] + g, rows[ry] + g], [cols[cx + 1] - g, rows[ry] + g], [cols[cx + 1] - g, rows[ry + 1] - g], [cols[cx] + g, rows[ry + 1] - g]], m),
    )
  })

  const sign = canvasTexture(1024, 160, (x, w) => {
    x.fillStyle = '#0a0f1e'
    x.fillRect(0, 0, w, 160)
    x.fillStyle = '#f5f6fa'
    x.font = `120px ${ANTON}`
    x.textAlign = 'center'
    x.fillText('ON AIR', w / 2, 128)
  })
  const onAir = screenMaterial(sign, 1)
  b.scene.add(plateQuad(b.space, [[0.3, 0.1], [0.7, 0.1], [0.7, 0.162], [0.3, 0.162]], onAir))

  const ticker = canvasTexture(2048, 96, (x) => {
    x.fillStyle = '#edeef2'
    x.fillRect(0, 0, 2048, 96)
    x.fillStyle = '#020308'
    x.font = `64px ${ANTON}`
    x.fillText('BREAKING: LOCAL CROW FINDS COIN  ///  GULLS DEMAND RECOUNT  ///  FOIL FUTURES STEADY  ///', 20, 72)
  })
  ticker.wrapS = THREE.RepeatWrapping
  b.scene.add(plateQuad(b.space, [[0.3, 0.655], [0.7, 0.655], [0.7, 0.692], [0.3, 0.692]], screenMaterial(ticker, 0.95)))

  return {
    ...stage(b, 0.55),
    update(t, dt) {
      b.tick(t)
      crowTick(c.mesh, t)
      ticker.offset.x += dt * 0.06
      onAir.color.setScalar(t % 1.8 < 1.25 ? 1 : 0.35)
      monitors.forEach((m, i) => (m.opacity = 0.78 + Math.sin(t * (1.3 + i * 0.4)) * 0.05))
    },
  }
}

// ---------------------------------------------------------------------------
// 07 THE CHART: he walks the floor, the room scrolls past, the chart is on the wall
// ---------------------------------------------------------------------------
function chart(): Stage {
  const b = base('bg-07', 2.4, 30, { scroll: true, haze: ['#0b1736', 0.05] }, 0.7)
  // The chart: three plate-widths of a rising line with candles, glowing blue.
  // Drawn bold: the whole band ends up only ~70 pixels tall before the pixel filter.
  const chartTex = canvasTexture(4096, 512, (x, w, h) => {
    const r = seeded(42)
    const n = 26
    const pts: [number, number][] = []
    // Climbs steadily across the whole walk, never quite reaching the top.
    let y = h * 0.84
    for (let i = 0; i < n; i++) {
      y -= h * (0.022 + (r() - 0.45) * 0.08)
      y = Math.max(h * 0.1, Math.min(h * 0.88, y))
      pts.push([((i + 0.5) / n) * w, y])
    }
    // grid
    x.fillStyle = 'rgba(47,123,255,.16)'
    for (let gy = 40; gy < h; gy += 96) x.fillRect(0, gy, w, 4)
    pts.forEach(([px, py], i) => {
      const up = i === 0 || py <= pts[i - 1][1]
      const body = 50 + r() * 90
      x.fillStyle = up ? 'rgba(47,123,255,.95)' : 'rgba(26,70,200,.75)'
      x.fillRect(px - 34, py + 26, 68, body)
      x.fillRect(px - 6, py + 6, 12, body + 50)
    })
    x.shadowColor = 'rgba(140,180,255,1)'
    x.shadowBlur = 40
    x.strokeStyle = 'rgba(220,232,255,1)'
    x.lineWidth = 22
    x.lineJoin = 'round'
    x.beginPath()
    pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)))
    x.stroke()
  })
  chartTex.wrapS = THREE.RepeatWrapping
  b.set('uOverlay', chartTex)
  b.set('uOverlayRect', new THREE.Vector4(0.12, 0.58, 1 / 3, 1))

  const where: CrowPlacement = { feet: [0.52, 0.93], height: 0.54 }
  const light: CrowLight = { tint: '#c4cde4', exposure: 0.95, rim: '#5d8dff', rimFrom: [0.2, 1], rimAmount: 0.9, feet: 0.3 }
  const walker = walk ? placeWalker(b.space, walk, where, light).mesh : placeCrow(b.space, 'hero', where, light).mesh
  b.scene.add(walker)
  contactShadow(b, where, walk ? walk.aspect * 0.55 : crows.hero.aspect, 0.55, [0, 0.01])

  // Scroll → how far the room has slid by. Walk speed follows scroll speed.
  const TRAVEL = 1.6 // plate widths over the whole screen
  const STRIDE = 0.5 // plate widths per second that look right at normal walking pace
  let lastP = 0
  let speed = 0
  let facing = 1
  const width = Math.abs(walker.scale.x)
  const video = walk?.video
  const standAt = walk ? walk.stand / walk.fps : 0
  const frame = walk ? 1 / walk.fps : 0

  return {
    ...stage(b, 0.5),
    enter() {
      lastP = -1
      if (!video) return
      video.pause()
      video.currentTime = standAt
    },
    leave: () => video?.pause(),
    update(t, dt, p) {
      b.tick(t)
      crowTick(walker, t)
      if (lastP < 0) lastP = p
      const dp = p - lastP
      lastP = p
      b.set('uScroll', p * TRAVEL)
      // Scrolling back: he turns round and walks the other way.
      if (Math.abs(dp) > 1e-5) facing = Math.sign(dp)
      walker.scale.x = width * facing
      const v = Math.abs(dp * TRAVEL) / Math.max(dt, 1e-3)
      speed += (v - speed) * Math.min(1, dt / 0.15)
      if (!video) return
      if (speed > 0.03) {
        video.playbackRate = Math.min(2.5, Math.max(0.5, speed / STRIDE))
        if (video.paused) void video.play().catch(() => {})
      } else if (!video.paused) {
        // Finish the stride (a little brisker), then hold the standing frame.
        video.playbackRate = 1.6
        const d = (video.currentTime - standAt + video.duration) % video.duration
        if (d < frame * 1.5) {
          video.pause()
          video.currentTime = standAt
        }
      } else if (Math.abs(video.currentTime - standAt) > frame) {
        // Stopped anywhere else (the browser paused it): rest on the standing frame.
        video.currentTime = standAt
      }
    },
  }
}

// ---------------------------------------------------------------------------
// 08 CHEERS: the bar
// ---------------------------------------------------------------------------
function cheers(): Stage {
  const b = base('bg-08', 2.0, 28, {
    haze: ['#1a1410', 0.1],
    lights: [{ at: [0.84, 0.07], radius: [0.1, 0.08], color: '#ffc080', amount: 0.25, kind: 'pulse' }],
  })
  const c = addCrow(b, 'toast', { feet: [0.6, 0.88], height: 0.7 }, {
    tint: '#d8bea2', rim: '#ffb26a', rimFrom: [1, 0.5], rimAmount: 1.2, feet: 0.35,
  })
  return { ...stage(b, 0.6), update: (t) => (b.tick(t), crowTick(c.mesh, t)) }
}

// ---------------------------------------------------------------------------
// 09 ASK THE CROW: laptop glow, questions float up
// ---------------------------------------------------------------------------
function ask(): Stage {
  const b = base('bg-09', 2.2, 30, {
    haze: ['#0b1736', 0.12],
    lights: [{ at: [0.57, 0.46], radius: [0.07, 0.07], color: '#8cb4ff', amount: 0.5, kind: 'screen' }],
  })
  const c = addCrow(
    b, 'laptop',
    { feet: [0.385, 0.76], depthAt: [0.47, 0.56], height: 0.5 },
    { tint: '#b0bee0', rim: '#7aa6ff', rimFrom: [1, 0.2], rimAmount: 1.4, feet: 0.2 },
    { feet: [0.5, 0.7], depthAt: [0.5, 0.56], height: 0.38 },
    false,
  )
  const QUESTIONS = ['WEN COIN?', 'IS IT SHINY?', 'WHY THE SUIT?', 'GULL OR NO GULL?', 'HOW MANY COINS?', 'WHO DREW YOU?', 'IS THIS ADVICE?', 'CAW?', 'WHERE IS THE NEST?']
  const origin = b.space.at(0.57, 0.42)
  const unit = b.space.span(0.1, -origin.z)
  const bubbles = QUESTIONS.map((q, i) => {
    const tex = canvasTexture(512, 256, (x, w, h) => {
      x.fillStyle = i % 3 === 1 ? '#2f7bff' : '#edeef2'
      x.beginPath()
      x.roundRect(8, 8, w - 16, h - 70, 46)
      x.fill()
      x.beginPath()
      x.moveTo(110, h - 66)
      x.lineTo(96, h - 8)
      x.lineTo(180, h - 66)
      x.fill()
      x.fillStyle = '#020308'
      x.font = `76px ${ANTON}`
      x.textAlign = 'center'
      x.fillText(q, w / 2, 124, w - 70)
    })
    const m = new THREE.Mesh(new THREE.PlaneGeometry(unit * 1.6, unit * 0.8), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))
    m.renderOrder = 4
    m.userData = { phase: i / QUESTIONS.length, side: ((i * 37) % 100) / 50 - 1 }
    b.scene.add(m)
    return m
  })
  return {
    ...stage(b, 0.5),
    update(t, _dt, p) {
      b.tick(t)
      crowTick(c.mesh, t)
      const live = 3 + Math.round(p * (bubbles.length - 3))
      bubbles.forEach((m, i) => {
        const life = (t * 0.1 + m.userData.phase) % 1
        ;(m.material as THREE.MeshBasicMaterial).opacity = i < live ? Math.sin(life * Math.PI) ** 0.7 : 0
        m.position.set(origin.x + m.userData.side * unit * (0.6 + life * 3), origin.y + unit * (0.3 + life * 4.2), origin.z + unit * life * 2)
        m.scale.setScalar(0.5 + life * 0.7)
      })
    },
  }
}

// ---------------------------------------------------------------------------
// 10 THE TOKEN: the vault door swings further open as you scroll
// ---------------------------------------------------------------------------
function token(): Stage {
  const DOOR: [number, number, number, number] = [0.755, 0.0, 1.0, 0.745]
  const b = base('bg-10', 2.2, 30, { haze: ['#14100a', 0.1], hole: { rect: DOOR, color: '#0a0d16' } })
  const c = addCrow(b, 'coin', { feet: [0.57, 0.86], height: 0.66 }, {
    tint: '#dcc6a2', rim: '#ffc46a', rimFrom: [1, 0.15], rimAmount: 1.3, feet: 0.35,
  })

  // The door: the photo's own door, cut out onto a panel hinged at its left edge.
  const [u0, v0, u1, v1] = DOOR
  const z = b.space.z(0.8, 0.4) * 0.97
  const tl = b.space.at(u0, v0, z)
  const br = b.space.at(u1, v1, z)
  const tex = b.space.plate.texture.clone()
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set(u1 - u0, v1 - v0)
  tex.offset.set(u0, 1 - v1)
  tex.needsUpdate = true
  const width = br.x - tl.x
  const height = tl.y - br.y
  const geo = new THREE.PlaneGeometry(width, height)
  geo.translate(width / 2, -height / 2, 0)
  const door = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
  const hinge = new THREE.Group()
  hinge.position.copy(tl)
  hinge.add(door)
  b.scene.add(hinge)

  const ease = (x: number) => x * x * (3 - 2 * x)
  return {
    ...stage(b, 0.6),
    update(t, _dt, p) {
      b.tick(t)
      crowTick(c.mesh, t)
      hinge.rotation.y = -ease(Math.min(1, p * 1.1)) * 0.22
    },
  }
}

// ---------------------------------------------------------------------------
// 11 THE MEMES: the ring around the crow on the plinth
// ---------------------------------------------------------------------------
function memes({ ring, openMeme }: SceneDeps): Stage {
  const b = base('bg-11', 2.6, 30, { haze: ['#0d1834', 0.18] }, 0.8)
  const c = addCrow(b, 'hero', { feet: [0.5, 0.62], height: 0.46 }, {
    tint: '#c6d0ea', rim: '#6c98ff', rimFrom: [0.15, 1], rimAmount: 1.3, feet: 0.3,
  })
  // Frames about a quarter of his height wide, circling at knee height, tipped
  // toward the camera so he stands clear above the ones in front.
  const k = (c.height * 0.24) / 0.92
  ring.group.scale.setScalar(k)
  ring.group.position.copy(c.mesh.position).add(new THREE.Vector3(0, c.height * 0.2, 0))
  ring.group.rotation.x = 0.2
  b.scene.add(ring.group)
  return {
    ...stage(b, 0.5),
    clickables: ring.faces.map((face, i) => ({ object: face, onClick: () => !ring.wasDrag && openMeme(i) })),
    update(t, dt) {
      b.tick(t)
      crowTick(c.mesh, t)
      ring.update(dt)
    },
  }
}

// ---------------------------------------------------------------------------
// 12 JOIN THE FLOCK: rooftop, crows on the wires
// ---------------------------------------------------------------------------
function flock(): Stage {
  const b = base('bg-12', 2.2, 34, { haze: ['#0b1736', 0.12] })
  const c = addCrow(b, 'hero', { feet: [0.64, 0.88], height: 0.62 }, {
    tint: '#aebbdc', rim: '#d6e4ff', rimFrom: [0.5, 1], rimAmount: 1.2, feet: 0.35,
  })
  const bird = canvasTexture(128, 96, (x) => {
    x.fillStyle = '#04050a'
    x.beginPath()
    x.ellipse(58, 58, 30, 20, -0.35, 0, Math.PI * 2)
    x.fill()
    x.beginPath()
    x.arc(84, 34, 14, 0, Math.PI * 2)
    x.fill()
    x.beginPath()
    x.moveTo(94, 30)
    x.lineTo(122, 38)
    x.lineTo(94, 42)
    x.fill()
    x.beginPath()
    x.moveTo(36, 66)
    x.lineTo(2, 84)
    x.lineTo(12, 92)
    x.lineTo(44, 74)
    x.fill()
    x.fillRect(52, 74, 3, 16)
    x.fillRect(64, 74, 3, 16)
  })
  // Points along the two wires in the photo.
  const perches: [number, number][] = [
    [0.12, 0.155], [0.2, 0.18], [0.33, 0.205], [0.41, 0.215], [0.55, 0.222], [0.6, 0.218],
    [0.74, 0.2], [0.82, 0.18], [0.18, 0.262], [0.47, 0.272], [0.66, 0.255], [0.86, 0.205],
  ]
  const z = b.space.far * 0.3
  const size = b.space.span(0.045, z)
  const birds = perches.map(([u, v], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.33, size), new THREE.MeshBasicMaterial({ map: bird, transparent: true, depthWrite: false }))
    const p = b.space.at(u, v, z)
    m.position.set(p.x, p.y + size * 0.42, p.z)
    if (i % 3 === 1) m.scale.x = -1
    b.scene.add(m)
    return m
  })
  return {
    ...stage(b, 0.6),
    update(t) {
      b.tick(t)
      crowTick(c.mesh, t)
      birds.forEach((m, i) => (m.rotation.z = Math.max(0, Math.sin(t * 1.3 + i * 2.1) - 0.94) * 2.5))
    },
  }
}

export function buildStages(deps: SceneDeps): Stage[] {
  return [hero(), office(), onStage(deps), post(), interview(), broadcast(), chart(), cheers(), ask(), token(), memes(deps), flock()]
}
