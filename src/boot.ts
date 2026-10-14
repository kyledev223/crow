import gsap from 'gsap'
import type { Engine } from './gl/engine'

const STATUS = [
  [0, 'Collecting shiny things…'],
  [38, 'Counting them twice…'],
  [72, 'Pressing the suit…'],
  [100, 'The nest is ready.'],
] as const

export interface BootOptions {
  reduced: boolean
  /** Resolves with the engine once every scene is built and warmed up. */
  ready: Promise<Engine>
  /** Runs inside the click, so audio is allowed to start. */
  onEnter(withSound: boolean): void
  /** The visitor has arrived on screen 01. */
  onArrive(): void
}

/**
 * Loader → particle entry → site.
 *
 * 1. Brand, a big 000 → 100 counter and a status line, on black.
 * 2. At 100 the loader fades away over the live particle field: a glowing
 *    sphere, "Enter" / "Enter without sound". Scrolling stays locked.
 * 3. On Enter the camera flies through the sphere and the first screen
 *    comes up out of the flash.
 */
export function runBoot({ reduced, ready, onEnter, onArrive }: BootOptions) {
  const root = document.documentElement
  const boot = document.getElementById('boot')!
  const count = document.getElementById('bootCount')!
  const status = document.getElementById('bootStatus')!
  const bar = document.getElementById('bootBar')!
  const entry = document.getElementById('entry')!

  const progress = { v: 0 }
  const counted = new Promise<void>((resolve) => {
    gsap.to(progress, {
      v: 100,
      duration: reduced ? 0.6 : 2.6,
      ease: 'power2.inOut',
      onUpdate() {
        const v = Math.round(progress.v)
        count.textContent = String(v).padStart(3, '0')
        gsap.set(bar, { scaleX: v / 100 })
        const line = [...STATUS].reverse().find(([at]) => v >= at)
        if (line && status.textContent !== line[1]) status.textContent = line[1]
      },
      onComplete: resolve,
    })
  })

  let engine: Engine
  Promise.all([ready, counted]).then(([e]) => {
    engine = e
    root.classList.remove('is-booting')
    root.classList.add('is-entry')
    entry.hidden = false
    gsap.to(boot, { autoAlpha: 0, duration: reduced ? 0.3 : 0.9, ease: 'power2.inOut', onComplete: () => boot.remove() })
    if (!reduced) gsap.from(entry.children, { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out', delay: 0.5 })
    entry.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  })

  let entered = false
  entry.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-enter]')
    if (!btn || entered || !engine) return
    entered = true
    // Whatever goes wrong in there, the gate still opens.
    try {
      onEnter(btn.dataset.enter === 'sound')
    } catch (err) {
      console.error(err)
    }
    const arrive = () => {
      root.classList.remove('is-entry')
      entry.remove()
      onArrive()
    }
    gsap.to(entry, { autoAlpha: 0, duration: 0.35 })
    if (reduced) {
      engine.showSite()
      engine.state.fade = 1
      gsap.to(engine.state, { fade: 0, duration: 0.4, onComplete: arrive })
      return
    }
    // Fly through the sphere, white out, and come up on screen 01.
    const fly = engine.entry.state
    gsap
      .timeline()
      .to(fly, { fly: 1, duration: 1.35, ease: 'power3.in' }, 0)
      .to(fly, { zoom: 1, duration: 1.15, ease: 'power2.in' }, 0.15)
      .to(fly, { flash: 1, duration: 0.22, ease: 'power1.in' }, 1.15)
      .call(() => {
        engine.showSite()
        engine.state.fade = 1
      })
      .to(engine.state, { fade: 0, duration: 0.9, ease: 'power2.out' })
      .call(arrive, [], '-=0.5')
  })
}
