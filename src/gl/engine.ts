import * as THREE from 'three'
import { blockSize, fx } from '../fx-config'
import { lite } from '../lite'
import { createEntry } from './entry'
import { FOV_Y, type PlateSpace } from './plate'
import { MAX_PALETTE, POST_FRAG, POST_VERT } from './post'

export interface Clickable {
  object: THREE.Object3D
  onClick(): void
}

/** One screen's scene. Only the active stage is updated and rendered. */
export interface Stage {
  scene: THREE.Scene
  /** The backplate's space: framing comes from the photo's shape. */
  space: PlateSpace
  /** Horizontal point (0–1 across the photo) to keep in view on narrow screens. */
  focus: number
  plate: THREE.Mesh
  update?(time: number, dt: number, progress: number): void
  clickables?: Clickable[]
  enter?(): void
  leave?(): void
}

export interface EngineOptions {
  reduced: boolean
  /** True on devices with a real mouse: enables parallax-from-cursor and the lens. */
  finePointer: boolean
}

/**
 * Owns the WebGL canvas. Two modes:
 *
 *   entry  the particle field, full resolution, its own light grain/scanlines
 *   site   the active screen's plate scene, rendered small and run through the
 *          pixel filter (post.ts)
 *
 * Everything animated from outside (scroll progress, transitions, the entry
 * fly-through) goes through `state` and `entry.state`.
 */
export function createEngine(canvas: HTMLCanvasElement, build: () => Stage[], opts: EngineOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  // The site picture is deliberately blocky and the entry is soft, so device pixel ratio buys nothing.
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x020308)

  const stages = build()
  const entry = createEntry(opts.reduced)
  const camera = new THREE.PerspectiveCamera(FOV_Y, 16 / 9, 0.05, 200)

  const siteTarget = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true })
  siteTarget.texture.colorSpace = THREE.SRGBColorSpace
  const entryTarget = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true })
  entry.post.uniforms.tScene.value = entryTarget.texture

  const palette = fx.palette.slice(0, MAX_PALETTE).map((hex) => new THREE.Color(hex).convertLinearToSRGB())
  while (palette.length < MAX_PALETTE) palette.push(palette[0].clone())
  const uniforms = {
    tScene: { value: siteTarget.texture },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPx: { value: 7 },
    uTime: { value: 0 },
    uExposure: { value: fx.exposure },
    uContrast: { value: fx.contrast },
    uGamma: { value: fx.gamma },
    uStatic: { value: fx.static },
    uScan: { value: fx.scanlines },
    uSplit: { value: fx.split },
    uVignette: { value: fx.vignette },
    uDither: { value: fx.dither },
    uGlitch: { value: 0 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color(0.86, 0.91, 1.0) },
    uMouse: { value: new THREE.Vector3(0, 0, 0) },
    uLens: { value: new THREE.Vector4(55, fx.lens.zoom, fx.lens.split, fx.lens.warp) },
    uPal: { value: palette },
    uPalCount: { value: Math.min(MAX_PALETTE, fx.palette.length) },
  }
  const quad = new THREE.PlaneGeometry(2, 2)
  const sitePost = new THREE.Mesh(quad, new THREE.ShaderMaterial({ uniforms, vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false }))
  const entryPost = new THREE.Mesh(quad, entry.post)
  sitePost.frustumCulled = entryPost.frustumCulled = false
  const postScene = new THREE.Scene()
  postScene.add(sitePost, entryPost)
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  /** Values the rest of the app animates. */
  const state = {
    mode: 'entry' as 'entry' | 'site',
    /** Scroll progress within the active screen, 0–1. */
    progress: 0,
    /** Transition dolly: +1 = pushed in (leaving), −1 = pulled back (arriving). */
    dolly: 0,
    glitch: 0,
    /** 1 = site picture washed to the flash colour (arriving from the entry screen). */
    fade: 0,
  }

  let active = 0
  let width = 1
  let height = 1
  let px = 7
  const pointer = { x: 0, y: 0, cx: 0, cy: 0, inside: false }
  const view = { x: 0, y: 0, lens: 0 }
  const tilt = { x: 0, y: 0, live: false }

  function resize() {
    width = window.innerWidth
    height = window.innerHeight
    px = blockSize(height, lite.on)
    renderer.setSize(width, height, false)
    siteTarget.setSize(Math.ceil(width / px), Math.ceil(height / px))
    entryTarget.setSize(width, height)
    uniforms.uRes.value.set(width, height)
    uniforms.uPx.value = px
    uniforms.uLens.value.x = (fx.lens.diameterAt1080 / 2) * (height / 1080)
    entry.resize(width, height)
  }

  /** Frames the photo to cover the viewport (with a margin for parallax), centred on the stage's focus. */
  function frame(stage: Stage) {
    const A = stage.space.plate.aspect
    const s = Math.max(width / A, height) * 1.07
    const full = A * s
    const x0 = THREE.MathUtils.clamp(stage.focus * full - width / 2, 0, full - width)
    camera.fov = FOV_Y
    camera.aspect = A
    camera.setViewOffset(full, s, x0, (s - height) / 2, width, height)
  }

  function placeCamera(stage: Stage, time: number) {
    frame(stage)
    const b = opts.reduced ? 0 : fx.breathing.amount
    const w = time * fx.breathing.speed * Math.PI * 2
    const p = THREE.MathUtils.clamp(state.progress, 0, 1)
    const ease = p * p * (3 - 2 * p)
    camera.position.set(
      view.x * fx.parallax.shift + Math.sin(w) * b,
      view.y * fx.parallax.lift + Math.sin(w * 1.3 + 1) * b * 0.6,
      -(ease * 0.45 + state.dolly * 0.6),
    )
    camera.rotation.set(0, 0, Math.sin(w * 0.7) * b * 0.04)
    camera.updateProjectionMatrix()
  }

  let last = 0
  let running = false
  let warming: Stage[] = []
  let warmed: (() => void) | null = null

  function loop(now: number) {
    if (!running) return
    requestAnimationFrame(loop)
    const time = now / 1000
    const dt = Math.min(0.1, time - last)
    last = time

    if (blockSize(height, lite.on) !== px) resize()

    // Where the camera leans: the cursor, device tilt, or a slow drift.
    let tx = pointer.x
    let ty = pointer.y
    if (opts.reduced) tx = ty = 0
    else if (!opts.finePointer) {
      tx = tilt.live ? tilt.x : Math.sin(time * 0.31) * fx.parallax.drift
      ty = tilt.live ? tilt.y : Math.cos(time * 0.23) * fx.parallax.drift * 0.6
    }
    const follow = 1 - Math.exp(-dt / fx.parallax.lag)
    view.x += (tx - view.x) * follow
    view.y += (ty - view.y) * follow
    const lensOn = opts.finePointer && !opts.reduced && pointer.inside && state.mode === 'site'
    view.lens += ((lensOn ? 1 : 0) - view.lens) * (1 - Math.exp(-dt / 0.15))

    // Warm-up: draw one not-yet-seen scene per frame (see warm()).
    const cold = warming.shift()
    if (cold) {
      placeCamera(cold, time)
      renderer.setRenderTarget(siteTarget)
      renderer.render(cold.scene, camera)
      if (!warming.length) warmed?.()
    }

    if (state.mode === 'entry') {
      entry.update(time, dt, opts.finePointer && pointer.inside ? { x: pointer.x, y: pointer.y } : null, { x: view.x, y: view.y })
      renderer.setRenderTarget(entryTarget)
      renderer.render(entry.scene, entry.camera)
      sitePost.visible = false
      entryPost.visible = true
    } else {
      const stage = stages[active]
      stage.update?.(time, dt, state.progress)
      placeCamera(stage, time)
      renderer.setRenderTarget(siteTarget)
      renderer.render(stage.scene, camera)
      uniforms.uTime.value = opts.reduced ? 0 : time
      uniforms.uGlitch.value = opts.reduced ? 0 : state.glitch * fx.glitch
      uniforms.uFade.value = state.fade
      uniforms.uMouse.value.set(pointer.cx, height - pointer.cy, view.lens)
      uniforms.uSplit.value = lite.on ? 0 : fx.split
      uniforms.uLens.value.z = lite.on ? 0 : fx.lens.split
      uniforms.uLens.value.w = lite.on ? 0 : fx.lens.warp
      sitePost.visible = true
      entryPost.visible = false
    }
    renderer.setRenderTarget(null)
    renderer.render(postScene, postCamera)
  }

  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return
    pointer.cx = e.clientX
    pointer.cy = e.clientY
    pointer.x = (e.clientX / width) * 2 - 1
    pointer.y = -((e.clientY / height) * 2 - 1)
    pointer.inside = true
  })
  document.documentElement.addEventListener('pointerleave', () => (pointer.inside = false))

  // Device tilt, only where the browser hands it over without asking (not iOS).
  type Gated = { requestPermission?: () => Promise<string> }
  if (!opts.finePointer && !opts.reduced && typeof DeviceOrientationEvent !== 'undefined') {
    if (typeof (DeviceOrientationEvent as unknown as Gated).requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma === null || e.beta === null) return
        tilt.live = true
        tilt.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1)
        tilt.y = THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1)
      })
    }
  }

  const ray = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  resize()
  // Compile both full-screen shaders now; otherwise the pixel filter compiles at
  // the moment the entry flies into screen 01 and that frame stalls.
  renderer.compile(postScene, postCamera)

  return {
    state,
    entry,
    stages,
    get active() {
      return active
    },
    start() {
      if (running) return
      running = true
      last = performance.now() / 1000
      requestAnimationFrame(loop)
    },
    setStage(index: number) {
      if (index === active) return
      stages[active].leave?.()
      active = index
      stages[active].enter?.()
    },
    /** Switch from the particle entry to the site screens. */
    showSite() {
      state.mode = 'site'
      stages[active].enter?.()
    },
    /**
     * Draws every scene once, one per frame, so shaders are compiled and
     * textures are on the GPU before anyone visits them. Without this each
     * first visit stalls mid-transition. Call it while the loader covers the page.
     */
    warm(): Promise<void> {
      return new Promise((resolve) => {
        warming = [...stages]
        warmed = resolve
      })
    },
    /** The clickable thing under a screen point in the active stage, if any. */
    pick(clientX: number, clientY: number): Clickable | null {
      if (state.mode !== 'site') return null
      const list = stages[active].clickables
      if (!list?.length) return null
      ndc.set((clientX / width) * 2 - 1, -((clientY / height) * 2 - 1))
      ray.setFromCamera(ndc, camera)
      for (const c of list) if (ray.intersectObject(c.object, true).length) return c
      return null
    },
    /** For the ?debug overlay. */
    info: () => (state.mode === 'entry' ? `entry · particles ${width}×${height}` : `${siteTarget.width}×${siteTarget.height} px${px}`),
  }
}

export type Engine = ReturnType<typeof createEngine>
