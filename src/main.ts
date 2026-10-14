import '@fontsource/anton/400.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/instrument-sans/400.css'
import '@fontsource/instrument-sans/500.css'
import '@fontsource/instrument-sans/600.css'
import 'lenis/dist/lenis.css'
import './style.css'

import { initSoundControl, music } from './audio'
import { initCarousel } from './carousel'
import { renderChapters } from './content'
import { mountCrow } from './crow'
import { runLoader } from './loader'
import { initLite } from './lite'
import { initScroll, setScrollLocked } from './scroll'
import { hydrateToken } from './token'

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
document.documentElement.classList.toggle('is-reduced', reduced)

void initLite()
if (new URLSearchParams(location.search).has('debug')) void import('./debug').then((m) => m.initDebug())

// Always start at the top: the intro gate assumes it.
history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

renderChapters(document.getElementById('lore')!)
const mascot = document.querySelector('#mascot .mascot__sway')!
const crow = mountCrow(mascot, 'm', reduced)
// Hover or tap the crow: a happy bounce, plus a caw if the music is on.
const greet = () => crow.caw() && music.chirp()
mascot.querySelector('svg')!.addEventListener('pointerenter', greet)
mascot.querySelector('svg')!.addEventListener('click', greet)
hydrateToken()
initSoundControl()
initCarousel({ reduced, lockScroll: setScrollLocked })
const scroll = initScroll(reduced, crow)

const site = document.getElementById('site')!
runLoader(reduced, (withSound) => {
  site.inert = false
  scroll.enter()
  // Still inside the click, which is what lets browsers (iOS Safari included) start audio.
  music.start(withSound)
})
