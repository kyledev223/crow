import type { Engine } from './gl/engine'

const CLICKABLE = 'a, button, [role="button"], [tabindex]:not([tabindex="-1"]), summary, label'

/**
 * Custom cursor ring for mouse users. It marks the centre of the lens the
 * post-process shader draws, grows over anything clickable (DOM controls and
 * clickable things in the 3D scene), and goes dashed over disabled controls.
 * Touch devices and reduced-motion visitors keep the system cursor.
 */
export function initCursor(engine: Engine, isLocked: () => boolean) {
  const ring = document.getElementById('cursor')!
  document.documentElement.classList.add('has-cursor')

  let x = 0
  let y = 0
  let moved = false
  let target: Element | null = null

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    x = e.clientX
    y = e.clientY
    target = e.target as Element
    moved = true
  })
  document.documentElement.addEventListener('pointerleave', () => ring.classList.remove('is-on'))
  window.addEventListener('pointerdown', () => ring.classList.add('is-down'))
  window.addEventListener('pointerup', () => ring.classList.remove('is-down'))

  const frame = () => {
    requestAnimationFrame(frame)
    if (!moved) return
    moved = false
    ring.style.transform = `translate3d(${x}px, ${y}px, 0)`
    const control = target?.closest?.(CLICKABLE) ?? null
    const disabled = !!control && (control.getAttribute('aria-disabled') === 'true' || (control as HTMLButtonElement).disabled === true)
    // Only look into the 3D scene when the pointer is over bare canvas.
    const inScene = !control && target instanceof HTMLCanvasElement && !isLocked() && engine.pick(x, y) !== null
    ring.classList.add('is-on')
    ring.classList.toggle('is-hot', (!!control && !disabled) || inScene)
    ring.classList.toggle('is-blocked', disabled)
  }
  requestAnimationFrame(frame)
}
