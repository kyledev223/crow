import gsap from 'gsap'

const STATUS = [
  [0, 'Collecting shiny things…'],
  [38, 'Counting them twice…'],
  [72, 'Polishing the beak…'],
  [100, 'The nest is ready.'],
] as const

/**
 * Full-screen intro gate. Counts 000 → 100, then offers the two ways in.
 * `onEnter` runs synchronously inside the click so audio is allowed to start.
 */
export function runLoader(reduced: boolean, onEnter: (withSound: boolean) => void) {
  const loader = document.getElementById('loader')!
  const count = document.getElementById('loaderCount')!
  const status = document.getElementById('loaderStatus')!
  const actions = document.getElementById('loaderActions')!
  const bar = document.getElementById('loaderBar')!

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

  Promise.all([counted, document.fonts.ready]).then(() => {
    actions.hidden = false
    loader.classList.add('is-ready')
    if (!reduced) gsap.from(actions.children, { y: 16, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out' })
    actions.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
  })

  let entered = false
  actions.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-enter]')
    if (!btn || entered) return
    entered = true
    // Whatever goes wrong in there, the gate still opens.
    try {
      onEnter(btn.dataset.enter === 'sound')
    } catch (err) {
      console.error(err)
    }
    gsap.to(loader, {
      ...(reduced ? { autoAlpha: 0, duration: 0.3 } : { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }),
      onComplete: () => loader.remove(),
    })
  })
}
