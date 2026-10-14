import '@fontsource/anton/400.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import './style.css'

import gsap from 'gsap'
import { loadAssets } from './assets'
import { initSoundControl, music } from './audio'
import { runBoot } from './boot'
import { initCursor } from './cursor'
import { fx } from './fx-config'
import { createEngine, type Engine } from './gl/engine'
import { createRing } from './gl/ring'
import { buildStages } from './gl/scenes'
import { createLightbox } from './lightbox'
import { initLite } from './lite'
import { buildMemes } from './memes'
import { createNav, type Nav } from './nav'
import { renderScreens } from './screens'
import { hydrateToken } from './token'

const root = document.documentElement
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
root.classList.toggle('is-reduced', reduced)

// The page overlay takes its strengths from the same config as the shader.
root.style.setProperty('--fx-grain', String(fx.dom.grain))
root.style.setProperty('--fx-scan', String(fx.dom.scanlines))
root.style.setProperty('--fx-split', `${fx.dom.split}px`)
root.classList.toggle('no-jitter', fx.dom.jitter === 0)

history.scrollRestoration = 'manual'
void initLite()

const views = renderScreens(document.getElementById('screens')!, reduced)
hydrateToken()
initSoundControl()

const canvas = document.getElementById('gl') as HTMLCanvasElement
const site = document.getElementById('site')!
let nav: Nav

/** Canvas text needs the fonts in memory first; don't let a slow font hold the page forever. */
const fonts = Promise.race([
  Promise.all(['56px Anton', '500 20px "JetBrains Mono"', '600 40px "Instrument Sans"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 2500)),
])

const ready: Promise<Engine> = fonts.then(loadAssets).then(async () => {
  const memes = buildMemes()
  const ring = createRing(memes, reduced)
  const lightbox = createLightbox(memes, {
    onOpen() {
      nav.setPaused(true)
      ring.paused = true
    },
    onClose(memeIndex) {
      nav.setPaused(false)
      ring.paused = false
      if (memeIndex !== null) ring.face(memeIndex)
    },
  })

  const engine = createEngine(canvas, (env) => buildStages({ env, ring, openVideo: lightbox.showVideo, openMeme: lightbox.showMeme }), {
    reduced,
    finePointer,
  })
  engine.start()
  nav = createNav({ engine, views, reduced })
  if (finePointer && !reduced) initCursor(engine, () => nav.locked)
  if (new URLSearchParams(location.search).has('debug')) {
    void import('./debug').then((m) => m.initDebug(() => `${String(nav.index + 1).padStart(2, '0')} ${views[nav.index].def.id} · ${engine.info()}`))
  }

  // ---- clicks into the 3D scene (bare canvas only) ---------------------------
  canvas.addEventListener('click', (e) => !nav.locked && engine.pick(e.clientX, e.clientY)?.onClick())
  document.querySelectorAll('[data-open-video]').forEach((b) => b.addEventListener('click', lightbox.showVideo))

  // ---- the meme ring: drag on the canvas, keys on its focusable label ---------
  const MEMES = views.findIndex((v) => v.def.id === 'memes')
  canvas.addEventListener('pointerdown', (e) => {
    if (nav.index !== MEMES || nav.locked || (e.pointerType === 'mouse' && e.button !== 0)) return
    ring.down(e.clientX, e.timeStamp)
    root.classList.add('is-dragging')
  })
  window.addEventListener('pointermove', (e) => ring.move(e.clientX, e.timeStamp))
  const release = (e: PointerEvent) => {
    ring.up(e.timeStamp)
    root.classList.remove('is-dragging')
  }
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)

  const keys = document.getElementById('ringKeys')!
  keys.addEventListener('focus', () => (ring.paused = true))
  keys.addEventListener('blur', () => (ring.paused = false))
  keys.addEventListener('click', () => lightbox.showMeme(ring.front))
  keys.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    ring.stepBy(e.key === 'ArrowRight' ? 1 : -1)
  })

  if (import.meta.env.DEV) Object.assign(window, { __engine: engine, __ring: ring, __nav: nav })

  // The loader's static is still up, so this is the moment to pay for the other eleven scenes.
  await engine.warm()
  return engine
})

runBoot({
  reduced,
  ready,
  onReveal() {
    views[0].intro?.play(0)
  },
  onEnter(withSound) {
    site.inert = false
    root.classList.remove('is-locked')
    if (!reduced) gsap.to('[data-after-enter]', { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' })
    nav.unlock()
    // Still inside the click, which is what lets browsers (iOS Safari included) start audio.
    music.start(withSound)
  },
})
