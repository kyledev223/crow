import { memes, type Meme } from './memes'
import { mountCrow } from './crow'

const AUTO_SPEED = -4.5 // deg per second while idle
const DRAG_SENS = 0.28 // deg per px
const IDLE_MS = 3500
const CLICK_SLOP = 6
/** A flick coasts for (release speed x this), capped at MAX_FLICK. */
const COAST_MS = 300
const MAX_FLICK = 120 // deg: a third of a turn
/** Ease-out time constants (ms) for settling after a flick and for key/focus turns. */
const SETTLE_FLICK = 330
const SETTLE_STEP = 170
const RAD = Math.PI / 180

const faceMarkup = (m: Meme) =>
  m.svg ?? `<img src="${m.src}" alt="${m.alt.replace(/"/g, '&quot;')}" draggable="false" loading="lazy" />`

export function initCarousel(opts: { reduced: boolean; lockScroll: (locked: boolean) => void }) {
  const scene = document.getElementById('scene')!
  const ring = document.getElementById('ring')!
  const n = memes.length
  const step = 360 / n

  mountCrow(document.getElementById('ringCrow')!, 'r', opts.reduced)

  const frames = memes.map((m, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'frame'
    b.setAttribute('aria-label', `Open meme ${i + 1} of ${n}: ${m.alt}`)
    b.innerHTML = `<span class="frame__face">${faceMarkup(m)}</span><span class="frame__back" aria-hidden="true"><span class="frame__back-sharp">//////</span><span class="frame__back-soft"></span></span>`
    ring.append(b)
    return b
  })

  const layout = () => {
    const w = frames[0].offsetWidth
    const radius = Math.round(w / 2 / Math.tan(Math.PI / n) + w * 0.16)
    frames.forEach((f, i) => (f.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`))
  }
  layout()
  window.addEventListener('resize', layout)

  // ---- rotation state -------------------------------------------------
  let rot = 0
  let vel = 0 // deg per ms
  let target: number | null = null
  let settle = SETTLE_STEP
  let shadedAt = NaN

  const snap = (angle: number) => Math.round(angle / step) * step
  const turnTo = (angle: number, timeConstant: number) => {
    target = angle
    settle = timeConstant
    vel = 0
  }

  // Frames facing the viewer stay at full brightness; the further round the
  // back a frame is, the darker it gets, and the far side goes soft. Only
  // opacities change here (see the note in style.css).
  const shade = () => {
    if (Math.abs(rot - shadedAt) < 0.15) return
    shadedAt = rot
    frames.forEach((f, i) => {
      const facing = Math.cos((i * step + rot) * RAD) // 1 = dead front, -1 = dead back
      const dim = Math.min(0.62, Math.max(0, (0.55 - facing) / 1.2))
      const soft = Math.min(1, Math.max(0, (-0.1 - facing) / 0.4))
      f.style.setProperty('--shade', dim.toFixed(3))
      f.style.setProperty('--sharp', ((1 - soft) * (1 - dim)).toFixed(3))
      f.style.setProperty('--soft', (soft * (1 - dim)).toFixed(3))
    })
  }
  let dragging = false
  let moved = 0
  let lastX = 0
  let lastT = 0
  let idleAt = 0
  let visible = false
  let raf = 0
  let prev = 0
  let open = false

  const tick = (now: number) => {
    // Capped so a backgrounded tab does not come back with one giant step.
    const dt = Math.min(now - prev, 250)
    prev = now
    if (!dragging) {
      if (target !== null) {
        rot += (target - rot) * (1 - Math.exp(-dt / settle))
        if (Math.abs(target - rot) < 0.2) {
          rot = target
          target = null
          idleAt = now + IDLE_MS
        }
      } else if (!opts.reduced && !open && now > idleAt && !scene.matches(':focus-within')) {
        rot += (AUTO_SPEED * dt) / 1000
      }
    }
    ring.style.transform = `rotateY(${rot}deg)`
    shade()
    raf = visible ? requestAnimationFrame(tick) : 0
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible && !raf) {
      prev = performance.now()
      raf = requestAnimationFrame(tick)
    }
  }).observe(scene)

  // ---- drag (mouse + touch) -------------------------------------------
  scene.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragging = true
    moved = 0
    vel = 0
    target = null
    lastX = e.clientX
    lastT = e.timeStamp
  })
  scene.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const dx = e.clientX - lastX
    const dt = Math.max(1, e.timeStamp - lastT)
    lastX = e.clientX
    lastT = e.timeStamp
    moved += Math.abs(dx)
    rot += dx * DRAG_SENS
    vel = vel * 0.6 + ((dx * DRAG_SENS) / dt) * 0.4
    if (moved > CLICK_SLOP && !scene.hasPointerCapture(e.pointerId)) {
      // Capture keeps the drag alive outside the scene. It can refuse (the
      // pointer may already be gone); the drag still works without it.
      try {
        scene.setPointerCapture(e.pointerId)
      } catch {}
      scene.classList.add('is-dragging')
    }
  })
  const release = (e: PointerEvent) => {
    if (!dragging) return
    dragging = false
    if (e.timeStamp - lastT > 80) vel = 0
    // Heavy flywheel: coast a capped distance, ease out, land on a frame.
    const coast = Math.max(-MAX_FLICK, Math.min(MAX_FLICK, vel * COAST_MS))
    turnTo(snap(rot + coast), SETTLE_FLICK)
    scene.classList.remove('is-dragging')
    // The click that follows this release still needs `moved`; clear it after.
    window.setTimeout(() => (moved = 0))
  }
  scene.addEventListener('pointerup', release)
  scene.addEventListener('pointercancel', release)

  // ---- keyboard: arrows turn one frame; focusing a frame brings it front ---
  const faceFrame = (i: number) => {
    const want = -i * step
    turnTo(want + Math.round((rot - want) / 360) * 360, SETTLE_STEP)
  }
  frames.forEach((f, i) => {
    f.addEventListener('focus', () => f.matches(':focus-visible') && faceFrame(i))
    f.addEventListener('click', (e) => {
      // A drag that ends on a frame is not a click. Keyboard activation (detail 0) always is.
      if (e.detail !== 0 && moved > CLICK_SLOP) return
      show(i)
    })
  })
  scene.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const i = frames.indexOf(document.activeElement as HTMLButtonElement)
    // On a frame: move focus, and the focus handler turns the ring.
    if (i >= 0) frames[(i + dir + n) % n].focus({ preventScroll: true })
    else turnTo(snap(target ?? rot) - dir * step, SETTLE_STEP)
  })

  // ---- lightbox ---------------------------------------------------------
  const box = document.getElementById('lightbox') as HTMLDialogElement
  const stage = document.getElementById('lightboxStage')!
  const caption = document.getElementById('lightboxCaption')!
  let current = 0

  function show(i: number) {
    current = (i + n) % n
    const m = memes[current]
    stage.innerHTML = faceMarkup(m)
    caption.textContent = `${String(current + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')} · ${m.id}`
    if (!box.open) {
      open = true
      opts.lockScroll(true)
      box.showModal()
    }
  }

  document.getElementById('lightboxClose')!.addEventListener('click', () => box.close())
  document.getElementById('lightboxPrev')!.addEventListener('click', () => show(current - 1))
  document.getElementById('lightboxNext')!.addEventListener('click', () => show(current + 1))
  box.addEventListener('click', (e) => e.target === box && box.close())
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1)
    if (e.key === 'ArrowRight') show(current + 1)
  })
  // Esc is handled natively by <dialog>; it lands here too.
  box.addEventListener('close', () => {
    open = false
    opts.lockScroll(false)
    faceFrame(current)
    stage.innerHTML = ''
  })
}
