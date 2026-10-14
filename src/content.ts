/**
 * Lore chapters. All copy is fiction; every "source" is a made-up bird.
 * `{{double braces}}` mark the phrase that gets the blue highlight.
 */
type Card =
  | { kind: 'quote'; text: string; who: string; role: string }
  | { kind: 'post'; handle: string; where: string; text: string; counts: string[] }
  | { kind: 'define'; term: string; say: string; senses: string[] }
  | { kind: 'ledger'; title: string; rows: [string, string][]; text: string; who: string; role: string }

interface Chapter {
  source: string
  lines: string[]
  body: string
  card: Card
}

export const chapters: Chapter[] = [
  {
    source: 'Field notes, first frost',
    lines: ['NOBODY HAD', 'DRAWN THE CROW.'],
    body: 'Bulls got statues. Bears got headlines. Apes, frogs and dogs all got their turn on the poster. The crow kept sitting on the wire, quietly picking up everything that glittered.',
    card: {
      kind: 'quote',
      text: 'Every flock needs a mascot. Ours was {{sitting on the wire the whole time}}.',
      who: 'Old Magpie',
      role: 'flock elder',
    },
  },
  {
    source: 'A post on The Perch, late autumn',
    lines: ['NAMED BY', 'THE FLOCK.'],
    body: 'Nobody ran a naming contest. Somebody asked a question on a message board for birds, and the replies did the rest before the sun was down.',
    card: {
      kind: 'post',
      handle: 'wire_sitter_09',
      where: 'The Perch · east wire board',
      text: 'what do you call a bird that {{comes back every season for the same coin}}? asking for the whole flock',
      counts: ['214 caws', '61 echoes', '9 shinies'],
    },
  },
  {
    source: 'Open mic at the scarecrow, midwinter',
    lines: ['ANY CROWS IN', 'THE AUDIENCE?'],
    body: 'One bird asked it as a joke. Half the field cawed back. Turns out a lot of us had been collecting quietly and assumed we were the only ones.',
    card: {
      kind: 'quote',
      text: "I don't chase. I {{wait where the shiny things land}}.",
      who: 'A crow on a power line',
      role: 'declined to give a name',
    },
  },
  {
    source: 'The Hedgerow Dictionary, 1st edition',
    lines: ['WE CALL THEM', 'COUPON CROWS.'],
    body: 'The name stuck because it was already true. A coupon is a payout that shows up on schedule. A crow is a bird that remembers exactly where it shows up.',
    card: {
      kind: 'define',
      term: 'coupon crow',
      say: 'koo·pon kroh · noun',
      senses: [
        'A patient collector who {{gathers recurring payouts, coin by coin}}.',
        'Any bird that would rather be early and bored than late and loud.',
      ],
    },
  },
  {
    source: 'Nest ledger, page 1',
    lines: ['COIN', 'BY COIN.'],
    body: 'No heists and no lucky finds. The nest fills up the slow way, one small glint at a time, and every glint gets written down.',
    card: {
      kind: 'ledger',
      title: 'Collected this week',
      rows: [
        ['Bottle cap, dented', 'kept'],
        ['Foil, lightly used', 'kept'],
        ['One coin', 'kept'],
        ['One more coin', 'kept'],
        ['Advice from a gull', 'returned'],
      ],
      text: 'Small and regular {{beats big and maybe}}.',
      who: 'The Night Rook',
      role: 'treasurer of the nest',
    },
  },
  {
    source: 'Carved under the old bridge, undated',
    lines: ['THE NEST', 'REMEMBERS.'],
    body: 'Crows hold a grudge for years and a favour for longer. The flock keeps its own count, and it has never once lost track of a shiny thing.',
    card: {
      kind: 'quote',
      text: 'Gulls shout. Pigeons panic. {{Crows keep receipts}}.',
      who: 'Dame Corvina',
      role: 'keeper of the bottle caps',
    },
  },
]

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const mark = (s: string) => esc(s).replace(/\{\{(.+?)\}\}/g, '<mark>$1</mark>')

export const linesMarkup = (lines: string[]) =>
  lines.map((l) => `<span class="line"><span class="line__in">${esc(l)}</span></span>`).join('')

function cardMarkup(card: Card): string {
  switch (card.kind) {
    case 'quote':
      return `
      <figure class="card card--quote" data-card="quote">
        <span class="card__glyph" aria-hidden="true">“</span>
        <blockquote>${mark(card.text)}</blockquote>
        <figcaption><b>${esc(card.who)}</b>, ${esc(card.role)}</figcaption>
      </figure>`
    case 'post':
      return `
      <article class="card card--post" data-card="post" aria-label="Post by ${esc(card.handle)}">
        <header>
          <span class="card__avatar" aria-hidden="true"></span>
          <span><b>${esc(card.handle)}</b><small>${esc(card.where)}</small></span>
        </header>
        <p>${mark(card.text)}</p>
        <footer>${card.counts.map((c) => `<span>${esc(c)}</span>`).join('')}</footer>
      </article>`
    case 'define':
      return `
      <article class="card card--define" data-card="define">
        <h3>${esc(card.term)}</h3>
        <small>${esc(card.say)}</small>
        <ol>${card.senses.map((s) => `<li><span>${mark(s)}</span></li>`).join('')}</ol>
      </article>`
    case 'ledger':
      return `
      <figure class="card card--ledger" data-card="ledger">
        <small>${esc(card.title)}</small>
        <ul>${card.rows.map(([a, b]) => `<li><span>${esc(a)}</span><span>${esc(b)}</span></li>`).join('')}</ul>
        <blockquote>${mark(card.text)}</blockquote>
        <figcaption><b>${esc(card.who)}</b>, ${esc(card.role)}</figcaption>
      </figure>`
  }
}

export function renderChapters(host: HTMLElement): void {
  host.innerHTML = chapters
    .map((c, i) => {
      const side = i % 2 === 0 ? 'left' : 'right'
      return `
    <section class="chapter chapter--${side}" data-chapter="${i + 1}" data-pose="${side === 'left' ? 'crowRight' : 'crowLeft'}">
      <div class="chapter__inner">
        <p class="eyebrow"><span>Lore · Chapter ${i + 1}</span><span class="slashes" aria-hidden="true">//////</span><span>${esc(c.source)}</span></p>
        <h2 class="display">${linesMarkup(c.lines)}</h2>
        <div class="chapter__body">
          <p class="chapter__text">${esc(c.body)}</p>
          ${cardMarkup(c.card)}
        </div>
      </div>
    </section>`
    })
    .join('')
}
