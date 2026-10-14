import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'

const ASSETS = resolve(process.cwd(), 'public/assets')
const CROW_DIR = resolve(ASSETS, 'crow')
const BG_DIR = resolve(ASSETS, 'bg')
const list = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => /\.(png|jpe?g|mp4|webm|json)$/i.test(f)) : [])

/**
 * `virtual:crow-assets` tells the app which files exist in
 * public/assets/crow and public/assets/bg, so it can show a labelled
 * placeholder for the missing ones without firing off requests that 404. The
 * dev server reloads when a file is added or removed there.
 */
function crowAssets() {
  const id = 'virtual:crow-assets'
  return {
    name: 'crow-assets',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load(source) {
      if (source !== '\0' + id) return null
      return `export const available = ${JSON.stringify(list(CROW_DIR))}
export const plates = ${JSON.stringify(list(BG_DIR))}`
    },
    configureServer(server) {
      server.watcher.add(ASSETS)
      const refresh = (file) => {
        // Windows reports drive letters in either case, so compare case-insensitively.
        if (!resolve(file).toLowerCase().startsWith(ASSETS.toLowerCase())) return
        const mod = server.moduleGraph.getModuleById('\0' + id)
        if (mod) server.moduleGraph.invalidateModule(mod)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh).on('unlink', refresh)
    },
  }
}

/**
 * Share cards need an absolute image URL, built from VITE_SITE_URL.
 *
 * Order of preference:
 *   1. VITE_SITE_URL from .env or the host's environment settings
 *   2. the site URL the host provides at build time (Netlify: URL,
 *      Vercel: VERCEL_PROJECT_PRODUCTION_URL)
 *   3. empty, which leaves the image URL relative (fine for local work)
 */
export default defineConfig(({ mode }) => {
  const explicit = loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const hosted = process.env.URL || (vercel ? `https://${vercel}` : '')
  process.env.VITE_SITE_URL = (explicit || hosted || '').replace(/\/+$/, '')
  return { plugins: [crowAssets()] }
})
