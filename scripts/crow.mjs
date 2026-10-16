/**
 * Builds public/assets/crow/crow.glb from the raw files in assets-raw/crow/.
 *
 *   npm run crow
 *
 * Drop new files into assets-raw/crow/ and run it again:
 *   - the Meshy model and/or Mixamo FBX exports (Mixamo names such as
 *     "Sitting Idle.fbx" are renamed to the site's slugs, see RENAMES)
 *   - crow-apose.png, the front image the model was generated from
 *
 * Steps: rename → Blender (scripts/crow/build.py: unwrap, project + bake the
 * texture, merge every clip onto one rig, export) → glTF-Transform (prune,
 * resample, quantize, meshopt) → public/assets/crow/crow.glb.
 * Previews of the bake (turntable, projection fit) go to assets-raw/crow/preview/.
 *
 * Needs Blender 4.2+. It is found via $BLENDER, then PATH, then the usual
 * install folders.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { dirname, join, resolve, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'assets-raw', 'crow')
const PREVIEW = join(SRC, 'preview')
const OUT = join(root, 'public', 'assets', 'crow', 'crow.glb')

/** Mixamo export name (lower case, no extension) → slug used by the site. */
const RENAMES = {
  'sitting idle': 'sitting-idle',
  cheering: 'cheering',
  walking: 'walking',
  'breathing idle': 'idle',
  'reaching out': 'reaching',
  'looking around': 'looking-up',
  drinking: 'toast',
  'texting while standing': 'typing',
  inspecting: 'looking-at-hand',
  waving: 'waving',
}

const log = (...a) => console.log('[crow]', ...a)

// ---- 1. rename -------------------------------------------------------------
if (!existsSync(SRC)) throw new Error(`Missing ${SRC}`)
for (const file of readdirSync(SRC)) {
  if (extname(file).toLowerCase() !== '.fbx') continue
  const stem = basename(file, extname(file)).toLowerCase().trim()
  const slug = RENAMES[stem]
  if (!slug || file === `${slug}.fbx`) continue
  const to = join(SRC, `${slug}.fbx`)
  const sameFile = file.toLowerCase() === `${slug}.fbx` // case-only rename (Windows/macOS see one file)
  if (!sameFile && existsSync(to) && statSync(to).mtimeMs >= statSync(join(SRC, file)).mtimeMs) {
    log(`skip rename ${file}: ${slug}.fbx is newer`)
    continue
  }
  if (sameFile) renameSync(join(SRC, file), to + '.tmp')
  renameSync(sameFile ? to + '.tmp' : join(SRC, file), to)
  log(`renamed "${file}" → ${slug}.fbx`)
}
if (!existsSync(join(SRC, 'crow-apose.png'))) throw new Error('Missing assets-raw/crow/crow-apose.png (the front image the model was made from)')

// ---- 2. Blender --------------------------------------------------------------
function findBlender() {
  if (process.env.BLENDER && existsSync(process.env.BLENDER)) return process.env.BLENDER
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['blender'], { encoding: 'utf8' })
  if (which.status === 0) return which.stdout.split(/\r?\n/)[0].trim()
  const dirs = [
    'C:/Program Files/Blender Foundation',
    join(homedir(), 'tools'),
    join(homedir(), 'AppData/Local/Programs'),
    '/Applications',
  ]
  for (const d of dirs) {
    if (!existsSync(d)) continue
    for (const sub of readdirSync(d).filter((s) => /blender/i.test(s)).sort().reverse()) {
      for (const exe of ['blender.exe', 'blender', 'Contents/MacOS/Blender']) {
        const p = join(d, sub, exe)
        if (existsSync(p)) return p
      }
    }
  }
  throw new Error('Blender not found. Install Blender 4.2+ or set BLENDER=/path/to/blender')
}

const blender = findBlender()
log('blender:', blender)
mkdirSync(PREVIEW, { recursive: true })
const tmp = join(tmpdir(), `crow-${process.pid}.glb`)
execFileSync(blender, ['-b', '--factory-startup', '-noaudio', '--python', join(root, 'scripts/crow/build.py'), '--', SRC, tmp, PREVIEW], {
  stdio: ['ignore', 'inherit', 'inherit'],
})
if (!existsSync(tmp)) throw new Error('Blender did not write the .glb')

// ---- 3. compress -------------------------------------------------------------
const { NodeIO } = await import('@gltf-transform/core')
const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions')
const { prune, dedup, resample, quantize, meshopt, weld } = await import('@gltf-transform/functions')
const { MeshoptEncoder, MeshoptDecoder } = await import('meshoptimizer')
await MeshoptEncoder.ready
await MeshoptDecoder.ready

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(tmp)
await doc.transform(dedup(), prune(), resample({ tolerance: 1e-4 }), weld(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
mkdirSync(dirname(OUT), { recursive: true })
await io.write(OUT, doc)
rmSync(tmp, { force: true })

const anims = doc.getRoot().listAnimations().map((a) => a.getName())
log(`wrote ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)} KB)`)
log('clips:', anims.join(', '))
log('previews:', PREVIEW)
