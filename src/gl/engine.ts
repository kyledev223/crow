import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { fx } from '../fx-config'
import { lite } from '../lite'
import { POST_FRAG, POST_VERT } from './post'

export type V3 = [number, number, number]

export interface Clickable {
  object: THREE.Object3D
  onClick(): void
}

/** One screen's 3D scene. Only the active stage is updated and rendered. */
export interface Stage {
  scene: THREE.Scene
  /** Camera travels from → to as the screen's scroll progress goes 0 → 1. */
  cam: { from: V3; to: V3; look: V3; fov: number }
  /** Where the subject stands. Narrow (phone) screens centre on this. */
  focus: V3
  /**
   * On phones the copy fills the lower part of the screen, so the scene is framed
   * higher by this fraction of the viewport (default 0.3). Lower it for screens
   * with little copy.
   */
  rise?: number
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
 * Owns the WebGL canvas: renders the active stage small, then runs the
 * pixel/static post pass over it. Everything animated from outside (scroll
 * progress, transitions, the boot sequence) goes through `state`.
 */
export function createEngine(canvas: HTMLCanvasElement, build: (env: THREE.Texture) => Stage[], opts: EngineOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  // The picture is deliberately blocky, so device pixel ratio buys nothing.
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.setClearColor(0x020308)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()

  const stages = build(env)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80)

  const target = new THREE.WebGLRenderTarget(4, 4, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  })
  target.texture.colorSpace = THREE.SRGBColorSpace

  const uniforms = {
    tScene: { value: target.texture },
    uRes: { value: new THREE.Vector2(1, 1) },
    uPx: { value: fx.pixelSize },
    uTime: { value: 0 },
    uExposure: { value: fx.exposure },
    uContrast: { value: fx.contrast },
    uGrain: { value: fx.grain },
    uScan: { value: fx.scanlines },
    uChroma: { value: fx.chroma },
    uVignette: { value: fx.vignette },
    uDither: { value: fx.dither },
    uGlitch: { value: 0 },
    uBoot: { value: 1 },
    uCrt: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector3(0, 0, 0) },
    uLens: { value: new THREE.Vector4(100, fx.lens.zoom, fx.lens.pixel, fx.lens.chroma) },
    uWarp: { value: fx.lens.warp },
    uPal: { value: fx.palette.map((hex) => new THREE.Color(hex).convertLinearToSRGB()) },
  }
  const postScene = new THREE.Scene()
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  postScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms, vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false }),
    ),
  )

  /** Values the rest of the app animates. */
  const state = {
    /** Scroll progress within the active screen, 0–1. */
    progress: 0,
    /** Transition dolly: +1 = pushed all the way in (leaving), −1 = pulled back (arriving). */
    dolly: 0,
    glitch: 0,
    /** 1 = loader static, 0 = picture. */
    boot: 1,
    crtX: 1,
    crtY: 1,
  }

  let active = 0
  let width = 1
  let height = 1
  let px = 0
  let portrait = false

  const pointer = { x: 0, y: 0, cx: 0, cy: 0, inside: false }
  const view = { x: 0, y: 0, lens: 0 }
  const tilt = { x: 0, y: 0, live: false }

  function resize() {
    width = window.innerWidth
    height = window.innerHeight
    portrait = width / height < 0.85
    px = Math.max(1, lite.on ? fx.lite.pixelSize : fx.pixelSize)
    renderer.setSize(width, height, false)
    target.setSize(Math.ceil(width / px), Math.ceil(height / px))
    uniforms.uRes.value.set(width, height)
    uniforms.uPx.value = px
    uniforms.uLens.value.x = fx.lens.radius * height
    camera.aspect = width / height
  }

  const from = new THREE.Vector3()
  const to = new THREE.Vector3()
  const look = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const ease = (t: number) => t * t * (3 - 2 * t)

  function placeCamera(stage: Stage) {
    const { cam, focus } = stage
    from.fromArray(cam.from)
    to.fromArray(cam.to)
    look.fromArray(cam.look)
    if (portrait) {
      // Recentre on the subject and step back so it fits a narrow frame.
      const dx = focus[0] - look.x
      from.x += dx
      to.x = focus[0]
      look.x = focus[0]
      from.z += 1.2
      to.z += 1.6
    }
    camera.fov = cam.fov * (portrait ? 1.25 : width / height < 1.25 ? 1.12 : 1)
    const rise = stage.rise ?? 0.3
    if (portrait) camera.setViewOffset(width, height * (1 + rise), 0, height * rise, width, height)
    else camera.clearViewOffset()
    camera.position.lerpVectors(from, to, ease(THREE.MathUtils.clamp(state.progress, 0, 1)))
    forward.subVectors(look, camera.position).normalize()
    right.crossVectors(forward, camera.up).normalize()
    camera.position.addScaledVector(forward, state.dolly * 1.1)
    camera.position.addScaledVector(right, view.x * fx.parallax.shift)
    camera.position.y += view.y * fx.parallax.shift * 0.5
    look.addScaledVector(right, view.x * fx.parallax.tilt)
    look.y += view.y * fx.parallax.tilt
    camera.lookAt(look)
    camera.updateProjectionMatrix()
  }

  let last = 0
  let running = false
  let warming: Stage[] = []
  let warmed: (() => void) | null = null
  function frame(now: number) {
    if (!running) return
    requestAnimationFrame(frame)
    const time = now / 1000
    const dt = Math.min(0.1, time - last)
    last = time

    const wantPx = lite.on ? fx.lite.pixelSize : fx.pixelSize
    if (wantPx !== px) resize()

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
    const lensOn = opts.finePointer && !opts.reduced && pointer.inside && state.boot < 0.5
    view.lens += ((lensOn ? 1 : 0) - view.lens) * (1 - Math.exp(-dt / 0.12))

    // Warm-up: draw one not-yet-seen scene per frame (see warm()).
    const cold = warming.shift()
    if (cold) {
      placeCamera(cold)
      renderer.setRenderTarget(target)
      renderer.render(cold.scene, camera)
      if (!warming.length) warmed?.()
    }

    const stage = stages[active]
    stage.update?.(time, dt, state.progress)
    placeCamera(stage)

    uniforms.uTime.value = opts.reduced ? 0 : time
    uniforms.uGlitch.value = opts.reduced ? 0 : state.glitch * fx.glitch
    uniforms.uBoot.value = state.boot
    uniforms.uCrt.value.set(state.crtX, state.crtY)
    uniforms.uMouse.value.set(pointer.cx, height - pointer.cy, view.lens)
    uniforms.uChroma.value = lite.on ? 0 : fx.chroma
    uniforms.uWarp.value = lite.on ? 0 : fx.lens.warp
    uniforms.uLens.value.w = lite.on ? 0 : fx.lens.chroma

    renderer.setRenderTarget(target)
    renderer.render(stage.scene, camera)
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

  return {
    state,
    stages,
    get active() {
      return active
    },
    start() {
      if (running) return
      running = true
      last = performance.now() / 1000
      requestAnimationFrame(frame)
    },
    setStage(index: number) {
      if (index === active) return
      stages[active].leave?.()
      active = index
      stages[active].enter?.()
    },
    /**
     * Draws every scene once, one per frame, so shaders are compiled and
     * textures and shadow maps are on the GPU before anyone visits them.
     * Without this each first visit stalls for 80–260ms mid-transition. Call
     * it while the loader's static is covering the picture.
     */
    warm(): Promise<void> {
      return new Promise((resolve) => {
        warming = stages.filter((_, i) => i !== active)
        warmed = resolve
      })
    },
    /** The clickable thing under a screen point in the active stage, if any. */
    pick(clientX: number, clientY: number): Clickable | null {
      const list = stages[active].clickables
      if (!list?.length) return null
      ndc.set((clientX / width) * 2 - 1, -((clientY / height) * 2 - 1))
      ray.setFromCamera(ndc, camera)
      for (const c of list) if (ray.intersectObject(c.object, true).length) return c
      return null
    },
    /** For the ?debug overlay. */
    info: () => `${target.width}×${target.height} px${px}`,
  }
}

export type Engine = ReturnType<typeof createEngine>
