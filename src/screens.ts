import gsap from 'gsap'

/**
 * The twelve screens: their names, URL hashes and copy. All of it is fiction;
 * every person quoted is a made-up bird. `{{double braces}}` mark the phrase
 * that gets the blue highlight. The matching 3D scenes are in gl/scenes.ts,
 * in the same order.
 */
export interface ScreenDef {
  /** URL hash and element id. */
  id: string
  /** Shown in the side nav and the corner label. */
  name: string
  /** Which side the copy sits on (the crow takes the other). */
  side: 'left' | 'right' | 'center'
  html: string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const mark = (s: string) => esc(s).replace(/\{\{(.+?)\}\}/g, '<mark>$1</mark>')
const lines = (...l: string[]) => l.map((t) => `<span class="line"><span class="line__in">${esc(t)}</span></span>`).join('')
const eyebrow = (n: number, title: string, source: string) =>
  `<p class="eyebrow" data-in><span>${String(n).padStart(2, '0')} — ${esc(title)}</span><span class="slashes" aria-hidden="true">//////</span><span>${esc(source)}</span></p>`
const head = (...l: string[]) => `<h2 class="display" data-split="${esc(l.join(' '))}">${lines(...l)}</h2>`
const text = (s: string) => `<p class="screen__text" data-scrub>${esc(s)}</p>`
const quote = (q: string, who: string, role: string) => `
  <figure class="card card--quote" data-scrub>
    <span class="card__glyph" aria-hidden="true">“</span>
    <blockquote>${mark(q)}</blockquote>
    <figcaption><b>${esc(who)}</b>, ${esc(role)}</figcaption>
  </figure>`

export const SCREENS: ScreenDef[] = [
  {
    id: 'crow',
    name: 'The crow',
    side: 'center',
    html: `
      <p class="eyebrow hero__eyebrow" data-after-enter><span>01 — THE CROW</span><span class="slashes" aria-hidden="true">//////</span><span>Collecting shiny returns.</span></p>
      <h1 class="hero__title display" aria-label="Coupon Crow" data-split="COUPON CROW"><span class="hero__word" aria-hidden="true">COUPON</span> <span class="hero__word" aria-hidden="true">CROW</span></h1>
      <p class="hero__lede" data-scrub>Every flock needs a mascot. Nobody had drawn the crow. So we put him in a suit.</p>
      <p class="hero__scroll" data-after-enter>Scroll to follow the glint <span class="scrollcue" aria-hidden="true"><i></i></span></p>`,
  },
  {
    id: 'name',
    name: 'Why the name',
    side: 'left',
    html: `
      ${eyebrow(2, 'WHY THE NAME', 'Corner office, after hours')}
      ${head('PAID ON', 'SCHEDULE.')}
      ${text('A coupon is a payout that turns up when it said it would. A crow is a bird that remembers exactly where. Put the two behind one desk and you get a very patient collector.')}
      ${quote("I don't chase. I {{wait where the shiny things land}}.", 'Corvus Black', 'flock elder')}`,
  },
  {
    id: 'stage',
    name: 'On stage',
    side: 'left',
    html: `
      ${eyebrow(3, 'ON STAGE', 'The Hedgerow Hall keynote')}
      ${head('ANY CROWS IN', 'THE AUDIENCE?')}
      ${text('First keynote. Full house. One slide. He asked the question as a joke and half the room cawed back.')}
      <div class="screen__actions" data-scrub>
        <button class="btn btn--primary" type="button" data-open-video>Play the keynote</button>
        <span class="note">or click the big screen</span>
      </div>
      ${quote('We have one announcement. {{We are still collecting.}}', 'The Crow', 'reading his only slide')}`,
  },
  {
    id: 'post',
    name: 'The post',
    side: 'left',
    html: `
      ${eyebrow(4, 'THE POST', 'The Perch, late autumn')}
      ${head('NAMED BY', 'THE FLOCK.')}
      ${text('Nobody ran a naming contest. One bird asked one question on a message board for birds, and the replies had settled it before the sun went down.')}
      <article class="card card--post" data-scrub aria-label="Post by wire_sitter_09">
        <header>
          <span class="card__avatar" aria-hidden="true"></span>
          <span><b>wire_sitter_09</b><small>The Perch · east wire board</small></span>
        </header>
        <p>${mark('what do you call a bird that {{comes back every season for the same coin}}? asking for the flock')}</p>
        <footer><span>214 caws</span><span>61 echoes</span><span>9 shinies</span></footer>
      </article>`,
  },
  {
    id: 'interview',
    name: 'The interview',
    side: 'right',
    html: `
      ${eyebrow(5, 'THE INTERVIEW', 'Hedgerow Tonight, episode 1')}
      ${head('NO FURTHER', 'QUESTIONS.')}
      ${text('The host asked how he does it. He looked at the coin. Then at the host. Then back at the coin. The host has not been seen in that chair since.')}
      <article class="card card--qa" data-scrub>
        <p><small>Marla Finch, host</small>So what is the strategy?</p>
        <p><small>Corvus Black</small>${mark('{{Small and regular beats big and maybe.}}')}</p>
      </article>`,
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    side: 'left',
    html: `
      ${eyebrow(6, 'BROADCAST', 'Wire News, top of the hour')}
      ${head('BREAKING:', 'CROW FINDS COIN.')}
      ${text('They cut into the weather for it. Markets were described as shiny, with a chance of foil toward the evening.')}
      ${quote('Sources close to the nest {{confirm it is a coin}}.', 'Dale Rook', 'Wire News anchor')}`,
  },
  {
    id: 'chart',
    name: 'The chart',
    side: 'left',
    html: `
      ${eyebrow(7, 'THE CHART', 'Drawn by hand, not by a market')}
      ${head('UP, AND', 'TO THE RIGHT.')}
      ${text('This chart is a drawing. It goes up because we drew it going up. The crow just likes the walk.')}
      <figure class="card card--note" data-scrub>
        <blockquote>${mark('Illustration only. {{Not a forecast}}, not a promise, not advice.')}</blockquote>
        <figcaption><b>The small print</b>, in full</figcaption>
      </figure>`,
  },
  {
    id: 'cheers',
    name: 'Cheers',
    side: 'left',
    html: `
      ${eyebrow(8, 'CHEERS', 'The Wire, last orders')}
      ${head('TO SMALL', 'SHINY THINGS.')}
      ${text('One round for the flock, one coin for the nest. He tips in bottle caps, and the staff have stopped arguing about it.')}
      ${quote('Gulls shout. Pigeons panic. {{Crows keep receipts}}.', 'Dame Corvina', 'keeper of the bottle caps')}`,
  },
  {
    id: 'ask',
    name: 'Ask the crow',
    side: 'right',
    html: `
      ${eyebrow(9, 'ASK THE CROW', 'Inbox: 4,112 unread')}
      ${head('ASK HIM', 'ANYTHING.')}
      ${text('He reads every question. He answers the ones about coins.')}
      <dl class="card card--faq" data-scrub>
        <div><dt>Wen coin?</dt><dd>When the flock is ready. Not before.</dd></div>
        <div><dt>Is this financial advice?</dt><dd>It is a bird.</dd></div>
        <div><dt>Why the suit?</dt><dd>${mark('{{Collecting is formal work.}}')}</dd></div>
      </dl>`,
  },
  {
    id: 'token',
    name: 'The token',
    side: 'left',
    html: `
      ${eyebrow(10, 'THE TOKEN', 'Concept only')}
      ${head('HOLD $CAW.', 'COLLECT', 'SHINY THINGS.')}
      ${text('$CAW is a community token concept: a mascot, a running joke about patience, and a flock that likes things that glitter. There is no contract yet and nothing to buy. When there is, these buttons wake up.')}
      <div class="screen__actions" data-scrub>
        <span class="slot" data-buy></span>
        <span class="slot" data-explorer></span>
        <span class="slot" data-ca></span>
      </div>`,
  },
  {
    id: 'memes',
    name: 'The memes',
    side: 'center',
    html: `
      <div class="memes__head">
        ${eyebrow(11, 'THE MEMES', 'Made on the wire')}
        ${head('CROWS AT WORK.')}
      </div>
      <button class="ringkeys" type="button" id="ringKeys" aria-roledescription="carousel"
        aria-label="Meme carousel. Left and right arrow keys turn it one frame. Enter opens the meme at the front." data-scrub>
        ⟵ ⟶ Drag to turn the memes · click one to open it
      </button>`,
  },
  {
    id: 'flock',
    name: 'Join the flock',
    side: 'left',
    html: `
      ${eyebrow(12, 'JOIN THE FLOCK', 'Open perch')}
      ${head('JOIN THE', 'FLOCK.')}
      ${text("Bring a shiny thing or a meme. Ideally both. There's room on the wire.")}
      <div class="screen__actions" data-scrub>
        <a class="btn btn--primary" data-href="community" href="#">Join the community</a>
        <a class="btn" data-href="follow" href="#">Follow the flock</a>
      </div>
      <div class="panel" data-scrub>
        <div class="panel__ca">
          <span class="panel__label">Contract address</span>
          <span class="slot" data-ca="full"></span>
          <span class="slot" data-explorer></span>
          <span class="slot" data-buy></span>
        </div>
        <dl class="stats" id="stats"></dl>
        <p class="panel__disclaimer">A fictional community art project. Not affiliated with any company. Nothing here is financial advice.</p>
        <p class="panel__sign"><span class="slashes" aria-hidden="true">//////</span> Coupon Crows · drawn by the flock</p>
      </div>`,
  },
]

export interface ScreenView {
  def: ScreenDef
  el: HTMLElement
  /** Plays once when the screen arrives: label and headline. */
  intro: gsap.core.Timeline | null
  /** Driven by scroll progress, 0–1: paragraph, cards, buttons. */
  scrub: gsap.core.Timeline | null
}

export function renderScreens(host: HTMLElement, reduced: boolean): ScreenView[] {
  host.innerHTML = SCREENS.map(
    (s, i) => `
    <section class="screen screen--${s.side} screen--${s.id}" id="${s.id}" data-screen="${i}" aria-label="${esc(s.name)}">
      <div class="screen__copy">${s.html}</div>
    </section>`,
  ).join('')

  return SCREENS.map((def, i) => {
    const el = host.children[i] as HTMLElement
    if (i === 0) {
      el.querySelectorAll<HTMLElement>('.hero__word').forEach((word) => {
        word.innerHTML = [...word.textContent!].map((ch) => `<span class="ch">${ch}</span>`).join('')
      })
    }
    if (reduced) return { def, el, intro: null, scrub: null }

    const intro = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } })
    const label = el.querySelectorAll('[data-in]')
    if (label.length) intro.from(label, { autoAlpha: 0, y: 12, duration: 0.45 }, 0)
    const rising = el.querySelectorAll('.line__in, .ch')
    if (rising.length) intro.from(rising, { yPercent: 115, duration: 0.85, stagger: i === 0 ? 0.04 : 0.09 }, 0.05)

    // Each [data-scrub] block arrives in turn as scroll progress goes 0 → 1.
    const scrub = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } })
    const blocks = el.querySelectorAll('[data-scrub]')
    const span = 0.7 / Math.max(1, blocks.length)
    blocks.forEach((b, n) => scrub.from(b, { autoAlpha: 0, y: 28, duration: Math.min(0.3, span * 1.4) }, 0.08 + n * span))
    scrub.to({}, { duration: Math.max(0.001, 1 - scrub.duration()) })
    return { def, el, intro, scrub }
  })
}
