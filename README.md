# Coupon Crows ($CAW)

A twelve-screen, full-viewport site for a **fictional** community art project. No real token, contract, company or people are involved. Every quote is from a made-up bird.

Each screen is a photo backplate rebuilt in 3D from its depth map, with the crow composited onto its floor and a few live layers, all seen through a pixel / dither filter. The site opens on a particle field. Built with Vite, vanilla TypeScript, Three.js and GSAP. The music is generated in the browser and the fonts are bundled.

## Run it

```bash
npm install
npm run dev       # dev server, http://localhost:5173
npm run dev:phone # same, but reachable from your phone, with a QR code
npm run assets    # prepare everything in assets-raw/ for the site (see below)
npm run build     # regenerate share images, type-check, build to dist/
npm run preview   # serve the built site
npm run og        # regenerate the share image on its own
```

Needs Node 22.18 or newer.

## Assets

Everything visual you supply goes in `assets-raw/`. `npm run assets` turns it into what the site loads, in `public/assets/`. Nothing is ever pre-pixelated: the filter runs over the finished picture in the browser.

| In `assets-raw/` | Becomes | Used on |
|---|---|---|
| `bg-01` … `bg-12` (png or jpg) | `public/assets/bg/bg-NN.jpg` + `bg-NN-depth.png` | One backplate per screen, in order |
| `crow-hero.png` | `public/assets/crow/crow-hero.png` (background removed) | Every screen without its own pose yet |
| `crow-seated.png` | same, cut out | 02 office, 05 interview, 06 broadcast (in the chair) |
| `crow-stage.png` | same | 03 on stage |
| `crow-phone.png` | same | 04 the post |
| `crow-toast.png` | same | 08 cheers |
| `crow-laptop.png` | same | 09 ask the crow (at the desk) |
| `crow-coin.png` | same | 10 the token |
| `walk.mp4` (filmed on solid green) | `walk.webm` + `walk.mp4` + `walk.json` | 07 the chart |

**Missing poses.** Until a pose exists, crow-hero stands in. On the seated screens (02, 05, 06, 09) he stands beside the chair instead of sitting in it; drop `crow-seated.png` or `crow-laptop.png` in and run `npm run assets`, and he sits. If crow-hero itself is missing, a dark labelled silhouette stands in.

**What `npm run assets` does**

- *Crow images:* removes the background (rembg), trims to the figure, shrinks to at most 2048px, and darkens the invisible pixels so no backdrop colour bleeds into the edges.
- *Backplates:* saves a web-sized JPEG and generates a depth map with Depth Anything V2 (small). The site displaces a mesh with it, so the photo gets real parallax when the cursor moves.
- *Walk cycle:* crops the generator's watermark off the bottom (staying below his feet), strips the audio, finds the two most alike frames at least half the clip apart and trims to that loop, crossfades the seam over six frames, keys out the green with spill suppression (the blue feathers keep their blue), and exports VP9 WebM with real transparency plus an H.264 MP4 on pure green for Safari, which is keyed in the browser. `walk.json` records the loop length and which frame is the "standing" one he rests on.

Outputs that are already newer than their source are skipped. `npm run assets -- --force` redoes everything.

**First run.** The script builds a private Python environment in `.venv-assets/` and installs rembg, onnxruntime and Pillow there (a few hundred MB, a few minutes), then downloads two models: rembg's (about 170 MB) and Depth Anything (about 100 MB). Nothing is installed system-wide; delete `.venv-assets/` to get the space back. The walk cycle also needs ffmpeg on the PATH (<https://ffmpeg.org/download.html>); without it the video is copied unprocessed.

- **No Python?** The script says so and stops. Install Python 3.10 or newer from <https://www.python.org/downloads/> (on Windows, tick "Add python.exe to PATH"), reopen the terminal, run it again.

**Reference images.** `reference-entry.png` and `crow-pixel-medium.png` in the project root are for comparison only. They are git-ignored and never part of the site.

**Placing the crow.** Each screen's entry in `src/gl/scenes.ts` says where his soles touch the floor (`feet`, as a fraction across and down the photo) and how tall he stands (`height`, a fraction of the frame). When his feet are hidden behind furniture, `depthAt` names a visible pixel at the same distance. Each also sets how he is lit to match the plate: `tint`, a `rim` light colour and the direction it comes from.

## Where things live

```
index.html              canvas, loader, entry, site chrome, lightbox
src/
  main.ts               boot order and wiring
  fx-config.ts          EVERY strength for the look: blocks, palette, dither, lens, entry particles
  screens.ts            the twelve screens: names, URL hashes, all the copy
  nav.ts                screen-by-screen navigation (wheel, keys, swipe, rail, hashes)
  boot.ts               loader → particle entry → fly-through into screen 01
  assets.ts             asset manifest: plates, crow poses, walk cycle, placeholders
  gl/
    engine.ts           renderer, two render modes (entry / site), camera, parallax, lens
    entry.ts            the particle field, sphere and rings, and its light post pass
    post.ts             the site pixel filter: blocks, contrast, palette dither, static, scanlines
    plate.ts            backplate-from-depth, crow compositing, dust, layers pinned to the photo
    scenes.ts           the twelve scenes, in page order
    ring.ts             the 3D meme ring (drag, inertia, snap)
  cursor.ts             ring + dot cursor
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
assets-raw/             your source files go here
public/assets/          what the site loads (written by npm run assets)
```

## The twelve screens

| # | Hash | Screen | Plate | Live layers |
|---|---|---|---|---|
| 01 | `#crow` | The crow | bg-01 spotlit floor, coins | dust in the beam |
| 02 | `#name` | Why the name | bg-02 office | lamp glow |
| 03 | `#stage` | On stage | bg-03 keynote stage | the big screen shows a slide; click it for the video lightbox |
| 04 | `#post` | The post | bg-04 penthouse | (the post itself is a card in the copy) |
| 05 | `#interview` | The interview | bg-05 fireside | firelight flickers on the room and on him |
| 06 | `#broadcast` | Broadcast | bg-06 news desk | six monitors, a scrolling ticker, a blinking ON AIR sign |
| 07 | `#chart` | The chart | bg-07 long wall | he walks the floor while the room scrolls past; the chart is drawn on the wall |
| 08 | `#cheers` | Cheers | bg-08 bar | pendant glow |
| 09 | `#ask` | Ask the crow | bg-09 desk by the window | laptop glow; question bubbles float up |
| 10 | `#token` | The token | bg-10 vault | the vault door swings a little further open as you scroll |
| 11 | `#memes` | The memes | bg-11 plinth | the meme ring circles him |
| 12 | `#flock` | Join the flock | bg-12 rooftop | crows sitting on the power lines |

Every screen also has dust that only shows where the photo is lit (so it gathers in light beams), haze on distant layers, a soft contact shadow under him, a touch of depth of field behind him, and slow camera breathing.

Copy for all of them is in `src/screens.ts`; wrap a phrase in `{{double braces}}` to highlight it in blue.

### Getting around

- **Wheel / trackpad.** Each screen holds for about 1.5 viewport-heights of scrolling, which drives its camera push-in and reveals its text. Keep pushing at the end and a one-second transition carries you to the next screen. Scrolling up does the reverse.
- **Keys.** Arrow down/up and Space step through a screen, then on to the next. Page Down/Up jump a whole screen. Home and End go to the first and last.
- **Touch.** One swipe, one screen; the screen's reveal then plays by itself.
- **Side rail.** Twelve numbered ticks on the right edge. The active screen's number and name show in blue; hover any other for its name; click to jump. On phones it becomes a slim strip.
- **Links.** Every screen has a hash (`…/#chart`), so links land on the right screen and the browser's Back and Forward buttons move between screens.
- **The chart (07).** Scrolling slides the room past; he walks at a speed that follows your scrolling, turns round if you scroll back, and when you stop he finishes his stride and rests on the standing frame.

## Tuning the look: `src/fx-config.ts`

| Setting | What it does |
|---|---|
| `blocksAt1080` | Block size: screen pixels per block at 1080px viewport height (scales with the viewport). 7 is the intended look |
| `palette` | The colours the picture is reduced to: near-black, greys, off-whites, blues, and three golds |
| `dither` | 0 = flat bands, 1 = full 4×4 Bayer dithering |
| `contrast`, `gamma`, `exposure` | Grading before the palette step (1.3 contrast and 0.8 gamma keep the crow's dark head readable) |
| `static`, `scanlines`, `split` | Per-pixel animated static, every-third-line darkening, red/blue offset in pixels |
| `vignette`, `glitch` | Corner darkening; strength of the transition tear |
| `lens.*` | The invisible cursor magnifier: diameter at 1080p, zoom, extra red/blue split, ripple |
| `parallax.*`, `breathing.*` | How the camera follows the cursor, and its slow handheld drift |
| `lite.blocksAt1080` | Block size in lite mode (bigger = smaller internal render) |
| `entry.*` | The particle entry: particle counts, cursor push, grain, diagonal scanlines, edge split |
| `dom.*` | The overlay on the text and UI: page static, page scanlines, headline RGB split, headline jitter |

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

`npm run og` (also the first step of `npm run build`) writes `public/og.png` and the home-screen icon. **The share image still shows the earlier drawn crow mascot** (`src/crow-art.ts`), not the crow-man; edit `scripts/og.mjs` to use `public/assets/crow/crow-hero.png` and a plate, or replace `public/og.png` by hand with a 1200×630 image and remove `og` from the build script.

Social crawlers need an absolute image URL, which is built from `VITE_SITE_URL`. See "Deploy" above for when you need to set it by hand. With it empty, `og:image` stays relative (`/og.png`), which is fine locally but will not unfurl on most platforms.

## Other things to swap

**Memes.** Drop image files (png, jpg, webp, gif, avif) into `src/memes/`. They are picked up automatically, sorted by filename, and replace the drawn placeholders one for one. Prefix with `01-`, `02-`… to set the order. Add alt text per file in the `ALT` map in `src/memes/index.ts`. Portrait 4:5 images fit the frames best.

**Music.** `src/audio.ts` synthesises three looping tracks. To add or change one, edit the `TRACKS` array (tempo, swing, chords as MIDI notes); its loudness is measured and matched automatically. Overall volume is `LEVEL`.

**Colours and type.** UI colours are tokens at the top of `src/style.css`; the 3D picture's colours are `palette` in `src/fx-config.ts`. Keep the two in step if you change the accent (search for `2f7bff`).

## Behaviour notes

- **Loader and entry.** The loader shows the brand, a big 000 → 100 counter and a status line while every scene is drawn once behind it (so nothing stutters later). At 100 it fades into a live particle field: a glowing sphere with two rings, "Enter" and "Enter without sound". Scrolling is locked until one is chosen; audio starts inside that click, as browsers require. On Enter the camera flies through the sphere and screen 01 comes up out of the flash.
- **Mouse.** Each photo has real depth, so the camera leaning toward the cursor gives true parallax (near things move more than far ones). An invisible lens around the cursor magnifies the picture slightly, with a little extra red/blue split; there is no visible outline. The cursor itself is a thin ring with a dot: the dot is exactly on the pointer, the ring follows with a little easing, grows over anything clickable, and dims over disabled controls. On the entry screen, particles near the cursor drift out of its way.
- **Touch.** No lens. The camera drifts slowly on its own, or follows device tilt on browsers that provide it without asking (not iOS).
- **Music.** One chain for all tracks: master gain → gentle compressor → limiter. Tracks are loudness-matched, crossfade on change, fade on mute, and pause while the tab is hidden. On iPhones the page declares itself as media playback so the music plays with the ringer switch on silent.
- **Lite mode.** For the first 1.5 seconds the site times its frames. A median under 30fps turns lite mode on: bigger blocks (a smaller internal render), no red/blue split and no lens ripple, and the page static stops animating. Pixelation and static stay. If the device then holds 50+ fps for 3 seconds, full quality returns. `?lite=1` and `?lite=0` override this.
- **Reduced motion.** With `prefers-reduced-motion`, there is no scroll-jacking: the twelve screens are an ordinary page that snaps one screen at a time, all copy is simply visible, the entry has no fly-through, and there is no lens, no glitch, no jitter and no moving static.
- **No WebGL.** The scenes need WebGL 2. Every current browser has it.

## Disclaimer

A fictional community art project. Not affiliated with any company. Nothing here is financial advice.
