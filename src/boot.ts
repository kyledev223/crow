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
  /** Resolves with the engine once the 3D scenes are built and rendering. */
  ready: Promise<Engine>
  /** The hero scene is now on screen behind the entry buttons. */
  onReveal(): void
  /** Runs inside the click, so audio is allowed to start. */
  onEnter(withSound: boolean): void
}

/**
 * Loader → CRT flip → interactive entry screen.
 *
 * 1. Counts 000 → 100 over heavy static.
 * 2. The picture collapses to a bright line and springs back open on the
 *    live hero scene (parallax and the cursor lens already work).
 * 3. "Enter" / "Enter without sound" wait there. Scrolling stays locked
 *    until one is chosen.
 */
export function runBoot({ reduced, ready, onReveal, onEnter }: BootOptions) {
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

  const reveal = () => {
    boot.remove()
    root.classList.remove('is-booting')
    entry.hidden = false
    onReveal()
    if (!reduced) gsap.from(entry.children, { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out', delay: 0.25 })
    entry.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  }

  Promise.all([ready, counted]).then(([engine]) => {
    const state = engine.state
    if (reduced) {
      state.boot = 0
      return reveal()
    }
    gsap
      .timeline()
      .to(boot, { autoAlpha: 0, duration: 0.16 }, 0)
      // collapse to a line…
      .to(state, { crtY: 0.006, duration: 0.24, ease: 'power3.in' }, 0)
      .to(state, { crtX: 0.3, duration: 0.16, ease: 'power2.in' }, 0.2)
      // …swap the static for the scene while it is too thin to see…
      .set(state, { boot: 0 })
      .call(reveal)
      // …and spring back open.
      .to(state, { crtX: 1, duration: 0.2, ease: 'power2.out' }, '+=0.06')
      .to(state, { crtY: 1, duration: 0.5, ease: 'expo.out' }, '<0.06')
  })

  let entered = false
  entry.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-enter]')
    if (!btn || entered) return
    entered = true
    // Whatever goes wrong in there, the gate still opens.
    try {
      onEnter(btn.dataset.enter === 'sound')
    } catch (err) {
      console.error(err)
    }
    gsap.to(entry, { autoAlpha: 0, y: 12, duration: reduced ? 0.01 : 0.35, onComplete: () => entry.remove() })
  })
}
