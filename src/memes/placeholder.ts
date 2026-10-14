/**
 * Placeholder meme cards, generated as inline SVG so they use the page fonts.
 * Delete this file's entries from index.ts once real images are in.
 */
interface Scheme {
  bg: string
  fg: string
  acc: string
  dim: string
}

const SCHEMES: Scheme[] = [
  { bg: '#050818', fg: '#EDEEF2', acc: '#2F7BFF', dim: '#18244D' },
  { bg: '#2F7BFF', fg: '#020308', acc: '#EDEEF2', dim: '#1F5FD6' },
  { bg: '#EDEEF2', fg: '#020308', acc: '#2F7BFF', dim: '#C9D1E4' },
  { bg: '#0B1B45', fg: '#EDEEF2', acc: '#7FB0FF', dim: '#16306E' },
]

type Motif = 'wire' | 'coin' | 'eye' | 'stack' | 'head'

export interface PlaceholderSpec {
  top: string[]
  bottom: string
  motif: Motif
  scheme: number
}

const star = (x: number, y: number, r: number, fill: string) =>
  `<path d="M${x} ${y - r} l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28} -${r * 0.72} ${r * 0.28} -${r * 0.28} ${r * 0.72} -${r * 0.28} -${r * 0.72} -${r * 0.72} -${r * 0.28} ${r * 0.72} -${r * 0.28} Z" fill="${fill}"/>`

/** Small crow silhouette; (x, y) is where the feet touch down. */
const bird = (x: number, y: number, s: number, fill: string, eye: string) => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="${fill}">
    <path d="M-14 -20 L-58 -2 L-48 8 L-6 -8 Z"/>
    <ellipse cx="0" cy="-26" rx="27" ry="20" transform="rotate(-22 0 -26)"/>
    <circle cx="19" cy="-52" r="16"/>
    <path d="M31 -60 L60 -50 L31 -43 Z"/>
    <path d="M-6 -8 v8 M8 -8 v8" stroke="${fill}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="24" cy="-55" r="4" fill="${eye}"/>
  </g>`

function art(motif: Motif, c: Scheme): string {
  switch (motif) {
    case 'wire':
      return `
        <path d="M-10 318 Q200 348 410 318" fill="none" stroke="${c.fg}" stroke-width="4"/>
        ${bird(96, 326, 1.15, c.fg, c.acc)}
        ${bird(206, 334, 1.5, c.fg, c.acc)}
        <g transform="translate(640 0) scale(-1 1)">${bird(322, 328, 1.05, c.fg, c.acc)}</g>
        ${star(318, 196, 26, c.acc)}`
    case 'coin':
      return `
        <circle cx="200" cy="286" r="112" fill="${c.fg}"/>
        <circle cx="200" cy="286" r="88" fill="none" stroke="${c.acc}" stroke-width="5"/>
        <text x="200" y="312" text-anchor="middle" font-size="76" fill="${c.bg}">CAW</text>
        ${star(292, 196, 40, c.acc)}`
    case 'eye':
      return `
        <circle cx="200" cy="290" r="118" fill="${c.fg}"/>
        <circle cx="212" cy="294" r="72" fill="${c.acc}"/>
        <circle cx="218" cy="296" r="36" fill="${c.bg}"/>
        <circle cx="238" cy="270" r="13" fill="${c.fg}"/>
        <path d="M60 180 L340 232 L340 196 L60 150 Z" fill="${c.bg}"/>`
    case 'stack': {
      const heights = [1, 2, 4, 6]
      const stacks = heights
        .map((h, i) =>
          Array.from({ length: h }, (_, j) => {
            const x = 74 + i * 84
            const y = 396 - j * 24
            return `<rect x="${x - 34}" y="${y - 18}" width="68" height="18" rx="5" fill="${j % 2 ? c.acc : c.fg}"/>`
          }).join(''),
        )
        .join('')
      return `${stacks}${bird(326, 256, 1.05, c.fg, c.acc)}`
    }
    case 'head':
      return `
        <circle cx="96" cy="300" r="150" fill="${c.fg}"/>
        <path d="M206 232 Q318 250 372 306 L214 318 Z" fill="${c.fg}"/>
        <path d="M216 326 L330 322 L220 356 Z" fill="${c.fg}"/>
        <circle cx="352" cy="318" r="30" fill="${c.acc}"/>
        <circle cx="352" cy="318" r="18" fill="none" stroke="${c.bg}" stroke-width="3"/>
        <circle cx="150" cy="262" r="30" fill="${c.bg}"/>
        <circle cx="156" cy="264" r="15" fill="${c.acc}"/>
        ${star(382, 268, 22, c.acc)}`
  }
}

export function placeholderSvg(spec: PlaceholderSpec, n: number): string {
  const c = SCHEMES[spec.scheme % SCHEMES.length]
  const id = String(n).padStart(2, '0')
  const top = spec.top
    .map((line, i) => `<text x="24" y="${102 + i * 56}" font-size="56" fill="${c.fg}">${line}</text>`)
    .join('')
  return `
<svg viewBox="0 0 400 500" role="img" aria-label="${[...spec.top, spec.bottom].join(' ')}" preserveAspectRatio="xMidYMid slice" font-family="Anton, Impact, sans-serif">
  <rect width="400" height="500" fill="${c.bg}"/>
  <g>${art(spec.motif, c)}</g>
  <text x="24" y="38" font-family="'JetBrains Mono', monospace" font-size="13" letter-spacing="1" fill="${c.fg}" opacity=".7">////// CAW-${id}</text>
  ${top}
  <rect x="0" y="424" width="400" height="76" fill="${c.bg}"/>
  <rect x="24" y="424" width="352" height="2" fill="${c.fg}" opacity=".35"/>
  <text x="24" y="468" font-size="27" fill="${c.fg}">${spec.bottom}</text>
</svg>`
}
