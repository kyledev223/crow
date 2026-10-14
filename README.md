# Coupon Crows ($CAW)

A twelve-screen, full-viewport site for a **fictional** community art project. No real token, contract, company or people are involved. Every quote is from a made-up bird.

Each screen is a live 3D scene (Three.js) seen through a pixel / static filter, with the text and buttons on top. Built with Vite, vanilla TypeScript, Three.js and GSAP. The scenes are blockout geometry, the music is generated in the browser, and the fonts are bundled. The only things you supply are the crow images.

## Run it

```bash
npm install
npm run dev       # dev server, http://localhost:5173
npm run dev:phone # same, but reachable from your phone, with a QR code
npm run assets    # turn images in assets-raw/ into transparent crow cutouts
npm run build     # regenerate share images, type-check, build to dist/
npm run preview   # serve the built site
npm run og        # regenerate the share image on its own
```

Needs Node 22.18 or newer.

## The crow images

The crow appears in the scenes as transparent PNG cutouts on planes inside the 3D world, lit by each scene's lights. They live in `public/assets/crow/`. **Any file that is missing is replaced by a dark silhouette of a figure in a suit, labelled with the filename it is waiting for**, so the site always runs.

| File | Pose | Used on |
|---|---|---|
| `crow-hero.png` | Standing, facing the camera | 01 The crow, 11 The memes, 12 Join the flock (and 07 if there is no video) |
| `crow-seated.png` | Seated | 02 Why the name, 05 The interview, 06 Broadcast |
| `crow-stage.png` | Presenting | 03 On stage |
| `crow-phone.png` | Holding a phone | 04 The post |
| `crow-toast.png` | Raising a glass | 08 Cheers |
| `crow-laptop.png` | At a laptop | 09 Ask the crow |
| `crow-coin.png` | Holding a coin | 10 The token |
| `walk.mp4` | Walk cycle filmed on **solid green** | 07 The chart |

### Making them: `npm run assets`

1. Put your source images in `assets-raw/`, named as in the table (`crow-hero.jpg`, `crow-seated.png`, …). Any of png, jpg, webp works; the output is always `.png`.
2. Run `npm run assets`.
3. Each image has its background removed, is trimmed to the figure, shrunk to at most 2048px on its longest side, and saved to `public/assets/crow/` under the same name. `walk.mp4` is copied as it is: its green background is removed live, in the browser.
4. Restart nothing: the dev server reloads when files land in `public/assets/crow/`.

Background removal is done by [rembg](https://github.com/danielgatis/rembg), a Python tool. The first run creates a private Python environment in `.venv-assets/` and installs rembg into it (a few hundred MB, a few minutes), then downloads its model (about 170 MB). Nothing is installed system-wide; delete `.venv-assets/` to get the space back.

- **No Python?** The script says so and stops. Install Python 3.10–3.13 from <https://www.python.org/downloads/> (on Windows, tick "Add python.exe to PATH"), reopen the terminal, run it again.
- **Rather not?** Skip the tool. Any transparent PNG saved straight into `public/assets/crow/` with the right name works.

Tips: full-body, evenly lit shots against a plain background cut out best. For `walk.mp4`, film side-on against an evenly lit pure green; the walker is moved along the chart by the scroll, so a walk-on-the-spot loop is ideal.

Positions, sizes and which pose goes where are set per scene in `src/gl/scenes.ts` (look for `crow(s, 'hero', { … })`; `h` is the height in metres, `flip: true` mirrors it).

## Where things live

```
index.html              canvas, loader, entry screen, site chrome, lightbox
src/
  main.ts               boot order and wiring
  fx-config.ts          EVERY strength for the pixel/static look, in one object
  screens.ts            the twelve screens: names, URL hashes, all the copy
  nav.ts                screen-by-screen navigation (wheel, keys, swipe, rail, hashes)
  boot.ts               loader count → CRT flip → entry screen
  assets.ts             crow asset manifest and the labelled placeholder
  gl/
    engine.ts           renderer, camera, parallax, cursor lens, render loop
    post.ts             the full-screen shader: pixels, dither, grain, scanlines, glitch
    kit.ts              building blocks: materials, props, lights, haze, the crow cutout
    scenes.ts           the twelve 3D scenes, in page order
    ring.ts             the 3D meme ring (drag, inertia, snap)
  cursor.ts             custom cursor ring
  lightbox.ts           meme viewer and the keynote video slot
  config.ts             contract address, links, stats, keynote video
  token.ts              turns config into disabled placeholders or live controls
  audio.ts              generated music, mix and loudness, the corner control
  lite.ts               decides when lite mode is on
  debug.ts              the ?debug overlay
  memes/                the meme list and the drawn placeholder cards
  crow-art.ts           the old SVG mascot, still used for the share image
  style.css             tokens on :root, then one block per piece of UI
scripts/
  assets.mjs, assets.py the `npm run assets` pipeline
  dev-phone.mjs         the `dev:phone` server and QR code
  og.mjs                share image and icons
assets-raw/             your source images go here
public/assets/crow/     the finished cutouts end up here
```

## The twelve screens

| # | Hash | Screen | Scene |
|---|---|---|---|
| 01 | `#crow` | The crow | Centre stage, one spotlight, haze, gold coins on the floor |
| 02 | `#name` | Why the name | Dim office: desk, leather chair, desk lamp, city in the window |
| 03 | `#stage` | On stage | Keynote stage, big screen (click it), audience in silhouette |
| 04 | `#post` | The post | The crow and his phone; a large post card floating beside him |
| 05 | `#interview` | The interview | Two armchairs, a round table, a mic and two waters, a fire |
| 06 | `#broadcast` | Broadcast | News desk, wall of monitors, scrolling ticker, ON AIR light |
| 07 | `#chart` | The chart | A glowing candlestick chart; the crow walks up the line as you scroll |
| 08 | `#cheers` | Cheers | Bar table and glasses, back bar, pendant lamp |
| 09 | `#ask` | Ask the crow | Laptop on a desk; question bubbles float up, more as you scroll |
| 10 | `#token` | The token | A vault door that opens as you scroll, onto stacks of coins |
| 11 | `#memes` | The memes | The meme ring in 3D around the crow: drag, flick, click to open |
| 12 | `#flock` | Join the flock | Rooftop, wires full of crows; join buttons, token panel, disclaimer |

Copy for all of them is in `src/screens.ts`; wrap a phrase in `{{double braces}}` to highlight it in blue.

### Getting around

- **Wheel / trackpad.** Each screen holds for about 1.5 viewport-heights of scrolling, which drives its camera push-in and reveals its text. Keep pushing at the end and a one-second transition carries you to the next screen. Scrolling up does the reverse.
- **Keys.** Arrow down/up and Space step through a screen, then on to the next. Page Down/Up jump a whole screen. Home and End go to the first and last.
- **Touch.** One swipe, one screen; the screen's reveal then plays by itself.
- **Side rail.** Twelve numbered ticks on the right; hover for the name, click to jump. On phones it becomes a strip of dots.
- **Links.** Every screen has a hash (`…/#chart`), so links land on the right screen and the browser's Back and Forward buttons move between screens.

## Tuning the look: `src/fx-config.ts`

Everything about the pixel / static treatment is one object with comments. The ones you will reach for first:

| Setting | What it does |
|---|---|
| `pixelSize` | Block size in CSS pixels (3–4 is the intended look; 1 switches pixelation off) |
| `palette` | The eight colours the 3D picture is reduced to |
| `dither` | 0 = flat bands, 1 = full ordered (Bayer) dithering |
| `exposure`, `contrast` | Brightness and punch before the palette step |
| `grain`, `scanlines`, `vignette` | Animated static, scanline darkness, corner darkening |
| `chroma` | Red/blue fringing toward the edges |
| `glitch` | Strength of the tear on screen transitions |
| `lens.*` | The cursor lens: radius, magnification, bigger blocks, extra fringe, ripple |
| `parallax.*` | How far and how lazily the camera follows the cursor |
| `lite.pixelSize` | Block size in lite mode (bigger = smaller internal render) |
| `dom.*` | The overlay on the text and UI: page static, page scanlines, headline RGB split, headline jitter |

Scene lighting and layout live in `src/gl/scenes.ts`; each scene is a short function, and the `cam` line at the bottom of each sets where the camera starts, where it ends, and what it looks at.

## Going live: contract address, buy buttons, keynote video

Everything is driven by `src/config.ts`:

```ts
contractAddress: null,   // e.g. '0xAbC…123'
buyUrl: null,            // e.g. 'https://…'
explorerUrl: null,       // e.g. 'https://…/token/0xAbC…123'
stageVideoUrl: null,     // e.g. '/keynote.mp4' (file in public/)
```

While a value is `null`, its controls are greyed out, marked `aria-disabled`, show "Coming soon", and do nothing on click. Fill a value in and they activate without further changes:

- `contractAddress` → the address pill turns blue and copies to the clipboard with a "Copied ✓" toast.
- `buyUrl` → every "Buy $CAW" button becomes a real link (opens in a new tab).
- `explorerUrl` → same for every "Explorer" button.
- `stageVideoUrl` → the keynote lightbox on screen 03 plays that video instead of showing a placeholder slot.

The placeholders are on screen 10 (The token) and in the panel on screen 12. `communityUrl` and `followUrl` (the "Join the flock" buttons) are `'#'` for now. Stats in the panel come from `stats` in the same file.

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

The overlay's last line, **SCENE**, shows the current screen and the size the 3D picture is being rendered at (for example `480×300 px3`: a 480×300 picture shown as 3-pixel blocks).

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

`npm run og` (also the first step of `npm run build`) writes `public/og.png` and the home-screen icon. **The share image still shows the earlier drawn crow mascot** (`src/crow-art.ts`), not your new crow-man art; edit `scripts/og.mjs` once the real artwork exists, or replace `public/og.png` by hand with a 1200×630 image and remove `og` from the build script.

Social crawlers need an absolute image URL, which is built from `VITE_SITE_URL`. See "Deploy" above for when you need to set it by hand. With it empty, `og:image` stays relative (`/og.png`), which is fine locally but will not unfurl on most platforms.

## Other things to swap

**Memes.** Drop image files (png, jpg, webp, gif, avif) into `src/memes/`. They are picked up automatically, sorted by filename, and replace the drawn placeholders one for one. Prefix with `01-`, `02-`… to set the order. Add alt text per file in the `ALT` map in `src/memes/index.ts`. Portrait 4:5 images fit the frames best.

**Music.** `src/audio.ts` synthesises three looping tracks. To add or change one, edit the `TRACKS` array (tempo, swing, chords as MIDI notes); its loudness is measured and matched automatically. Overall volume is `LEVEL`.

**Colours and type.** UI colours are tokens at the top of `src/style.css`; the 3D picture's colours are `palette` in `src/fx-config.ts`. Keep the two in step if you change the accent (search for `2f7bff`).

## Behaviour notes

- **Loader and entry.** The loader counts 000 → 100 over heavy static while every scene is drawn once behind it (so nothing stutters later). At 100 the picture collapses to a line and springs open on the live hero scene, where "Enter" and "Enter without sound" wait. Scrolling is locked until one is chosen; audio starts inside that click, as browsers require.
- **Mouse.** The camera leans toward the cursor in every scene. A lens around the cursor magnifies the picture, enlarges its blocks and splits its colours. The cursor ring grows over anything clickable, in the page or in the scene, and goes dashed over disabled controls.
- **Touch.** No lens. The camera drifts slowly on its own, or follows device tilt on browsers that provide it without asking (not iOS).
- **Music.** One chain for all tracks: master gain → gentle compressor → limiter. Tracks are loudness-matched, crossfade on change, fade on mute, and pause while the tab is hidden. On iPhones the page declares itself as media playback so the music plays with the ringer switch on silent.
- **Lite mode.** For the first 1.5 seconds the site times its frames. A median under 30fps turns lite mode on: the 3D picture renders smaller (bigger blocks), colour fringing and the lens ripple are dropped, and the page static stops animating. Pixelation and static stay. If the device then holds 50+ fps for 3 seconds, full quality returns. `?lite=1` and `?lite=0` override this.
- **Reduced motion.** With `prefers-reduced-motion`, there is no scroll-jacking: the twelve screens are an ordinary page that snaps one screen at a time, all copy is simply visible, and there is no lens, no glitch, no jitter and no moving static (still grain only).
- **No WebGL.** The 3D scenes need WebGL 2. Every current browser has it.

## Disclaimer

A fictional community art project. Not affiliated with any company. Nothing here is financial advice.
