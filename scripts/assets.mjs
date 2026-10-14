/**
 * `npm run assets`: turns the images in assets-raw/ into transparent cutouts
 * in public/assets/crow/ (background removed, trimmed, max 2048px).
 *
 * The work is done by rembg, a Python tool. To keep it away from the rest of
 * your system, this script builds a private Python environment in
 * .venv-assets/ the first time and installs rembg there. Nothing is
 * installed globally. Delete that folder any time to reclaim the space.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const raw = join(root, 'assets-raw')
const out = join(root, 'public', 'assets', 'crow')
const venv = join(root, '.venv-assets')
const venvPython = process.platform === 'win32' ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python')

const EXPECTED = ['crow-hero', 'crow-seated', 'crow-stage', 'crow-phone', 'crow-toast', 'crow-laptop', 'crow-coin']

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', ...opts })
const quiet = (cmd, args) => spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' })
const fail = (message) => {
  console.error('\n' + message + '\n')
  process.exit(1)
}

mkdirSync(raw, { recursive: true })
if (!readdirSync(raw).some((f) => /\.(png|jpe?g|webp|bmp|tiff?|mp4|webm)$/i.test(f))) {
  console.log(`\nassets-raw/ is empty. Drop your source images in there, named for the slot they fill:\n`)
  for (const name of EXPECTED) console.log(`  ${name}.png   (or .jpg / .webp)`)
  console.log(`  walk.mp4        (walk cycle on solid green; copied as is)\n\nThen run "npm run assets" again.\n`)
  process.exit(0)
}

// ---- 1. find a Python ----------------------------------------------------------
function findPython() {
  const candidates = process.platform === 'win32' ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]]
  for (const [cmd, pre] of candidates) {
    const r = quiet(cmd, [...pre, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'])
    if (r.status === 0 && /^\d+\.\d+/.test(r.stdout.trim())) return { cmd, pre, version: r.stdout.trim() }
  }
  return null
}

if (!existsSync(venvPython)) {
  const py = findPython()
  if (!py) {
    fail(
      `Python was not found, and "npm run assets" needs it for background removal.\n\n` +
        `  1. Install Python 3.10–3.13 from https://www.python.org/downloads/\n` +
        `     (on Windows, tick "Add python.exe to PATH" in the installer).\n` +
        `  2. Close and reopen the terminal.\n` +
        `  3. Run "npm run assets" again.\n\n` +
        `Or skip this tool: any transparent PNG saved as public/assets/crow/<name>.png works.`,
    )
  }
  console.log(`\nSetting up a private Python environment in .venv-assets/ (Python ${py.version}). One time only.\n`)
  if (run(py.cmd, [...py.pre, '-m', 'venv', venv]).status !== 0) fail('Could not create the Python environment in .venv-assets/.')
}

// ---- 2. make sure rembg is in it -------------------------------------------------
if (quiet(venvPython, ['-c', 'import rembg, PIL, onnxruntime']).status !== 0) {
  console.log('Installing rembg (background removal). This downloads a few hundred MB and takes a few minutes…\n')
  run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', '--quiet'])
  const install = run(venvPython, ['-m', 'pip', 'install', 'rembg[cpu]', 'pillow'])
  if (install.status !== 0 || quiet(venvPython, ['-c', 'import rembg, PIL, onnxruntime']).status !== 0) {
    const v = quiet(venvPython, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])']).stdout.trim()
    fail(
      `rembg could not be installed on Python ${v}.\n\n` +
        `This usually means rembg (or onnxruntime, which it needs) has not published a build for that\n` +
        `Python version yet. Python 3.10–3.13 are known to work:\n\n` +
        `  1. Install Python 3.12 from https://www.python.org/downloads/ alongside your current one.\n` +
        `  2. Delete the .venv-assets folder.\n` +
        `  3. Run "npm run assets" again (on Windows, "py -3.12 -m venv .venv-assets" first makes it use 3.12).\n\n` +
        `Or skip this tool: any transparent PNG saved as public/assets/crow/<name>.png works.`,
    )
  }
}

// ---- 3. cut out ---------------------------------------------------------------------
console.log(`\nassets-raw/  →  public/assets/crow/\n`)
const done = run(venvPython, [join(root, 'scripts', 'assets.py'), raw, out])
if (done.status !== 0) fail('Background removal failed. The message above says why.')

const have = new Set(readdirSync(out))
const missing = [...EXPECTED.map((n) => n + '.png'), 'walk.mp4'].filter((f) => !have.has(f))
console.log(missing.length ? `\nStill missing (the site shows a labelled placeholder for these): ${missing.join(', ')}\n` : '\nAll expected assets are present.\n')
