/**
 * Every knob for the look, in one place. Change a number, save, and the dev
 * server reloads.
 *
 * Site screens: the 3D picture (photo backplate, crow, live layers) is
 * rendered small, then a full-screen shader (src/gl/post.ts) scales it into
 * blocks, lifts contrast, dithers it into `palette`, and adds static,
 * scanlines, red/blue offset and the cursor lens.
 *
 * Entry screen: the particle field has its own lighter treatment (`entry`).
 */
export const fx = {
  /** Block size: this many screen pixels at 1080px viewport height, scaled with the viewport. */
  blocksAt1080: 7,
  /** Never smaller than this many pixels, whatever the screen. */
  minBlock: 3,

  /**
   * The only colours the site screens may use (up to 16). Order doesn't matter.
   * Near-black, greys, off-whites, blues, and three golds for coins and firelight.
   */
  palette: [
    '#020308',
    '#12141E', '#2A2E3C', '#505668', '#8C92A0',
    '#D6DAE2', '#F5F6FA',
    '#0C1E5A', '#1A46C8', '#2F7BFF', '#8CB4FF',
    '#6E5420', '#C9A24A', '#E8CF8A',
  ],

  /** 0 = flat bands of colour, 1 = full 4×4 ordered (Bayer) dithering between them. */
  dither: 1,
  /** Brightness of the picture before the colour steps below. */
  exposure: 1.0,
  /** Contrast lift around mid-grey before quantizing. 1 = none. */
  contrast: 1.3,
  /** Gamma before quantizing. Below 1 opens up the shadows (keeps the crow's head readable). */
  gamma: 0.8,

  /** Animated static, per screen pixel, 0–1. */
  static: 0.06,
  /** Every third scanline is darkened by this much, 0–1. */
  scanlines: 0.18,
  /** Red and blue channels are offset by ± this many screen pixels. 0 turns it off. */
  split: 2,
  /** Darkening toward the corners, 0–1. */
  vignette: 0.35,
  /** Strength of the tear on screen transitions. 0 turns it off. */
  glitch: 1,

  /** The invisible magnifier that follows the cursor (mouse only). */
  lens: {
    /** Diameter in screen pixels at 1080px viewport height. */
    diameterAt1080: 110,
    /** Magnification at the centre. Fades smoothly to 1 at the edge. */
    zoom: 1.15,
    /** Extra red/blue offset at the centre, in screen pixels. */
    split: 2,
    /** Gentle ripple, as a fraction of the lens radius. */
    warp: 0.04,
  },

  /** Camera response to the cursor (or to auto-drift on touch screens). */
  parallax: {
    /** Sideways camera travel, in scene units (the nearest things in a plate sit ~2.5 away). */
    shift: 0.2,
    /** Vertical camera travel. */
    lift: 0.1,
    /** Seconds to catch up with the cursor. Higher = floatier. */
    lag: 0.45,
    /** Size of the automatic drift on touch devices, 0–1. */
    drift: 0.5,
  },

  /** Slow handheld "breathing" of the camera. */
  breathing: { amount: 0.025, speed: 0.22 },

  /** Lite mode (slow devices, or ?lite=1): cheaper settings. */
  lite: {
    /** Bigger blocks means a smaller internal render. */
    blocksAt1080: 10,
  },

  /** The particle entry screen. */
  entry: {
    /** Particles in the deep field. */
    field: 26000,
    /** Particles in the sphere and its rings. */
    sphere: 9000,
    /** How hard particles near the cursor are pushed away. */
    push: 0.06,
    grain: 0.07,
    /** Strength of the faint diagonal scanline texture. */
    scan: 0.07,
    /** Red/blue offset toward the edges, in pixels. */
    split: 2.2,
  },

  /** The overlay on top of text and UI, so the page matches the picture. */
  dom: {
    /** Opacity of the static over the whole page, 0–1. */
    grain: 0.08,
    /** Opacity of the page scanlines, 0–1. */
    scanlines: 0.12,
    /** Red/blue split on headlines, in px. 0 turns it off. */
    split: 2,
    /** 1 = headlines twitch now and then, 0 = they hold still. */
    jitter: 1,
  },
}

/** Block size in screen pixels for a viewport this tall. */
export const blockSize = (viewportHeight: number, lite = false) =>
  Math.max(fx.minBlock, Math.round(((lite ? fx.lite.blocksAt1080 : fx.blocksAt1080) * viewportHeight) / 1080))

export type Fx = typeof fx
