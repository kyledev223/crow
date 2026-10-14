/**
 * Every knob for the pixel / static look, in one place. Change a number,
 * save, and the dev server reloads.
 *
 * The 3D scene is rendered small, then a full-screen shader (src/gl/post.ts)
 * scales it up into blocks, dithers it into `palette`, and adds grain,
 * scanlines, colour fringing and the cursor lens. The `dom` block styles the
 * matching overlay that sits on top of the text and buttons.
 */
export const fx = {
  /** Block size in CSS pixels. 3–4 is the intended look; 1 turns pixelation off. */
  pixelSize: 3,

  /**
   * The only colours the 3D picture may use. Near-black, greys, off-white and
   * the blue accent. Exactly 8 entries (the shader's array is fixed-size).
   */
  palette: ['#020308', '#0d1120', '#232838', '#4b5266', '#8c93a6', '#edeef2', '#12357f', '#2f7bff'],

  /** 0 = flat bands of colour, 1 = full ordered (Bayer) dithering between them. */
  dither: 1,
  /** Overall brightness of the 3D picture before it is reduced to the palette. */
  exposure: 1.35,
  /** 0 = flat, 1 = punchy. Pushes darks down and lights up before the palette step. */
  contrast: 0.75,

  /** Animated static, 0–1. */
  grain: 0.05,
  /** Darkness of the scanlines, 0–1. */
  scanlines: 0.2,
  /** Red/blue fringing toward the screen edges. 0 turns it off. */
  chroma: 0.012,
  /** Darkening toward the corners, 0–1. */
  vignette: 0.55,
  /** Strength of the tear on screen transitions. 0 turns it off. */
  glitch: 1,

  /** The magnifying lens that follows the cursor (mouse only). */
  lens: {
    /** Radius as a fraction of the viewport height. */
    radius: 0.16,
    /** How much it magnifies, 0–1. */
    zoom: 0.32,
    /** Blocks inside the lens are this many times bigger. */
    pixel: 2,
    /** Extra red/blue split inside the lens. */
    chroma: 0.012,
    /** Ripple distortion inside the lens. */
    warp: 0.012,
  },

  /** Camera response to the cursor (or to auto-drift on touch screens). */
  parallax: {
    /** Sideways/vertical camera travel, in scene metres. */
    shift: 0.45,
    /** How far the look-at point follows, in scene metres. */
    tilt: 0.18,
    /** Seconds to catch up with the cursor. Higher = floatier. */
    lag: 0.35,
    /** Size of the automatic drift on touch devices, 0–1. */
    drift: 0.5,
  },

  /** Lite mode (slow devices, or ?lite=1): cheaper settings. */
  lite: {
    /** Bigger blocks means a smaller internal render. */
    pixelSize: 5,
  },

  /** The overlay on top of text and UI, so the page matches the picture. */
  dom: {
    /** Opacity of the static over the whole page, 0–1. */
    grain: 0.1,
    /** Opacity of the page scanlines, 0–1. */
    scanlines: 0.14,
    /** Red/blue split on headlines, in px. 0 turns it off. */
    split: 2,
    /** 1 = headlines twitch now and then, 0 = they hold still. */
    jitter: 1,
  },
}

export type Fx = typeof fx
