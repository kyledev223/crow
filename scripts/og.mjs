/**
 * Renders the share image and the iOS home-screen icon.
 *
 *   npm run og                 (also runs as part of `npm run build`)
 *
 *   public/og.png                1200×630, mascot + headline in the site style
 *   public/apple-touch-icon.png  180×180, from public/favicon.svg
 *   public/frame-back-soft.png   pre-blurred back of a carousel card (see the
 *                                depth note in src/style.css)
 *
 * The mascot comes straight from src/crow-art.ts, so the image always matches
 * the site. Text is converted to outlines from the bundled fonts, which keeps
 * the result identical on every machine. Needs Node 22.18+ (it imports a .ts
 * file directly).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/**
 * With --optional (how `npm run build` calls it), a failure here is not fatal
 * as long as the images already exist: they are checked in, and a build host
 * that cannot run the renderer should still be able to ship the site.
 */
try {
  await generate()
} catch (err) {
  const have = ['og.png', 'apple-touch-icon.png', 'frame-back-soft.png'].every((f) => existsSync(resolve(root, 'public', f)))
  if (!process.argv.includes('--optional') || !have) throw err
  console.warn(`og.mjs: could not regenerate images (${err.message}). Using the existing files in public/.`)
}

async function generate() {
  const { Resvg } = await import('@resvg/resvg-js')
  const { default: opentype } = await import('opentype.js')
  const { crowMarkup } = await import('../src/crow-art.ts')

  const font = (pkg, file) => {
    const buf = readFileSync(resolve(root, 'node_modules/@fontsource', pkg, 'files', file))
    return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  }
  const anton = font('anton', 'anton-latin-400-normal.woff')
  const mono = font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff')
  const sans = font('instrument-sans', 'instrument-sans-latin-500-normal.woff')

  const INK = '#EDEEF2'
  const ACCENT = '#2F7BFF'
  const BG = '#020308'

  /**
   * Text as an outlined <path>. Glyphs are placed one by one (advance, kerning,
   * tracking in em) because opentype.js cannot run every font's substitution
   * tables. `anchor: 'end'` right-aligns to x.
   */
  function text(f, str, x, y, size, fill, { anchor = 'start', tracking = 0, opacity = 1 } = {}) {
    const scale = size / f.unitsPerEm
    const glyphs = [...str].map((ch) => f.charToGlyph(ch))
    const advances = glyphs.map(
      (g, i) => (g.advanceWidth + (glyphs[i + 1] ? f.getKerningValue(g, glyphs[i + 1]) : 0)) * scale + tracking * size,
    )
    let pen = anchor === 'end' ? x - advances.reduce((a, b) => a + b, 0) : x
    const d = glyphs
      .map((g, i) => {
        const path = g.getPath(pen, y, size).toPathData(2)
        pen += advances[i]
        return path
      })
      .join('')
    return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`
  }

  const W = 1200
  const H = 630
  const og = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="g1" cx="76%" cy="62%" r="46%">
        <stop offset="0" stop-color="${ACCENT}" stop-opacity=".42"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g2" cx="8%" cy="110%" r="60%">
        <stop offset="0" stop-color="${ACCENT}" stop-opacity=".3"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="${BG}"/>
    <rect width="${W}" height="${H}" fill="url(#g2)"/>
    <rect width="${W}" height="${H}" fill="url(#g1)"/>
    <rect x="24.5" y="24.5" width="${W - 49}" height="${H - 49}" fill="none" stroke="${INK}" stroke-opacity=".14"/>

    ${text(mono, '//////', 64, 88, 22, ACCENT, { tracking: -0.08 })}
    ${text(mono, 'COUPON CROWS', 150, 88, 22, INK, { tracking: 0.06 })}
    ${text(mono, '$CAW', W - 64, 88, 22, INK, { anchor: 'end', tracking: 0.06, opacity: 0.66 })}

    ${text(anton, 'COUPON', 58, 318, 214, INK)}
    ${text(anton, 'CROWS', 58, 508, 214, INK)}

    <rect x="64" y="545" width="56" height="3" fill="${ACCENT}"/>
    ${text(sans, 'Collecting shiny returns.', 138, 558, 34, INK)}

    <svg x="672" y="92" width="480" height="502" viewBox="0 0 440 460">${crowMarkup('og', true).replace(/<svg[^>]*>|<\/svg>/g, '')}</svg>
  </svg>`

  const png = (svg, opts = {}) => new Resvg(svg, { font: { loadSystemFonts: false }, ...opts }).render().asPng()

  writeFileSync(resolve(root, 'public/og.png'), png(og))
  writeFileSync(
    resolve(root, 'public/apple-touch-icon.png'),
    png(readFileSync(resolve(root, 'public/favicon.svg'), 'utf8'), {
      fitTo: { mode: 'width', value: 180 },
      background: BG,
    }),
  )
  // The back of a meme card, blurred. Keep the colours in step with
  // .frame__back-sharp in src/style.css. The 12-unit margin leaves room for the
  // blur to spread; the CSS insets the layer by the same proportion.
  const cardBack = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 224 274">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#0d1a40"/><stop offset="1" stop-color="#04060f"/></linearGradient>
      <filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.6"/></filter>
    </defs>
    <g filter="url(#b)">
      <rect width="200" height="250" rx="3" fill="url(#g)" stroke="${INK}" stroke-opacity=".28"/>
      <path d="M79 133l6-16M87 133l6-16M95 133l6-16M103 133l6-16M111 133l6-16M119 133l6-16" stroke="${ACCENT}" stroke-width="1.6"/>
    </g>
  </svg>`
  writeFileSync(resolve(root, 'public/frame-back-soft.png'), png(cardBack, { fitTo: { mode: 'width', value: 336 } }))

  console.log('wrote public/og.png (1200×630) public/apple-touch-icon.png (180×180) and public/frame-back-soft.png')
}
