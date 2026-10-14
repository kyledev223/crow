import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import type { CrowHandle } from './crow'

gsap.registerPlugin(ScrollTrigger)

let lenis: Lenis | null = null

/** Freezes page scroll (intro gate, lightbox). */
export function setScrollLocked(locked: boolean) {
  document.documentElement.classList.toggle('is-locked', locked)
  if (lenis) locked ? lenis.stop() : lenis.start()
}

// ---- mascot poses ---------------------------------------------------------
type PoseName = 'hero' | 'crowRight' | 'crowLeft' | 'token' | 'hidden' | 'join'
interface Pose {
  x: number
  y: number
  scale: number
  alpha: number
  /** 1 faces right, -1 faces left. The crow always looks at the copy. */
  flip: 1 | -1
}

function poseFor(name: PoseName): Pose {
  const w = window.innerWidth
  const h = window.innerHeight
  const phone = w < 900
  switch (name) {
    case 'hero':
      return { x: 0, y: h * (phone ? 0.09 : 0.05), scale: phone ? 0.82 : 1.2, alpha: 1, flip: 1 }
    case 'crowRight':
      return phone
        ? { x: w * 0.27, y: h * -0.31, scale: 0.4, alpha: 1, flip: -1 }
        : { x: w * 0.27, y: h * 0.03, scale: 1, alpha: 1, flip: -1 }
    case 'crowLeft':
      return phone
        ? { x: w * -0.27, y: h * -0.31, scale: 0.4, alpha: 1, flip: 1 }
        : { x: w * -0.27, y: h * 0.03, scale: 1, alpha: 1, flip: 1 }
    case 'token':
      return phone
        ? { x: w * -0.27, y: h * -0.31, scale: 0.4, alpha: 1, flip: 1 }
        : { x: w * -0.28, y: h * 0.02, scale: 1.08, alpha: 1, flip: 1 }
    case 'join':
      return { x: 0, y: h * (phone ? -0.24 : -0.2), scale: phone ? 0.5 : 0.62, alpha: 1, flip: 1 }
    case 'hidden':
      return { x: 0, y: h * 0.04, scale: 0.7, alpha: 0, flip: 1 }
  }
}

export function initScroll(reduced: boolean, crow: CrowHandle) {
  ScrollTrigger.config({ ignoreMobileResize: true })

  const mascot = document.getElementById('mascot')!
  const flip = mascot.querySelector<HTMLElement>('.mascot__flip')!
  const sway = mascot.querySelector<HTMLElement>('.mascot__sway')!
  let pose: PoseName = 'hero'

  const applyPose = (name: PoseName, instant = false) => {
    if (!instant && name !== pose) crow.hop()
    pose = name
    const p = poseFor(name)
    const to = { x: p.x, y: p.y, scale: p.scale, autoAlpha: p.alpha }
    if (instant) {
      gsap.set(mascot, to)
      gsap.set(flip, { scaleX: p.flip })
    } else if (reduced) {
      gsap
        .timeline({ overwrite: true })
        .to(mascot, { autoAlpha: 0, duration: 0.15 })
        .set(mascot, { x: p.x, y: p.y, scale: p.scale })
        .set(flip, { scaleX: p.flip })
        .to(mascot, { autoAlpha: p.alpha, duration: 0.25 })
    } else {
      gsap.to(mascot, { ...to, duration: 1.1, ease: 'power3.inOut', overwrite: 'auto' })
      gsap.to(flip, { scaleX: p.flip, duration: 0.6, ease: 'power2.inOut', overwrite: 'auto' })
    }
  }

  gsap.set(mascot, { xPercent: -50, yPercent: -50 })
  applyPose('hero', true)
  gsap.set(mascot, { autoAlpha: 0, scale: poseFor('hero').scale * 0.72, y: poseFor('hero').y + 70 })

  // ---- smooth scroll ------------------------------------------------------
  if (!reduced) {
    lenis = new Lenis({ autoRaf: false })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((t) => lenis!.raf(t * 1000))
    gsap.ticker.lagSmoothing(0)
    lenis.stop()

    // The crow leans into the scroll and settles when it stops.
    const lean = gsap.quickTo(sway, 'rotation', { duration: 0.7, ease: 'power3' })
    const lift = gsap.quickTo(sway, 'y', { duration: 0.7, ease: 'power3' })
    gsap.ticker.add(() => {
      const v = lenis!.velocity || 0
      lean(gsap.utils.clamp(-9, 9, v * 0.14))
      lift(gsap.utils.clamp(-26, 26, v * -0.5))
    })
  }

  document.getElementById('brandLink')!.addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0)
    else window.scrollTo(0, 0)
  })

  // ---- hero ---------------------------------------------------------------
  const heroWords = gsap.utils.toArray<HTMLElement>('.hero__word')
  heroWords.forEach((word) => {
    word.innerHTML = [...word.textContent!].map((ch) => `<span class="ch">${ch}</span>`).join('')
  })
  const heroChars = gsap.utils.toArray<HTMLElement>('.hero .ch')
  const heroBits = gsap.utils.toArray<HTMLElement>('.hero [data-fade]')
  if (!reduced) {
    gsap.set(heroChars, { yPercent: 112 })
    gsap.set(heroBits, { autoAlpha: 0, y: 18 })
    gsap.to('.hero__title', {
      yPercent: -22,
      autoAlpha: 0,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 35%', scrub: true },
    })
  }

  const mm = gsap.matchMedia()
  const MOTION = '(prefers-reduced-motion: no-preference)'
  // Pin chapters only where a whole chapter fits on screen.
  const ROOMY = '(min-width: 900px) and (min-height: 600px), (max-width: 899px) and (min-height: 700px)'
  const chapters = gsap.utils.toArray<HTMLElement>('.chapter')

  const cardIn = (tl: gsap.core.Timeline, chapter: HTMLElement, at: number) => {
    const card = chapter.querySelector<HTMLElement>('.card')!
    const side = chapter.classList.contains('chapter--left') ? 1 : -1
    switch (card.dataset.card) {
      case 'post':
        return tl.from(card, { yPercent: 70, rotation: -5, autoAlpha: 0, duration: 0.7, ease: 'power3.out' }, at)
      case 'define':
        return tl.from(
          card,
          { scale: 0.8, autoAlpha: 0, transformOrigin: '0% 100%', duration: 0.6, ease: 'back.out(1.6)' },
          at,
        )
      case 'ledger':
        return tl
          .from(card, { autoAlpha: 0, y: 30, duration: 0.4 }, at)
          .from(card.querySelectorAll('li'), { xPercent: -10, autoAlpha: 0, stagger: 0.07, duration: 0.3 }, at + 0.15)
          .from(card.querySelectorAll('blockquote, figcaption'), { autoAlpha: 0, duration: 0.3 }, '>-0.05')
      default:
        return tl.from(
          card,
          { xPercent: side * 35, rotation: side * 4, autoAlpha: 0, duration: 0.7, ease: 'power3.out' },
          at,
        )
    }
  }

  const headIn = (chapter: HTMLElement) =>
    gsap
      .timeline({ defaults: { ease: 'power4.out' } })
      .from(chapter.querySelector('.eyebrow'), { autoAlpha: 0, y: 14, duration: 0.5 }, 0)
      .from(chapter.querySelectorAll('.line__in'), { yPercent: 112, duration: 0.9, stagger: 0.1 }, 0.05)

  mm.add({ motion: MOTION, roomy: ROOMY }, (ctx) => {
    const { motion, roomy } = ctx.conditions as { motion: boolean; roomy: boolean }
    if (!motion) return

    chapters.forEach((chapter) => {
      if (roomy) {
        // The headline lands as the chapter arrives, then the chapter pins
        // and the scroll itself reveals the paragraph and the card.
        ScrollTrigger.create({
          trigger: chapter,
          start: 'top 62%',
          animation: headIn(chapter),
          toggleActions: 'play none none reverse',
        })
        const tl = gsap.timeline({
          scrollTrigger: { trigger: chapter, start: 'top top', end: '+=95%', pin: true, scrub: 0.6, refreshPriority: 1 },
        })
        tl.from(chapter.querySelector('.chapter__text'), { autoAlpha: 0, y: 36, duration: 0.5, ease: 'power2.out' }, 0.05)
        cardIn(tl, chapter, 0.4)
        tl.to({}, { duration: 0.35 })
      } else {
        // Small screens: no pinning, each chapter plays once as it scrolls in.
        const tl = headIn(chapter)
        tl.from(chapter.querySelector('.chapter__text'), { autoAlpha: 0, y: 24, duration: 0.6 }, 0.4)
        cardIn(tl, chapter, 0.6)
        ScrollTrigger.create({ trigger: chapter, start: 'top 70%', animation: tl, once: true })
      }
    })

    // Everything after the lore: one reveal per section, played once.
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((section) => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } })
      const lines = section.querySelectorAll('.line__in')
      const bits = section.querySelectorAll('[data-fade]')
      if (lines.length) tl.from(lines, { yPercent: 112, duration: 0.9, stagger: 0.1 }, 0)
      if (bits.length) tl.from(bits, { autoAlpha: 0, y: 22, duration: 0.6, stagger: 0.07 }, 0.25)
      ScrollTrigger.create({ trigger: section, start: 'top 68%', animation: tl, once: true })
    })
  })

  // ---- mascot follows the sections ----------------------------------------
  const posed = gsap.utils.toArray<HTMLElement>('[data-pose]')
  const progNum = document.getElementById('progNum')!
  const progName = document.getElementById('progName')!
  const ticks = gsap.utils.toArray<HTMLElement>('#progTicks i')
  const groups = gsap.utils.toArray<HTMLElement>('[data-group]')
  document.getElementById('progTotal')!.textContent = String(groups.length).padStart(2, '0')
  let group = 0
  let chapter = ''
  let entered = false

  const renderProgress = () => {
    const el = groups[group]
    progNum.textContent = String(group + 1).padStart(2, '0')
    progName.textContent = el.id === 'lore' && chapter ? `Lore · ch. ${chapter}` : el.dataset.group!
    ticks.forEach((t, i) => t.classList.toggle('is-on', i === group))
  }

  // The last trigger must still be active at the very bottom of the page,
  // so its end sits just past the reachable scroll range.
  const pastEnd = () => ScrollTrigger.maxScroll(window) + 100

  posed.forEach((section, i) => {
    const next = posed[i + 1]
    ScrollTrigger.create({
      trigger: section,
      start: i === 0 ? 0 : 'top 55%',
      ...(next ? { endTrigger: next, end: 'top 55%' } : { end: pastEnd }),
      onToggle: (self) => {
        if (!self.isActive) return
        chapter = section.dataset.chapter ?? ''
        renderProgress()
        if (entered) applyPose(section.dataset.pose as PoseName)
        else pose = section.dataset.pose as PoseName
      },
    })
  })

  groups.forEach((el, i) => {
    ScrollTrigger.create({
      trigger: el,
      // The footer can be too short to ever reach the 55% line, so the last
      // group also switches on just before the page runs out.
      start:
        i === 0
          ? 0
          : i < groups.length - 1
            ? 'top 55%'
            : () =>
                Math.min(
                  el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.55,
                  ScrollTrigger.maxScroll(window) - 80,
                ),
      end: i === groups.length - 1 ? pastEnd : 'bottom 55%',
      onToggle: (self) => {
        if (!self.isActive) return
        group = i
        renderProgress()
      },
    })
  })

  ScrollTrigger.addEventListener('refreshInit', () => entered && applyPose(pose, true))
  ScrollTrigger.sort()
  ScrollTrigger.refresh()
  renderProgress()

  return {
    /** Called when the visitor passes the intro gate. */
    enter() {
      entered = true
      setScrollLocked(false)
      applyPose(pose)
      if (reduced) return
      gsap
        .timeline({ delay: 0.35 })
        .to(heroChars, { yPercent: 0, duration: 1.1, stagger: 0.045, ease: 'power4.out' }, 0)
        .to(heroBits, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' }, 0.6)
    },
  }
}
