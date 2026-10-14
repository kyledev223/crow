import * as THREE from 'three'
import { walkVideo } from '../assets'
import type { Stage } from './engine'
import { BLUE, INK, M, ball, box, canvasTexture, coin, coinStack, crow, cyl, glow, ground, haze, mat, panel, rig, seeded } from './kit'
import type { Ring } from './ring'

/**
 * The twelve scenes, in page order. Everything is blockout geometry with PBR
 * materials; the lighting and the pixel filter do the rest. Each builder
 * returns a Stage: a scene, a camera move, and an optional per-frame update.
 */
export interface SceneDeps {
  env: THREE.Texture
  ring: Ring
  openVideo(): void
  openMeme(index: number): void
}

const MONO = '"JetBrains Mono", monospace'
const ANTON = 'Anton, Impact, sans-serif'

/** Night skyline: dark towers with a scatter of lit windows. */
const cityTexture = () =>
  canvasTexture(768, 384, (c, w, h) => {
    const sky = c.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#04060f')
    sky.addColorStop(1, '#0d1a40')
    c.fillStyle = sky
    c.fillRect(0, 0, w, h)
    const r = seeded(11)
    for (let x = 0; x < w; ) {
      const bw = 24 + r() * 60
      const bh = 60 + r() * 250
      c.fillStyle = '#05070f'
      c.fillRect(x, h - bh, bw, bh)
      for (let wy = h - bh + 8; wy < h - 6; wy += 11) {
        for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
          if (r() < 0.3) {
            c.fillStyle = r() < 0.3 ? '#edeef2' : '#2f7bff'
            c.globalAlpha = 0.35 + r() * 0.65
            c.fillRect(wx, wy, 4, 6)
          }
        }
      }
      c.globalAlpha = 1
      x += bw + 2
    }
  })

// ---------------------------------------------------------------------------
// 01 THE CROW: centre stage, one spotlight, haze, gold on the floor
// ---------------------------------------------------------------------------
function hero({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [0, 7.5, 2.6], aim: [0, 0.9, 0], keyPower: 9, keyAngle: 0.4, rim: [-3, 3.6, -4.5], rimPower: 12, ambient: 0.25, fog: 0.05 })
  ground(s)
  box(s, 30, 12, 0.3, M.wall(), 0, 6, -8)
  crow(s, 'hero', { h: 2.15 })
  const beam = haze(s, [0, 7.5, 2.6], [0, 0, 0], 1.9, 0xdfe8ff, 0.11)

  const gold = M.gold()
  const r = seeded(7)
  for (let i = 0; i < 54; i++) {
    const a = r() * Math.PI * 2
    const d = 0.75 + r() * 3.4
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d * 0.8 + 0.3
    if (r() < 0.2) coinStack(s, gold, x, 0, z, 2 + Math.floor(r() * 7))
    else {
      const c = coin(s, gold, x, 0.012, z)
      // a few caught on edge, mid-roll
      if (r() < 0.12) {
        c.rotation.z = Math.PI / 2
        c.rotation.y = r() * 3
        c.position.y = 0.11
      } else c.rotation.z = (r() - 0.5) * 0.12
    }
  }
  return {
    scene: s,
    cam: { from: [0, 1.75, 7.4], to: [0, 1.6, 5.3], look: [0, 1.55, 0], fov: 38 },
    focus: [0, 1.1, 0],
    rise: -0.12,
    update: (t) => ((beam.material as THREE.ShaderMaterial).uniforms.uStrength.value = 0.11 + Math.sin(t * 1.7) * 0.012),
  }
}

// ---------------------------------------------------------------------------
// 02 WHY THE NAME: dim office, desk lamp, city in the window
// ---------------------------------------------------------------------------
function office({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [1.8, 4.6, 3.4], aim: [0, 0.9, 0], keyPower: 3, rim: [3.5, 3, -2.4], rimPower: 8, ambient: 0.3 })
  ground(s, mat(0x0c0d14, 0.6, 0.05))
  box(s, 16, 7, 0.2, M.wall(), 0, 3.5, -3.1)

  // window
  panel(s, 5.2, 2.7, glow(0xffffff, 1.1, cityTexture()), 0.9, 2.15, -2.98)
  const frame = mat(0x07080d, 0.6)
  for (const x of [-1.72, 0.03, 1.78, 3.52]) box(s, 0.07, 2.8, 0.08, frame, x, 2.15, -2.94)
  for (const y of [0.78, 2.15, 3.52]) box(s, 5.3, 0.07, 0.08, frame, 0.9, y, -2.94)

  // desk
  const wood = M.wood()
  box(s, 2.5, 0.07, 1.05, wood, 0, 0.76, 0.4)
  box(s, 2.4, 0.72, 0.05, wood, 0, 0.37, 0.88)
  for (const x of [-1.18, 1.18]) box(s, 0.06, 0.74, 1, wood, x, 0.37, 0.4)

  // chair and crow
  const leather = M.leather()
  box(s, 0.78, 1.25, 0.14, leather, 0, 0.95, -0.82)
  box(s, 0.78, 0.12, 0.7, leather, 0, 0.5, -0.5)
  crow(s, 'seated', { z: -0.36, h: 1.62, contact: false })

  // lamp
  const metal = M.metal()
  cyl(s, 0.1, 0.11, 0.03, metal, -0.82, 0.81, 0.55)
  cyl(s, 0.012, 0.012, 0.46, metal, -0.82, 1.04, 0.55)
  cyl(s, 0.05, 0.15, 0.16, metal, -0.82, 1.3, 0.55)
  const lamp = new THREE.PointLight(0xffc98a, 2.6, 4.5, 1.2)
  lamp.position.set(-0.8, 1.18, 0.6)
  s.add(lamp)
  haze(s, [-0.82, 1.3, 0.55], [-0.82, 0.8, 0.55], 0.42, 0xffe2b8, 0.3)

  // desk clutter: ledger, coins, nameplate
  box(s, 0.5, 0.03, 0.36, mat(INK, 0.9), 0.25, 0.81, 0.5).rotation.y = 0.2
  const gold = M.gold()
  coinStack(s, gold, 0.85, 0.795, 0.6, 6, 0.06)
  coinStack(s, gold, 0.98, 0.795, 0.52, 3, 0.06)
  box(s, 0.5, 0.1, 0.05, M.metal(), -0.1, 0.84, 0.85)

  return {
    scene: s,
    cam: { from: [1.7, 1.8, 5.4], to: [0.7, 1.42, 3.6], look: [0, 1.08, -0.2], fov: 38 },
    focus: [0, 1.1, 0],
    update: (t) => (lamp.intensity = 2.6 + Math.sin(t * 9) * 0.05),
  }
}

// ---------------------------------------------------------------------------
// 03 ON STAGE: keynote, big screen, a full house in silhouette
// ---------------------------------------------------------------------------
function stage({ env, openVideo }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [2, 8.5, 4.5], aim: [3.2, 1.4, -0.2], keyPower: 8, keyAngle: 0.36, rim: [3.5, 5, -5], rimPower: 10, ambient: 0.22, fog: 0.03 })
  ground(s, M.dark())
  box(s, 10, 0.5, 4.6, mat(0x0d0f18, 0.35, 0.3), 0, 0.25, -1)
  box(s, 22, 12, 0.3, M.wall(), 0, 6, -3.6)
  crow(s, 'stage', { x: 3.3, y: 0.5, z: -0.1, h: 2.05 })

  const slide = canvasTexture(1024, 576, (c, w, h) => {
    c.fillStyle = '#081230'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = '#2f7bff'
    c.lineWidth = 6
    c.strokeRect(14, 14, w - 28, h - 28)
    c.fillStyle = '#edeef2'
    c.font = `150px ${ANTON}`
    c.fillText('COUPON', 60, 220)
    c.fillText('CROWS', 60, 370)
    c.fillStyle = '#2f7bff'
    c.font = `500 30px ${MONO}`
    c.fillText('////// KEYNOTE · ONE SLIDE', 64, 440)
    c.fillStyle = '#edeef2'
    c.beginPath()
    c.arc(790, 290, 112, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#081230'
    c.beginPath()
    c.moveTo(755, 225)
    c.lineTo(860, 290)
    c.lineTo(755, 355)
    c.fill()
    c.fillStyle = '#edeef2'
    c.font = `500 26px ${MONO}`
    c.fillText('CLICK TO PLAY', 688, 460)
  })
  box(s, 6.1, 3.5, 0.12, M.dark(), 1, 2.95, -3.2)
  const screen = panel(s, 5.8, 3.26, glow(0xffffff, 1.25, slide), 1, 2.95, -3.12)
  const wash = new THREE.PointLight(BLUE, 2.2, 9, 1)
  wash.position.set(1, 3, -2.2)
  s.add(wash)

  haze(s, [5.5, 8.5, 2.5], [3.3, 0.5, -0.1], 1.4, 0xdfe8ff, 0.13)
  haze(s, [-4.5, 8.5, 2.5], [-2, 0.5, -1], 1.7, 0x9cc2ff, 0.08)

  // audience: heads and shoulders, a few rows deep
  const dark = mat(0x04050a, 0.85)
  const r = seeded(3)
  const seats: [number, number, number][] = []
  for (let row = 0; row < 5; row++) {
    for (let x = -5.6 + (row % 2) * 0.36; x <= 5.6; x += 0.74) seats.push([x + (r() - 0.5) * 0.12, 0.98 + row * 0.07 + r() * 0.08, 2.5 + row * 0.95])
  }
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 12, 9), dark, seats.length)
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.4, 3, 8), dark, seats.length)
  const m4 = new THREE.Matrix4()
  seats.forEach(([x, y, z], i) => {
    heads.setMatrixAt(i, m4.makeTranslation(x, y + 0.38, z))
    bodies.setMatrixAt(i, m4.makeScale(1.35, 1, 0.8).setPosition(x, y - 0.12, z))
  })
  s.add(heads, bodies)

  return {
    scene: s,
    cam: { from: [0, 1.95, 9.6], to: [0, 2.1, 7.1], look: [0, 2.15, -1], fov: 40 },
    focus: [2.7, 2.1, 0],
    clickables: [{ object: screen, onClick: openVideo }],
    update: (t) => (wash.intensity = 2.2 + Math.sin(t * 2.3) * 0.25),
  }
}

// ---------------------------------------------------------------------------
// 04 THE POST: the crow, his phone, and one very large post
// ---------------------------------------------------------------------------
function post({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [-2.5, 6, 4], aim: [-1, 1, 0], keyPower: 6, rim: [3, 4, -4], rimPower: 10, ambient: 0.28, fog: 0.045 })
  ground(s)
  box(s, 26, 10, 0.3, M.wall(), 0, 5, -6)
  crow(s, 'phone', { x: 0.15, h: 2.08 })

  const tex = canvasTexture(1000, 720, (c, w, h) => {
    c.fillStyle = '#0a0e1c'
    c.fillRect(0, 0, w, h)
    c.strokeStyle = 'rgba(237,238,242,.35)'
    c.lineWidth = 4
    c.strokeRect(2, 2, w - 4, h - 4)
    c.fillStyle = '#2f7bff'
    c.fillRect(0, 0, 70, 8)
    c.fillRect(0, 0, 8, 70)
    // avatar: a small crow head
    c.strokeStyle = '#2f7bff'
    c.lineWidth = 5
    c.beginPath()
    c.arc(104, 112, 52, 0, Math.PI * 2)
    c.stroke()
    c.fillStyle = '#12357f'
    c.beginPath()
    c.arc(98, 116, 26, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#2f7bff'
    c.beginPath()
    c.moveTo(116, 100)
    c.lineTo(146, 114)
    c.lineTo(118, 124)
    c.fill()
    c.fillStyle = '#edeef2'
    c.font = `500 40px ${MONO}`
    c.fillText('wire_sitter_09', 184, 104)
    c.globalAlpha = 0.6
    c.font = `26px ${MONO}`
    c.fillText('THE PERCH · EAST WIRE BOARD', 184, 148)
    c.globalAlpha = 1
    c.font = '600 62px "Instrument Sans", sans-serif'
    c.fillText('what do you call a bird', 56, 290)
    c.fillStyle = '#2f7bff'
    c.fillText('that comes back every', 56, 372)
    c.fillText('season for the same coin?', 56, 454)
    c.fillStyle = '#edeef2'
    c.fillText('asking for the flock', 56, 536)
    c.globalAlpha = 0.25
    c.fillRect(56, 596, w - 112, 3)
    c.globalAlpha = 0.7
    c.font = `28px ${MONO}`
    c.fillText('214 CAWS      61 ECHOES      9 SHINIES', 56, 660)
  })
  const card = new THREE.Group()
  card.position.set(2.45, 1.75, -0.1)
  card.rotation.y = -0.34
  box(card, 2.66, 1.94, 0.05, M.dark(), 0, 0, -0.03)
  panel(card, 2.6, 1.87, glow(0xffffff, 1.05, tex), 0, 0, 0)
  s.add(card)
  const spill = new THREE.PointLight(BLUE, 2.4, 6, 1)
  spill.position.set(0.5, 1.6, 1)
  s.add(spill)

  // motes drifting up past the card
  const r = seeded(5)
  const motes = Array.from({ length: 16 }, () => {
    const m = panel(s, 0.05, 0.05, glow(BLUE, 2.4), 0, 0, 0)
    m.userData = { x: 1.1 + r() * 2.8, z: -0.6 + r() * 1.4, speed: 0.12 + r() * 0.25, phase: r() * 4 }
    return m
  })

  return {
    scene: s,
    cam: { from: [0.2, 1.6, 6.6], to: [0.5, 1.55, 4.9], look: [0.5, 1.4, 0], fov: 38 },
    focus: [0.4, 1.4, 0],
    update(t) {
      card.position.y = 1.75 + Math.sin(t * 0.9) * 0.05
      card.rotation.z = Math.sin(t * 0.6) * 0.012
      for (const m of motes) {
        const u = m.userData
        m.position.set(u.x + Math.sin(t * 0.5 + u.phase) * 0.1, ((t * u.speed + u.phase) % 3.6) + 0.1, u.z)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// 05 THE INTERVIEW: two armchairs, one guest
// ---------------------------------------------------------------------------
function interview({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [2.2, 5.2, 3.8], aim: [-0.7, 0.9, 0], keyPower: 5.5, rim: [-3.2, 3.2, -2.6], rimPower: 9, ambient: 0.3 })
  ground(s, mat(0x0c0d14, 0.7))
  box(s, 18, 8, 0.3, M.wall(), 0, 4, -2.9)
  cyl(s, 2.5, 2.5, 0.015, mat(0x0c1838, 0.95), 0, 0.008, 0.2, 40)

  const leather = M.leather()
  const armchair = (x: number, turn: number) => {
    const g = new THREE.Group()
    g.position.set(x, 0, 0)
    g.rotation.y = turn
    box(g, 0.86, 0.32, 0.82, leather, 0, 0.34, 0)
    box(g, 0.86, 0.95, 0.18, leather, 0, 0.88, -0.38)
    for (const ax of [-0.46, 0.46]) box(g, 0.15, 0.56, 0.84, leather, ax, 0.5, 0)
    s.add(g)
  }
  armchair(-1.2, 0.42)
  armchair(1.2, -0.42)
  crow(s, 'seated', { x: -1.16, z: 0.14, h: 1.66, contact: false })

  // table, mic, two waters
  const wood = M.wood()
  cyl(s, 0.4, 0.4, 0.04, wood, 0, 0.6, 0.4)
  cyl(s, 0.04, 0.04, 0.58, wood, 0, 0.3, 0.4)
  cyl(s, 0.24, 0.26, 0.03, wood, 0, 0.015, 0.4)
  const metal = M.metal()
  cyl(s, 0.06, 0.07, 0.02, metal, -0.04, 0.63, 0.36)
  cyl(s, 0.012, 0.012, 0.2, metal, -0.04, 0.73, 0.36)
  ball(s, 0.048, M.dark(), -0.04, 0.85, 0.36)
  const glass = M.glass()
  cyl(s, 0.036, 0.03, 0.12, glass, 0.2, 0.68, 0.5)
  cyl(s, 0.036, 0.03, 0.12, glass, -0.24, 0.68, 0.55)

  // the fire in "fireside"
  box(s, 2, 1.5, 0.35, mat(0x161923, 0.9), 0, 0.75, -2.6)
  const fire = panel(s, 1.2, 0.8, glow(0xffd9a8, 1.2), 0, 0.55, -2.42)
  const ember = new THREE.PointLight(0xffb070, 2.2, 6, 1)
  ember.position.set(0, 0.7, -1.9)
  s.add(ember)

  return {
    scene: s,
    cam: { from: [0.5, 1.55, 5.9], to: [-0.2, 1.32, 4.1], look: [0, 0.98, 0], fov: 38 },
    focus: [-0.7, 1, 0],
    update(t) {
      const flicker = 0.8 + Math.sin(t * 11) * 0.1 + Math.sin(t * 17.3) * 0.08
      ember.intensity = 2.2 * flicker
      ;(fire.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2 * flicker
    },
  }
}

// ---------------------------------------------------------------------------
// 06 BROADCAST: news desk, wall of monitors, ON AIR
// ---------------------------------------------------------------------------
function broadcast({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [1.6, 5.4, 4.4], aim: [0, 1.3, -0.3], keyPower: 6, rim: [-3.8, 3.4, -1], rimPower: 9, ambient: 0.3 })
  ground(s, mat(0x080a12, 0.3, 0.3))
  box(s, 7.2, 3.3, 0.2, M.dark(), 0, 2.45, -2.3)

  const r = seeded(21)
  const screens = [
    (c: CanvasRenderingContext2D, w: number, h: number) => {
      c.strokeStyle = '#2f7bff'
      c.lineWidth = 5
      c.beginPath()
      for (let x = 0, y = h * 0.8; x <= w; x += 16) c.lineTo(x, (y -= 2 + (r() - 0.35) * 18))
      c.stroke()
    },
    (c: CanvasRenderingContext2D, w: number, h: number) => {
      c.fillStyle = '#edeef2'
      c.font = `120px ${ANTON}`
      c.textAlign = 'center'
      c.fillText('LIVE', w / 2, h / 2 + 44)
    },
    (c: CanvasRenderingContext2D, w: number, h: number) => {
      for (let i = 0; i < 12; i++) {
        c.fillStyle = i % 3 ? '#2f7bff' : '#edeef2'
        const bh = 20 + r() * (h - 60)
        c.fillRect(22 + i * 31, h - 20 - bh, 20, bh)
      }
    },
    (c: CanvasRenderingContext2D, w: number, h: number) => {
      c.fillStyle = '#edeef2'
      c.font = `70px ${ANTON}`
      c.textAlign = 'center'
      c.fillText('WIRE NEWS', w / 2, h / 2 + 6)
      c.fillStyle = '#2f7bff'
      c.font = `500 20px ${MONO}`
      c.fillText('////// ALL COINS, ALL THE TIME', w / 2, h / 2 + 48)
    },
    (c: CanvasRenderingContext2D, w: number, h: number) => {
      for (let i = 0; i < 260; i++) {
        c.fillStyle = r() < 0.2 ? '#edeef2' : '#12357f'
        c.fillRect(r() * w, r() * h, 6, 6)
      }
    },
    (c: CanvasRenderingContext2D, w: number, h: number) => {
      c.strokeStyle = '#edeef2'
      c.lineWidth = 6
      c.beginPath()
      c.arc(w / 2, h / 2, 62, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = '#2f7bff'
      c.font = `90px ${ANTON}`
      c.textAlign = 'center'
      c.fillText('C', w / 2, h / 2 + 34)
    },
  ]
  screens.forEach((draw, i) => {
    const tex = canvasTexture(400, 224, (c, w, h) => {
      c.fillStyle = '#060b1d'
      c.fillRect(0, 0, w, h)
      draw(c, w, h)
    })
    panel(s, 1.9, 1.06, glow(0xffffff, 0.95, tex), -2.1 + (i % 3) * 2.1, i < 3 ? 3.1 : 1.94, -2.18)
  })
  const wash = new THREE.PointLight(BLUE, 2.6, 8, 1)
  wash.position.set(0, 2.4, -1.4)
  s.add(wash)

  // desk with a scrolling ticker
  box(s, 4.6, 0.95, 1, mat(0x0a0d18, 0.3, 0.45), 0, 0.475, 0.3)
  box(s, 4.8, 0.06, 1.16, M.metal(), 0, 0.98, 0.3)
  panel(s, 4.6, 0.05, glow(BLUE, 1.8), 0, 0.3, 0.81)
  const ticker = canvasTexture(2048, 96, (c, w, h) => {
    c.fillStyle = '#edeef2'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#020308'
    c.font = `64px ${ANTON}`
    c.fillText('BREAKING: LOCAL CROW FINDS COIN  ///  GULLS DEMAND RECOUNT  ///  FOIL FUTURES STEADY  ///', 20, 72)
  })
  ticker.wrapS = THREE.RepeatWrapping
  ticker.repeat.x = 1
  panel(s, 4.4, 0.24, glow(0xffffff, 0.9, ticker), 0, 0.62, 0.812)
  crow(s, 'seated', { z: -0.38, h: 1.8, contact: false })
  cyl(s, 0.012, 0.012, 0.22, M.metal(), 0.5, 1.12, 0.45)
  ball(s, 0.045, M.dark(), 0.5, 1.24, 0.45)
  box(s, 0.4, 0.015, 0.28, mat(INK, 0.9), -0.6, 1.02, 0.5).rotation.y = -0.15

  // ON AIR
  const sign = canvasTexture(256, 96, (c, w, h) => {
    c.fillStyle = '#edeef2'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#020308'
    c.font = `70px ${ANTON}`
    c.textAlign = 'center'
    c.fillText('ON AIR', w / 2, 74)
  })
  box(s, 1.1, 0.42, 0.14, M.dark(), -2.9, 4.42, -2.2)
  const onAir = panel(s, 1, 0.36, glow(0xffffff, 1.6, sign), -2.9, 4.42, -2.12)

  haze(s, [-3, 7, 3], [-0.4, 1, 0], 1.3, 0xdfe8ff, 0.07)

  return {
    scene: s,
    cam: { from: [-1.5, 1.75, 6.3], to: [-1.3, 1.6, 4.7], look: [-1.3, 1.75, -0.6], fov: 40 },
    focus: [0, 1.7, 0],
    update(t, dt) {
      ticker.offset.x += dt * 0.07
      ;(onAir.material as THREE.MeshStandardMaterial).emissiveIntensity = t % 1.6 < 1.1 ? 1.7 : 0.25
    },
  }
}

// ---------------------------------------------------------------------------
// 07 THE CHART: a line that only goes up, and a crow out for a walk on it
// ---------------------------------------------------------------------------
function chart({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [-2, 10, 7], aim: [1, 2.6, 0], keyPower: 4.5, keyAngle: 0.6, rim: [5, 7, -5], rimPower: 9, ambient: 0.3, fog: 0.028 })
  ground(s, mat(0x05070e, 0.5, 0.2))
  const grid = new THREE.GridHelper(40, 40, 0x12357f, 0x0b1a44)
  grid.position.y = 0.01
  s.add(grid)

  const lines = canvasTexture(64, 512, (c, w, h) => {
    c.fillStyle = '#04060f'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#12357f'
    for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 2)
  })
  lines.wrapS = THREE.RepeatWrapping
  lines.repeat.x = 30
  panel(s, 40, 14, glow(0xffffff, 0.5, lines), 0, 7, -5)

  const r = seeded(42)
  const N = 15
  const pts: THREE.Vector3[] = []
  const up = glow(BLUE, 1.5)
  const down = glow(0x12357f, 1.2)
  for (let i = 0; i < N; i++) {
    const x = -6.6 + i * 0.94
    const y = 0.7 + i * 0.36 + (r() - 0.5) * 0.7
    pts.push(new THREE.Vector3(x, y + 0.55, 0))
    const rising = i === 0 || r() > 0.28
    const bodyH = 0.35 + r() * 0.7
    box(s, 0.3, bodyH, 0.3, rising ? up : down, x, y - bodyH / 2 + 0.25, -0.9, false)
    box(s, 0.04, bodyH + 0.6, 0.04, rising ? up : down, x, y - bodyH / 2 + 0.25, -0.9, false)
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25)
  const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.05, 8), glow(0x9cc2ff, 2.6))
  s.add(line)
  ball(s, 0.16, glow(INK, 2.4), pts[N - 1].x, pts[N - 1].y, 0)
  const tipLight = new THREE.PointLight(BLUE, 3, 7, 1)
  tipLight.position.copy(pts[N - 1])
  s.add(tipLight)

  // The walker: keyed video if public/assets/crow/walk.mp4 exists, otherwise the hero cutout slides along.
  let walker: THREE.Object3D
  if (walkVideo) {
    const video = new THREE.VideoTexture(walkVideo)
    video.colorSpace = THREE.SRGBColorSpace
    const h = 1.7
    const geo = new THREE.PlaneGeometry((h * walkVideo.videoWidth) / walkVideo.videoHeight, h)
    geo.translate(0, h / 2, 0)
    walker = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { map: { value: video } },
        transparent: true,
        side: THREE.DoubleSide,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        // Chroma key: how much greener than red or blue a pixel is decides how see-through it is.
        fragmentShader: `uniform sampler2D map; varying vec2 vUv;
          void main(){ vec4 c = texture2D(map, vUv); float spill = c.g - max(c.r, c.b);
            float a = 1.0 - smoothstep(0.04, 0.18, spill); if (a < 0.05) discard;
            c.g = min(c.g, max(c.r, c.b) + 0.02); gl_FragColor = vec4(c.rgb * 0.9, a); }`,
      }),
    )
    s.add(walker)
  } else {
    walker = crow(s, 'hero', { h: 1.7, contact: false })
  }

  const at = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  return {
    scene: s,
    cam: { from: [-1.6, 2.8, 11.5], to: [1.6, 3.9, 8.6], look: [0.9, 3.3, 0], fov: 42 },
    focus: [0.8, 3.3, 0],
    enter: () => void walkVideo?.play().catch(() => {}),
    leave: () => walkVideo?.pause(),
    update(t, _dt, p) {
      const u = THREE.MathUtils.clamp(0.12 + p * 0.56 + Math.sin(t * 0.35) * 0.012, 0, 1)
      curve.getPointAt(u, at)
      curve.getTangentAt(u, tangent)
      walker.position.set(at.x, at.y + 0.04 + (walkVideo ? 0 : Math.abs(Math.sin(t * 5)) * 0.045), 0.12)
      walker.rotation.z = walkVideo ? 0 : Math.atan2(tangent.y, tangent.x) * 0.25
      ;(line.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.4 + Math.sin(t * 3) * 0.3
    },
  }
}

// ---------------------------------------------------------------------------
// 08 CHEERS: a bar table, a round for the flock
// ---------------------------------------------------------------------------
function cheers({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [0.3, 4.6, 1.6], aim: [-0.1, 1, 0.1], keyPower: 7, keyAngle: 0.55, rim: [-3.2, 3.2, -2], rimPower: 9, ambient: 0.28 })
  ground(s, mat(0x0c0b10, 0.45, 0.1))
  box(s, 18, 8, 0.3, M.wall(), 0, 4, -3.2)

  // back bar: counter, lit shelves, a row of bottles
  const wood = M.wood()
  box(s, 7.5, 1.1, 0.6, wood, 0, 0.55, -2.5)
  panel(s, 6.6, 1.9, glow(BLUE, 0.55), 0, 2.25, -3.02)
  const r = seeded(9)
  for (const y of [1.55, 2.15, 2.75]) {
    box(s, 6.8, 0.05, 0.32, wood, 0, y, -2.86)
    for (let x = -3.1; x < 3.2; x += 0.22 + r() * 0.12) {
      const h = 0.22 + r() * 0.22
      const tint = r() < 0.3 ? 0x12357f : r() < 0.5 ? 0x8c93a6 : 0x05060b
      cyl(s, 0.04, 0.045, h, mat(tint, 0.15, 0.2), x, y + 0.025 + h / 2, -2.86, 10)
      cyl(s, 0.014, 0.02, 0.1, mat(tint, 0.15, 0.2), x, y + 0.075 + h, -2.86, 8)
    }
  }
  const neon = canvasTexture(512, 128, (c, w) => {
    c.fillStyle = '#edeef2'
    c.font = `100px ${ANTON}`
    c.textAlign = 'center'
    c.fillText('THE WIRE', w / 2, 104)
  })
  panel(s, 2.2, 0.55, new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffffff, emissiveMap: neon, emissiveIntensity: 1.5, transparent: true, alphaMap: neon }), -2.3, 3.5, -3)

  // the table
  cyl(s, 0.58, 0.58, 0.05, wood, 0.25, 1.08, 0.55, 32)
  cyl(s, 0.05, 0.05, 1.05, M.metal(), 0.25, 0.53, 0.55)
  cyl(s, 0.32, 0.34, 0.03, M.metal(), 0.25, 0.015, 0.55)
  const glass = M.glass()
  cyl(s, 0.045, 0.035, 0.14, glass, 0.1, 1.18, 0.7)
  cyl(s, 0.045, 0.035, 0.14, glass, 0.45, 1.18, 0.62)
  cyl(s, 0.045, 0.035, 0.14, glass, 0.32, 1.18, 0.35)
  const bottle = mat(0x0c1a3a, 0.12, 0.2)
  cyl(s, 0.042, 0.046, 0.26, bottle, 0.55, 1.24, 0.4, 12)
  cyl(s, 0.015, 0.02, 0.1, bottle, 0.55, 1.42, 0.4, 8)
  coinStack(s, M.gold(), 0.0, 1.105, 0.42, 4, 0.05)
  for (const x of [-1.4, 1.7]) {
    cyl(s, 0.2, 0.2, 0.06, M.leather(), x, 0.78, 0.2)
    cyl(s, 0.03, 0.03, 0.76, M.metal(), x, 0.38, 0.2)
  }
  crow(s, 'toast', { x: -0.4, z: -0.25, h: 2.08 })

  // pendant lamp
  cyl(s, 0.06, 0.3, 0.24, M.dark(), 0.25, 2.9, 0.55)
  cyl(s, 0.006, 0.006, 3, M.dark(), 0.25, 4.5, 0.55)
  const cone = haze(s, [0.25, 2.85, 0.55], [0.25, 1.05, 0.55], 0.85, 0xffe2b8, 0.26)
  const bulb = new THREE.PointLight(0xffd09a, 2.4, 5, 1)
  bulb.position.set(0.25, 2.6, 0.55)
  s.add(bulb)

  return {
    scene: s,
    cam: { from: [2.1, 1.6, 5.8], to: [1.6, 1.55, 4.3], look: [1.05, 1.4, 0], fov: 38 },
    focus: [-0.1, 1.35, 0],
    update: (t) => ((cone.material as THREE.ShaderMaterial).uniforms.uStrength.value = 0.25 + Math.sin(t * 1.3) * 0.02),
  }
}

// ---------------------------------------------------------------------------
// 09 ASK THE CROW: a laptop, and the questions coming off it
// ---------------------------------------------------------------------------
function ask({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [-2.2, 4.8, 3.6], aim: [0, 1, 0], keyPower: 4.5, rim: [3.2, 3.6, -3], rimPower: 9, ambient: 0.3 })
  ground(s, mat(0x0c0d14, 0.6))
  box(s, 16, 7, 0.2, M.wall(), 0, 3.5, -2.8)
  // shelves behind
  const wood = M.wood()
  const r = seeded(31)
  for (const y of [1.3, 2.0, 2.7]) {
    box(s, 3.4, 0.05, 0.3, wood, 2.4, y, -2.6)
    for (let x = 0.9; x < 3.9; x += 0.1 + r() * 0.1) box(s, 0.07, 0.3 + r() * 0.2, 0.22, mat(r() < 0.25 ? 0x12357f : 0x1b1f2c, 0.8), x, y + 0.2, -2.6)
  }

  box(s, 2.2, 0.06, 0.95, wood, 0, 0.76, 0.3)
  for (const [x, z] of [[-1.02, -0.1], [1.02, -0.1], [-1.02, 0.7], [1.02, 0.7]]) box(s, 0.06, 0.74, 0.06, wood, x, 0.37, z)
  crow(s, 'laptop', { z: -0.38, h: 1.7, contact: false })

  // laptop, seen from behind: the lid faces us, the screen lights the crow
  const metal = M.metal()
  box(s, 0.52, 0.02, 0.36, metal, 0.12, 0.8, 0.38)
  const lid = box(s, 0.52, 0.34, 0.016, metal, 0.12, 0.96, 0.53)
  lid.rotation.x = 0.28
  const logo = cyl(s, 0.05, 0.05, 0.004, glow(INK, 1.6), 0.12, 0.97, 0.545, 20)
  logo.rotation.x = Math.PI / 2 + 0.28
  const screenLight = new THREE.PointLight(0x9cc2ff, 2.2, 3.5, 1)
  screenLight.position.set(0.12, 1.02, 0.3)
  s.add(screenLight)
  cyl(s, 0.045, 0.04, 0.1, mat(INK, 0.6), -0.55, 0.84, 0.5)

  const QUESTIONS = ['WEN COIN?', 'IS IT SHINY?', 'WHY THE SUIT?', 'GULL OR NO GULL?', 'HOW MANY COINS?', 'WHO DREW YOU?', 'IS THIS ADVICE?', 'CAW?', 'WHERE IS THE NEST?']
  const bubbles = QUESTIONS.map((q, i) => {
    const tex = canvasTexture(512, 256, (c, w, h) => {
      const blue = i % 3 === 1
      c.fillStyle = blue ? '#2f7bff' : '#edeef2'
      c.beginPath()
      c.roundRect(8, 8, w - 16, h - 70, 46)
      c.fill()
      c.beginPath()
      c.moveTo(110, h - 66)
      c.lineTo(96, h - 8)
      c.lineTo(180, h - 66)
      c.fill()
      c.fillStyle = '#020308'
      c.font = `76px ${ANTON}`
      c.textAlign = 'center'
      c.fillText(q, w / 2, 124, w - 70)
    })
    const m = panel(s, 0.95, 0.475, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), 0, 0, 0)
    m.userData = { phase: i / QUESTIONS.length, side: ((i * 37) % 100) / 50 - 1 }
    return m
  })

  return {
    scene: s,
    cam: { from: [-1.9, 1.7, 5.4], to: [-1.3, 1.55, 3.9], look: [-0.95, 1.5, 0], fov: 40 },
    focus: [0, 1.45, 0],
    update(t, _dt, p) {
      screenLight.intensity = 2.2 + Math.sin(t * 7) * 0.12
      // More questions arrive the further you scroll.
      const live = 3 + Math.round(p * (bubbles.length - 3))
      bubbles.forEach((b, i) => {
        const life = (t * 0.11 + b.userData.phase) % 1
        const mat = b.material as THREE.MeshBasicMaterial
        mat.opacity = i < live ? Math.sin(life * Math.PI) ** 0.7 : 0
        b.position.set(0.12 + b.userData.side * (0.3 + life * 1.5), 1.25 + life * 2.4, 0.6 + life * 0.5)
        b.scale.setScalar(0.45 + life * 0.75)
      })
    },
  }
}

// ---------------------------------------------------------------------------
// 10 THE TOKEN: the vault. Scroll opens the door.
// ---------------------------------------------------------------------------
function token({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [3.2, 6.5, 5.5], aim: [1.4, 1.4, -0.2], keyPower: 5.5, rim: [-4.5, 4, 2.5], rimPower: 8, ambient: 0.26 })
  ground(s, mat(0x0a0c14, 0.35, 0.3))

  const CY = 1.95
  const R = 1.55
  const wallShape = new THREE.Shape()
  wallShape.moveTo(-9, 0)
  wallShape.lineTo(9, 0)
  wallShape.lineTo(9, 8)
  wallShape.lineTo(-9, 8)
  wallShape.closePath()
  wallShape.holes.push(new THREE.Path().absarc(0, CY, R, 0, Math.PI * 2, true))
  const steel = mat(0x242938, 0.5, 0.65)
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape, { depth: 0.6, bevelEnabled: false, curveSegments: 40 }), steel)
  wall.position.z = -1.1
  wall.castShadow = wall.receiveShadow = true
  s.add(wall)
  const frame = new THREE.Mesh(new THREE.TorusGeometry(R + 0.06, 0.13, 12, 48), M.metal())
  frame.position.set(0, CY, -0.48)
  s.add(frame)

  // door, hinged on the left
  const hinge = new THREE.Group()
  hinge.position.set(-R - 0.1, CY, -0.42)
  s.add(hinge)
  const doorMat = mat(0x596072, 0.34, 0.9)
  const disc = cyl(hinge, R - 0.02, R - 0.02, 0.3, doorMat, R + 0.1, 0, 0.1, 48)
  disc.rotation.x = Math.PI / 2
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 10, 32), M.metal())
  wheel.position.set(R + 0.1, 0, 0.32)
  hinge.add(wheel)
  for (let i = 0; i < 3; i++) box(hinge, 1.12, 0.07, 0.05, M.metal(), R + 0.1, 0, 0.32).rotation.z = (i * Math.PI) / 3
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    cyl(hinge, 0.07, 0.07, 0.08, M.metal(), R + 0.1 + Math.cos(a) * (R - 0.25), Math.sin(a) * (R - 0.25), 0.27, 10).rotation.x = Math.PI / 2
  }
  box(hinge, 0.22, 2.2, 0.22, M.metal(), 0, 0, 0)

  // inside: coins, to the ceiling
  box(s, 6, 0.3, 6, steel, 0, CY - R - 0.05, -4.1)
  box(s, 6, 6, 0.3, steel, 0, 3, -7)
  const gold = M.gold()
  const r = seeded(77)
  for (let x = -1.6; x <= 1.6; x += 0.26) {
    for (let z = -1.5; z >= -5.2; z -= 0.3) {
      const depth = (-z - 1.5) / 3.7
      coinStack(s, gold, x + (r() - 0.5) * 0.05, CY - R + 0.1, z, 6 + Math.floor(r() * 26 + depth * 30), 0.115)
    }
  }
  const inner = new THREE.PointLight(0xdfe8ff, 0, 9, 1)
  inner.position.set(0, 3.3, -2.6)
  const innerBlue = new THREE.PointLight(BLUE, 0, 8, 1)
  innerBlue.position.set(0, 1.4, -1.6)
  s.add(inner, innerBlue)

  crow(s, 'coin', { x: 2.15, z: -0.15, h: 2.05 })
  for (let i = 0; i < 14; i++) coin(s, gold, -0.6 + r() * 2.4, 0.012, 0.2 + r() * 1.6)

  const ease = (t: number) => t * t * (3 - 2 * t)
  return {
    scene: s,
    cam: { from: [-0.9, 1.75, 8.1], to: [-1.1, 1.85, 5.6], look: [-1.25, 1.85, -1], fov: 40 },
    focus: [0.5, 1.8, 0],
    update(_t, _dt, p) {
      const open = ease(THREE.MathUtils.clamp(p * 1.15, 0, 1))
      hinge.rotation.y = -open * 1.7
      wheel.rotation.z = open * 4
      inner.intensity = 0.2 + open * 4.5
      innerBlue.intensity = open * 2.5
    },
  }
}

// ---------------------------------------------------------------------------
// 11 THE MEMES: the ring, in 3D, around the crow
// ---------------------------------------------------------------------------
function memes({ env, ring, openMeme }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [0, 7.5, 3.2], aim: [0, 1.2, 0], keyPower: 7, keyAngle: 0.5, rim: [-3.2, 4, -4.5], rimPower: 11, ambient: 0.3, fog: 0.04 })
  ground(s)
  cyl(s, 0.75, 0.85, 0.75, mat(0x10131f, 0.4, 0.5), 0, 0.375, 0, 40)
  cyl(s, 0.77, 0.77, 0.03, glow(BLUE, 1.4), 0, 0.74, 0, 40)
  crow(s, 'hero', { y: 0.76, h: 1.8, contact: false })
  ring.group.position.y = 1.32
  s.add(ring.group)
  haze(s, [0, 7.5, 3.2], [0, 0.7, 0], 1.7, 0xdfe8ff, 0.07)

  return {
    scene: s,
    cam: { from: [0, 2.5, 6.9], to: [0, 2.05, 5.7], look: [0, 1.42, 0], fov: 40 },
    focus: [0, 1.4, 0],
    rise: 0.02,
    clickables: ring.faces.map((face, i) => ({ object: face, onClick: () => !ring.wasDrag && openMeme(i) })),
    update: (_t, dt) => ring.update(dt),
  }
}

// ---------------------------------------------------------------------------
// 12 JOIN THE FLOCK: rooftop, wires, everyone's here
// ---------------------------------------------------------------------------
function flock({ env }: SceneDeps): Stage {
  const s = new THREE.Scene()
  rig(s, { env, key: [4, 7, 5], aim: [2.4, 1.4, -1], keyPower: 5, rim: [-4, 6, -7], rimPower: 12, ambient: 0.3, fog: 0.03 })
  ground(s, mat(0x08090f, 0.7))
  box(s, 16, 0.5, 1.2, mat(0x151823, 0.8), 0, 0.25, -1)
  panel(s, 34, 9, glow(0xffffff, 0.9, cityTexture()), 0, 3.4, -11)
  ball(s, 1.25, glow(INK, 1.1), 5.2, 7.4, -10.5)
  crow(s, 'hero', { x: 2.7, y: 0.5, z: -1, h: 1.9 })

  const dark = mat(0x0a0c14, 0.55, 0.1)
  const bird = (x: number, y: number, z: number, flip: boolean, size: number) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.scale.setScalar(size)
    if (flip) g.rotation.y = Math.PI
    ball(g, 0.16, dark, 0, 0.14, 0).scale.set(1.35, 1, 1)
    ball(g, 0.1, dark, 0.19, 0.3, 0)
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 8), dark)
    beak.rotation.z = -Math.PI / 2
    beak.position.set(0.34, 0.29, 0)
    g.add(beak)
    box(g, 0.28, 0.03, 0.1, dark, -0.26, 0.08, 0).rotation.z = 0.35
    s.add(g)
    return g
  }

  const r = seeded(15)
  const birds: THREE.Group[] = []
  const wireMat = mat(0x05060b, 0.6)
  ;[
    [2.5, -2.4],
    [3.3, -3.1],
    [4.1, -3.8],
  ].forEach(([y, z], row) => {
    const sag = (x: number) => y - 0.32 + (x * x) / 260
    const pts = Array.from({ length: 21 }, (_, i) => new THREE.Vector3(-10 + i, sag(-10 + i), z))
    s.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.018, 6), wireMat))
    for (let x = -5.5 + row * 0.7; x < 6; x += 0.9 + r() * 1.5) birds.push(bird(x, sag(x), z, r() < 0.4, 0.85 + r() * 0.35))
  })
  for (const x of [-8, 8]) cyl(s, 0.09, 0.11, 6, wireMat, x, 3, -3.1)
  const gold = M.gold()
  for (let i = 0; i < 9; i++) coin(s, gold, -1.8 + r() * 4.5, 0.512, -1.2 + r() * 0.5)

  return {
    scene: s,
    cam: { from: [0, 2.3, 8.6], to: [0, 2.7, 6.6], look: [0, 3, -2.4], fov: 40 },
    focus: [2.3, 2.6, -2],
    // every so often one of them shuffles along the wire
    update(t) {
      birds.forEach((b, i) => (b.rotation.z = Math.max(0, Math.sin(t * 1.4 + i * 2.1) - 0.93) * 2.2))
    },
  }
}

export function buildStages(deps: SceneDeps): Stage[] {
  return [hero, office, stage, post, interview, broadcast, chart, cheers, ask, token, memes, flock].map((build) => build(deps))
}
