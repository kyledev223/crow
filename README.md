# Coupon Crows ($CAW)

A single-page, scroll-driven landing site for a **fictional** community art project. No real token, contract, company or people are involved. Every quote is from a made-up bird.

Built with Vite, vanilla TypeScript, GSAP + ScrollTrigger and Lenis. The mascot, the meme cards, the favicon, the share image and the music are all generated in code, and the fonts are bundled, so the site runs with no external assets.

## Run it

```bash
npm install
npm run dev       # dev server, http://localhost:5173
npm run dev:phone # same, but reachable from your phone, with a QR code
npm run build     # regenerate images, type-check, build to dist/
npm run preview   # serve the built site
npm run og        # regenerate the generated images on their own
```

Needs Node 22.18 or newer (the image script imports a `.ts` file directly).

## Where things live

```
index.html            page structure and share/meta tags
.env                  VITE_SITE_URL, the public origin used in share-image URLs
vite.config.js        fills VITE_SITE_URL from the host when .env leaves it empty
netlify.toml          build settings for Netlify
scripts/og.mjs        renders the generated images in public/
scripts/dev-phone.mjs the `dev:phone` server and QR code
public/
  favicon.svg           crow glyph (also the avatar on the "post" card)
  og.png                generated: 1200×630 share image
  apple-touch-icon.png  generated: 180×180 home-screen icon
  frame-back-soft.png   generated: pre-blurred carousel card back
src/
  main.ts             boot order
  config.ts           contract address, buy/explorer links, community links, stats
  token.ts            turns config into disabled placeholders or live controls
  content.ts          the six lore chapters (copy + card type)
  crow-art.ts         the mascot SVG (no imports; shared with scripts/og.mjs)
  crow.ts             mascot animation: idle, hop, caw, random actions
  scroll.ts           Lenis, chapter pinning and reveals, mascot poses, progress
  loader.ts           the 000 → 100 intro gate
  lite.ts             decides when lite mode is on
  debug.ts            the ?debug overlay (loaded only when asked for)
  audio.ts            generated music, mix and loudness, the corner control
  carousel.ts         3D meme ring: drag, snap, depth shading, lightbox
  memes/
    index.ts          the meme list the carousel reads
    placeholder.ts    generated SVG placeholder cards
  style.css           design tokens on :root, then one block per section
```

## Going live: contract address and buy buttons

Everything is driven by `src/config.ts`:

```ts
contractAddress: null,   // e.g. '0xAbC…123'
buyUrl: null,            // e.g. 'https://…'
explorerUrl: null,       // e.g. 'https://…/token/0xAbC…123'
```

While a value is `null`, its controls are greyed out, marked `aria-disabled`, show "Coming soon", and do nothing on click. Fill a value in and they activate without further changes:

- `contractAddress` → the address pill turns blue and copies to the clipboard with a "Copied ✓" toast.
- `buyUrl` → every "Buy $CAW" button becomes a real link (opens in a new tab).
- `explorerUrl` → same for every "Explorer" button.

`communityUrl` and `followUrl` (the "Join the flock" buttons) are `'#'` for now. Stats in the footer panel come from `stats` in the same file.

## Test on a phone

1. Put the phone on the **same Wi-Fi** as this computer.
2. Run `npm run dev:phone`. It prints a QR code and an address like `http://192.168.x.x:5173/`.
3. Scan the QR code with the phone's camera and open the link. It opens with the debug overlay on.

If the page does not load on the phone:

- **VPN.** A VPN on the computer (NordVPN, for example) usually hides it from other devices on the Wi-Fi. Pause the VPN, or turn on its "allow LAN access" / turn off its "invisibility on LAN" setting, and restart `npm run dev:phone`.
- **Windows Firewall.** The first time Node listens on the network, Windows shows "Windows Security Alert: allow Node.js JavaScript Runtime?". Tick both **Private** and **Public** networks and choose **Allow access**. If you dismissed it, or it never appeared:
  1. Press Start, type **Allow an app through Windows Firewall**, open it.
  2. Click **Change settings**.
  3. Find **Node.js JavaScript Runtime** in the list. Tick the box on its left, and tick the column that matches your Wi-Fi (**Public** if Windows treats the Wi-Fi as a public network, which is the default; otherwise **Private**). If there are several Node.js rows, do the same for each.
  4. If Node.js is not listed: **Allow another app…** → **Browse…** → `C:\Program Files\nodejs\node.exe` → **Add**, then tick the columns as above.
  5. Click **OK** and restart `npm run dev:phone`.

  The same thing as one command, in a PowerShell window opened with "Run as administrator" (remove it later with `Remove-NetFirewallRule -DisplayName "Coupon Crows dev server"`):

  ```powershell
  New-NetFirewallRule -DisplayName "Coupon Crows dev server" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Private,Public
  ```
- **Guest Wi-Fi.** Guest networks and some routers keep devices from seeing each other ("client isolation"). Use the main network.

The phone loads the site over plain `http`, which is fine for everything here. Copy-to-clipboard (once a contract address is set) needs `https`, so test that on the deployed site.

## Debug overlay and URL switches

Add these to any URL, local or deployed:

| URL | What it does |
|---|---|
| `?debug` | Corner overlay: live FPS, whether lite mode is on and why, audio state, current track |
| `?lite=1` | Forces lite mode on |
| `?lite=0` | Forces lite mode off |
| `?debug&lite=0` | Combine them with `&` |

In the overlay, **AUDIO** reads `not created yet` until sound is switched on, then `running` or `suspended`, followed by how the page asked the phone to treat its sound: `audioSession: playback` (Safari 17+), `silent <audio> loop` (older iOS), or `default session` (everything else).

## Deploy

The site is plain static files. `npm run build` puts everything in `dist/`.

### Netlify, drag and drop (no Git needed)

1. In this folder, run `npm install` once, then `npm run build`.
2. Go to <https://app.netlify.com/drop> and sign up or log in.
3. Drag the `dist` folder from File Explorer onto the page. Netlify gives the site an address like `https://something-random-123.netlify.app`. (Rename it under **Site configuration → Change site name** if you like.)
4. Make the share card work. Open the file `.env` in this folder with Notepad and put the address after the `=`, with no slash at the end:
   ```
   VITE_SITE_URL=https://your-site-name.netlify.app
   ```
5. Run `npm run build` again.
6. In Netlify, open the site's **Deploys** tab and drag the new `dist` folder onto it.

Repeat steps 5 and 6 whenever you change the site. If you later add your own domain, put that in `.env` instead and rebuild.

### Netlify or Vercel from a Git repository (rebuilds on every push)

1. Put this folder in a GitHub repository.
2. **Netlify:** Add new site → Import an existing project → pick the repository → Deploy. The settings come from `netlify.toml`.
   **Vercel:** Add New → Project → pick the repository → Deploy. It detects Vite on its own and needs no config file.
3. Nothing to set for the share card: the build picks up the site's address from the host automatically, including a custom domain once you add one and redeploy. To override it, add an environment variable named `VITE_SITE_URL` in the host's settings.

### After deploying

- Open the site on a phone and on a desktop.
- Paste the address into a chat app or a share-card checker to confirm the image appears. If it does not, view the page source and check that `og:image` starts with `https://`.

## Share image and meta tags

`npm run og` (also the first step of `npm run build`) writes `public/og.png` from the real mascot artwork and the bundled fonts, so it always matches the site. Edit the layout in `scripts/og.mjs`.

Social crawlers need an absolute image URL, which is built from `VITE_SITE_URL`. See "Deploy" above for when you need to set it by hand. With it empty, `og:image` stays relative (`/og.png`), which is fine locally but will not unfurl on most platforms.

During `npm run build` the image step is optional: if it cannot run on a build host, the build carries on with the images already in `public/`.

## Swapping in real assets

**Memes.** Drop image files (png, jpg, webp, gif, avif) into `src/memes/`. They are picked up automatically, sorted by filename, and replace the generated placeholders one for one. Prefix with `01-`, `02-`… to set the order. Add alt text per file in the `ALT` map in `src/memes/index.ts`. Portrait 4:5 images fit the frames best. Once all ten are real, the `PLACEHOLDERS` list and `placeholder.ts` can go.

**Mascot.** `crowMarkup()` in `src/crow-art.ts` returns the SVG. Replace the artwork and keep the group class names listed at the top of that file (`crow-hop`, `crow-bird`, `crow-wing`, `crow-head`, `crow-turn`, `crow-beakcoin`, `crow-lid`, the two glints) so the animation in `crow.ts` still has parts to move. Pivot points are SVG coordinates set at the top of `animateCrow()`; adjust them if the proportions change. Run `npm run og` afterwards to refresh the share image.

**Music.** `src/audio.ts` synthesises three looping tracks. To add or change one, edit the `TRACKS` array (tempo, swing, chords as MIDI notes); its loudness is measured and matched automatically. Overall volume is `LEVEL`. To use audio files instead, keep the exported `music` object's surface (`start`, `setMuted`, `toggle`, `next`, `prev`, `onChange`, `chirp`) and back it with an `<audio>` element.

**Copy.** Lore chapters are in `src/content.ts`; wrap a phrase in `{{double braces}}` to highlight it in blue. Everything else is in `index.html`.

**Colours and type.** Tokens are at the top of `src/style.css` (`--accent`, `--accent-soft`, `--accent-glow`, `--bg`, `--ink`, the three font stacks). The mascot, the placeholder memes and `scripts/og.mjs` hard-code the same blue, so search for `2F7BFF` if you change the accent.

## Behaviour notes

- **Gate.** Scrolling is locked until the visitor picks "Enter" or "Enter without sound". The audio context is created inside that click (or inside the first click on the music toggle), as browsers require. If a browser has no Web Audio, the site still opens and the music control reads "No audio here".
- **Music.** All tracks share one chain: master gain → gentle compressor → limiter. Each track is rendered offline at startup, its loudness measured, and its gain trimmed so the three match. Track changes crossfade over 1.2s, mute and unmute fade over 0.6s, and the music pauses while the tab is hidden. In dev, `await __music.levels()` in the console prints the measured levels.
- **Mascot.** It hops and flaps when the section changes, does one random idle action (preen, look back, coin toss) every 6–10 seconds, and bounces when hovered or tapped, with a small caw if the music is on. Only one action runs at a time.
- **Carousel.** A flick coasts at most a third of a turn and settles on the nearest frame. Left and right arrow keys turn it one frame when it has focus. Back frames dim and soften using opacity only.
- **Pinning.** Lore chapters pin on screens with room for a whole chapter (desktop at 600px+ tall, phones at 700px+ tall). Smaller screens get the same reveals without pinning.
- **Lite mode.** For the first 1.5 seconds the site times its frames (skipping the first few). A median under 30fps adds `is-lite` to `<html>`, which fades out the film grain and the larger glow layers. If the device then holds 50+ fps for 3 seconds, they fade back in; if that drags it under 30 again, lite mode returns and stays for the visit. `?lite=1` and `?lite=0` override all of this.
- **iPhone silent switch.** iPhones mute web-page sound effects when the ringer switch is on silent. When the music starts, the page declares itself as media playback (the Audio Session API on Safari 17+, a looping silent `<audio>` element on older iOS), so the music plays regardless. As with any music app, this can pause other audio playing on the phone. Other browsers skip this step.
- **Reduced motion.** `prefers-reduced-motion` turns off smooth scrolling, pinning, carousel auto-rotate, film grain, and every mascot animation except the blink. Content is simply visible.

## Disclaimer

A fictional community art project. Not affiliated with any company. Nothing here is financial advice.
