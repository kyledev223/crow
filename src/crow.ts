import gsap from 'gsap'
import { crowMarkup } from './crow-art'

export interface CrowHandle {
  /** Squash-and-stretch hop with a wing flap. Used when the section changes. */
  hop(): void
  /** Happy bounce. Returns true if it actually played (the crow wasn't busy). */
  caw(): boolean
}

const STILL: CrowHandle = { hop() {}, caw: () => false }

/**
 * Brings a crow to life.
 *
 * Always on: blink. Everything else is skipped under reduced motion.
 * Baseline: breathing, small head tilts, coin glints.
 * Actions: hop, caw, and one random idle (preen, look back, coin toss) every
 * 6–10s. Only one action runs at a time; a hop may interrupt an idle.
 */
export function animateCrow(root: Element, reduced: boolean): CrowHandle {
  const q = gsap.utils.selector(root)
  const lid = q('.crow-lid')
  const bird = q('.crow-bird')
  const hopper = q('.crow-hop')
  const wing = q('.crow-wing')
  const head = q('.crow-head')
  const turn = q('.crow-turn')
  const coin = q('.crow-beakcoin')
  const beakGlint = q('.crow-glint--beak')

  gsap.set(lid, { scaleY: 0, svgOrigin: '272 150' })
  gsap.set(beakGlint, { scale: 0, svgOrigin: '402 184' })
  gsap.set(q('.crow-glint--stack'), { scale: 0, svgOrigin: '150 372' })
  gsap.set(hopper, { svgOrigin: '214 372' })
  gsap.set(wing, { svgOrigin: '236 230' })
  gsap.set(head, { svgOrigin: '244 214' })
  gsap.set(turn, { svgOrigin: '262 176' })
  gsap.set(coin, { svgOrigin: '384 196' })

  const blink = () => {
    const twice = Math.random() < 0.25
    gsap
      .timeline({ delay: gsap.utils.random(2.2, 5.5), onComplete: blink })
      .to(lid, { scaleY: 1, duration: 0.07, ease: 'power2.in' })
      .to(lid, { scaleY: 0, duration: 0.12, ease: 'power2.out' })
      .to(lid, { scaleY: twice ? 1 : 0, duration: 0.07, delay: 0.08 })
      .to(lid, { scaleY: 0, duration: 0.12 })
  }
  blink()
  if (reduced) return STILL

  // ---- baseline -----------------------------------------------------------
  gsap.to(bird, {
    scaleY: 1.022,
    scaleX: 0.992,
    svgOrigin: '214 372',
    duration: 2.1,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
  })

  const glint = (sel: string, delay: number) =>
    gsap
      .timeline({ repeat: -1, repeatDelay: 3.4, delay })
      .to(q(sel), { scale: 1, rotation: 45, duration: 0.28, ease: 'power2.out' })
      .to(q(sel), { scale: 0, rotation: 90, duration: 0.45, ease: 'power2.in' })
  const beakGlintLoop = glint('.crow-glint--beak', 1.2)
  glint('.crow-glint--stack', 3.1)

  // ---- one action at a time -------------------------------------------------
  let action: gsap.core.Timeline | null = null
  const busy = () => action !== null

  const start = (build: (tl: gsap.core.Timeline) => void, interrupt = false): boolean => {
    const interrupted = busy()
    if (interrupted && !interrupt) return false
    action?.kill()
    gsap.killTweensOf(head)
    const tl = gsap.timeline({
      onComplete: () => {
        action = null
        beakGlintLoop.resume()
      },
    })
    if (interrupted) {
      // Whatever was cut short, get every part back home first.
      tl.to([...wing, ...coin], { rotation: 0, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.1 }, 0)
        .to(turn, { scaleX: 1, duration: 0.1 }, 0)
        .to(head, { rotation: 0, duration: 0.1 }, 0)
        .to(hopper, { y: 0, scaleX: 1, scaleY: 1, duration: 0.1 }, 0)
    }
    build(tl)
    action = tl
    return true
  }

  const hop = (tl: gsap.core.Timeline) => {
    tl.addLabel('hop')
      .to(hopper, { scaleY: 0.96, scaleX: 1.03, duration: 0.1, ease: 'power2.out' }, 'hop')
      .to(hopper, { y: -26, scaleY: 1.04, scaleX: 0.98, duration: 0.2, ease: 'power2.out' })
      .to(hopper, { y: 0, scaleY: 1, scaleX: 1, duration: 0.18, ease: 'power2.in' })
      .to(hopper, { scaleY: 0.97, scaleX: 1.02, duration: 0.07, ease: 'power1.out' })
      .to(hopper, { scaleY: 1, scaleX: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' })
      .to(wing, { rotation: 30, duration: 0.1, ease: 'power2.out' }, 'hop+=0.1')
      .to(wing, { rotation: -4, duration: 0.1, ease: 'power1.inOut' }, 'hop+=0.2')
      .to(wing, { rotation: 24, duration: 0.09, ease: 'power1.inOut' }, 'hop+=0.3')
      .to(wing, { rotation: 0, duration: 0.24, ease: 'power2.out' }, 'hop+=0.39')
  }

  const caw = (tl: gsap.core.Timeline) => {
    tl.addLabel('caw')
      .to(head, { rotation: -16, duration: 0.1, ease: 'power2.out' }, 'caw')
      .to(hopper, { y: -12, duration: 0.11, ease: 'power2.out', yoyo: true, repeat: 3 }, 'caw')
      .to(wing, { rotation: 16, duration: 0.11, ease: 'power1.inOut', yoyo: true, repeat: 3 }, 'caw')
      .to(head, { rotation: 0, duration: 0.45, ease: 'elastic.out(1, 0.45)' }, 'caw+=0.34')
  }

  const preen = (tl: gsap.core.Timeline) => {
    tl.to(head, { rotation: 34, duration: 0.35, ease: 'power2.inOut' })
      .to(wing, { rotation: 10, duration: 0.3, ease: 'power2.out' }, '<0.1')
      .to(head, { rotation: 26, duration: 0.12, ease: 'sine.inOut', yoyo: true, repeat: 5 })
      .to(head, { rotation: 0, duration: 0.45, ease: 'back.out(1.6)' })
      .to(wing, { rotation: 0, duration: 0.3, ease: 'power2.inOut' }, '<')
  }

  const lookBack = (tl: gsap.core.Timeline) => {
    tl.to(turn, { scaleX: -1, duration: 0.22, ease: 'power2.inOut' })
      .to(head, { rotation: 6, duration: 0.22 }, '<')
      .to(turn, { scaleX: 1, duration: 0.22, ease: 'power2.inOut' }, '+=1.1')
      .to(head, { rotation: 0, duration: 0.3 }, '<')
  }

  const toss = (tl: gsap.core.Timeline) => {
    beakGlintLoop.pause(0)
    gsap.set(beakGlint, { scale: 0 })
    tl.to(head, { rotation: 8, duration: 0.14, ease: 'power1.in' })
      .to(head, { rotation: -16, duration: 0.12, ease: 'power2.out' })
      .addLabel('air', '<')
      .to(coin, { y: -120, duration: 0.36, ease: 'power2.out' }, 'air')
      .to(coin, { y: 0, duration: 0.34, ease: 'power2.in' })
      .to(coin, { scaleY: -1, duration: 0.175, ease: 'none', yoyo: true, repeat: 3 }, 'air')
      .to(head, { rotation: 5, duration: 0.08, ease: 'power1.out' })
      .to(head, { rotation: 0, duration: 0.4, ease: 'elastic.out(1, 0.5)' })
  }

  // Small head tilts fill the gaps between actions.
  const tilt = () => {
    gsap.delayedCall(gsap.utils.random(1.4, 4.2), () => {
      if (!busy()) gsap.to(head, { rotation: gsap.utils.random(-10, 7), duration: 0.45, ease: 'back.out(2.4)' })
      tilt()
    })
  }
  tilt()

  const idles = [preen, lookBack, toss]
  const idle = () => {
    gsap.delayedCall(gsap.utils.random(6, 10), () => {
      if (!document.hidden) start(gsap.utils.random(idles))
      idle()
    })
  }
  idle()

  return {
    hop: () => void start(hop, true),
    caw: () => start(caw),
  }
}

export function mountCrow(host: Element, idPrefix: string, reduced: boolean): CrowHandle {
  host.innerHTML = crowMarkup(idPrefix)
  return animateCrow(host, reduced)
}
