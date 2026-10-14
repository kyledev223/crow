/**
 * The full-screen pass that gives the site its look. Input is the 3D scene
 * rendered small (one texel per block). Order of operations:
 *
 *   CRT collapse → glitch tear → cursor lens → snap to blocks → colour fringe
 *   → exposure → vignette → static → reduce to palette (Bayer dither) → scanlines
 *
 * Strengths come from src/fx-config.ts via uniforms.
 */
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
uniform float uGrain;
uniform float uScan;
uniform float uChroma;
uniform float uVignette;
uniform float uDither;
uniform float uGlitch;    // 0..1 during screen transitions
uniform float uBoot;      // 1 = pure static (loader), 0 = picture
uniform vec2 uCrt;        // picture scale for the CRT turn-on, (1,1) = normal
uniform vec3 uMouse;      // xy in px from bottom-left, z = lens strength 0..1
uniform vec4 uLens;       // radius px, zoom, block multiplier, chroma
uniform float uWarp;
uniform vec3 uPal[8];

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

// Nearest two palette colours, mixed by the dither pattern.
vec3 toPalette(vec3 c, vec2 block) {
  float d1 = 1e9;
  float d2 = 1e9;
  vec3 c1 = uPal[0];
  vec3 c2 = uPal[0];
  for (int i = 0; i < 8; i++) {
    vec3 e = (c - uPal[i]) * vec3(0.9, 1.2, 0.8);
    float d = dot(e, e);
    if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = uPal[i]; }
    else if (d < d2) { d2 = d; c2 = uPal[i]; }
  }
  float a = sqrt(d1);
  float t = a / (a + sqrt(d2) + 1e-5);   // 0 = exactly c1, 0.5 = halfway
  return bayer4(block) < t * uDither ? c2 : c1;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;

  // CRT turn-on: the picture is squeezed toward a line, then let go.
  vec2 c = (uv - 0.5) / max(uCrt, vec2(0.002));
  if (abs(c.x) > 0.5 || abs(c.y) > 0.5) {
    gl_FragColor = vec4(uPal[0], 1.0);
    return;
  }
  uv = c + 0.5;
  float squeeze = 1.0 - min(uCrt.x, uCrt.y);

  // Glitch: horizontal bands slide sideways for a few frames.
  float tick = floor(uTime * 24.0);
  float band = floor(uv.y * 16.0 + hash(vec2(tick, 1.0)) * 8.0);
  float torn = step(0.5, hash(vec2(band * 1.7, tick + 3.0)));
  uv.x = fract(uv.x + (hash(vec2(band, tick)) - 0.5) * torn * 0.3 * uGlitch);

  // Cursor lens: magnify, ripple, bigger blocks, more fringe.
  vec2 m = uMouse.xy / uRes;
  vec2 d = (uv - m) * vec2(uRes.x / uRes.y, 1.0);
  float r = length(d) / (uLens.x / uRes.y);
  float inside = uMouse.z * step(r, 1.0);
  float k = uMouse.z * smoothstep(1.0, 0.35, r);
  uv = m + (uv - m) * (1.0 - uLens.y * k);
  uv += normalize(d + 1e-5) * sin(r * 12.0 - uTime * 4.0) * uWarp * k;

  float px = uPx * (1.0 + (uLens.z - 1.0) * inside);
  vec2 block = floor(uv * uRes / px);
  vec2 quv = (block + 0.5) * px / uRes;

  // Colour fringe: grows toward the edges, plus a fixed split inside the lens.
  vec2 dir = quv - 0.5;
  vec2 off = dir * (uChroma * dot(dir, dir) * 4.0 + uGlitch * 0.03) + vec2(uLens.w * inside, 0.0);
  vec3 col = vec3(
    texture2D(tScene, quv + off).r,
    texture2D(tScene, quv).g,
    texture2D(tScene, quv - off).b
  );

  col = 1.0 - exp(-col * uExposure);
  col = pow(col, vec3(1.0 / 2.2));
  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
  col *= 1.0 - uVignette * dot(dir, dir) * 1.6;

  // Lens rim
  col += inside * smoothstep(0.93, 1.0, r) * vec3(0.05, 0.14, 0.4);

  // Static
  float n = hash(block + fract(uTime) * vec2(37.0, 91.0));
  col += (n - 0.5) * uGrain;
  float snow = hash(block * 0.71 + fract(uTime * 1.31) * vec2(71.0, 13.0));
  col = mix(col, vec3(step(0.62, snow)) * vec3(0.75, 0.8, 0.95) + 0.03, uBoot);
  col += squeeze * squeeze * 0.9;

  col = toPalette(col, block);
  col *= 1.0 - uScan * step(mod(frag.y, 3.0), 0.99);

  gl_FragColor = vec4(col, 1.0);
}`
