/**
 * The site screens' full-screen pass. Input is the 3D picture rendered small
 * (one texel per block). For every screen pixel:
 *
 *   glitch tear → cursor lens (invisible magnifier) → which block am I in
 *   → tone, contrast ×1.3, gamma 0.8, vignette → reduce to the palette with a
 *   4×4 Bayer pattern → red/blue offset ±2px → static → every third scanline
 *
 * Strengths come from src/fx-config.ts via uniforms.
 */
export const MAX_PALETTE = 16

export const POST_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

export const POST_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D tScene;
uniform vec2 uRes;        // canvas size in px
uniform float uPx;        // block size in px
uniform float uTime;
uniform float uExposure;
uniform float uContrast;
uniform float uGamma;
uniform float uStatic;
uniform float uScan;
uniform float uSplit;     // red/blue offset in px
uniform float uVignette;
uniform float uDither;
uniform float uGlitch;    // 0..1 during screen transitions
uniform float uFade;      // 0 = picture, 1 = flat colour (used coming in from the entry screen)
uniform vec3 uFadeColor;
uniform vec3 uMouse;      // xy in px from bottom-left, z = lens strength 0..1
uniform vec4 uLens;       // radius px, zoom, extra split px, warp
uniform vec3 uPal[${MAX_PALETTE}];
uniform int uPalCount;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 4x4 ordered-dither threshold, built from two 2x2 patterns.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

// The colour a block shows: graded, then reduced to the palette.
vec3 blockColour(vec2 p) {
  vec2 block = floor(p / uPx);
  vec2 uv = (block + 0.5) * uPx / uRes;
  vec3 c = texture2D(tScene, clamp(uv, 0.0, 1.0)).rgb;

  c = 1.0 - exp(-c * uExposure * 1.6);
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c = (c - 0.5) * uContrast + 0.5;
  c = pow(clamp(c, 0.0, 1.0), vec3(uGamma));
  vec2 dir = uv - 0.5;
  c *= 1.0 - uVignette * dot(dir, dir) * 1.8;
  c += (hash(block + fract(uTime * 0.7) * vec2(17.0, 61.0)) - 0.5) * 0.04;

  float d1 = 1e9;
  float d2 = 1e9;
  vec3 c1 = uPal[0];
  vec3 c2 = uPal[0];
  for (int i = 0; i < ${MAX_PALETTE}; i++) {
    if (i >= uPalCount) break;
    vec3 e = (c - uPal[i]) * vec3(0.9, 1.15, 0.85);
    float d = dot(e, e);
    if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = uPal[i]; }
    else if (d < d2) { d2 = d; c2 = uPal[i]; }
  }
  float a = sqrt(d1);
  float t = a / (a + sqrt(d2) + 1e-5);   // 0 = exactly c1, 0.5 = halfway to c2
  return bayer4(block) < t * uDither ? c2 : c1;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = frag;

  // Glitch: horizontal bands slide sideways for a few frames.
  float tick = floor(uTime * 24.0);
  float band = floor(frag.y / uRes.y * 16.0 + hash(vec2(tick, 1.0)) * 8.0);
  float torn = step(0.5, hash(vec2(band * 1.7, tick + 3.0)));
  p.x += (hash(vec2(band, tick)) - 0.5) * torn * 0.3 * uRes.x * uGlitch;
  p.x = mod(p.x, uRes.x);

  // Lens: magnifies gently toward the cursor, fading smoothly to nothing at the edge. No rim.
  vec2 d = p - uMouse.xy;
  float r = length(d) / uLens.x;
  float k = uMouse.z * (1.0 - smoothstep(0.0, 1.0, r));
  k *= k * (3.0 - 2.0 * k);
  p = uMouse.xy + d / mix(1.0, uLens.y, k);
  p += normalize(d + 1e-5) * sin(r * 9.0 - uTime * 3.0) * uLens.w * uLens.x * k;

  // Red and blue come from blocks a couple of pixels to either side.
  float split = uSplit + uLens.z * k + uGlitch * 6.0;
  vec3 col;
  if (split > 0.01) {
    col = vec3(
      blockColour(p + vec2(split, 0.0)).r,
      blockColour(p).g,
      blockColour(p - vec2(split, 0.0)).b
    );
  } else {
    col = blockColour(p);
  }

  col += (hash(frag + fract(uTime) * vec2(71.0, 13.0)) - 0.5) * uStatic;
  col *= 1.0 - uScan * step(mod(floor(frag.y), 3.0), 0.5);
  col = mix(col, uFadeColor, uFade);

  gl_FragColor = vec4(col, 1.0);
}`
