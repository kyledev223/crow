import gsap from 'gsap'
import type { Engine } from './gl/engine'
import type { ScreenView } from './screens'

/** Scroll distance, in viewport heights, that drives one screen's internal animation. */
const PIN_HEIGHTS = 1.5
/** Extra scroll needed past the end of a screen before it hands over to the next (px). */
const PUSH_PX = 110
const TRANSITION = 1 // seconds
const SWIPE_PX = 48

export interface NavOptions {
  engine: Engine
  views: ScreenView[]
  reduced: boolean
  /** Fired after the active screen changes. */
  onChange?(index: number): void
}

/**
 * Screen-by-screen navigation.
 *
 * Normal mode: the page never scrolls natively. Wheel/trackpad input moves a
 * progress value 0–1 inside the current screen (camera push, text reveals).
 * Pushing past either end runs a one-second transition to the neighbour.
 * Touch swipes and PageUp/PageDown move a whole screen; arrow keys step
 * through a screen's progress first.
 *
 * Reduced motion: none of that. The screens are a normal scroll-snapped page
 * and this module only tracks which one is in view.
 */
export function createNav({ engine, views, reduced, onChange }: NavOptions) {
  const count = views.length
  const state = engine.state
  const rail = document.getElementById('rail')!
  const progNum = document.getElementById('progNum')!
  const progName = document.getElementById('progName')!
  document.getElementById('progTotal')!.textContent = String(count).padStart(2, '0')

  rail.innerHTML = views
    .map(
      (v, i) =>
        `<a class="rail__tick" href="#${v.def.id}" data-i="${i}"><span class="rail__name">${v.def.name}</span><span class="rail__num">${String(i + 1).padStart(2, '0')}</span><i aria-hidden="true"></i></a>`,
    )
    .join('')
  const ticks = [...rail.querySelectorAll<HTMLAnchorElement>('.rail__tick')]

  let index = 0
  let locked = true
  const indexOfHash = () => views.findIndex((v) => v.def.id === location.hash.slice(1))

  /** Updates everything that reflects "which screen is this": rail, label, URL. */
  function reflect(push: boolean) {
    ticks.forEach((t, i) => {
      t.classList.toggle('is-active', i === index)
      if (i === index) t.setAttribute('aria-current', 'true')
      else t.removeAttribute('aria-current')
    })
    progNum.textContent = String(index + 1).padStart(2, '0')
    progName.textContent = views[index].def.name
    const hash = '#' + views[index].def.id
    // Before Enter the URL is left alone, so an incoming #hash survives to be honoured.
    if (!locked && location.hash !== hash && !(index === 0 && !location.hash)) {
      if (push) history.pushState(null, '', hash)
      else history.replaceState(null, '', hash)
    }
    onChange?.(index)
  }

  // =========================================================================
  // Reduced motion: native scrolling with CSS scroll-snap
  // =========================================================================
  if (reduced) {
    document.documentElement.classList.add('is-native')
    state.progress = 1
    views.forEach((v) => v.el.classList.add('is-active'))
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          index = views.findIndex((v) => v.el === e.target)
          engine.setStage(index)
          reflect(false)
        }
      },
      { threshold: 0.55 },
    )
    views.forEach((v) => seen.observe(v.el))
    const jump = (i: number) => views[i]?.el.scrollIntoView()
    ticks.forEach((t, i) =>
      t.addEventListener('click', (e) => {
        e.preventDefault()
        jump(i)
      }),
    )
    reflect(false)
    return {
      get index() {
        return index
      },
      get locked() {
        return locked
      },
      unlock() {
        locked = false
        document.documentElement.classList.remove('is-locked')
        const i = indexOfHash()
        if (i > 0) jump(i)
      },
      jump,
      setPaused(_p: boolean) {},
    }
  }

  // =========================================================================
  // Normal mode: virtual scrolling
  // =========================================================================
  document.documentElement.classList.add('is-jacked')
  let target = 0 // where progress is heading
  let p = 0 // smoothed progress
  let busy = false
  let paused = false // lightbox open
  let push = 0
  let pushAt = 0
  let coolUntil = 0
  let auto: gsap.core.Tween | null = null

  views[0].el.classList.add('is-active')
  views.forEach((v, i) => i && gsap.set(v.el, { autoAlpha: 0 }))

  gsap.ticker.add((_t, deltaMs) => {
    p += (target - p) * (1 - Math.exp(-deltaMs / 140))
    state.progress = p
    views[index].scrub?.progress(Math.min(1, Math.max(0, p)))
  })

  /** Glides progress somewhere, e.g. after a swipe lands on a new screen. */
  function glide(to: number, seconds: number) {
    auto?.kill()
    const proxy = { v: target }
    auto = gsap.to(proxy, { v: to, duration: seconds, ease: 'power2.inOut', onUpdate: () => (target = proxy.v) })
  }

  interface GoOptions {
    /** Progress to land on: 0 = start of the screen, 1 = end (when arriving from below). */
    arrive?: number
    /** Play the screen's reveal through once it lands. */
    play?: boolean
    push?: boolean
  }

  function go(to: number, { arrive = 0, play = false, push: pushHistory = true }: GoOptions = {}) {
    if (busy || to === index || to < 0 || to >= count) return
    busy = true
    auto?.kill()
    const from = views[index]
    const next = views[to]
    gsap.to(from.el, { autoAlpha: 0, duration: 0.3, ease: 'power1.in' })
    gsap
      .timeline()
      .to(state, { glitch: 1, duration: 0.42, ease: 'power2.in' }, 0)
      .to(state, { dolly: 1, duration: 0.5, ease: 'power2.in' }, 0)
      .call(
        () => {
          from.el.classList.remove('is-active')
          index = to
          target = p = arrive
          state.progress = arrive
          engine.setStage(to)
          next.scrub?.progress(arrive)
          next.el.classList.add('is-active')
          gsap.set(next.el, { autoAlpha: 1 })
          next.intro?.restart()
          reflect(pushHistory)
        },
        [],
        0.5,
      )
      .fromTo(state, { dolly: -1 }, { dolly: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, 0.5)
      .to(state, { glitch: 0, duration: 0.42, ease: 'power2.out' }, 0.56)
      .call(
        () => {
          busy = false
          push = 0
          coolUntil = performance.now() + 320
          if (play) glide(1, 1.5)
        },
        [],
        TRANSITION,
      )
  }

  const next = (o?: GoOptions) => go(index + 1, o)
  const prev = (o?: GoOptions) => go(index - 1, { arrive: 1, ...o })
  const blocked = () => locked || paused || busy

  // ---- wheel / trackpad -----------------------------------------------------
  window.addEventListener(
    'wheel',
    (e) => {
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      if (blocked() || performance.now() < coolUntil) return
      const dy = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY
      auto?.kill()
      const wanted = target + dy / (PIN_HEIGHTS * window.innerHeight)
      target = Math.min(1, Math.max(0, wanted))
      // Anything past the end counts toward leaving the screen.
      const now = performance.now()
      const over = (wanted - target) * PIN_HEIGHTS * window.innerHeight
      if (now - pushAt > 260 || Math.sign(over) !== Math.sign(push)) push = 0
      if (over !== 0) {
        push += over
        pushAt = now
        if (push > PUSH_PX) next()
        else if (push < -PUSH_PX) prev()
      }
    },
    { passive: false },
  )

  // ---- touch: one swipe, one screen -------------------------------------------
  let touch: { x: number; y: number } | null = null
  window.addEventListener('touchstart', (e) => (touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }), { passive: true })
  window.addEventListener(
    'touchend',
    (e) => {
      if (!touch || blocked()) return
      const dx = e.changedTouches[0].clientX - touch.x
      const dy = e.changedTouches[0].clientY - touch.y
      touch = null
      if (Math.abs(dy) < SWIPE_PX || Math.abs(dy) < Math.abs(dx) * 1.2) return
      if (dy < 0) next({ play: true })
      else prev()
    },
    { passive: true },
  )

  // ---- keyboard ---------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (blocked() || e.altKey || e.ctrlKey || e.metaKey) return
    const el = e.target as HTMLElement
    const typing = el.closest('input, textarea, select, [contenteditable]')
    const onControl = el.closest('button, a, [role="button"]')
    if (typing) return
    switch (e.key) {
      case 'ArrowDown':
        target < 0.98 ? glide(1, 0.9) : next()
        break
      case 'ArrowUp':
        target > 0.02 ? glide(0, 0.9) : prev()
        break
      case ' ':
        if (onControl) return
        e.shiftKey ? prev() : target < 0.98 ? glide(1, 0.9) : next()
        break
      case 'PageDown':
        next({ play: true })
        break
      case 'PageUp':
        prev()
        break
      case 'Home':
        go(0, { play: true })
        break
      case 'End':
        go(count - 1, { play: true })
        break
      default:
        return
    }
    e.preventDefault()
  })

  // ---- side nav and URL hash ----------------------------------------------------
  ticks.forEach((t, i) =>
    t.addEventListener('click', (e) => {
      e.preventDefault()
      if (!locked) go(i, { play: true })
    }),
  )
  const fromHash = () => {
    const i = indexOfHash()
    if (!locked) go(i < 0 ? 0 : i, { play: true, push: false })
  }
  window.addEventListener('popstate', fromHash)
  window.addEventListener('hashchange', fromHash)

  reflect(false)

  return {
    get index() {
      return index
    },
    get locked() {
      return locked
    },
    /** Called when the visitor passes the entry screen. Honours a #hash in the URL. */
    unlock() {
      locked = false
      const i = indexOfHash()
      if (i > 0) go(i, { play: true, push: false })
    },
    jump: (i: number) => go(i, { play: true }),
    /** Suspends input while a lightbox is open. */
    setPaused(v: boolean) {
      paused = v
    },
  }
}

export type Nav = ReturnType<typeof createNav>
