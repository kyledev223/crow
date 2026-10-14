import type { Engine } from './gl/engine'

const CLICKABLE = 'a, button, [role="button"], [tabindex]:not([tabindex="-1"]), summary, label'

/**
 * The visible cursor for mouse users: a thin ring with a small solid dot.
 * The dot sits exactly on the pointer; the ring follows with a little easing.
 * Over anything clickable (page controls, or clickable things in the scene)
 * the ring grows a little; over disabled controls it dims. The lens itself is
 * invisible and lives in the post-process shader.
 *
 * Touch devices and reduced-motion visitors keep the system cursor.
 */
export function initCursor(engine: Engine, isLocked: () => boolean) {
  const el = document.getElementById('cursor')!
  const ring = el.querySelector<HTMLElement>('.cursor__ring')!
  const dot = el.querySelector<HTMLElement>('.cursor__dot')!
  document.documentElement.classList.add('has-cursor')

  let x = -100
  let y = -100
  let rx = -100
  let ry = -100
  let target: Element | null = null
  let seen = false

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    x = e.clientX
    y = e.clientY
    target = e.target as Element
    if (!seen) {
      rx = x
      ry = y
      seen = true
    }
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`
    el.classList.add('is-on')
  })
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('is-on'))
  window.addEventListener('pointerdown', () => el.classList.add('is-down'))
  window.addEventListener('pointerup', () => el.classList.remove('is-down'))

  let last = performance.now()
  let checkAt = 0
  const frame = (now: number) => {
    requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const k = 1 - Math.exp(-dt / 0.07)
    rx += (x - rx) * k
    ry += (y - ry) * k
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
    // What's under the pointer, a few times a second is plenty.
    if (now < checkAt) return
    checkAt = now + 80
    const control = target?.closest?.(CLICKABLE) ?? null
    const disabled = !!control && (control.getAttribute('aria-disabled') === 'true' || (control as HTMLButtonElement).disabled === true)
    const inScene = !control && target instanceof HTMLCanvasElement && !isLocked() && engine.pick(x, y) !== null
    el.classList.toggle('is-hot', (!!control && !disabled) || inScene)
    el.classList.toggle('is-blocked', disabled)
  }
  requestAnimationFrame(frame)
}
