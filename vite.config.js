import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'

const CROW_DIR = resolve(process.cwd(), 'public/assets/crow')

/**
 * `virtual:crow-assets` tells the app which files exist in
 * public/assets/crow, so it can show a labelled placeholder for the missing
 * ones without firing off requests that 404. The dev server reloads when a
 * file is added or removed there.
 */
function crowAssets() {
  const id = 'virtual:crow-assets'
  return {
    name: 'crow-assets',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load(source) {
      if (source !== '\0' + id) return null
      const files = existsSync(CROW_DIR) ? readdirSync(CROW_DIR).filter((f) => /\.(png|mp4|webm)$/i.test(f)) : []
      return `export const available = ${JSON.stringify(files)}`
    },
    configureServer(server) {
      server.watcher.add(CROW_DIR)
      const refresh = (file) => {
        // Windows reports drive letters in either case, so compare case-insensitively.
        if (!resolve(file).toLowerCase().startsWith(CROW_DIR.toLowerCase())) return
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
